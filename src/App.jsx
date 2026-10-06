import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UIProvider } from './components/ui.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { NavCtx } from './lib/nav.js';
import { getState, useStore } from './lib/store.js';
import { joinRoute } from './lib/join.js';
import { NotifyAsk } from './components/NotifyAsk.jsx';
import { syncConfigured } from './lib/supabase.js';
import { cleanCode } from './lib/sync-model.js';
import { KeptScope, notePlace, startPlace } from './lib/kept.js';
import { cleanTripId } from './lib/draft.js';
import UpNext from './screens/UpNext.jsx';

// Only Up next (the first screen) is in the main bundle; the rest load on demand. The service
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
const joinInvite = () => import('./screens/JoinInvite.jsx');
const JoinInvite = screen(joinInvite);
const JoinInviteScreen = screen(joinInvite, 'JoinInviteScreen');
const History = screen(() => import('./screens/History.jsx'));
const Ledger = screen(() => import('./screens/Ledger.jsx'));
const Person = screen(() => import('./screens/Person.jsx'));
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
const Profile = screen(() => import('./screens/Profile.jsx'));
const plan = () => import('./screens/Plan.jsx');
const Plan = screen(plan);
const RollCall = screen(plan, 'RollCall');
const PlanLink = screen(plan, 'PlanLink');
const Preview = screen(() => import('./screens/Preview.jsx'));
const challenge = () => import('./screens/Challenge.jsx');
const Challenge = screen(challenge);
const Share = screen(() => import('./screens/Share.jsx'));
const ChallengeLink = screen(challenge, 'ChallengeLink');
const Paywall = screen(() => import('./screens/Paywall.jsx'));
const Season = screen(() => import('./screens/Season.jsx'));
const Stats = screen(() => import('./screens/Stats.jsx'));
const Lately = screen(() => import('./screens/Lately.jsx'));
const Friends = screen(() => import('./screens/Friends.jsx'));
const FriendRound = screen(() => import('./screens/FriendRound.jsx'));
const trip = () => import('./screens/Trip.jsx');
const Trip = screen(trip);
const TripSettle = screen(trip, 'TripSettle');
const books = () => import('./screens/Books.jsx');
const CloseBooks = screen(books, 'CloseBooks');
const Book = screen(books, 'Book');
const draft = () => import('./screens/Draft.jsx');
const Draft = screen(draft);
const DraftLink = screen(draft, 'DraftLink');
const BigGame = screen(() => import('./screens/BigGame.jsx'));
const BigGameSetup = screen(() => import('./screens/BigGameSetup.jsx'));
const Roadmap = screen(() => import('./screens/Roadmap.jsx'));
const WhatsNew = screen(() => import('./screens/WhatsNew.jsx'));
const HallOfFame = screen(() => import('./screens/HallOfFame.jsx'));

/**
 * The public roadmap link (/roadmap, or ?roadmap): { ids } (with &ids, each item's id shows, for
 * Trevor), or null. Anyone can open it: someone set up gets it on top of Up next, anyone else reads it.
 */
function roadmapLink() {
  try {
    const q = new URLSearchParams(location.search);
    if (location.pathname.replace(/\/+$/, '') !== '/roadmap' && !q.has('roadmap')) return null;
    return { ids: q.has('ids') };
  } catch { return null; }
}

/** A plan link (?plan=CODE, &p=WHO for one person's own) waiting to open: { code, who } or null. */
function pendingPlanLink() {
  try {
    const q = new URLSearchParams(location.search);
    const code = cleanCode(q.get('plan'));
    if (code) {
      const v = { code, who: q.get('p') || null };
      sessionStorage.setItem('bb-plan', JSON.stringify(v));
      return v;
    }
    const saved = JSON.parse(sessionStorage.getItem('bb-plan'));
    return saved?.code ? { code: cleanCode(saved.code), who: saved.who || null } : null;
  } catch { return null; }
}
const clearPlanLink = () => { try { sessionStorage.removeItem('bb-plan'); } catch { /* ignore */ } };

/** A challenge link (?challenge=CODE) waiting to open: its code, or null. Kept for this tab until it opens. */
function pendingChallengeLink() {
  try {
    const code = cleanCode(new URLSearchParams(location.search).get('challenge'));
    if (code) { sessionStorage.setItem('pending-challenge', code); return code; }
    return cleanCode(sessionStorage.getItem('pending-challenge')) || null;
  } catch { return null; }
}
/** A plan, challenge, draft, join or "Play this now" link opened the app: it goes first, ahead of where you were. */
function linkWaiting() {
  try {
    const q = new URLSearchParams(location.search);
    return !!(roadmapLink() || q.get('plan') || q.get('challenge') || q.get('join') || q.get('draft') || q.get('play') || sessionStorage.getItem('bb-plan') || sessionStorage.getItem('pending-challenge') || sessionStorage.getItem('bb-join') || sessionStorage.getItem('pending-draft') || sessionStorage.getItem('bb-play'));
  } catch { return false; }
}

/**
 * "Play this now" on a rule page (?play=wolf): the game as the link names it, or null. Setup and
 * onboarding read which game it is (rule-links.js), so the first screen doesn't load the names.
 * Kept for this tab until it opens.
 */
function pendingPlay() {
  try {
    const clean = v => (/^[a-z0-9-]{1,40}$/i.test(String(v || '')) ? String(v).toLowerCase() : null);
    const now = clean(new URLSearchParams(location.search).get('play'));
    if (now) { sessionStorage.setItem('bb-play', now); return now; }
    return clean(sessionStorage.getItem('bb-play'));
  } catch { return null; }
}
const clearPlay = () => { try { sessionStorage.removeItem('bb-play'); } catch { /* ignore */ } };
const clearChallengeLink = () => { try { sessionStorage.removeItem('pending-challenge'); } catch { /* ignore */ } };

/** A captain's draft link (?draft=TRIP&c=0|1) waiting to open: { tripId, seat }, or null. Kept for this tab until it opens. */
function pendingDraftLink() {
  try {
    const q = new URLSearchParams(location.search);
    const tripId = cleanTripId(q.get('draft'));
    if (tripId) {
      const v = { tripId, seat: q.get('c') === '1' ? 1 : 0 };
      sessionStorage.setItem('pending-draft', JSON.stringify(v));
      return v;
    }
    const saved = JSON.parse(sessionStorage.getItem('pending-draft'));
    return cleanTripId(saved?.tripId) ? { tripId: saved.tripId, seat: saved.seat === 1 ? 1 : 0 } : null;
  } catch { return null; }
}
const clearDraftLink = () => { try { sessionStorage.removeItem('pending-draft'); } catch { /* ignore */ } };

/** A join link (?join=CODE) waiting to open, from the address bar or saved for this tab. */
function pendingJoin() {
  try { return cleanCode(new URLSearchParams(location.search).get('join') || sessionStorage.getItem('bb-join')) || null; } catch { return null; }
}

/** Warm the screens once the first one is up, so tapping into one never shows a blank frame. */
function preloadScreens() {
  const go = () => LOADERS.forEach(l => l().catch(() => {}));
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}

const SCREENS = {
  roundDetail: RoundDetail, newRound: NewRound, play: Play,
  playerEdit: PlayerEdit, crewEdit: CrewEdit, person: Person,
  settings: Settings, defaults: Defaults, courses: Courses, courseEdit: CourseEdit, about: About, suggest: Suggest,
  plan: Plan, rollCall: RollCall, planLink: PlanLink, preview: Preview, paywall: Paywall, season: Season,
  challenge: Challenge, challengeLink: ChallengeLink,
  joinInvite: JoinInviteScreen, lately: Lately, trip: Trip, tripSettle: TripSettle, draft: Draft, draftLink: DraftLink,
  bigGame: BigGame, bigGameSetup: BigGameSetup, roadmap: Roadmap, whatsNew: WhatsNew,
  friends: Friends, friendRound: FriendRound,
  profile: Profile, stats: Stats, share: Share, closeBooks: CloseBooks, book: Book, hallOfFame: HallOfFame,
};
// Settings lives behind the avatar on Up next, so it's a pushed screen rather than a tab
const TABS = { upnext: UpNext, ledger: Ledger, history: History, people: People };

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
  // Coming back after the phone dropped the page (another app, a call, low memory): the same tab and
  // screens, unless a link is what opened the app (see place.js)
  const [fromLink] = useState(linkWaiting);
  const [restored] = useState(() => {
    const back = startPlace(getState(), { screens: Object.keys(SCREENS), tabs: Object.keys(TABS) });
    return back && !fromLink ? back : null;
  });
  const [tab, setTab] = useState(() => restored?.tab || 'upnext');
  // A plan link opens straight onto the plan: for someone set up, on top of Up next
  const [planLinkAt, setPlanLinkAt] = useState(pendingPlanLink);
  // A challenge link too: someone set up gets it on top of Up next, anyone else answers it as it is
  const [challengeAt, setChallengeAt] = useState(pendingChallengeLink);
  // A captain's draft link: on top of Up next for someone set up, on its own for anyone else
  const [draftAt, setDraftAt] = useState(pendingDraftLink);
  // "Play this now" from a rule page: setup with the game picked, or onboarding with it ticked
  const [playAt] = useState(pendingPlay);
  // The roadmap link: read-only on its own for anyone not set up (no sign-in needed)
  const [roadmapAt] = useState(roadmapLink);
  const [webRoadmap, setWebRoadmap] = useState(() => !onboarded && !!roadmapAt);
  const [stack, setStack] = useState(() => {
    if (!onboarded) return [];
    if (planLinkAt) {
      clearPlanLink();
      return [{ name: 'planLink', params: planLinkAt, key: Date.now() }];
    }
    if (challengeAt) {
      clearChallengeLink();
      return [{ name: 'challengeLink', params: { code: challengeAt }, key: Date.now() }];
    }
    if (draftAt) {
      clearDraftLink();
      return [{ name: 'draftLink', params: draftAt, key: Date.now() }];
    }
    if (roadmapAt) return [{ name: 'roadmap', params: roadmapAt, key: Date.now() }];
    // A join link for someone already set up opens the invite card (seats, "Not on the list? Add me")
    const code = syncConfigured ? pendingJoin() : null;
    try { sessionStorage.removeItem('bb-join'); } catch { /* ignore */ }
    const to = code ? joinRoute(getState(), code) : null;
    if (to) return [{ name: to[0], params: to[1], key: Date.now() }];
    if (playAt) {
      clearPlay();
      return [{ name: 'newRound', params: { play: playAt }, key: Date.now() }];
    }
    return restored ? restored.stack : [];
  });
  // A join link opened before onboarding skips straight to picking your name in that round
  const [inviteCode, setInviteCode] = useState(() => {
    if (onboarded || !syncConfigured) return null;
    return pendingJoin();
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
  /** Swap the top screen for another, with no new history entry (sending an idea → the roadmap). */
  const replace = useCallback((name, params = {}) => {
    setStack(s => [...s.slice(0, -1), { name, params, key: Date.now() + Math.random() }]);
  }, []);
  /** Replace the whole stack (e.g. finish a round → go to its results). */
  const reset = useCallback((nextTab, ...routes) => {
    if (nextTab) setTab(nextTab);
    setStack(routes.map(([name, params = {}]) => ({ name, params, key: Date.now() + Math.random() })));
  }, []);

  // Save where you are as it changes (and kept.js saves again as the app goes to the background)
  useEffect(() => { if (onboarded) notePlace(tab, stack); }, [onboarded, tab, stack]);

  // Screens brought back after a cold start get their history entries again, so the phone's back still walks them
  useEffect(() => {
    if (!restored?.stack.length || history.state?.bb) return;
    try { restored.stack.forEach(() => history.pushState({ bb: true }, '')); } catch { /* ignore */ }
  }, [restored]);

  // Live shared rounds + ?join=CODE links
  useEffect(() => {
    // Accounts, profiles and live sync start right after the first paint, in the same order as
    // always; feedback.js sends any suggestions queued while offline
    Promise.all([import('./lib/cloud.js'), import('./lib/profiles.js'), import('./lib/sync.js')]).then(([cloud, profiles, sync]) => {
      cloud.bootCloud();
      profiles.bootProfiles();
      sync.bootSync();
    }).catch(() => {});
    import('./lib/feedback.js').catch(() => {});
    preloadScreens();
    const q = new URLSearchParams(location.search).get('join');
    if (q) {
      // Kept for this tab only until onboarding is past (someone set up already went to the invite card)
      if (!getState().onboarded) { try { sessionStorage.setItem('bb-join', q); } catch { /* ignore */ } }
      history.replaceState(null, '', location.pathname);
    }
    if (new URLSearchParams(location.search).get('plan')) history.replaceState(null, '', location.pathname);
    if (new URLSearchParams(location.search).get('challenge')) history.replaceState(null, '', location.pathname);
    if (new URLSearchParams(location.search).get('draft')) history.replaceState(null, '', location.pathname);
    if (new URLSearchParams(location.search).get('play')) history.replaceState(null, '', location.pathname);
    // Someone set up who opened the roadmap link has it on top of Up next; a reload starts at home
    if (getState().onboarded && roadmapLink()) history.replaceState(null, '', '/');
  }, []);

  // Overlays opened in place over a screen (the course editor over round setup): the phone's back
  // closes the top one first. `layer(onClose)` adds a history entry and returns the in-app close,
  // which drops that entry again without popping the screen underneath.
  const layers = useRef([]);
  const layer = useCallback(onClose => {
    const entry = { onClose, done: false };
    layers.current.push(entry);
    let pushed = false;
    try { history.pushState({ bb: true, layer: true }, ''); pushed = true; } catch { /* ignore */ }
    return () => {
      if (entry.done) return;
      entry.done = true;
      // popstate then finds this entry done and leaves the screen be
      if (pushed && history.state?.layer) history.back();
      else layers.current = layers.current.filter(e => e !== entry);
    };
  }, []);

  // Phone/browser back button closes the top overlay, or pops the stack
  useEffect(() => {
    const onPop = () => {
      // An overlay already closed in the app: this is its entry going, so the screen stays
      const gone = layers.current.findIndex(e => e.done);
      if (gone >= 0) { layers.current.splice(gone, 1); return; }
      const top = layers.current.pop();
      if (top) { top.done = true; top.onClose(); return; }
      setStack(s => s.slice(0, -1));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const nav = useMemo(() => ({ push, pop, replace, reset, layer, tab, setTab: t => { setTab(t); setStack([]); } }), [push, pop, replace, reset, layer, tab]);

  if (!onboarded) {
    const joined = (id, done) => {
      try { sessionStorage.removeItem('bb-join'); } catch { /* ignore */ }
      setStack([{ name: done ? 'roundDetail' : 'play', params: { id }, key: Date.now() }]);
    };
    const skip = () => {
      try { sessionStorage.removeItem('bb-join'); } catch { /* ignore */ }
      setInviteCode(null);
    };
    // A friend with a plan link answers and votes with no setup; the plan waits on their Up next if they set up later
    const skipPlan = () => { clearPlanLink(); setPlanLinkAt(null); };
    const skipChallenge = () => { clearChallengeLink(); setChallengeAt(null); };
    const skipDraft = () => { clearDraftLink(); setDraftAt(null); };
    return (
      <UIProvider>
        <div className="device">
          <Suspense fallback={<div className="screen active" aria-busy="true" />}>
            {webRoadmap ? <Roadmap web ids={roadmapAt?.ids} onStart={() => { history.replaceState(null, '', '/'); setWebRoadmap(false); }} />
              : inviteCode ? <JoinInvite code={inviteCode} onJoined={joined} onSkip={skip} />
              : planLinkAt ? <PlanLink code={planLinkAt.code} who={planLinkAt.who} standalone onSkip={skipPlan} />
              : challengeAt ? <ChallengeLink code={challengeAt} standalone onSkip={skipChallenge} />
              : draftAt ? <DraftLink tripId={draftAt.tripId} seat={draftAt.seat} standalone onSkip={skipDraft} />
              : <Onboarding play={playAt} onDone={routes => { clearPlay(); setStack(routes.map(([name, params = {}]) => ({ name, params, key: Date.now() + Math.random() }))); }} />}
          </Suspense>
        </div>
      </UIProvider>
    );
  }

  const top = stack[stack.length - 1];
  const Top = top ? SCREENS[top.name] : null;
  const TabScreen = TABS[tab] || UpNext;

  return (
    <UIProvider>
      <NavCtx.Provider value={nav}>
        <div className="device">
          <ErrorBoundary onReset={() => reset('upnext')}>
            <Suspense fallback={<div className="screen active" aria-busy="true" />}>
              <KeptScope.Provider value={top ? String(top.key) : `tab:${tab}`}>
                {Top ? <Top key={top.key} {...top.params} /> : <TabScreen key={tab} />}
              </KeptScope.Provider>
            </Suspense>
          </ErrorBoundary>
          <NotifyAsk />
        </div>
      </NavCtx.Provider>
    </UIProvider>
  );
}
