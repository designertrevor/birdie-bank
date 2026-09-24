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

export function teeYards(tee) {
  return tee?.yards?.every(y => y != null) ? tee.yards.reduce((a, b) => a + b, 0) : null;
}
