import { COURSES } from '../data/courses.js';

/** Custom courses first; a corrected copy of a built-in course hides the original. */
export function allCourses(state) {
  const custom = Object.values(state.customCourses || {});
  const replaced = new Set(custom.map(c => c.replaces).filter(Boolean));
  return [...custom, ...COURSES.filter(c => !replaced.has(c.id))];
}

export function findCourse(state, id) {
  return allCourses(state).find(c => c.id === id) || null;
}

export function coursePar(course) {
  return course.holes.reduce((a, h) => a + (h.par || 0), 0);
}


const TEE_HEX = { black: '#1a1a1a', blue: '#2f6fd6', white: '#f2f2f2', red: '#d64545', silver: '#b8bcc2', gold: '#d4af37', green: '#2c8c66' };

/** Dot colour for a tee; split tees like "Black/Blue" get both halves. */
export function teeDotStyle(tee) {
  const parts = tee.name.toLowerCase().split('/').map(s => TEE_HEX[s.trim()]).filter(Boolean);
  if (parts.length === 2) return { background: `linear-gradient(90deg, ${parts[0]} 50%, ${parts[1]} 50%)` };
  return { background: tee.color || parts[0] || '#999' };
}
