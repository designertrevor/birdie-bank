// When this copy of the app was built (ms), stamped by vite.config.js. 0 in dev and in tests,
// which the update check reads as "say nothing" (see isNewerBuild in app-update.js).
/* global __APP_BUILT__ */
export const BUILT = typeof __APP_BUILT__ === 'number' ? __APP_BUILT__ : 0;
