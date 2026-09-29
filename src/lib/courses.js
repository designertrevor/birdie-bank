import { COURSES } from '../data/courses.js';

/** Custom courses first; a corrected copy of a built-in course hides the original. */
export function allCourses(state) {
  const custom = Object.values(state.customCourses || {});
  const replaced = new Set(custom.map(c => c.replaces).filter(Boolean));
  return [...custom, ...COURSES.filter(c => !replaced.has(c.id))];
}

export function findCourse(state, id) {
  const list = allCourses(state);
  // A built-in course you corrected is found by its old id too, so rounds and plans made on it still find it
  return list.find(c => c.id === id) || list.find(c => id && c.replaces === id) || null;
}

/**
 * A fix made to one hole mid-round, saved into this phone's copy of the course so the next round
 * there starts right. `courseIdx` is the hole on the card; `par` and `hdcp` are the new values
 * (null leaves one as it is). `builtIn`: the course came with the app (not in customCourses). A stroke index another hole on the card already has swaps the two,
 * so the card never has one twice. Returns { id, course } to put in customCourses: a built-in
 * course becomes a corrected copy that hides the original (as the course editor does), and a
 * course from the database is marked edited. Null when there's nothing to change.
 */
export function courseWithHoleFix(course, courseIdx, { par = null, hdcp = null } = {}, { builtIn = false } = {}) {
  const h = course?.holes?.[courseIdx];
  if (!h) return null;
  const holes = course.holes.map(x => ({ ...x }));
  let changed = false;
  if (par != null && par !== h.par) { holes[courseIdx].par = par; changed = true; }
  if (hdcp != null && hdcp !== h.hdcp) {
    const other = holes.findIndex((x, i) => i !== courseIdx && x.hdcp === hdcp);
    if (other >= 0) holes[other].hdcp = h.hdcp ?? null;
    holes[courseIdx].hdcp = hdcp;
    changed = true;
  }
  if (!changed) return null;
  if (builtIn) {
    const id = `${course.id}-custom`;
    return { id, builtInId: course.id, course: { ...course, id, holes, custom: true, verified: false, replaces: course.id } };
  }
  return { id: course.id, course: { ...course, holes, ...(course.source === 'golfcourseapi' ? { edited: true } : {}) } };
}

export function coursePar(course) {
  return course.holes.reduce((a, h) => a + (h.par || 0), 0);
}


const TEE_HEX = { black: '#1a1a1a', blue: '#2f6fd6', white: '#f2f2f2', red: '#d64545', silver: '#b8bcc2', gold: '#d4af37', green: '#2c8c66', yellow: '#e8c547', orange: '#e8873a', purple: '#7b4fc9' };

/**
 * Dot colour for a tee; split tees like "Black/Blue" get both halves. Extras from the
 * course database such as "Red (W)" or "Blue Tees" still find their colour.
 */
export function teeDotStyle(tee) {
  const base = tee.name.toLowerCase().replace(/\(.*?\)/g, '').replace(/\btees?\b/g, '');
  const parts = base.split('/').map(s => TEE_HEX[s.trim()]).filter(Boolean);
  if (parts.length === 2) return { background: `linear-gradient(90deg, ${parts[0]} 50%, ${parts[1]} 50%)` };
  return { background: tee.color || parts[0] || '#999' };
}

/**
 * The tag under a course in lists, or null for a bundled course whose scorecard is trusted:
 * { text, soft }. A course from the database always says so, softly, since the group can still fix it.
 */
export function courseTag(c) {
  if (c.source === 'golfcourseapi') return c.edited ? { text: 'Edited by you', soft: true } : { text: 'From course database', soft: true };
  if (c.verified) return null;
  return c.custom ? { text: 'Added by you', soft: true } : { text: 'Scorecard not checked yet', soft: false };
}

/** The tag's words alone (kept for screens that show it as plain text). */
export function courseWarning(c) {
  return courseTag(c)?.text || null;
}

/**
 * The tee picked for a player until someone changes it. Database courses list every set of
 * tees, so they start on the middle men's tee (by rating when known) rather than the tips.
 */
export function defaultTee(course) {
  const tees = course?.tees || [];
  if (!tees.length) return null;
  if (course.source !== 'golfcourseapi') return tees[0];
  const men = tees.filter(t => !/\(W\)$/.test(t.name));
  const pool = men.length ? men : tees;
  const sorted = pool.every(t => t.rating != null) ? [...pool].sort((a, b) => b.rating - a.rating) : pool;
  return sorted[Math.floor((sorted.length - 1) / 2)];
}
