// Which look this phone is on, for the few places a look changes what's drawn rather than how it's
// styled. main.jsx sets it on <html> before the first render, and it only changes with a reload.
//   ?look=gooddog: the Good Dog trial (2026-10-29) on top of the overhaul look, <html data-skin="gooddog">
import { initialsOf } from './avatars.js';

export const isGoodDog = () => typeof document !== 'undefined' && document.documentElement.dataset.skin === 'gooddog';

/** The Good Dog trial has no faces: a Ball buddy carries two initials to show instead (Avatar.jsx). */
export const gdModel = (m, name) => (isGoodDog() && m?.kind === 'buddy' ? { ...m, text: initialsOf(name, 2) } : m);
