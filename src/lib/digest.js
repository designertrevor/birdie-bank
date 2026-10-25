// The weekly feedback digest (?digest, Trevor's account only): the ideas sent in over the last week,
// grouped by theme, each with Approve or Skip, and the approved ones as a note to paste into a Claude
// session so they go into ROADMAP.md in the right area. The server decides who may read it
// (supabase/2026-10-12-feedback-digest.sql); this file is the plain logic. No storage, no network.

/** The roadmap's areas by number (ROADMAP.md "The checklist by area"), for the area picker. */
export const ROADMAP_AREAS = {
  1: 'Accounts and cloud data', 2: 'Profiles', 3: 'Onboarding', 4: 'Invites and joining',
  5: 'Setting up and playing a round', 6: 'Courses', 7: 'The tab and settling up', 8: 'History and stats',
  9: 'Social and community', 10: 'Leagues and events', 11: 'Upgrading and paywalls', 12: 'Notifications',
  13: 'Distribution', 14: 'Trust and legal', 15: 'Behind the scenes', 16: 'Brand and identity',
  17: 'Brand assets you can share', 18: 'Website', 19: 'App Store presence', 20: 'Feedback, roadmap and community',
  21: 'Between rounds (the week)', 22: 'Creator marketing', 23: 'Partners and the real world', 24: 'Visual design pass',
};

/**
 * The themes, in the order they're tried. A course request or a new game is its own theme by kind;
 * a feature or bug goes by the first theme whose words it mentions. `area` is the guess for where it
 * goes on the roadmap (Trevor can change it before approving).
 */
export const THEMES = [
  { id: 'games', label: 'New games', area: 5, kinds: ['game'] },
  { id: 'courses', label: 'Courses', area: 6, kinds: ['course'] },
  { id: 'money', label: 'Money and the Tab', area: 7, words: ['tab', 'pay', 'paid', 'owe', 'settle', 'venmo', 'cash app', 'zelle', 'paypal', 'money', 'bet', 'stake', 'carry', 'dollar', '$'] },
  { id: 'stats', label: 'History and stats', area: 8, words: ['history', 'stat*', 'handicap', 'record', 'season', 'average', 'trend', 'best round'] },
  { id: 'trips', label: 'Trips and planning', area: 21, words: ['trip', 'plan', 'tee time', 'schedule', 'calendar', 'rsvp', 'weekend', 'next round'] },
  { id: 'social', label: 'Friends and groups', area: 9, words: ['friend', 'group', 'crew', 'feed', 'comment', 'trash talk', 'share', 'social'] },
  { id: 'invites', label: 'Invites and joining', area: 4, words: ['invite', 'join', 'link', 'code', 'qr'] },
  { id: 'leagues', label: 'Leagues and events', area: 10, words: ['league', 'event', 'tournament', 'member-guest', 'member guest', 'outing'] },
  { id: 'alerts', label: 'Notifications', area: 12, words: ['notif*', 'push', 'remind*', 'alert'] },
  { id: 'profile', label: 'Profiles and accounts', area: 2, words: ['profile', 'avatar', 'account', 'sign in', 'login', 'log in', 'photo'] },
  { id: 'scoring', label: 'Scoring and rounds', area: 5, words: ['score', 'hole', 'round', 'scorecard', 'putt', 'par', 'strokes', 'game'] },
];
const OTHER = { id: 'other', label: 'Everything else', area: 20 };
const BUGS = { id: 'bugs', label: 'Something broken', area: 20 };

/** The kinds that are ideas to approve. Reactions ("Great", "Just OK") are counted, not listed. */
export const IDEA_KINDS = ['game', 'course', 'feature', 'bug'];

const lower = v => String(v ?? '').toLowerCase();

/** The text an idea is matched on: what they wrote plus the short fields of the form. */
function ideaText(row) {
  const d = row?.details && typeof row.details === 'object' ? row.details : {};
  const extra = Object.entries(d).filter(([k, v]) => k !== 'from' && typeof v === 'string').map(([, v]) => v);
  return lower([row?.body, ...extra].join(' '));
}

/**
 * Whether `text` mentions `word`: the whole word (or its -s, -es, -ed, -ing), any word starting with
 * it for a word ending in *, and a plain find for a symbol like $.
 */
function mentions(text, word) {
  if (!/^[a-z]/.test(word)) return text.includes(word);
  const prefix = word.endsWith('*');
  const w = (prefix ? word.slice(0, -1) : word).replace(/[.+?^${}()|[\]\\-]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z])${w}${prefix ? '' : '(s|es|ed|ing)?([^a-z]|$)'}`);
  return re.test(text);
}

/** The theme for one feedback row: { id, label, area }. Bugs are their own group whatever they say. */
export function themeOf(row) {
  const kind = row?.kind;
  if (kind === 'bug') return BUGS;
  const byKind = THEMES.find(t => t.kinds?.includes(kind));
  if (byKind) return byKind;
  const text = ideaText(row);
  return THEMES.find(t => t.words?.some(w => mentions(text, w))) || OTHER;
}

/** The area an approval goes to: Trevor's pick, else the theme's guess. A string, as the server keeps it. */
export function areaFor(row) {
  const a = row?.area != null && ROADMAP_AREAS[Number(row.area)] ? Number(row.area) : themeOf(row).area;
  return String(a);
}

/**
 * The week's ideas as groups: [{ id, label, area, items, waiting }], biggest first, with Something
 * broken and Everything else at the end. `waiting` counts the ones with no call yet. Rows that
 * aren't ideas (reactions) are left out; `reactions` counts them by label.
 */
export function groupDigest(rows) {
  const groups = new Map();
  const reactions = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') continue;
    const sentAs = r.details?.sentAs;
    if (r.kind === 'reaction' || sentAs === 'reaction') {
      const label = String(r.body || 'Reaction').slice(0, 40);
      reactions[label] = (reactions[label] || 0) + 1;
      continue;
    }
    if (!IDEA_KINDS.includes(r.kind)) continue;
    const t = themeOf(r);
    if (!groups.has(t.id)) groups.set(t.id, { id: t.id, label: t.label, area: t.area, items: [], waiting: 0 });
    const g = groups.get(t.id);
    g.items.push(r);
    if (!r.decision) g.waiting++;
  }
  const last = id => (id === 'other' ? 2 : id === 'bugs' ? 1 : 0);
  const list = [...groups.values()].sort((a, b) => last(a.id) - last(b.id) || b.items.length - a.items.length || a.label.localeCompare(b.label));
  for (const g of list) g.items.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return { groups: list, reactions, waiting: list.reduce((n, g) => n + g.waiting, 0), total: list.reduce((n, g) => n + g.items.length, 0) };
}

/** One line of an idea, squeezed: no line breaks, at most `max` characters. */
export function oneLine(v, max = 240) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
}

/** The form's second answer, shown under an idea: a game's rules, a course's city, why, what was expected. */
const DETAIL_KEYS = ['rules', 'money', 'city', 'note', 'why', 'expected'];
export function ideaDetail(row) {
  const d = row?.details && typeof row.details === 'object' ? row.details : {};
  const body = String(row?.body ?? '').trim();
  return DETAIL_KEYS.map(k => (typeof d[k] === 'string' ? d[k].trim() : '')).filter(v => v && v !== body).join(' · ');
}

const KIND_WORD = { game: 'new game', course: 'missing course', feature: 'feature', bug: 'bug' };

/**
 * The approved ideas as a note to paste into a Claude session: grouped by area, each with its words,
 * its kind and day, Trevor's note and its id (so it can be marked added). `today` is YYYY-MM-DD.
 */
export function approvedNote(rows, today) {
  const list = (Array.isArray(rows) ? rows : []).filter(r => r && r.id);
  if (!list.length) return '';
  const byArea = new Map();
  for (const r of list) {
    const a = Number(areaFor(r));
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a).push(r);
  }
  const out = [
    `Feedback digest approvals (${today}). Add each one to ROADMAP.md as a new unchecked line in its area,`,
    'in your own words, with a step tag (S1 to S5). Then tell me, and I will mark them added in the Digest.',
    '',
  ];
  for (const a of [...byArea.keys()].sort((x, y) => x - y)) {
    out.push(`Area ${a}, ${ROADMAP_AREAS[a]}:`);
    for (const r of byArea.get(a)) {
      const day = String(r.created_at || '').slice(0, 10);
      const course = r.kind === 'course' && r.details?.city ? ` (${oneLine(r.details.city, 60)})` : '';
      const note = r.note ? ` Trevor’s note: ${oneLine(r.note, 300)}` : '';
      out.push(`- "${oneLine(r.body)}"${course}. A ${KIND_WORD[r.kind] || r.kind}, sent ${day}.${note} [${r.id}]`);
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}

/** The Monday push to Trevor: { title, body, url, tag }, or null when nothing waits. */
export function digestPush(waiting) {
  const n = Math.floor(Number(waiting) || 0);
  if (n <= 0) return null;
  return {
    title: 'Your weekly feedback digest',
    body: n === 1 ? '1 idea from the last 7 days is waiting for a yes or a no.' : `${n} ideas from the last 7 days are waiting for a yes or a no.`,
    url: '/?digest',
    tag: 'digest',
  };
}

/** How long ago a sent time was, short: "today", "yesterday", "3 days ago". `now` in ms. */
export function sentAgo(at, now = Date.now()) {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((startOfDay(now) - startOfDay(t)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }

/** Whether a server error means the digest SQL hasn't run (no such function) rather than "not allowed". */
export function digestOff(error) {
  const code = error?.code || '';
  return code === 'PGRST202' || code === '42883' || /could not find the function|does not exist/i.test(error?.message || '');
}
/** Whether a server error means this account isn't an admin. */
export function digestDenied(error) {
  return error?.code === '42501' || /not allowed/i.test(error?.message || '');
}
