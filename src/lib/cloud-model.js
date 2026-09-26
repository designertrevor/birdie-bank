// Pure helpers for saving app state to the cloud as small documents, one per
// player, crew, course, round, payment, plus one "profile" for you and your settings.
// Each document is compared by content, so only what changed gets sent.
import { stable } from './sync-model.js';

// Round fields that only mean something on this phone
const ROUND_LOCAL = ['_remote'];

/** Split app state into documents: { 'kind:id': { kind, id, data } }. */
export function toDocs(state) {
  const out = {};
  const put = (kind, id, data) => { out[`${kind}:${id}`] = { kind, id, data }; };
  put('profile', 'me', { me: state.me, onboarded: state.onboarded, settings: state.settings, favorites: state.favorites });
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
    if (kind === 'round' && data == null && draft.activeRoundId === id) draft.activeRoundId = null;
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
    draft.settings = { ...draft.settings, ...data.settings };
    draft.favorites = data.favorites || [];
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
