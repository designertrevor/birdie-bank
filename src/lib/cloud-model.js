// Pure helpers for saving app state to the cloud as small documents, one per
// player, crew, course, round, payment, plus one "profile" for you and your settings.
// Each document is compared by content, so only what changed gets sent.
import { stable } from './sync-model.js';
import { mergeSettings, migrateSettings } from './settings.js';
import { nextActiveId } from './rounds.js';
import { mergeExpenses } from './trip-expenses.js';

// Round fields that only mean something on this phone
const ROUND_LOCAL = ['_remote'];

/** Split app state into documents: { 'kind:id': { kind, id, data } }. */
export function toDocs(state) {
  const out = {};
  const put = (kind, id, data) => { out[`${kind}:${id}`] = { kind, id, data }; };
  put('profile', 'me', {
    me: state.me, onboarded: state.onboarded, settings: state.settings, favorites: state.favorites, usuals: Array.isArray(state.usuals) ? state.usuals : [], carries: state.carries || [],
    // Who is who: "Same person as..." links and "Not the same person" breaks (people-links.js)
    links: state.links && typeof state.links === 'object' ? state.links : {}, unlinks: Array.isArray(state.unlinks) ? state.unlinks : [],
    rewardsDone: state.rewardsDone || {},
    starredCourses: Array.isArray(state.starredCourses) ? state.starredCourses : [],
    // Your avatar, home course and privacy settings (profile-model.js), so every phone you sign in on has them
    profile: state.profile && typeof state.profile === 'object' && !Array.isArray(state.profile) ? state.profile : {},
    // Golf trips (trips.js): name, dates and "done playing". Their rounds carry the trip themselves
    trips: state.trips && typeof state.trips === 'object' && !Array.isArray(state.trips) ? state.trips : {},
    // Trips you hid from your Tab and Up next (trips.js tripHidden)
    tripHidden: state.tripHidden && typeof state.tripHidden === 'object' && !Array.isArray(state.tripHidden) ? state.tripHidden : {},
    // Trip expenses (trip-expenses.js), yours and the ones friends' phones sent, deleted ones as a stub
    tripExpenses: state.tripExpenses && typeof state.tripExpenses === 'object' && !Array.isArray(state.tripExpenses) ? state.tripExpenses : {},
    // Stake payments you marked on a team points trip (cup.js), kept off the Tab
    cupPaid: state.cupPaid && typeof state.cupPaid === 'object' && !Array.isArray(state.cupPaid) ? state.cupPaid : {},
    // Booking pages saved for courses, and when you last nudged each person (tee-reminders.js, nudges.js)
    courseLinks: state.courseLinks && typeof state.courseLinks === 'object' && !Array.isArray(state.courseLinks) ? state.courseLinks : {},
    nudges: state.nudges && typeof state.nudges === 'object' && !Array.isArray(state.nudges) ? state.nudges : {},
  });
  for (const p of Object.values(state.players)) put('player', p.id, p);
  for (const c of Object.values(state.crews)) put('crew', c.id, c);
  for (const c of Object.values(state.customCourses)) put('course', c.id, c);
  for (const r of Object.values(state.rounds)) {
    const data = { ...r };
    for (const k of ROUND_LOCAL) delete data[k];
    put('round', r.id, data);
  }
  for (const s of state.settlements) put('settlement', s.id, s);
  return out;
}

export function hashDoc(data) { return data == null ? 'null' : stable(data); }

/** Hash every document: { key: hash }. */
export function hashAll(docs) {
  const out = {};
  for (const [k, d] of Object.entries(docs)) out[k] = hashDoc(d.data);
  return out;
}

/** Put one document (or its deletion, when data is null) into a state draft (mutates). */
export function applyDoc(draft, kind, id, data) {
  const map = { player: 'players', crew: 'crews', course: 'customCourses', round: 'rounds' }[kind];
  if (map) {
    if (data == null) delete draft[map][id];
    else if (kind === 'round') draft.rounds[id] = { ...data, _remote: draft.rounds[id]?._remote };
    else draft[map][id] = data;
    if (kind === 'round' && data == null && draft.activeRoundId === id) draft.activeRoundId = nextActiveId(draft, id);
    return;
  }
  if (kind === 'settlement') {
    draft.settlements = draft.settlements.filter(s => s.id !== id);
    if (data != null) draft.settlements.push(data);
    return;
  }
  if (kind === 'profile' && data != null) {
    // A profile saved before setup finished never blanks out who "me" is
    if (data.me) draft.me = data.me;
    draft.onboarded = data.onboarded || draft.onboarded;
    // Game by game, so a profile saved before a house rule was added never wipes it
    draft.settings = mergeSettings(draft.settings, migrateSettings(data.settings));
    draft.favorites = data.favorites || [];
    // A profile saved by an older version has no usuals or carries: keep this phone's rather than wiping them
    if (Array.isArray(data.usuals)) draft.usuals = data.usuals;
    if (Array.isArray(data.carries)) draft.carries = data.carries;
    // Same for links and unlinks (people-links.js): an older profile has none, so keep this phone's
    if (data.links && typeof data.links === 'object' && !Array.isArray(data.links)) draft.links = data.links;
    if (Array.isArray(data.unlinks)) draft.unlinks = data.unlinks;
    // Reward lines marked done (per phone, never money): an older profile without them keeps this phone's
    if (data.rewardsDone && typeof data.rewardsDone === 'object' && !Array.isArray(data.rewardsDone)) draft.rewardsDone = data.rewardsDone;
    // Starred courses came later too: an older profile keeps this phone's stars
    if (Array.isArray(data.starredCourses)) draft.starredCourses = data.starredCourses;
    // Your own profile came later too: an older profile keeps this phone's
    if (data.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)) draft.profile = data.profile;
    // Trips came later still: an older profile keeps this phone's
    if (data.trips && typeof data.trips === 'object' && !Array.isArray(data.trips)) draft.trips = data.trips;
    // And hidden trips later again
    if (data.tripHidden && typeof data.tripHidden === 'object' && !Array.isArray(data.tripHidden)) draft.tripHidden = data.tripHidden;
    // Trip expenses are kept expense by expense, the newer copy of each, so two of your phones
    // adding one at once both keep theirs (a deleted one stays as a stub, so it stays deleted)
    if (data.tripExpenses && typeof data.tripExpenses === 'object' && !Array.isArray(data.tripExpenses)) {
      draft.tripExpenses = mergeExpenses(draft.tripExpenses || {}, Object.values(data.tripExpenses));
    }
    // And the stake marks of team points trips later still
    if (data.cupPaid && typeof data.cupPaid === 'object' && !Array.isArray(data.cupPaid)) draft.cupPaid = data.cupPaid;
    // Booking links and nudges came later again: an older profile keeps this phone's
    if (data.courseLinks && typeof data.courseLinks === 'object' && !Array.isArray(data.courseLinks)) draft.courseLinks = data.courseLinks;
    if (data.nudges && typeof data.nudges === 'object' && !Array.isArray(data.nudges)) draft.nudges = data.nudges;
  }
}

/**
 * Decide what to do with one remote document.
 * local/shadow/remote are hashes; shadow is what this phone last agreed with the server
 * (undefined if never synced). Returns 'same' | 'take' (apply remote) | 'keep' (push ours).
 */
export function resolve({ local, shadow, remote, localChangedAt = 0, remoteChangedAt = 0 }) {
  if (local === remote) return 'same';
  const localChanged = local !== (shadow ?? 'null');
  if (!localChanged) return 'take';
  return remoteChangedAt > localChangedAt ? 'take' : 'keep';
}

/** What to send: documents whose hash differs from the shadow, and deletions of ones that went away. */
export function outgoing(docs, shadow) {
  const out = [];
  for (const [k, d] of Object.entries(docs)) {
    if (hashDoc(d.data) !== shadow[k]) out.push({ key: k, kind: d.kind, id: d.id, data: d.data, deleted: false });
  }
  for (const [k, h] of Object.entries(shadow)) {
    if (!docs[k] && h !== 'null') {
      const i = k.indexOf(':');
      out.push({ key: k, kind: k.slice(0, i), id: k.slice(i + 1), data: null, deleted: true });
    }
  }
  return out;
}

/**
 * First sign-in on a phone that already has its own "me": replace that player id with the
 * account's id everywhere, so both phones agree on who you are. Ids are random strings,
 * so a plain text swap over the JSON is safe.
 */
export function remapId(state, from, to) {
  if (!from || !to || from === to) return state;
  // Object keys are quoted too, so player maps and score maps follow along
  return JSON.parse(JSON.stringify(state).split(JSON.stringify(from)).join(JSON.stringify(to)));
}
