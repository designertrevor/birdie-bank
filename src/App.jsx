import { useCallback, useEffect, useMemo, useState } from 'react';
import { UIProvider } from './components/ui.jsx';
import { NavCtx } from './lib/nav.js';
import { useStore } from './lib/store.js';
import Onboarding from './screens/Onboarding.jsx';
import History from './screens/History.jsx';
import Ledger from './screens/Ledger.jsx';
import People, { PlayerEdit, CrewEdit } from './screens/People.jsx';
import Settings, { Defaults, Courses, CourseEdit, About } from './screens/Settings.jsx';
import NewRound from './screens/NewRound.jsx';
import Play from './screens/Play.jsx';
import RoundDetail from './screens/RoundDetail.jsx';

const SCREENS = {
  roundDetail: RoundDetail, newRound: NewRound, play: Play,
  playerEdit: PlayerEdit, crewEdit: CrewEdit,
  defaults: Defaults, courses: Courses, courseEdit: CourseEdit, about: About,
};
const TABS = { history: History, ledger: Ledger, people: People, settings: Settings };

export default function App() {
  const onboarded = useStore(s => s.onboarded);
  const [tab, setTab] = useState('history');
  const [stack, setStack] = useState([]);

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

  // Phone/browser back button pops the stack
  useEffect(() => {
    const onPop = () => setStack(s => s.slice(0, -1));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const nav = useMemo(() => ({ push, pop, reset, tab, setTab: t => { setTab(t); setStack([]); } }), [push, pop, reset, tab]);

  if (!onboarded) {
    return <UIProvider><div className="device"><Onboarding /></div></UIProvider>;
  }

  const top = stack[stack.length - 1];
  const Top = top ? SCREENS[top.name] : null;
  const TabScreen = TABS[tab];

  return (
    <UIProvider>
      <NavCtx.Provider value={nav}>
        <div className="device">
          {Top ? <Top key={top.key} {...top.params} /> : <TabScreen key={tab} />}
        </div>
      </NavCtx.Provider>
    </UIProvider>
  );
}
