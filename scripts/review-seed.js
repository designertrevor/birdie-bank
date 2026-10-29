// Overhaul review: the seed state both copies of the app load for the Current vs New screenshots
// (scripts/review-shots.mjs). Runs inside the app's page, so it builds rounds and plans with the
// app's own functions. Every number comes from a fixed random seed, so a rebuild gives the same state.
// buildSeed(now) returns the state; newOnlyPlans(state, now) returns the plans only the New copy has.

export async function buildSeed(NOW, SEED = 5) {
  const R = await import('/src/lib/round.js');
  const C = await import('/src/lib/courses.js');
  const ST = await import('/src/lib/store.js');
  const PL = await import('/src/lib/plans.js');
  const AV = await import('/src/lib/avatars.js');
  const DAY = 86400000;

  let seed = SEED;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const s = ST.freshState();
  s.onboarded = true;
  const ME = 'p_trevor';
  s.me = ME;
  const people = [
    [ME, 'Trevor', 11.3, 'snapback', 'lav'],
    ['p_jackson', 'Jackson', 8.4, 'bucket', 'mint'],
    ['p_marcus', 'Marcus', 14.2, 'flatcap', 'ochre'],
    ['p_dev', 'Dev', 21.0, 'visor', 'peach'],
    ['p_sam', 'Sam', 6.1, 'beanie', 'teal'],
    ['p_riley', 'Riley', 17.5, 'shades', 'pink'],
    ['p_tyler', 'Tyler', 12.8, 'cowboy', 'lav'],
    ['p_cody', 'Cody', 24.3, 'straw', 'mint'],
    ['p_ben', 'Ben', 9.7, 'tourcap', 'blush'],
  ];
  const created = NOW - 75 * DAY;
  for (const [id, name, index, buddy, bg] of people) {
    s.players[id] = { id, name, index, venmo: id === ME ? 'trevor-nielsen' : name.toLowerCase() + '-golf', createdAt: created, ...(id === ME ? {} : { avatar: { kind: 'buddy', id: buddy, bg } }) };
  }
  s.profile = { avatar: { kind: 'buddy', id: 'snapback', bg: 'lav' }, updatedAt: created, age: { answer: 'adult', at: created } };
  s.favorites = ['logan-river', 'birch-creek', 'preston'];
  s.starredCourses = ['logan-river'];
  const course = id => C.findCourse(s, id);
  const settings = structuredClone(ST.DEFAULT_SETTINGS);
  settings.skins = { ...settings.skins, value: 2 };
  settings.nassau = { ...settings.nassau, front: 5, back: 5, total: 5 };
  settings.wolf = { ...settings.wolf, point: 2 };
  settings.banker = { ...settings.banker, defaultBet: 2, min: 1, max: 10 };
  s.settings = { ...s.settings, ...structuredClone(settings) };

  // A player's score on a hole: around their handicap, now and then a birdie or a blow-up
  const gross = (pid, par) => {
    const idx = s.players[pid].index;
    const x = rnd();
    let d = x < 0.08 ? -1 : x < 0.08 + Math.max(0.12, 0.55 - idx / 40) ? 0 : x < 0.88 ? 1 : x < 0.97 ? 2 : 3;
    if (idx > 18 && rnd() < 0.35) d += 1;
    return par + d;
  };
  const at = (daysAgo, hh, mm) => { const d = new Date(NOW - daysAgo * DAY); d.setHours(hh, mm, 0, 0); return d.getTime(); };

  function play(id, game, courseId, pids, { daysAgo, hh = 8, mm = 30, holesScored = 18, teams = null, current = null, useHandicaps = true, tweak = null }) {
    const c = course(courseId);
    const players = pids.map(pid => ({ ...s.players[pid], tee: c.tees?.[Math.min(2, c.tees.length - 1)]?.name }));
    let r = R.createRound({ id, game, course: c, holesCount: 18, nine: 'front', players, settings: s.settings, hcPct: 100, useHandicaps, teams });
    r.createdAt = at(daysAgo, hh, mm);
    for (let i = 0; i < holesScored; i++) {
      const h = r.holes[i];
      if (game === 'banker') {
        const bh = R.bankerHoleSetup(r, i);
        for (const k of Object.keys(bh.bets)) bh.bets[k] = [1, 2, 2, 3, 5][Math.floor(rnd() * 5)];
        if (rnd() < 0.12) { const k = Object.keys(bh.bets)[0]; bh.doubled = { [k]: true }; }
        r.banker[h.no] = bh;
      }
      if (game === 'wolf') {
        const w = R.wolfFor(r, i);
        const others = pids.filter(p => p !== w);
        r.wolf[h.no] = { wolf: w, partner: rnd() < 0.22 ? null : others[Math.floor(rnd() * others.length)] };
      }
      r.scores[h.no] = Object.fromEntries(pids.map(pid => [pid, gross(pid, h.par)]));
      r.marks[h.no] = {};
    }
    if (tweak) tweak(r);
    if (current == null) {
      r.status = 'done';
      r.current = 17;
      r.finishedAt = r.createdAt + (4 * 60 + 10 + Math.floor(rnd() * 40)) * 60000;
    } else {
      r.current = current;
    }
    AV.stampAvatars(s, r);
    s.rounds[id] = r;
    return r;
  }

  // Eight finished rounds over two months, Saturdays and a Wednesday evening, across four games
  play('r_0829', 'skins', 'logan-river', [ME, 'p_jackson', 'p_marcus', 'p_dev'], { daysAgo: 58, hh: 8, mm: 10 });
  play('r_0905', 'nassau', 'birch-creek', [ME, 'p_sam', 'p_riley', 'p_tyler'], { daysAgo: 51, hh: 9, mm: 0, teams: [[ME, 'p_riley'], ['p_sam', 'p_tyler']] });
  play('r_0912', 'wolf', 'logan-river', [ME, 'p_jackson', 'p_marcus', 'p_cody'], { daysAgo: 44, hh: 7, mm: 50 });
  play('r_0919', 'banker', 'preston', [ME, 'p_dev', 'p_sam', 'p_ben'], { daysAgo: 37, hh: 10, mm: 20 });
  play('r_0926', 'skins', 'logan-river', [ME, 'p_jackson', 'p_riley', 'p_tyler', 'p_cody'], { daysAgo: 30, hh: 8, mm: 40 });
  play('r_1003', 'nassau', 'birch-creek', [ME, 'p_marcus'], { daysAgo: 23, hh: 15, mm: 30 });
  play('r_1010', 'wolf', 'logan-river', [ME, 'p_dev', 'p_sam', 'p_jackson'], { daysAgo: 16, hh: 8, mm: 0 });
  play('r_1021', 'banker', 'logan-river', [ME, 'p_marcus', 'p_ben', 'p_cody'], { daysAgo: 5, hh: 16, mm: 45 });
  // Going on now: Skins at Logan River, two holes in, on the 3rd
  play('r_live', 'skins', 'logan-river', [ME, 'p_jackson', 'p_marcus', 'p_dev'], { daysAgo: 0, hh: NOW_H(NOW) - 1, mm: 5, holesScored: 2, current: 2 });
  s.activeRoundId = 'r_live';

  // A few paid up, so the Tab has history and both directions are still open
  const pay = (id, from, to, amount, daysAgo) => s.settlements.push({ id, from, to, amount, at: at(daysAgo, 19, 15) });
  pay('s_1', 'p_dev', ME, 12, 55);
  pay('s_2', 'p_sam', ME, 10, 20);

  // Saturday's round, set for 8:40 with the regulars, three answers in
  const satAhead = (6 - new Date(NOW).getDay() + 7) % 7 || 7;
  const date = PL.isoDate(new Date(NOW + satAhead * DAY));
  const planPeople = ['p_jackson', 'p_marcus', 'p_dev', 'p_sam'].map(id => ({ id, name: s.players[id].name }));
  const plan = PL.newPlan({ id: 'pl_sat', hostName: 'Trevor', game: 'nassau', holesCount: 18, date, teeTime: '08:40', course: { id: 'logan-river', name: 'Logan River GC', city: 'Logan, UT' }, people: planPeople, ballot: { games: ['skins', 'wolf'], bets: [2, 5, 10] }, suggestedBet: 5, settings: s.settings, now: NOW - 2 * DAY });
  const says = (who, ans, hoursAgo) => { plan.answers[who] = { name: s.players[who].name, at: NOW - hoursAgo * 3600000, ...ans }; };
  says('p_jackson', { status: 'in', game: 'nassau', bet: 5, betGame: 'nassau' }, 40);
  says('p_marcus', { status: 'in', game: 'skins', bet: 5, betGame: 'nassau' }, 30);
  says('p_dev', { status: 'maybe' }, 6);
  s.plans[plan.id] = plan;

  // What the money came to, to check it reads right
  const money = Object.fromEntries(Object.values(s.rounds).filter(r => r.status === 'done').map(r => [r.id, R.roundResults(r).balances]));
  return { state: s, money };
}
function NOW_H(now) { return new Date(now).getHours(); }

/** The plans only the New copy knows how to show: a round with no day yet and a couple of day votes, and its friend's view. */
export async function newOnlyPlans(state, NOW) {
  const ASK = await import('/src/lib/plan-ask.js');
  const OPEN = await import('/src/lib/plan-open.js');
  const P = state.players;
  const people = ['p_riley', 'p_tyler', 'p_cody', 'p_ben'].map(id => ({ id, name: P[id].name }));
  const days = OPEN.soonDays(new Date(NOW));
  const pick = [days[1], days[2], days[3]];
  const mk = (id, over = {}) => ASK.newAskPlan({ id, hostWho: 'host', hostName: 'Trevor', people, settings: state.settings, now: NOW - 5 * 3600000, when: { mode: 'options', days: pick }, course: { id: 'birch-creek', name: 'Birch Creek GC', city: 'Smithfield, UT' }, ...over });
  const says = (plan, who, ans, hoursAgo) => { plan.answers[who] = { name: P[who].name, at: NOW - hoursAgo * 3600000, ...ans }; return plan; };
  const open = mk('pl_open');
  says(open, 'p_riley', { status: 'in', days: [pick[0], pick[1]] }, 4);
  says(open, 'p_tyler', { status: 'in', days: [pick[1]] }, 3);
  says(open, 'p_ben', { status: 'maybe', days: [pick[2]] }, 1);
  // The same plan as Riley sees it from Trevor's link, carrying the faces Trevor's phone stamps on it (plan-faces.js)
  const FACES = await import('/src/lib/plan-faces.js');
  const friend = { ...FACES.stampPlanFaces(state, structuredClone(open)), id: 'pl_open_friend', host: false, localMe: 'p_riley', hostName: 'Trevor' };
  return { open, friend };
}

/**
 * The top of the scoring screen (n5/top, n6/top): one round going on per game, on top of the seed
 * without touching its rounds. Each is the active round in its own state, so the shots can open it:
 * Nassau 2 v 2 on the 7th with a press and two side games (the busiest top there is), Wolf on the 5th
 * before the wolf picks, Banker on the 4th (the bets step) and Vegas on the 4th. Skins is the seed's own.
 */
export async function topRounds(state, NOW) {
  const R = await import('/src/lib/round.js');
  const C = await import('/src/lib/courses.js');
  const ST = await import('/src/lib/store.js');
  const AV = await import('/src/lib/avatars.js');
  let seed = 11;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const s = structuredClone(state);
  const ME = s.me;
  const gross = (pid, par) => { const x = rnd(); const idx = s.players[pid].index; return par + (x < 0.1 ? -1 : x < 0.1 + Math.max(0.15, 0.55 - idx / 40) ? 0 : x < 0.88 ? 1 : 2); };
  const out = {};
  function make(id, game, pids, { scored, teams = null, sideGames = null, tweak = null }) {
    const c = C.findCourse(s, 'logan-river');
    const players = pids.map(pid => ({ ...s.players[pid], tee: c.tees?.[Math.min(2, c.tees.length - 1)]?.name }));
    const r = R.createRound({ id, game, course: c, holesCount: 18, nine: 'front', players, settings: s.settings, hcPct: 100, useHandicaps: true, teams });
    r.createdAt = NOW - (scored * 14 + 6) * 60000;
    if (sideGames) r.sideGames = sideGames.map(g => ({ game: g, settings: structuredClone(ST.DEFAULT_SETTINGS[g] || {}) }));
    for (let i = 0; i < scored; i++) {
      const h = r.holes[i];
      if (game === 'banker') {
        const bh = R.bankerHoleSetup(r, i);
        for (const k of Object.keys(bh.bets)) bh.bets[k] = [1, 2, 2, 3, 5][Math.floor(rnd() * 5)];
        r.banker[h.no] = bh;
      }
      if (game === 'wolf') {
        const w = R.wolfFor(r, i);
        const others = pids.filter(p => p !== w);
        r.wolf[h.no] = { wolf: w, partner: i === 1 ? null : others[Math.floor(rnd() * others.length)] };
      }
      r.scores[h.no] = Object.fromEntries(pids.map(pid => [pid, gross(pid, h.par)]));
      r.marks[h.no] = {};
    }
    if (tweak) tweak(r);
    r.current = scored;
    AV.stampAvatars(s, r);
    const st = structuredClone(s);
    st.rounds[id] = structuredClone(r);
    st.activeRoundId = id;
    // Only this round going on, so Up next's resume card opens it
    delete st.rounds['r_live'];
    out[game] = st;
  }
  const four = [ME, 'p_jackson', 'p_marcus', 'p_dev'];
  make('r_top_nassau', 'nassau', four, {
    scored: 6, teams: [[ME, 'p_jackson'], ['p_marcus', 'p_dev']], sideGames: ['skins', 'dots'],
    // A press on the front from the 5th, so the press bar shows too
    tweak: r => { r.presses.push({ id: 'pr_top', leg: 'front', start: 5, by: 1 }); },
  });
  make('r_top_wolf', 'wolf', four, { scored: 4 });
  make('r_top_banker', 'banker', four, { scored: 3 });
  make('r_top_vegas', 'vegas', four, { scored: 3, teams: [[ME, 'p_marcus'], ['p_jackson', 'p_dev']] });
  return out;
}
