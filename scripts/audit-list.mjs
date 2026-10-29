// The design audit's shot list (scripts/audit-shots.mjs runs it). Each shot opens a fresh page with
// `page` (state, storage, place, url), then `run(p, ctx)` taps its way through and shoots:
// p.js(body) runs in the page with the helpers, p.shoot(id, what) settles and saves (plus scrolled
// shots for a tall screen), p.snap(id, what) saves the frame as it is (mid-animation).

/** Tap, shoot the frame about 150 ms in (mid-entrance), then the settled screen. */
async function step(p, id, what, tapJs, opts = {}) {
  await p.js(`${tapJs}; await w(150);`);
  await p.snap(`${id}-mid`, `${what}, about 150 ms into the step's entrance`);
  await p.shoot(id, what, opts);
}

/** From a payoff or question: Continue, then each answer (null: just Continue) */
async function answer(p, picks) {
  await p.js(`tap('Continue'); await w(700);`);
  for (const c of picks) await p.js(`${c ? `tap(${JSON.stringify(c)}); await w(300);` : ''} tap('Continue'); await w(700);`);
}

const onboardingFlow = paywall => async p => {
  const sfx = paywall ? '-paywall' : '';
  if (!paywall) await p.shoot('welcome', 'Welcome: the course scene, Birdie Bank title, game tags, Set up my group');
  await step(p, `games${sfx}-empty`, 'Q1 Which games: nothing picked, Continue greyed with the hint', `tap('Set up my group')`);
  if (!paywall) {
    await p.js(`tap('Skins: '); await w(200); tap('Nassau: '); await w(200); tap('Wolf: ');`);
    await p.shoot('games-picked', 'Q1 Which games: Skins, Nassau and Wolf picked');
  } else await p.js(`tap('Skins: ');`);
  await step(p, `p-games${sfx}`, 'Payoff 1: the sample money phone mock', `tap('Continue')`);
  if (paywall) {
    await answer(p, ['A foursome', 'A payment app', null, 'Me, every time', null]);
    await p.js(`typeIn('#ob-name', 'Trevor'); tap('Friendly wagers only'); await w(300); tap('Yes, I'); await w(300); tap('Continue'); await w(900);`);
    await p.js(`(tryTap('Get a round going') || tap('Set up your next round')); await w(1500);`);
    await p.shoot('set-up-next-round-paywall', 'Set up your next round with the paywall flag on (the paywall waits under it)');
    await p.js(`(await navApi()).pop(); await w(1400);`);
    await p.shoot('paywall', 'The paywall after onboarding (?paywall=on), backed out of the next round');
    return;
  }
  await step(p, 'size-empty', 'Q2 How many usually play: nothing picked', `tap('Continue')`);
  await p.js(`tap('A foursome');`);
  await p.shoot('size-picked', 'Q2 with A foursome picked');
  await step(p, 'settle-empty', 'Q3 How do you settle up: nothing picked', `tap('Continue')`);
  await p.js(`tap('A payment app');`);
  await p.shoot('settle-picked', 'Q3 with A payment app picked');
  await step(p, 'p-settle', 'Payoff 3: the IOU ring, 6 IOUs cut to 3 payments', `tap('Continue')`);
  await step(p, 'math-empty', 'Q4 Who does the math: nothing picked', `tap('Continue')`);
  await p.js(`tap('Me, every time');`);
  await p.shoot('math-picked', 'Q4 with Me, every time picked');
  await step(p, 'p-math', 'Payoff 4: the four jobs stamped Birdie Bank (after the last stamp lands, about 2.7 s)', `tap('Continue')`, { settle: 3500 });
  await step(p, 'name-empty', 'Name step, empty: Continue greyed with what is missing', `tap('Continue')`);
  await p.js(`tap('Handicap, optional');`);
  await p.shoot('name-handicap-pad', 'Name step with the handicap number pad open', { scroll: false });
  await p.js(`for (const k of ['1','1','Decimal point','3']) { tap(k, '.numpad-sheet button'); await w(80); } await w(200); tap('Done', '.numpad-sheet button'); await w(700);`);
  await p.js(`typeIn('#ob-name', 'Trevor'); tap('snapback', '[role=radio]') ; await w(200); tap('Friendly wagers only'); await w(500); tap('Yes, I'); await w(300);`).catch(async () => {
    await p.js(`typeIn('#ob-name', 'Trevor'); clickEl('.ob-buddies .av-pick'); await w(200); tap('Friendly wagers only'); await w(500); tap('Yes, I'); await w(300);`);
  });
  await p.js(`document.activeElement?.blur(); scrollTopNow(); await w(400);`);
  await p.shoot('name-filled', 'Name step filled: name, handicap, a buddy, wagers ticked, 18 or older');
  await step(p, 'group', 'All set: Here is your group review, ready lines, Set up your next round', `tap('Continue')`);
  await step(p, 'set-up-next-round', 'Set up your next round (newRound ahead, from onboarding)', `tryTap('Get a round going') || tap('Set up your next round')`);
};


const clone = x => structuredClone(x);
const DAY = 86400000;
const PEOPLE = ['p_jackson', 'p_marcus', 'p_dev', 'p_sam', 'p_riley', 'p_tyler', 'p_cody', 'p_ben'];

// ---------- states made from the review seed ----------
function newUser(ctx) {
  const s = clone(ctx.STATES.done);
  s.rounds = {}; s.plans = {}; s.settlements = []; s.activeRoundId = null; s.favorites = []; s.starredCourses = [];
  s.players = { p_trevor: s.players.p_trevor };
  return s;
}
function withRounds(ctx, ids, { plans = {} } = {}) {
  const s = clone(ctx.STATES.done);
  s.rounds = Object.fromEntries(ids.map(id => [id, s.rounds[id]]));
  s.settlements = [];
  s.plans = plans;
  return s;
}
function twentyRounds(ctx) {
  const s = clone(ctx.STATES.done);
  const base = Object.values(s.rounds).filter(r => r.status === 'done');
  for (let k = 0; k < 12; k++) {
    const r = clone(base[k % base.length]);
    r.id = `r_old${k}`;
    const back = (k + 2) * 9 * DAY + 60 * DAY;
    r.createdAt -= back; r.finishedAt -= back;
    s.rounds[r.id] = r;
  }
  return s;
}
const MORE_NAMES = ['Austin', 'Brady', 'Carter', 'Derek', 'Eli', 'Finn', 'Gabe', 'Hunter', 'Isaac', 'Jake', 'Kyle', 'Logan', 'Mason', 'Nate', 'Owen', 'Parker'];
const BUDDY_IDS = ['snapback', 'bucket', 'flatcap', 'visor', 'beanie', 'shades', 'cowboy', 'straw', 'tourcap'];
const BGS = ['lav', 'mint', 'ochre', 'peach', 'teal', 'pink', 'blush'];
function players25(ctx) {
  const s = clone(ctx.STATES.done);
  MORE_NAMES.forEach((name, i) => {
    const id = 'p_x' + i;
    s.players[id] = { id, name, index: 5 + ((i * 7) % 20), venmo: '', createdAt: ctx.NOW - 10 * DAY, ...(i % 4 === 3 ? {} : { avatar: { kind: 'buddy', id: BUDDY_IDS[i % 9], bg: BGS[i % 7] } }) };
  });
  return s;
}
function players3(ctx) {
  const s = withRounds(ctx, ['r_1003', 'r_0829']);
  for (const id of Object.keys(s.players)) if (!['p_trevor', 'p_marcus', 'p_jackson', 'p_dev'].includes(id)) delete s.players[id];
  return s;
}
function allSquare(ctx) {
  const s = clone(ctx.STATES.done);
  const at = ctx.NOW - 3600000;
  s.settlements.push({ id: 'sq1', from: 'p_sam', to: 'p_trevor', amount: 22, at }, { id: 'sq2', from: 'p_tyler', to: 'p_trevor', amount: 11, at }, { id: 'sq3', from: 'p_jackson', to: 'p_trevor', amount: 3, at }, { id: 'sq4', from: 'p_trevor', to: 'p_ben', amount: 13, at });
  return s;
}
/** A live round of `game` at hole 1 (or with some holes in) on top of the finished seed */
function liveGame(ctx, game, { pids = ['p_trevor', 'p_jackson', 'p_marcus', 'p_dev'], holesScored = 0, current = null, holesCount = 18, playFor = null, teams = null, extra = '' } = {}) {
  return ctx.memo(`live:${game}:${pids.length}:${holesScored}:${current}:${holesCount}:${JSON.stringify(playFor)}:${JSON.stringify(teams)}:${extra}`, () => ctx.build(ctx.STATES.done, `S.update(s => { mkRound(s, { id: 'r_${game}', game: '${game}', pids: ${JSON.stringify(pids)}, holesScored: ${holesScored}, current: ${current}, holesCount: ${holesCount}, playFor: ${JSON.stringify(playFor)}, teams: ${JSON.stringify(teams)} }); }); ${extra}`));
}
// Vegas is always two teams of two (setup asks for them)
const VEGAS_TEAMS = [['p_trevor', 'p_jackson'], ['p_marcus', 'p_dev']];
/** Finished rounds for the results screens */
function resultsState(ctx) {
  return ctx.memo('results', () => ctx.build(ctx.STATES.done, `S.update(s => {
    mkRound(s, { id: 'r_points', game: 'skins', pids: ['p_trevor', 'p_jackson', 'p_marcus', 'p_dev'], holesScored: 18, done: true, daysAgo: 1, playFor: { kind: 'points' } });
    mkRound(s, { id: 'r_reward', game: 'nassau', pids: ['p_trevor', 'p_sam'], holesScored: 18, done: true, daysAgo: 2, playFor: { kind: 'reward', reward: 'Loser buys lunch', owes: 'last' } });
    mkRound(s, { id: 'r_square', game: 'skins', pids: ['p_trevor', 'p_jackson', 'p_marcus'], holesScored: 18, done: true, daysAgo: 3, useHandicaps: false, score: (k, i, h) => h.par });
    mkRound(s, { id: 'r_solo9', game: 'stroke', pids: ['p_trevor'], holesScored: 9, holesCount: 9, current: 8, keepActive: true });
    mkRound(s, { id: 'r_tie', game: 'stroke', pids: ['p_trevor', 'p_riley', 'p_tyler'], holesScored: 18, done: true, daysAgo: 4, useHandicaps: false, score: (k, i, h) => h.par + (k === 2 ? 1 : (i === 3 && k === 0) || (i === 5 && k === 1) ? 1 : 0) });
    mkRound(s, { id: 'r_solo', game: 'stroke', pids: ['p_trevor'], holesScored: 18, done: true, daysAgo: 6, useHandicaps: false });
    mkRound(s, { id: 'r_fin', game: 'skins', pids: ['p_trevor', 'p_jackson', 'p_marcus', 'p_dev'], holesScored: 17, current: 17, keepActive: true });
    s.activeRoundId = 'r_fin';
  });`));
}
function tripState(ctx, kind) {
  return ctx.memo('trip:' + kind, () => ctx.build(ctx.STATES.done, `
    const T = await import('/src/lib/trip-store.js'); const CUP = await import('/src/lib/cup.js');
    const st = S.getState(); const nm = id => ({ id, name: st.players[id].name, index: st.players[id].index });
    const people = ['p_jackson', 'p_marcus', 'p_dev', 'p_sam', 'p_riley', 'p_tyler', 'p_cody'];
    const kind = '${kind}';
    const before = kind === 'before';
    const cup = kind === 'cup' || kind === 'draft';
    const opts = { name: cup ? 'Bandon Cup' : 'Bandon Boys', start: before ? '2026-11-12' : '2026-10-21', end: before ? '2026-11-15' : '2026-10-28', where: 'Bandon, OR', people, format: cup ? 'cup' : 'money' };
    if (cup) {
      const teams = CUP.balanceTeams(['p_trevor', ...people, 'p_ben'].map(nm));
      opts.cup = kind === 'draft'
        ? { names: ['Blue', 'Red'], teams: [[teams[0][0]], [teams[1][0]]], captains: [teams[0][0].id, teams[1][0].id], pick: 'draft', stake: 20, draft: { live: true, order: 'snake', first: 0 } }
        : { names: ['Blue', 'Red'], teams, captains: [teams[0][0].id, teams[1][0].id], pick: 'balance', stake: 20 };
      opts.people = [...people, 'p_ben'];
    }
    const t = T.makeTrip(opts);
    window.__trip = t.id;
    if (!before) {
      for (const id of ['r_1021']) T.setRoundTrip(id, S.getState().trips[t.id]);
      const P = id => ({ id });
      T.saveExpense({ tripId: t.id, what: 'The house', amount: 140000, payer: 'p_trevor', split: 'equal', people: ['p_trevor', ...people].map(P) });
      T.saveExpense({ tripId: t.id, what: 'Dinner', amount: 31250, payer: 'p_jackson', split: 'equal', people: ['p_trevor', 'p_jackson', 'p_marcus', 'p_dev'].map(P) });
      T.saveExpense({ tripId: t.id, what: 'Gas', amount: 9600, payer: 'p_marcus', split: 'equal', people: ['p_trevor', 'p_marcus'].map(P) });
      S.update(s => { mkRound(s, { id: 'r_trip1', game: 'skins', pids: ['p_trevor', 'p_jackson', 'p_marcus', 'p_dev'], holesScored: 18, done: true, daysAgo: 3 }); mkRound(s, { id: 'r_trip2', game: 'nassau', pids: ['p_trevor', 'p_sam', 'p_riley', 'p_tyler'], holesScored: 18, done: true, daysAgo: 2, teams: [['p_trevor', 'p_riley'], ['p_sam', 'p_tyler']] }); });
      for (const id of ['r_trip1', 'r_trip2']) T.setRoundTrip(id, S.getState().trips[t.id]);
    }
    S.update(s => { s.__tripId = t.id; });
  `));
}
const tripId = s => s.__tripId;
const CREW = { c_sat: { id: 'c_sat', name: 'Saturday crew', playerIds: ['p_jackson', 'p_marcus', 'p_dev'] } };

/** The home-screen card stack: put away the install and reminder cards so What's new shows */
const clearStack = `for (let i = 0; i < 4; i++) { if (!tryTap('Not now')) break; await w(700); }`;
export const SHOTS = [
  // ---------- onboarding ----------
  { area: 'onboarding', id: 'flow', page: { state: null }, run: onboardingFlow(false) },
  { area: 'onboarding', id: 'flow-paywall', page: { state: null, url: 'http://127.0.0.1:5193/?paywall=on' }, run: onboardingFlow(true) },
  {
    area: 'onboarding', id: 'later', page: { state: null },
    run: async p => {
      await p.js(`tap('Set up my group'); await w(700); tap('Skins: '); await w(300); tap('Continue'); await w(700);`);
      await answer(p, ['Just two of us', 'Honestly?']);
      await p.shoot('p-settle-two', 'Payoff 3 for two players who mostly do not settle (no IOU picture)');
      await answer(p, ['It rotates', null]);
      await p.shoot('name-no-age', 'Name step when the group does not settle (no age question)');
      await p.js(`typeIn('#ob-name', 'Sam'); tap('Friendly wagers only'); await w(300); tap('Continue'); await w(900);`);
      await p.shoot('group-two', 'All set for a two-player, no-money group');
      await step(p, 'later-upnext', 'I will do it later: Up next for a brand new organizer', `tap('I’ll do it later')`);
    },
  },
  {
    area: 'onboarding', id: 'reduced', page: { state: null, reduced: true },
    run: async p => {
      await p.js(`tap('Set up my group'); await w(150);`);
      await p.snap('games-reduced-mid', 'Q1 with reduced motion, 150 ms after the tap');
      await p.js(`tap('Skins: '); await w(300); tap('Continue'); await w(150);`);
      await p.snap('p-games-reduced-mid', 'Payoff 1 with reduced motion, 150 ms after the tap');
      await p.js(`tap('Continue'); await w(150);`);
      await p.snap('size-reduced-mid', 'Q2 with reduced motion, 150 ms after the tap');
    },
  },

  {
    area: 'onboarding', id: 'friend-join', page: ctx => ({ state: null, storage: { 'bb-live:LOGAN7': ctx.liveRecord }, url: ctx.BASE + '?join=LOGAN7' }),
    run: async p => {
      await p.shoot('friend-join-invite', 'A friend on a new phone opens a join link (?join=LOGAN7): pick your seat');
      const b = await p.js(`return listButtons();`);
      if (b.some(x => x.includes('Jackson'))) {
        await step(p, 'friend-join-picked', 'Join link: picked a seat', `tap('Riley') || tap('Dev')`).catch(() => {});
      }
    },
  },

  // ---------- home ----------
  { area: 'home', id: 'new-user', page: ctx => ({ state: newUser(ctx) }), run: async p => p.shoot('upnext-new-user', 'Up next for a new organizer: no rounds, no plans') },
  { area: 'home', id: 'one-round', page: ctx => ({ state: withRounds(ctx, ['r_1021'], { plans: { pl_open: clone(ctx.extra.open) } }) }), run: async p => p.shoot('upnext-one-round-open-plan', 'Up next with 1 finished round and a no-day plan (days voted)') },
  { area: 'home', id: 'one-round-noplan', page: ctx => ({ state: withRounds(ctx, ['r_1021']) }), run: async p => p.shoot('upnext-one-round', 'Up next with 1 finished round and nothing planned') },
  { area: 'home', id: 'install-card', page: ctx => ({ state: ctx.STATES.doneOpen, install: true }), run: async p => { await p.js(`const c = el('.install-card'); c?.scrollIntoView({ block: 'center' }); await w(600);`); await p.shoot('upnext-install-card', 'Up next with the Add to Home Screen card (the only shot that keeps it)', { scroll: false }); } },
  { area: 'home', id: 'tiles', page: ctx => ({ state: ctx.STATES.doneOpen }), run: async p => p.shoot('upnext-many-rounds', 'Up next with 8 rounds: countdown strip, two upcoming plans, tiles, recap, callouts, Lately') },
  { area: 'home', id: 'in-progress', page: ctx => ({ state: ctx.STATES.liveOpen }), run: async p => p.shoot('upnext-round-in-progress', 'Up next with a round in progress (Skins, hole 3) on top') },
  { area: 'home', id: 'trip-on', page: async ctx => ({ state: await tripState(ctx, 'during') }), run: async p => p.shoot('upnext-trip-on', 'Up next during a money trip (Bandon Boys)') },
  {
    area: 'home', id: 'countdown-today', page: ctx => { const s = clone(ctx.STATES.done); s.plans.pl_sat.date = '2026-10-26'; s.plans.pl_sat.teeTime = '19:55'; return { state: s }; },
    run: async p => p.shoot('upnext-countdown-today', 'Countdown strip with the round today, about 2 hours out', { scroll: false }),
  },
  {
    area: 'home', id: 'whats-new', page: ctx => ({ state: ctx.STATES.done, storage: { 'bb-whats-new': { seen: [], at: 1 } } }),
    run: async p => {
      await p.js(`tryTap('3 more'); await w(900);`);
      await p.shoot('upnext-card-stack-open', 'Up next card stack opened (the reminders)', { scroll: false });
      // The What's new card itself never claimed the slot in a seeded visit (see INDEX.md)
    },
  },
  {
    area: 'home', id: 'join-sheet', page: ctx => ({ state: ctx.STATES.done }),
    run: async p => {
      await p.js(`tap('Join a friend'); await w(1200);`);
      await p.shoot('join-sheet', 'Join a friend’s round sheet (enter a code)', { scroll: false });
      await p.js(`const i = el('.sheet input, [role=dialog] input'); if (i) typeIn(i, 'LOGAN7'); await w(500);`);
      await p.shoot('join-sheet-code', 'Join sheet with a code typed', { scroll: false });
    },
  },
  {
    area: 'home', id: 'rounds-picker', page: async ctx => ({ state: await ctx.memo('two-live', () => ctx.build(ctx.STATES.live, `S.update(s => { mkRound(s, { id: 'r_second', game: 'wolf', pids: ['p_trevor', 'p_sam', 'p_riley', 'p_tyler'], holesScored: 5, keepActive: true }); });`)) }),
    run: async p => {
      await p.shoot('upnext-two-rounds-live', 'Up next with two rounds in progress');
      await p.js(`clickEl('.bottom-nav .nav-btn.center'); await w(1000);`);
      await p.shoot('rounds-in-progress-sheet', 'The play button with two rounds going: which one?', { scroll: false });
    },
  },

  // ---------- plan ----------
  {
    area: 'plan', id: 'ask', page: ctx => ({ state: ctx.STATES.done }),
    run: async p => {
      await step(p, 'ask', 'Get a round going: the ask (who is up for golf?)', `tap('Get a round going')`);
      await p.js(`tap('When'); await w(1000);`);
      await p.shoot('ask-when-sheet-not-sure', 'When sheet: Not sure yet (the default)', { scroll: false });
      await p.js(`tap('Set a day'); await w(800);`);
      await p.shoot('ask-when-set-a-day', 'When sheet: Set a day');
      await p.js(`tap('A few options'); await w(800);`);
      await p.shoot('ask-when-few-options', 'When sheet: A few options with the weekend days');
      await p.js(`tap('Sat Oct 31'); tap('Sun Nov 1'); tap('Sat Nov 7'); await w(400);`);
      await p.shoot('ask-when-few-options-picked', 'When sheet: three days picked');
      await p.js(`tap('Pick a day'); await w(1000);`);
      await p.shoot('ask-when-day-picker', 'The day picker over the When sheet', { scroll: false });
      await p.js(`tryTap('Done') || tryTap('Close'); await w(800); tryTap('Done'); await w(900);`);
      await p.shoot('ask-with-days', 'The ask with three days offered');
      await p.js(`tap('Where'); await w(1100);`);
      await p.shoot('ask-where-sheet', 'Where sheet: course search');
      await p.js(`tryTap('Logan River GC') || tryTap('Logan River'); await w(500); tryTap('Done'); await w(900);`);
      await p.js(`tap('Game and bet'); await w(1100);`);
      await p.shoot('ask-game-bet-sheet', 'Game and bet sheet');
      await p.js(`tryTap('Done'); await w(900);`);
      await p.shoot('ask-filled', 'The ask with day options, course and game set');
    },
  },
  {
    area: 'plan', id: 'nothing-set', page: async ctx => ({ state: await ctx.memo('plan-empty', () => ctx.build(ctx.STATES.done, `const A = await import('/src/lib/plan-ask.js'); const st = S.getState(); const plan = A.newAskPlan({ id: 'pl_empty', hostWho: 'host', hostName: 'Trevor', people: ['p_jackson', 'p_marcus', 'p_dev'].map(id => ({ id, name: st.players[id].name })), settings: st.settings, when: { mode: 'open' } }); S.update(s => { s.plans.pl_empty = plan; });`)), place: ['upnext', [['plan', { id: 'pl_empty' }]]] }),
    run: async p => p.shoot('plan-nothing-set', 'Plan page for a plan with nothing set yet (no day, course, game)'),
  },
  {
    area: 'plan', id: 'days-voted', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['plan', { id: 'pl_open' }]]] }),
    run: async p => {
      await p.shoot('plan-days-voted', 'Plan page: three days voted on, Sat Nov 7 leads, the Lock in nudge');
      await p.js(`tap('Day'); await w(1100);`);
      await p.shoot('plan-day-votes-sheet', 'The day row opened: who can make which day', { scroll: false });
      await p.js(`tryTap('Close') || tryTap('Done'); await w(900); tap('Lock in Sat Nov 7'); await w(1200);`);
      await p.shoot('plan-lock-sheet', 'Lock in sheet');
    },
  },
  {
    area: 'plan', id: 'trash-talk', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['plan', { id: 'pl_open' }]]] }),
    run: async p => {
      await p.js(`tap('Trash talk'); await w(1200);`);
      await p.shoot('plan-trash-talk-sheet', 'Trash talk sheet on a plan', { scroll: false });
    },
  },
  {
    area: 'plan', id: 'call-off', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['plan', { id: 'pl_open' }]]] }),
    run: async p => {
      await p.js(`tap('Call it off'); await w(1000);`);
      await p.shoot('plan-call-off-confirm', 'Call it off: the confirm', { scroll: false });
      await p.js(`const b = [...document.querySelectorAll('.sheet button, [role=dialog] button, .confirm button')].filter(vis).find(b => /call it off|yes/i.test(txt(b))); if (b) b.click(); await w(1500); scrollTopNow(); await w(400);`);
      await p.shoot('plan-called-off', 'After calling it off');
    },
  },
  {
    area: 'plan', id: 'dated', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['plan', { id: 'pl_sat' }]]] }),
    run: async p => {
      await p.shoot('plan-dated-ticket', 'Saturday’s Nassau: the dated plan ticket, 3 in, 1 maybe, no answer');
      await p.js(`tryTap('Saturday preview') || tryTap('preview'); await w(1300);`);
      await p.shoot('plan-preview', 'Saturday preview from the plan');
    },
  },
  { area: 'plan', id: 'dated-from-home', page: ctx => ({ state: ctx.STATES.doneOpen }), run: async p => { await p.js(`tap('Saturday preview'); await w(1400);`); await p.shoot('plan-preview-from-home', 'Saturday preview opened from the Up next card'); } },
  {
    area: 'plan', id: 'roll-call', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['rollCall', { id: 'pl_sat' }]]] }),
    run: async p => p.shoot('roll-call', 'Roll call for Saturday’s round'),
  },
  {
    area: 'plan', id: 'friend-before', page: ctx => { const s = clone(ctx.STATES.friend); delete s.plans.pl_open_friend.answers.p_riley; return { state: s, place: ['upnext', [['plan', { id: 'pl_open_friend' }]]] }; },
    run: async p => {
      await p.shoot('friend-view-no-answer', 'Riley’s view of the no-day plan from Trevor’s link, before answering');
      await p.js(`tryTap('I’m in') || tryTap('In'); await w(1200);`);
      await p.shoot('friend-view-answering', 'Riley tapped In: picking days');
    },
  },
  { area: 'plan', id: 'friend-after', page: ctx => ({ state: ctx.STATES.friend, place: ['upnext', [['plan', { id: 'pl_open_friend' }]]] }), run: async p => p.shoot('friend-view-answered', 'Riley’s view after answering (in, two days)') },
  {
    area: 'plan', id: 'edit-plan', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['newRound', { edit: 'pl_sat' }]]] }),
    run: async p => p.shoot('plan-edit', 'Editing Saturday’s plan (newRound edit)'),
  },

  // ---------- setup ----------
  {
    area: 'setup', id: 'overview', page: ctx => ({ state: ctx.STATES.done }),
    run: async p => {
      await step(p, 'overview-fresh', 'Setup overview, fresh: Run it back on top, every row to pick', `clickEl('.bottom-nav .nav-btn.center')`);
      await step(p, 'game', 'Game step', `tap('Pick a game')`);
      await p.js(`pickGame('Skins'); await w(700);`);
      await p.shoot('game-picked', 'Game step with Skins picked');
      await p.js(`tryTap('Rules'); await w(1200);`);
      await p.shoot('game-rules-sheet', 'Skins rules from the Game step', { scroll: false });
      await p.js(`tryTap('Close'); await w(800); tap('Next: Course'); await w(1100);`);
      await p.shoot('course', 'Course step');
      await p.js(`tap('Logan River GC'); await w(700);`);
      await p.shoot('course-picked', 'Course step with Logan River picked (tees and holes)');
      await p.js(`tap('Next: Players'); await w(1100);`);
      await p.shoot('players', 'Players step');
      await p.js(`tap('Jackson'); tap('Marcus'); tap('Dev'); await w(500);`);
      await p.shoot('players-picked', 'Players step with four picked');
      await p.js(`tap('Next: Bets'); await w(1100);`);
      await p.shoot('bets', 'Bets step for Skins');
      await p.js(`tryTap('Add a side game') || tryTap('Side games'); await w(1200);`);
      await p.shoot('side-games-sheet', 'Side games sheet');
      await p.js(`tryTap('Close', '.sheet button, [role=dialog] button') || tryTap('Done'); await w(900); tap('Next: Look it over'); await w(1300);`);
      await p.shoot('overview-all-set', 'Setup overview, all set');
      await p.js(`tap('Handicaps'); await w(1200);`);
      await p.shoot('handicaps-sheet', 'Handicaps sheet');
      await p.js(`tap('Done'); await w(1100); tap('Playing for'); await w(1200);`);
      await p.shoot('playing-for-sheet', 'Playing for sheet: money, points or a reward');
      await p.js(`tryTap('A reward') || tryTap('Reward'); await w(700);`);
      await p.shoot('playing-for-reward', 'Playing for: a reward picked');
      await p.js(`tap('Done'); await w(1100);`);
      await p.shoot('overview-reward', 'Setup overview after picking a reward');
      await p.js(`tap('Create round'); await w(1600);`);
      await p.shoot('round-ready', 'Round ready');
    },
  },
  {
    area: 'setup', id: 'error-row', page: ctx => ({ state: ctx.STATES.done }),
    run: async p => {
      await p.js(`clickEl('.bottom-nav .nav-btn.center'); await w(1300); tap('Pick a game'); await w(1000); pickGame('Wolf'); await w(700); tap('Next: Course'); await w(900); tap('Logan River GC'); await w(400); tap('Next: Players'); await w(900); tap('Jackson'); await w(300);`);
      await p.shoot('players-too-few-wolf', 'Players step for Wolf with only two: Add 2 more players');
    },
  },
  {
    area: 'setup', id: 'run-it-back', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['newRound', {}]]] }),
    run: async p => {
      await step(p, 'run-it-back', 'Run it back: last round’s setup filled in', `tap('RUN IT BACK') || clickEl('.ov-again')`);
    },
  },
  {
    area: 'setup', id: 'schedule-later', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['newRound', {}]]] }),
    run: async p => { await p.js(`clickEl('.ov-again'); await w(1300);`); await step(p, 'schedule-for-later', 'Schedule for later (after Run it back)', `tap('Schedule for later')`); },
  },
  {
    area: 'setup', id: 'first-tee', page: ctx => ({ state: ctx.STATES.live, place: ['upnext', [['play', { id: 'r_live' }]]] }),
    run: async p => { await p.js(`tryTap('Skip for now'); await w(400); tap('Round menu'); await w(900); tap('First-tee rules card'); await w(1300);`); await p.shoot('first-tee-card-menu', 'First-tee rules card from the round menu'); },
  },
  {
    area: 'setup', id: 'fresh-round', page: async ctx => ({ state: await liveGame(ctx, 'nassau', { pids: ['p_trevor', 'p_sam'] }), place: ['upnext', [['play', { id: 'r_nassau' }]]] }),
    run: async p => {
      await p.shoot('first-tee-on-start', 'A brand new Nassau round: the First tee card on hole 1');
      await p.js(`tap('Skip for now'); await w(1200);`);
      await p.shoot('first-hole-fresh', 'Hole 1 of a brand new round, nothing scored');
    },
  },

  // ---------- play ----------
  {
    area: 'play', id: 'hole', page: ctx => ({ state: ctx.STATES.live, place: ['upnext', [['play', { id: 'r_live' }]]] }),
    run: async p => {
      await p.js(`tryTap('Skip for now'); await w(500);`);
      await p.shoot('hole-fresh', 'Skins hole 3, nothing changed yet (par shown for everyone)');
      await p.js(`tap('Trevor Birdie, 3'); await w(250); tap('Dev Bogey, 5'); await w(250); tap('Marcus Double, 6'); await w(300);`);
      await p.shoot('hole-editing', 'Hole 3 mid-edit: Trevor birdie, Marcus double, Dev bogey');
      await p.js(`tap('Jackson: another score. Number pad'); await w(900);`);
      await p.shoot('pad', 'The number pad for another score', { scroll: false });
    },
  },
  { area: 'play', id: 'money-strip', page: ctx => ({ state: ctx.STATES.live, place: ['upnext', [['play', { id: 'r_live' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(400); clickEl('.money-strip'); await w(1200);`); await p.shoot('money-strip-sheet', 'Money so far sheet (from the money strip)'); } },
  { area: 'play', id: 'scorecard', page: ctx => ({ state: ctx.STATES.live, place: ['upnext', [['play', { id: 'r_live' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(400); tap('Open scorecard'); await w(1200);`); await p.shoot('scorecard-sheet', 'Scorecard sheet'); } },
  {
    area: 'play', id: 'menu', page: ctx => ({ state: ctx.STATES.live, place: ['upnext', [['play', { id: 'r_live' }]]] }),
    run: async p => {
      await p.js(`tryTap('Skip for now'); await w(400); tap('Round menu'); await w(1000);`);
      await p.shoot('round-menu', 'Round menu');
      const sub = [['Bets', 'menu-bets', 'Bets from the round menu'], ['Handicaps', 'menu-handicaps', 'Handicaps from the round menu'], ['Play for', 'menu-play-for', 'Play for from the round menu'],
        ['Add a side game', 'menu-add-side-game', 'Add a side game mid-round'], ['Side bets', 'menu-side-bets', 'Side bets mid-round'], ['Invite', 'menu-invite', 'Invite the group (share the round)'],
        ['Fix par or HCP', 'menu-fix-hole', 'Fix par or HCP for hole 3'], ['A player left', 'menu-player-left', 'A player left'], ['Add a player', 'menu-add-player', 'Add a player mid-round'],
        ['Round length', 'menu-round-length', 'Round length'], ['Course and tee', 'menu-course-tee', 'Course and tee'], ['Skins rules', 'menu-rules', 'Skins rules from the menu'], ['End round', 'menu-end-round', 'End round confirm']];
      for (const [label, id, what] of sub) {
        try {
          await p.js(`tap(${JSON.stringify(label)}, '.menu-row, .menu-tile'); await w(1200);`);
          await p.shoot(id, what);
        } catch (e) { p.area && (await p.js(`return 1`)); }
        // back to the hole and open the menu again
        await p.js(`for (let i = 0; i < 3 && !el('.menu-row'); i++) { if (el('.hole-line') && !el('.sheet, [role=dialog]')) break; const c = [...document.querySelectorAll('.sheet-close, .header-back, [aria-label=Close]')].filter(vis).pop(); if (c) c.click(); else break; await w(700); } if (!el('.menu-row')) { tryTap('Round menu'); await w(900); }`).catch(() => {});
      }
    },
  },
  { area: 'play', id: 'wolf', page: async ctx => ({ state: await liveGame(ctx, 'wolf'), place: ['upnext', [['play', { id: 'r_wolf' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('wolf-hole-1', 'Wolf hole 1: pick a partner or go alone'); await p.js(`tryTap('Jackson', '.wolf-pick button, [class*=wolf] button'); await w(500);`); await p.shoot('wolf-partner-picked', 'Wolf hole 1 after picking a partner (if the pick took)'); } },
  { area: 'play', id: 'wolf-mid', page: async ctx => ({ state: await liveGame(ctx, 'wolf', { holesScored: 6 }), place: ['upnext', [['play', { id: 'r_wolf' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('wolf-hole-7', 'Wolf hole 7 with six holes in'); } },
  { area: 'play', id: 'banker', page: async ctx => ({ state: await liveGame(ctx, 'banker', { holesScored: 4 }), place: ['upnext', [['play', { id: 'r_banker' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('banker-hole-5', 'Banker hole 5: the banker and the bets'); } },
  { area: 'play', id: 'hammer', page: async ctx => ({ state: await liveGame(ctx, 'hammer', { pids: ['p_trevor', 'p_sam'] }), place: ['upnext', [['play', { id: 'r_hammer' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('hammer-hole-1', 'Hammer hole 1, head to head'); } },
  { area: 'play', id: 'snake', page: async ctx => ({ state: await liveGame(ctx, 'snake'), place: ['upnext', [['play', { id: 'r_snake' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('snake-hole-1', 'Snake hole 1'); } },
  { area: 'play', id: 'vegas', page: async ctx => ({ state: await liveGame(ctx, 'vegas', { teams: VEGAS_TEAMS }), place: ['upnext', [['play', { id: 'r_vegas' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('vegas-hole-1', 'Vegas hole 1, 2 v 2'); } },
  { area: 'play', id: 'nassau', page: async ctx => ({ state: await liveGame(ctx, 'nassau', { pids: ['p_trevor', 'p_sam'], holesScored: 5 }), place: ['upnext', [['play', { id: 'r_nassau' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('nassau-hole-6', 'Nassau hole 6, front/back/total strip'); } },
  { area: 'play', id: 'stableford', page: async ctx => ({ state: await liveGame(ctx, 'stableford', { holesScored: 3, playFor: { kind: 'points' } }), place: ['upnext', [['play', { id: 'r_stableford' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(600);`); await p.shoot('stableford-points-hole-4', 'Stableford played for points, hole 4'); } },
  {
    area: 'play', id: 'halfway', page: async ctx => ({ state: await liveGame(ctx, 'skins', { holesScored: 8, current: 8 }), place: ['upnext', [['play', { id: 'r_skins' }]]] }),
    run: async p => {
      await p.js(`tryTap('Skip for now'); await w(600);`);
      await p.shoot('hole-9-before-turn', 'Hole 9 with eight holes in');
      await p.js(`tap('Save & next hole'); await w(4500);`);
      await p.shoot('halfway-sheet', 'The halfway sheet after saving hole 9');
    },
  },
  {
    area: 'play', id: 'live-money', page: ctx => ({ state: ctx.STATES.watch, storage: { 'bb-live:LOGAN7': ctx.liveRecord }, place: ['upnext', [['play', { id: 'r_live' }]]] }),
    run: async p => { await p.js(`await w(800);`); await p.shoot('live-money-watching', 'Watching phone: Jackson keeps the card, this phone sees the live money'); },
  },
  {
    area: 'play', id: 'reveal', page: async ctx => ({ state: await resultsState(ctx), place: ['upnext', [['play', { id: 'r_fin' }]]] }),
    run: async p => {
      await p.js(`tryTap('Skip for now'); await w(600);`);
      await p.shoot('hole-18-last', 'Hole 18, the last hole');
      await p.js(`const b = find('Save & finish') || find('Finish') || find('Save & next hole'); b.click(); await w(1500);`);
      await p.shoot('reveal-adding-up', 'The reveal: Adding it up, as it lands');
      await p.js(`await w(4000);`);
      await p.shoot('reveal-settled', 'The reveal after it finishes counting');
      await p.js(`tap('Who pays who'); await w(1500);`);
      await p.shoot('reveal-settle-up', 'End of round: Settle up (who pays who, pay buttons)');
      await p.js(`tap('Share results'); await w(1500);`);
      await p.shoot('reveal-share-card', 'End of round: the share card');
      await p.js(`tap('Done'); await w(1600);`);
      await p.shoot('reveal-done-results', 'After Done: the round’s results');
    },
  },
  { area: 'play', id: 'reveal-direct', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['roundDetail', { id: 'r_1021', celebrate: true }]]] }), run: async p => { await p.js(`await w(400);`); await p.shoot('reveal-banker', 'The reveal for the Oct 21 Banker round (roundDetail celebrate)'); } },
  ...[['r_1021', 'results-money', 'Results: Banker for money (Oct 21)'], ['r_1010', 'results-tie', 'Results: Wolf, Trevor and Dev tied for the top'], ['r_0926', 'results-skins-win', 'Results: Skins, Trevor won'], ['r_0905', 'results-nassau-teams', 'Results: Nassau 2 v 2']].map(([id, name, what]) => (
    { area: 'play', id: name, page: ctx => ({ state: ctx.STATES.done, place: ['history', [['roundDetail', { id }]]] }), run: async p => p.shoot(name, what) })),
  ...[['r_points', 'results-points', 'Results: Skins played for points'], ['r_reward', 'results-reward', 'Results: Nassau for a reward (loser buys lunch)'], ['r_square', 'results-all-square', 'Results: all square, every score the same'], ['r_tie', 'results-stroke-tie', 'Results: stroke play with a tie for first'], ['r_solo', 'results-solo', 'Results: a solo round']].map(([id, name, what]) => (
    { area: 'play', id: name, page: async ctx => ({ state: await resultsState(ctx), place: ['history', [['roundDetail', { id }]]] }), run: async p => p.shoot(name, what) })),
  {
    area: 'play', id: 'settle-up', page: ctx => ({ state: ctx.STATES.done, place: ['history', [['roundDetail', { id: 'r_1021' }]]] }),
    run: async p => { await p.js(`tap('Pay or mark paid'); await w(1400);`); await p.shoot('settle-up', 'Pay or mark paid from the Oct 21 results'); },
  },
  { area: 'play', id: 'solo-finish', page: async ctx => ({ state: await resultsState(ctx), place: ['upnext', [['play', { id: 'r_solo9' }]]] }), run: async p => { await p.js(`tryTap('Skip for now'); await w(500); const b = find('Finish round') || find('Save & next hole'); b.click(); await w(2500);`); await p.shoot('solo-nice-round', 'A solo 9-hole round finished: the Nice round screen'); } },

  // ---------- tab ----------
  { area: 'tab', id: 'both-sides', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', []] }), run: async p => p.shoot('tab-both-sides', 'The Tab: owed to you (Sam, Tyler, Jackson) and you owe (Ben), group lines, payments') },
  { area: 'tab', id: 'all-square', page: ctx => ({ state: allSquare(ctx), place: ['ledger', []] }), run: async p => p.shoot('tab-all-square', 'The Tab with everyone paid up') },
  { area: 'tab', id: 'empty', page: ctx => ({ state: newUser(ctx), place: ['ledger', []] }), run: async p => p.shoot('tab-empty', 'The Tab for a new user') },
  { area: 'tab', id: 'trip', page: async ctx => ({ state: await tripState(ctx, 'during'), place: ['ledger', []] }), run: async p => p.shoot('tab-with-trip', 'The Tab during a trip (trip money and expenses)') },
  {
    area: 'tab', id: 'person', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', []] }),
    run: async p => {
      await step(p, 'tab-person-sam', 'Sam’s story from the Tab', `tap('Sam: owes you $22. See the story')`);
    },
  },
  { area: 'tab', id: 'person-owe', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', []] }), run: async p => { await p.js(`tap('Ben: you owe $13. See the story'); await w(1400);`); await p.shoot('tab-person-ben', 'Ben’s story (you owe him)'); } },
  {
    area: 'tab', id: 'paid-part', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', []] }),
    run: async p => {
      // Paid part of it? opens straight on the amount (n3 polish, tab-10)
      await p.js(`tap('Paid part of it?'); await w(1200);`);
      await p.shoot('paid-part-amount', 'Paid part of it?: the amount, named and capped', { scroll: false });
    },
  },
  {
    area: 'tab', id: 'paid-toast', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', []] }),
    run: async p => {
      await p.js(`tap('Sam paid me $22'); await w(350);`);
      await p.snap('paid-toast-mid', 'Sam paid me: the moment after the tap (toast and the row leaving)');
      await p.shoot('paid-toast', 'After Sam paid me: the undo toast', { scroll: false, settle: 600 });
    },
  },
  { area: 'tab', id: 'season', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', [['season', {}]]] }), run: async p => p.shoot('season', 'Season: net over the season, standings and records') },
  { area: 'tab', id: 'close-books', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', [['closeBooks', {}]]] }), run: async p => p.shoot('close-the-books', 'Close the books') },
  {
    area: 'tab', id: 'crew-tabs', page: ctx => { const s = clone(ctx.STATES.done); s.crews = CREW; return { state: s, place: ['ledger', []] }; },
    run: async p => { await p.shoot('tab-with-crew', 'The Tab with a saved crew (crew tabs, if the crew shape matches)'); },
  },
  { area: 'tab', id: 'crew-edit', page: ctx => ({ state: ctx.STATES.done, place: ['people', [['crewEdit', {}]]] }), run: async p => p.shoot('crew-edit', 'Save them as a crew (crewEdit)') },

  // ---------- history ----------
  { area: 'history', id: 'zero', page: ctx => ({ state: newUser(ctx), place: ['history', []] }), run: async p => p.shoot('history-empty', 'History with no rounds') },
  { area: 'history', id: 'three', page: ctx => ({ state: withRounds(ctx, ['r_1021', 'r_1010', 'r_1003']), place: ['history', []] }), run: async p => p.shoot('history-3-rounds', 'History with 3 rounds') },
  { area: 'history', id: 'eight', page: ctx => ({ state: ctx.STATES.done, place: ['history', []] }), run: async p => p.shoot('history-8-rounds', 'History with the seed’s 8 rounds') },
  { area: 'history', id: 'twenty', page: ctx => ({ state: twentyRounds(ctx), place: ['history', []] }), run: async p => p.shoot('history-20-rounds', 'History with 20 rounds') },
  { area: 'history', id: 'filter', page: ctx => ({ state: ctx.STATES.done, place: ['history', []] }), run: async p => { await p.js(`tap('Wolf', '.pick-chip'); await w(900);`); await p.shoot('history-filter-wolf', 'History filtered to Wolf', { scroll: false }); await p.js(`tap('Month'); await w(900);`); await p.shoot('history-month', 'History by month', { scroll: false }); await p.js(`tap('Custom'); await w(1000);`); await p.shoot('history-custom', 'History, custom range', { scroll: false }); } },
  { area: 'history', id: 'detail', page: ctx => ({ state: ctx.STATES.done, place: ['history', []] }), run: async p => { await step(p, 'round-detail', 'Round detail (Oct 21 Banker) opened from History', `clickEl('.rc-card')`); await p.js(`tap('Talk'); await w(900);`); await p.shoot('round-detail-talk', 'Round detail, Talk tab'); await p.js(`tap('Details'); await w(900);`); await p.shoot('round-detail-details', 'Round detail, Details tab'); } },
  { area: 'history', id: 'stats', page: ctx => ({ state: ctx.STATES.done, place: ['history', [['stats', { range: { kind: 'season', year: 2026 } }]]] }), run: async p => p.shoot('stats', 'Your stats for the 2026 season') },
  { area: 'history', id: 'stats-empty', page: ctx => ({ state: newUser(ctx), place: ['history', [['stats', { range: { kind: 'all' } }]]] }), run: async p => p.shoot('stats-empty', 'Stats with no rounds') },
  { area: 'history', id: 'hof-empty', page: ctx => { const s = newUser(ctx); s.players.p_jackson = clone(ctx.STATES.done.players.p_jackson); s.crews = { c_new: { id: 'c_new', name: 'New crew', playerIds: ['p_jackson'] } }; return { state: s, place: ['history', [['hallOfFame', { crew: 'c_new' }]]] }; }, run: async p => p.shoot('hall-of-fame-empty', 'Hall of fame for a crew with no rounds yet') },
  { area: 'history', id: 'hof', page: ctx => { const s = twentyRounds(ctx); s.crews = CREW; return { state: s, place: ['history', [['hallOfFame', { crew: 'c_sat' }]]] }; }, run: async p => p.shoot('hall-of-fame', 'Hall of fame for the Saturday crew, with records') },
  { area: 'tab', id: 'crew-tab', page: ctx => { const s = twentyRounds(ctx); s.crews = CREW; return { state: s, place: ['ledger', []] }; }, run: async p => { await p.js(`tryTap('Saturday crew'); await w(1000);`); await p.shoot('tab-crew-saturday', 'The Saturday crew’s tab (crew tabs)'); } },
  { area: 'history', id: 'season', page: ctx => ({ state: twentyRounds(ctx), place: ['history', [['season', {}]]] }), run: async p => p.shoot('season-20', 'Season with 20 rounds') },
  { area: 'history', id: 'lately', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['lately', {}]]] }), run: async p => p.shoot('lately', 'Lately: everything that happened') },
  { area: 'history', id: 'share-wrapped', page: ctx => ({ state: ctx.STATES.done, place: ['history', [['share', { kind: 'wrapped', year: 2026 }]]] }), run: async p => p.shoot('share-wrapped', 'Season wrapped share card') },
  { area: 'history', id: 'print', page: ctx => ({ state: ctx.STATES.done, place: ['history', [['print', { kind: 'round', id: 'r_1021' }]]] }), run: async p => p.shoot('print-round', 'Printable results sheet for a round') },

  // ---------- players ----------
  { area: 'players', id: 'three', page: ctx => ({ state: players3(ctx), place: ['people', []] }), run: async p => p.shoot('players-3', 'Players with 3 friends') },
  { area: 'players', id: 'eight', page: ctx => ({ state: ctx.STATES.done, place: ['people', []] }), run: async p => p.shoot('players-8', 'Players with the seed’s 8 friends, regulars and the nemesis card') },
  { area: 'players', id: 'many', page: ctx => ({ state: players25(ctx), place: ['people', []] }), run: async p => p.shoot('players-25', 'Players with 25') },
  { area: 'players', id: 'empty', page: ctx => ({ state: newUser(ctx), place: ['people', []] }), run: async p => p.shoot('players-empty', 'Players for a new user') },
  { area: 'players', id: 'search', page: ctx => ({ state: players25(ctx), place: ['people', []] }), run: async p => { await p.js(`typeIn('input.search-box', 'Ma'); await w(700);`); await p.shoot('players-search', 'Players search for "Ma"', { scroll: false }); } },
  { area: 'players', id: 'person', page: ctx => ({ state: ctx.STATES.done, place: ['people', []] }), run: async p => { await step(p, 'person-jackson', 'Jackson’s person card', `tap('Jackson In Sat')`); } },
  { area: 'players', id: 'person-marcus', page: ctx => ({ state: ctx.STATES.done, place: ['people', [['person', { id: 'p_marcus' }]]] }), run: async p => p.shoot('person-marcus-nemesis', 'Marcus (the nemesis) person card') },
  { area: 'players', id: 'edit', page: ctx => ({ state: ctx.STATES.done, place: ['people', [['playerEdit', { id: 'p_dev' }]]] }), run: async p => { await p.shoot('player-edit', 'Edit a player (Dev)'); await p.js(`tryTap('Same person') || tryTap('Merge'); await w(1200);`); await p.shoot('player-merge', 'Merge (same person) from the player edit, if offered'); } },
  { area: 'players', id: 'add', page: ctx => ({ state: ctx.STATES.done, place: ['people', [['playerEdit', {}]]] }), run: async p => p.shoot('player-add', 'Add a player') },
  { area: 'players', id: 'friends', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['people', [['friends', {}]]] }), run: async p => { await p.shoot('friends-feed', 'Friends: the group feed'); await p.js(`tryTap('Friends', '[role=tab], .pm-btn, button'); tryTap('List'); await w(900);`); await p.shoot('friends-list', 'Friends: the list'); } },
  {
    area: 'players', id: 'avatar', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['profile', {}]]] }),
    run: async p => {
      await p.js(`tap('Your avatar'); await w(1200);`);
      await p.shoot('avatar-picker-buddies', 'Avatar picker: Ball buddies');
      await p.js(`tryTap('Critters'); await w(900);`);
      await p.shoot('avatar-picker-critters', 'Avatar picker: critters');
      await p.js(`tryTap('Photo'); await w(900);`);
      await p.shoot('avatar-picker-photo', 'Avatar picker: photo tab');
      await p.js(`tryTap('Initials'); await w(900);`);
      await p.shoot('avatar-picker-initials', 'Avatar picker: initials tab');
    },
  },
  { area: 'players', id: 'skip-player-avatar', themes: [], page: ctx => ({ state: ctx.STATES.done, place: ['people', [['playerEdit', { id: 'p_sam' }]]] }), run: async p => { await p.js(`const b = [...document.querySelectorAll('button')].filter(vis).find(b => /avatar/i.test(b.getAttribute('aria-label') || '') || b.className.includes('av')); if (b) b.click(); await w(1200);`); await p.shoot('player-avatar-picker', 'Avatar picker for a friend (Sam)'); } },

  // ---------- trips ----------
  {
    area: 'trips', id: 'create', page: ctx => ({ state: ctx.STATES.done }),
    run: async p => {
      await p.js(`tap('Start a trip'); await w(1200);`);
      await p.shoot('start-trip-sheet', 'Start a trip: templates, name, dates, money or team points');
      await p.js(`tap('8 Ryder Cup weekend'); await w(900);`);
      await p.shoot('start-trip-template', 'Start a trip with the 8-player Ryder Cup template picked');
      await p.js(` typeIn(document.querySelector('.sheet input.text-input'), 'Bandon Cup'); await w(300); tap('Next: players'); await w(1100);`);
      await p.shoot('start-trip-players', 'Start a trip: who’s going');
      await p.js(`for (const n of ['Jackson', 'Marcus', 'Dev', 'Sam', 'Riley', 'Tyler', 'Cody']) { tryTap(n, '.sheet button'); await w(80); } await w(400); tap('Next: the teams'); await w(1200);`);
      await p.shoot('start-trip-teams', 'Start a trip: the teams');
      const next = await p.js(`const b = [...document.querySelectorAll('.sheet .full-btn')].filter(vis).pop(); const t = b && txt(b); if (b && !b.disabled) { b.click(); await w(1300); } return t;`);
      await p.shoot('start-trip-after-teams', `Start a trip: after "${next}"`);
      const next2 = await p.js(`const b = [...document.querySelectorAll('.sheet .full-btn')].filter(vis).pop(); const t = b && txt(b); if (b && !b.disabled) { b.click(); await w(1500); } return t;`);
      await p.shoot('start-trip-done', `Start a trip: after "${next2}"`);
    },
  },
  { area: 'trips', id: 'before', page: async ctx => { const s = await tripState(ctx, 'before'); return { state: s, place: ['upnext', [['trip', { id: s.__tripId }]]] }; }, run: async p => p.shoot('trip-before', 'Trip page before it starts (Nov 12 to 15)') },
  { area: 'trips', id: 'before-home', page: async ctx => ({ state: await tripState(ctx, 'before') }), run: async p => p.shoot('upnext-trip-ahead', 'Up next with a trip coming up') },
  {
    area: 'trips', id: 'during', page: async ctx => { const s = await tripState(ctx, 'during'); return { state: s, place: ['upnext', [['trip', { id: s.__tripId }]]] }; },
    run: async p => {
      await p.shoot('trip-during', 'Trip page during a money trip (day 6 of 8)');
      for (const [v, id] of [['Standings', 'trip-standings'], ['Rounds', 'trip-rounds'], ['Games', 'trip-games'], ['Expenses', 'trip-expenses']]) {
        const ok = await p.js(`const b = [...document.querySelectorAll('.trip-views button, [aria-label="Trip view"] button')].filter(vis).find(b => txt(b) === ${JSON.stringify(v)}); if (!b) return false; b.click(); await w(1000); return true;`);
        if (ok) await p.shoot(id, `Trip page, ${v} view`);
      }
      await p.js(`tryTap('Add an expense') || tryTap('Add'); await w(1200);`);
      await p.shoot('trip-add-expense', 'Add an expense sheet');
    },
  },
  { area: 'trips', id: 'settle', page: async ctx => { const s = await tripState(ctx, 'during'); return { state: s, place: ['upnext', [['trip', { id: s.__tripId }], ['tripSettle', { id: s.__tripId }]]] }; }, run: async p => p.shoot('trip-settle', 'Settle the trip') },
  { area: 'trips', id: 'share', page: async ctx => { const s = await tripState(ctx, 'during'); return { state: s, place: ['upnext', [['share', { kind: 'trip', id: s.__tripId }]]] }; }, run: async p => p.shoot('trip-share', 'Trip share card') },
  { area: 'trips', id: 'print', page: async ctx => { const s = await tripState(ctx, 'during'); return { state: s, place: ['upnext', [['print', { kind: 'trip', id: s.__tripId }]]] }; }, run: async p => p.shoot('trip-print', 'Trip pairings and cart signs to print') },
  {
    area: 'trips', id: 'cup', page: async ctx => { const s = await tripState(ctx, 'cup'); return { state: s, place: ['upnext', [['trip', { id: s.__tripId }]]] }; },
    run: async p => {
      await p.shoot('cup-trip', 'Team points trip (Bandon Cup): the Cup');
      for (const [v, id] of [['Cup', 'cup-view'], ['Standings', 'cup-standings'], ['Rounds', 'cup-rounds'], ['Expenses', 'cup-expenses']]) {
        const ok = await p.js(`const b = [...document.querySelectorAll('.trip-views button, [aria-label="Trip view"] button')].filter(vis).find(b => txt(b) === ${JSON.stringify(v)}); if (!b) return false; b.click(); await w(1000); return true;`);
        if (ok) await p.shoot(id, `Cup trip, ${v} view`);
      }
    },
  },
  {
    area: 'trips', id: 'draft', page: async ctx => { const s = await tripState(ctx, 'draft'); return { state: s, place: ['upnext', [['trip', { id: s.__tripId }]]] }; },
    run: async p => {
      await p.shoot('draft-trip', 'Cup trip set to a captains’ draft, before it starts');
      const b = await p.js(`return listButtons().filter(b => /draft/i.test(b));`);
      if (b.length) {
        await p.js(`const e = [...document.querySelectorAll('button, a')].filter(vis).find(e => /draft/i.test(txt(e) + (e.getAttribute('aria-label') || ''))); e.click(); await w(1500);`);
        await p.shoot('draft-open', `The draft (from "${b[0].slice(0, 50)}")`);
        for (let i = 1; i <= 3; i++) {
          const t = await p.js(`const e = [...document.querySelectorAll('.stage .full-btn, .sheet .full-btn')].filter(vis).filter(e => !e.disabled).pop(); if (!e) return null; const t = txt(e); e.click(); await w(1500); return t;`).catch(() => null);
          if (!t) break;
          await p.shoot(`draft-stage-${i}`, `The draft after "${t}"`);
          const pick = await p.js(`const e = [...document.querySelectorAll('.stage .list-item, .stage .pick, .stage [class*=draft] button')].filter(vis).find(e => !e.disabled); if (!e) return null; const t = txt(e); e.click(); await w(1200); return t;`).catch(() => null);
          if (pick) await p.shoot(`draft-pick-${i}`, `The draft after picking "${pick.slice(0, 30)}"`);
        }
      }
    },
  },
  {
    area: 'trips', id: 'big-setup', page: ctx => ({ state: ctx.STATES.done }),
    run: async p => {
      await step(p, 'big-game-setup-day', 'Big Game setup: the day', `tap('Big Game')`);
      await p.js(`tap('Next: Course'); await w(1100);`);
      await p.shoot('big-game-setup-course', 'Big Game setup: the course');
      await p.js(`tap('Logan River GC'); await w(600); const b = [...document.querySelectorAll('.full-btn')].filter(vis).pop(); b.click(); await w(1100);`);
      await p.shoot('big-game-setup-players', 'Big Game setup: who’s playing');
      await p.js(`for (const n of ['Jackson', 'Marcus', 'Dev', 'Sam', 'Riley', 'Tyler', 'Cody', 'Ben']) { tryTap(n, '.list-item, .stage button'); await w(80); } await w(400);`);
      await p.shoot('big-game-setup-players-picked', 'Big Game setup: nine players picked');
      await p.js(`tap('Next: Groups'); await w(1200);`);
      await p.shoot('big-game-setup-groups', 'Big Game setup: the groups');
      await p.js(`tap('Next: Games'); await w(1200);`);
      await p.shoot('big-game-setup-games', 'Big Game setup: pot, skins and teams');
      await p.js(`tap('Next: Side bets'); await w(1200);`);
      await p.shoot('big-game-setup-bets', 'Big Game setup: side bets');
      await p.js(`tap('Add a side bet'); await w(1200);`);
      await p.shoot('big-game-side-bet-sheet', 'Big Game: add a side bet sheet');
      await p.js(`tryTap('Close', '.sheet button'); await w(900); const b = [...document.querySelectorAll('.cta-wrap .full-btn')].filter(vis).filter(b => /Start the groups/.test(txt(b))).pop(); b.click(); await w(2500);`);
      await p.shoot('big-game-board', 'The Big Game board after starting the groups');
      for (const v of ['Pot', 'Skins', 'Groups', 'Bets', 'Money']) {
        const ok = await p.js(`const b = [...document.querySelectorAll('.pm-btn, [role=tab]')].filter(vis).find(b => txt(b) === ${JSON.stringify(v)}); if (!b) return false; b.click(); await w(1000); return true;`);
        if (ok) await p.shoot(`big-game-board-${v.toLowerCase()}`, `Big Game board, ${v}`);
      }
    },
  },

  // ---------- more ----------
  { area: 'more', id: 'settings', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}]]] }), run: async p => p.shoot('settings', 'Settings, all of it', { all: true }) },
  { area: 'more', id: 'defaults', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}], ['defaults', {}]]] }), run: async p => p.shoot('game-defaults', 'Settings: Game defaults') },
  { area: 'more', id: 'courses', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}], ['courses', {}]]] }), run: async p => p.shoot('courses', 'Settings: Courses') },
  { area: 'more', id: 'course-edit', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}], ['courses', {}], ['courseEdit', { id: 'logan-river' }]]] }), run: async p => p.shoot('course-edit', 'Settings: edit a course scorecard') },
  { area: 'more', id: 'about', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}], ['about', {}]]] }), run: async p => p.shoot('about', 'About Birdie Bank') },
  { area: 'more', id: 'recently-deleted', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}], ['recentlyDeleted', {}]]] }), run: async p => p.shoot('recently-deleted-empty', 'Recently deleted, empty') },
  { area: 'more', id: 'notify', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}], ['notifyPicks', {}]]] }), run: async p => p.shoot('notifications', 'Notifications picks') },
  { area: 'more', id: 'profile', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}], ['profile', {}]]] }), run: async p => p.shoot('profile', 'Your profile') },
  { area: 'more', id: 'profile-share', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['share', { kind: 'profile' }]]] }), run: async p => p.shoot('profile-card-share', 'Share my card (profile card)') },
  { area: 'more', id: 'privacy', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}]]] }), run: async p => { await p.js(`const e = find('Only you'); e.scrollIntoView({ block: 'center' }); await w(600);`); await p.shoot('privacy', 'Settings: privacy (who sees your profile)', { scroll: false }); await p.js(`tap('Only you'); await w(900);`); await p.shoot('privacy-only-you', 'Privacy set to Only you', { scroll: false }); } },
  { area: 'more', id: 'start-over', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}]]] }), run: async p => { await p.js(`tap('Start over'); await w(1200);`); await p.shoot('start-over-confirm', 'Start over (confirm or onboarding again)', { scroll: false }); } },
  { area: 'more', id: 'erase', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}]]] }), run: async p => { await p.js(`tap('Erase all data'); await w(1200);`); await p.shoot('erase-confirm', 'Erase all data confirm', { scroll: false }); } },
  { area: 'more', id: 'age', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}]]] }), run: async p => { await p.js(`tap('Playing for money'); await w(1200);`); await p.shoot('age-sheet', 'Playing for money: the age question again', { scroll: false }); } },
  { area: 'more', id: 'home-course', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['settings', {}]]] }), run: async p => { await p.js(`tap('Add your home course'); await w(1200);`); await p.shoot('home-course-from-settings', 'Add your home course (opens the profile)', { scroll: false }); await p.js(`tryTap('Pick where you usually play'); await w(1200);`); await p.shoot('home-course-sheet', 'Home course sheet from the profile', { scroll: false }); } },
  { area: 'more', id: 'your-plan', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['yourPlan', {}]]] }), run: async p => p.shoot('your-plan', 'Your plan') },
  { area: 'more', id: 'your-plan-flag', page: ctx => ({ state: ctx.STATES.done, url: ctx.BASE + '?paywall=on', place: ['upnext', [['yourPlan', {}]]] }), run: async p => p.shoot('your-plan-paywall-on', 'Your plan with ?paywall=on') },
  { area: 'more', id: 'cancel-plan', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['yourPlan', {}], ['cancelPlan', {}]]] }), run: async p => p.shoot('cancel-plan', 'Cancel your plan') },
  { area: 'more', id: 'paywall', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['paywall', { source: 'settings' }]]] }), run: async p => p.shoot('paywall-settings', 'The paywall (from Settings)') },
  { area: 'more', id: 'paywall-flag', page: ctx => ({ state: ctx.STATES.done, url: ctx.BASE + '?paywall=on', place: ['upnext', [['paywall', { source: 'season' }]]] }), run: async p => p.shoot('paywall-flag-on', 'The paywall with ?paywall=on (from Season)') },
  { area: 'more', id: 'whats-new', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['whatsNew', {}]]] }), run: async p => p.shoot('whats-new', 'What’s new') },
  { area: 'more', id: 'roadmap', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['roadmap', {}]]] }), run: async p => p.shoot('roadmap', 'Roadmap') },
  { area: 'more', id: 'roadmap-web', page: { state: null, url: 'http://127.0.0.1:5193/roadmap' }, run: async p => p.shoot('roadmap-web', 'The public roadmap link (/roadmap) on a phone that isn’t set up') },
  { area: 'more', id: 'suggest', page: ctx => ({ state: ctx.STATES.done, place: ['upnext', [['suggest', {}]]] }), run: async p => { await p.shoot('suggest', 'Suggest something'); await p.js(`tap('A feature'); await w(1200);`); await p.shoot('suggest-feature', 'Suggest something: A feature'); await p.js(`const t = el('textarea') || el('input[type=text]'); if (t) typeIn(t, 'Let me pick a tee per hole for the short par 3s.'); await w(500);`); await p.shoot('suggest-typed', 'Suggest something with an idea typed', { scroll: false }); } },
  { area: 'more', id: 'join-invite', page: ctx => ({ state: ctx.STATES.done, storage: { 'bb-live:LOGAN7': ctx.liveRecord }, url: ctx.BASE + '?join=LOGAN7' }), run: async p => p.shoot('join-invite', 'Join invite card (a join link opened by someone set up)') },
  {
    area: 'more', id: 'plan-link-stranger',
    page: async ctx => {
      const keys = await ctx.memo('plan-link', async () => {
        const p = await ctx.open({ state: ctx.STATES.doneOpen });
        await p.ready();
        try { return await p.js(`const PS = await import('/src/lib/plan-sync.js'); await PS.sharePlan('pl_open'); await w(800); const S = await store(); const code = S.getState().plans.pl_open.code; const out = { code }; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('bb-plan:')) out[k] = localStorage.getItem(k); } return out; `); } finally { await p.close(); }
      });
      const { code, ...storage } = keys;
      return { state: null, storage, url: ctx.BASE + '?plan=' + code };
    },
    run: async p => { await p.shoot('plan-link-stranger', 'The plan link as a stranger (no app set up)'); await p.js(`tryTap('I’m in') || tryTap('In'); await w(1200);`); await p.shoot('plan-link-stranger-in', 'Plan link as a stranger after tapping In'); },
  },
  { area: 'more', id: 'plan-link-gone', page: ctx => ({ state: null, url: ctx.BASE + '?plan=ZZZZZZ' }), run: async p => { await p.js(`await w(1500);`); await p.shoot('plan-link-not-found', 'A plan link that doesn’t exist (gone)'); } },
  { area: 'more', id: 'join-gone', page: ctx => ({ state: ctx.STATES.done, url: ctx.BASE + '?join=ZZZZZZ' }), run: async p => { await p.js(`await w(1500);`); await p.shoot('join-link-not-found', 'A join link for a round that doesn’t exist'); } },
  { area: 'more', id: 'challenge-gone', page: ctx => ({ state: ctx.STATES.done, url: ctx.BASE + '?challenge=ZZZZZZ' }), run: async p => { await p.js(`await w(1500);`); await p.shoot('challenge-link-not-found', 'A challenge link that doesn’t exist'); } },
  { area: 'more', id: 'status', page: ctx => ({ state: null, url: ctx.BASE + 'status.html' }), run: async p => { await p.js(`await w(2500);`); await p.shoot('status', '/status: the service status page'); } },
  { area: 'art', id: 'art', themes: ['light'], page: ctx => ({ state: null, url: ctx.BASE + '?art' }), run: async p => { await p.js(`await w(2500);`); await p.shoot('art-sheet', 'The art sheet (?art), Light, every drawing', { all: true }); } },
  { area: 'art', id: 'art-dark', themes: ['dark'], page: ctx => ({ state: null, url: ctx.BASE + '?art&theme=dark' }), run: async p => { await p.js(`await w(2500);`); await p.shoot('art-sheet', 'The art sheet (?art&theme=dark), Dark, every drawing', { all: true }); } },
  { area: 'more', id: 'error', page: ctx => ({ state: ctx.STATES.done }), run: async p => { await p.js(`await go('roundDetail', { id: 'r_nope' }); await w(500);`); await p.shoot('round-gone', 'A round that’s gone (roundDetail with a missing id)'); } },
  { area: 'more', id: 'error-boundary-crash', page: ctx => { const s = clone(ctx.STATES.done); s.rounds.r_bad = { id: 'r_bad', status: 'done', game: 'skins', createdAt: ctx.NOW - DAY, finishedAt: ctx.NOW - DAY + 3600000 }; return { state: s }; }, run: async p => { await p.js(`await go('roundDetail', { id: 'r_bad' }); await w(1200);`); await p.shoot('error-boundary', 'The error screen (a malformed saved round opened, so the screen throws)'); } },
  { area: 'more', id: 'error-play', page: ctx => ({ state: ctx.STATES.done }), run: async p => { await p.js(`await go('play', { id: 'r_nope' }); await w(500);`); await p.shoot('play-gone', 'Play for a round that doesn’t exist'); } },
  { area: 'more', id: 'error-boundary', page: ctx => ({ state: ctx.STATES.done }), run: async p => { await p.js(`await go('person', { id: 'p_nope' }); await w(500);`); await p.shoot('person-gone', 'A person card for someone not on this phone'); } },
  { area: 'more', id: 'crash', page: ctx => ({ state: ctx.STATES.done }), run: async p => { await p.js(`await go('trip', { id: 't_nope' }); await w(500);`); await p.shoot('trip-gone', 'A trip that doesn’t exist'); } },
  { area: 'more', id: 'error-screen', page: ctx => ({ state: ctx.STATES.done }), run: async p => { await p.js(`await go('stats', { range: 'bad' }); await w(800);`); await p.shoot('error-screen', 'Stats with a broken range (an error screen if it crashes)'); } },
  { area: 'more', id: 'toast-undo', page: ctx => ({ state: ctx.STATES.done, place: ['ledger', []] }), run: async p => { await p.js(`tap('Undo payment'); await w(700);`); await p.shoot('toast-undo-payment', 'A toast after undoing a payment', { scroll: false, settle: 300 }); } },
  { area: 'more', id: 'challenge', page: ctx => ({ state: ctx.STATES.doneOpen, place: ['upnext', [['plan', { id: 'pl_open' }]]] }), run: async p => { await p.js(`tap('Challenge someone'); await w(1300);`); await p.shoot('challenge-sheet', 'Challenge someone, or set one up'); } },
  { area: 'more', id: 'share-sheet', page: ctx => ({ state: ctx.STATES.done, place: ['history', [['roundDetail', { id: 'r_1021' }]]] }), run: async p => { await p.js(`tap('Share'); await w(1300);`); await p.shoot('share-round', 'Share from a round'); } },

  // ---------- classic look ----------
  ...[['upnext', 'upnext', ['upnext', []], 'liveOpen'], ['tab', 'tab', ['ledger', []], 'done'], ['scoring', 'scoring', ['upnext', [['play', { id: 'r_live' }]]], 'live'], ['results', 'results', ['history', [['roundDetail', { id: 'r_1021' }]]], 'done'], ['history', 'history', ['history', []], 'done'], ['players', 'players', ['people', []], 'done']].map(([id, name, place, st]) => (
    { area: 'classic', id, themes: ['light'], page: ctx => ({ state: ctx.STATES[st], place, url: ctx.BASE + '?look=classic', storage: { 'bb-look': 'classic' } }), run: async p => { await p.js(`tryTap('Skip for now'); await w(400);`); await p.shoot(`classic-${name}`, `Classic look (?look=classic): ${name}`); } })),
];
