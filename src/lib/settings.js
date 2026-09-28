// Saved game defaults across versions. Pure, so the store and cloud sync can share it (and tests can load it).

/** The current version of the saved game defaults. */
export const SETTINGS_REV = 3;

/** Defaults that changed in rev 2 (2026-09-27). */
export const REV2_DEFAULTS = {
  stableford: { stake: 5, payout: 'pot', modified: false },
  quota: { stake: 5, payout: 'pot' },
  rabbit: { stake: 5, mode: 'free', tiesFree: false },
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
 * could pick a cap before). Returns a new object; settings at the current rev come back as they are.
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
  return out;
}
