import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { UIProvider } from './components/ui.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { NavCtx } from './lib/nav.js';
import { useStore } from './lib/store.js';
import { bootSync, syncConfigured } from './lib/sync.js';
import { bootCloud } from './lib/cloud.js';
import { cleanCode } from './lib/sync-model.js';
import History from './screens/History.jsx';
import './lib/feedback.js'; // sends any suggestions queued while offline

// Only History (the first screen) is in the main bundle; the rest load on demand. The service
// worker saves every chunk on install, so they still open with no signal.
const RELOADED = 'bb-chunk-reload';
const LOADERS = [];
function screen(load, name = 'default') {
  LOADERS.push(load);
  return lazy(() => load().then(m => {
    try { sessionStorage.removeItem(RELOADED); } catch { /* ignore */ }
    return { default: m[name] };
  }, err => {
    // A new deploy replaced the files this page was built with: reload once to pick them up
    let again = false;
    try { again = !sessionStorage.getItem(RELOADED); if (again) sessionStorage.setItem(RELOADED, '1'); } catch { /* ignore */ }
    if (again) { location.reload(); return new Promise(() => {}); }
    throw err;
  }));
}
const onboarding = () => import('./screens/Onboarding.jsx');
const people = () => import('./screens/People.jsx');
const settings = () => import('./screens/Settings.jsx');
const Onboarding = screen(onboarding);
const JoinInvite = screen(() => import('./screens/JoinInvite.jsx'));
const Ledger = screen(() => import('./screens/Ledger.jsx'));
const People = screen(people);
const PlayerEdit = screen(people, 'PlayerEdit');
const CrewEdit = screen(people, 'CrewEdit');
const Settings = screen(settings);
const Defaults = screen(settings, 'Defaults');
const Courses = screen(settings, 'Courses');
const CourseEdit = screen(settings, 'CourseEdit');
const About = screen(settings, 'About');
const NewRound = screen(() => import('./screens/NewRound.jsx'));
const Play = screen(() => import('./screens/Play.jsx'));
const RoundDetail = screen(() => import('./screens/RoundDetail.jsx'));
const Suggest = screen(() => import('./screens/Suggest.jsx'));

/** Warm the screens once the first one is up, so tapping into one never shows a blank frame. */
function preloadScreens() {
  const go = () => LOADERS.forEach(l => l().catch(() => {}));
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}

const SCREENS = {
  roundDetail: RoundDetail, newRound: NewRound, play: Play,
  playerEdit: PlayerEdit, crewEdit: CrewEdit,
  defaults: Defaults, courses: Courses, courseEdit: CourseEdit, about: About, suggest: Suggest,
};
const TABS = { history: History, ledger: Ledger, people: People, settings: Settings };

export default function App() {
  const onboarded = useStore(s => s.onboarded);
  const theme = useStore(s => s.settings.theme);

  // Appearance: follow the system unless the user picked light or dark
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
    const apply = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = getComputedStyle(root).getPropertyValue('--canvas').trim() || '#fffaf0';
    };
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme]);
  const [tab, setTab] = useState('history');
  const [stack, setStack] = useState([]);
  // A join link opened before onboarding skips straight to picking your name in that round
  const [inviteCode, setInviteCode] = useState(() => {
    if (onboarded || !syncConfigured) return null;
    try { return cleanCode(new URLSearchParams(location.search).get('join') || sessionStorage.getItem('bb-join')) || null; } catch { return null; }
  });

  const push = useCallback((name, params = {}) => {
    setStack(s => [...s, { name, params, key: Date.now() + Math.random() }]);
    try { history.pushState({ bb: true }, ''); } catch { /* ignore */ }
  }, []);
  // Go back through browser history when we pushed an entry, so the phone's back gesture stays in sync
  const pop = useCallback(() => {
    if (history.state?.bb) history.back();
    else setStack(s => s.slice(0, -1));
  }, []);
  /** Replace the whole stack (e.g. finish a round → go to its results). */
  const reset = useCallback((nextTab, ...routes) => {
    if (nextTab) setTab(nextTab);
    setStack(routes.map(([name, params = {}]) => ({ name, params, key: Date.now() + Math.random() })));
  }, []);

  // Live shared rounds + ?join=CODE links
  useEffect(() => {
    bootCloud();
    bootSync();
    preloadScreens();
    const q = new URLSearchParams(location.search).get('join');
    if (q) {
      try { sessionStorage.setItem('bb-join', q); } catch { /* ignore */ }
      history.replaceState(null, '', location.pathname);
    }
  }, []);

  // Phone/browser back button pops the stack
  useEffect(() => {
    const onPop = () => setStack(s => s.slice(0, -1));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const nav = useMemo(() => ({ push, pop, reset, tab, setTab: t => { setTab(t); setStack([]); } }), [push, pop, reset, tab]);

  if (!onboarded) {
    const joined = (id, done) => {
      try { sessionStorage.removeItem('bb-join'); } catch { /* ignore */ }
      setStack([{ name: done ? 'roundDetail' : 'play', params: { id }, key: Date.now() }]);
    };
    const skip = () => {
      try { sessionStorage.removeItem('bb-join'); } catch { /* ignore */ }
      setInviteCode(null);
    };
    return (
      <UIProvider>
        <div className="device">
          <Suspense fallback={<div className="screen active" aria-busy="true" />}>
            {inviteCode ? <JoinInvite code={inviteCode} onJoined={joined} onSkip={skip} /> : <Onboarding />}
          </Suspense>
        </div>
      </UIProvider>
    );
  }

  const top = stack[stack.length - 1];
  const Top = top ? SCREENS[top.name] : null;
  const TabScreen = TABS[tab];

  return (
    <UIProvider>
      <NavCtx.Provider value={nav}>
        <div className="device">
          <ErrorBoundary onReset={() => reset('history')}>
            <Suspense fallback={<div className="screen active" aria-busy="true" />}>
              {Top ? <Top key={top.key} {...top.params} /> : <TabScreen key={tab} />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </NavCtx.Provider>
    </UIProvider>
  );
}
