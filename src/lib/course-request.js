// "Request this course": when the course picker finds nothing, one tap sends the name the
// golfer typed (plus an optional city and scorecard photo) as a missing-course suggestion in the
// feedback table. This file is the plain logic: the message it sends and the "already asked"
// memory that stops one phone sending the same course twice. Storage is passed in so tests can
// use a plain object; the app passes localStorage.

const MAX_REMEMBERED = 100;

// Words that don't tell two courses apart, so "Birch Creek GC" and "birch creek golf course"
// count as one request. Only dropped from the end of the name.
const TAIL_WORDS = new Set(['golf', 'course', 'club', 'gc', 'cc', 'gcc', 'country', 'links']);

/** A course name reduced to what matters for "is this the same request?". */
export function courseRequestKey(name) {
  const words = String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/\bg\s*&\s*cc\b/g, ' gcc ') // "G&CC", golf and country club
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && TAIL_WORDS.has(words[words.length - 1])) words.pop();
  if (words[0] === 'the' && words.length > 1) words.shift();
  return words.join(' ');
}

/** The tidy name to send: what they typed, trimmed, with spaces squeezed. */
export function cleanCourseName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * What goes to submitFeedback. `query` is the search text exactly as typed and `from` the
 * sender's name on this phone.
 */
export function courseRequestPayload({ name, city = '', query = name, from = null, image = null, roundId = null }) {
  const n = cleanCourseName(name);
  const c = String(city || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const details = { request: 'missing-course', source: 'course-search', name: n, query: String(query || '').slice(0, 200), key: courseRequestKey(n), from };
  if (c) details.city = c;
  return { kind: 'course', body: c ? `${n}, ${c}` : n, details, image, roundId };
}

/** Is this name worth sending? Two letters or more after tidying. */
export function canRequestCourse(name) {
  return courseRequestKey(name).replace(/ /g, '').length >= 2;
}

/** Read this phone's earlier requests: [{ key, name, at }], newest last. */
export function readCourseRequests(storage, storageKey) {
  try {
    const list = JSON.parse(storage.getItem(storageKey));
    return Array.isArray(list) ? list.filter(x => x && typeof x.key === 'string') : [];
  } catch { return []; }
}

/** The earlier request for this name, or null. */
export function findCourseRequest(storage, storageKey, name) {
  const key = courseRequestKey(name);
  if (!key) return null;
  return readCourseRequests(storage, storageKey).find(x => x.key === key) || null;
}

/** Remember a request so the same phone doesn't send it again. Returns the saved entry. */
export function rememberCourseRequest(storage, storageKey, name, at = Date.now()) {
  const entry = { key: courseRequestKey(name), name: cleanCourseName(name), at };
  const list = readCourseRequests(storage, storageKey).filter(x => x.key !== entry.key);
  try { storage.setItem(storageKey, JSON.stringify([...list, entry].slice(-MAX_REMEMBERED))); } catch { /* storage full */ }
  return entry;
}

/**
 * Which card to show for the name in the search box. `done` is what this card last sent
 * ({ status, entry }), kept while the search still reads the same, and `earlier` the phone's earlier request for this name, if any.
 * Resolves to null (the request form) or { status: 'sent' | 'queued' | 'already', entry }, and
 * always carries the entry, so the "already" card has a name and a date even when it came from
 * this card's own send (a second tap that lost the race to the first).
 */
export function courseRequestView({ done = null, name, earlier = null }) {
  if (done && done.entry && done.entry.name === cleanCourseName(name)) return done;
  return earlier ? { status: 'already', entry: earlier } : null;
}

/**
 * Send a request once per phone per course. `submit` is submitFeedback (or a stand-in in tests).
 * Resolves to { status: 'sent' | 'queued' | 'already', entry }. A name already requested here
 * is never sent again; a failed send still counts, since the feedback queue keeps it.
 */
export async function requestCourse({ storage, storageKey, submit, name, city, query, from, image, roundId, now = Date.now() }) {
  const before = findCourseRequest(storage, storageKey, name);
  if (before) return { status: 'already', entry: before };
  const payload = courseRequestPayload({ name, city, query, from, image, roundId });
  // Remembered before sending, so a double tap can't send two
  const entry = rememberCourseRequest(storage, storageKey, name, now);
  let status;
  try { status = await submit(payload); } catch { status = 'queued'; }
  return { status: status === 'sent' ? 'sent' : 'queued', entry };
}
