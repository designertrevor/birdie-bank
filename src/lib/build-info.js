// When this copy of the app was built (ms), stamped by vite.config.js. 0 in dev and in tests,
// which the update check reads as "say nothing" (see isNewerBuild in app-update.js).
/* global __APP_BUILT__, __APP_BUILD_ID__ */
export const BUILT = typeof __APP_BUILT__ === 'number' ? __APP_BUILT__ : 0;
// Which build this is, the same id /version.json names (the commit's first 7 characters on Vercel):
// crash reports carry it as their release. 'dev' in dev and in tests.
export const BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'dev';
