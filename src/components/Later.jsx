// The parts of a screen that load just after its first paint, each in its own boundary so the
// cards above never wait or blank (Up next's recap, its trips and its Tab: UpNext.jsx). Every
// chunk is saved for offline use like the rest, so a part arrives from the cache on a later open.
import { Suspense, lazy } from 'react';

/** One named export of a file loaded with import(): `part(() => import('./X.jsx'), 'Thing')`. */
// A part that can't load (no signal before the app was ever saved offline) is left off, never the whole screen
// eslint-disable-next-line react-refresh/only-export-components
export const part = (load, name) => lazy(() => load().then(m => ({ default: m[name] }), () => ({ default: () => null })));

/** The boundary a part renders in: nothing until it's in, so the page never waits on it. */
export const Later = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;
