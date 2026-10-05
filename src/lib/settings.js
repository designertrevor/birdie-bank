// Saved game defaults across versions. Pure, so the store and cloud sync can share it (and tests can load it).

/** The current version of the saved game defaults. */
export const SETTINGS_REV = 4;

/** Defaults that changed in rev 2 (2026-09-27). */
export const REV2_DEFAULTS = {
  stableford: { stake: 5, payout: 'pot', modified: false },
  quota: { stake: 5, payout: 'pot' },
  rabbit: { stake: 5, mode: 'free', tiesFree: false },
};

/**
 * How the team games (Best ball, Shamble, Alternate shot, Chapman, 2026-10-03) are bet unless the group
 * changes it: a $5 Nassau played as a match, presses by hand like Nassau's. `stake` is the one bet on
 * the round, `perHole` the bet a hole won. Best ball and Shamble count the best ball (count 2: the
 * best two, for teams of three or four); Shamble's drives are a scramble's minimum drives (0: off).
 * New games, so nothing saved before them changes: mergeSettings fills them in on older phones.
 */
const TEAM_BETS = { format: 'nassau', scoring: 'match', front: 5, back: 5, total: 5, stake: 10, perHole: 2, pressMode: 'manual', threshold: 2, turnPress: false, noLastPress: false };
// lowTotal (2026-10-05): low ball and low total, a second point a hole per hole, off unless picked
export const TEAM_DEFAULTS = {
  bestball: { ...TEAM_BETS, count: 1, lowTotal: false },
  shamble: { ...TEAM_BETS, count: 1, drives: 0, lowTotal: false },
  altshot: { ...TEAM_BETS },
  chapman: { ...TEAM_BETS },
};

/**
 * Most doubles a doubling snake makes, for new rounds (rev 3, 2026-09-28): 4, so a $5 snake stops at $80.
 * 0 means no cap. A round saved without a cap has none, so rounds already played keep their money.
 */
export const SNAKE_CAP_DEFAULT = 4;

/**
 * Bring saved game defaults up to date. Rev 2: Stableford and Quota default to a pot, and Rabbit
 * defaults to "set free" with ties changing nothing. Stableford and Quota move only while they still
 * sit on the old defaults ($1 a point); a stake someone picked is kept. Nobody could pick "set free"
 * before rev 2, so Rabbit's rules always move. Rev 3: a doubling snake gets a cap of 4 doubles (nobody
 * could pick a cap before). Rev 4 (2026-09-30): blind wolf is one or two more than a lone wolf
 * (blindPlus) instead of 3× or 4×, and starts off: still on the old default (on at 3×), it goes off.
 * Returns a new object; settings at the current rev come back as they are.
 */
export function migrateSettings(saved) {
  const rev = saved?.rev || 1;
  if (!saved || typeof saved !== 'object' || rev >= SETTINGS_REV) return saved;
  const out = { ...saved, rev: SETTINGS_REV };
  if (rev < 2) {
    if (saved.stableford?.payout === 'per' && saved.stableford?.stake === 1) out.stableford = { ...REV2_DEFAULTS.stableford, modified: !!saved.stableford.modified };
    if (saved.quota?.payout === 'per' && saved.quota?.stake === 1) out.quota = { ...REV2_DEFAULTS.quota };
    if (saved.rabbit) out.rabbit = { ...saved.rabbit, mode: 'free', tiesFree: false };
  }
  if (saved.snake && saved.snake.cap == null) out.snake = { ...saved.snake, cap: SNAKE_CAP_DEFAULT };
  if (rev < 4 && saved.wolf && saved.wolf.blindPlus == null) {
    const { blindMultiplier: bm, ...wolf } = saved.wolf;
    const lone = wolf.loneMultiplier || 2;
    wolf.blindPlus = Math.min(2, Math.max(1, (bm ?? 3) - lone));
    if (wolf.blind && (bm ?? 3) === 3) wolf.blind = false;
    out.wolf = wolf;
  }
  return out;
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Lay saved game defaults over the ones on this phone, one game at a time, the way the store's load
 * does. A key the saved copy has wins; a key it lacks (a house rule added since it was saved, like
 * wolf.blind or dots.kinds.hogan) keeps this phone's value. Returns a new object.
 */
export function mergeSettings(base, saved) {
  if (!isObj(saved)) return { ...base };
  const out = { ...base, ...saved };
  for (const [k, v] of Object.entries(saved)) {
    if (isObj(v) && isObj(base?.[k])) out[k] = { ...base[k], ...v };
  }
  if (isObj(out.dots) && isObj(base?.dots?.kinds) && isObj(saved.dots?.kinds)) out.dots = { ...out.dots, kinds: { ...base.dots.kinds, ...saved.dots.kinds } };
  return out;
}
