// Saved game defaults across versions. Pure, so the store and cloud sync can share it (and tests can load it).

/** The current version of the saved game defaults. */
export const SETTINGS_REV = 2;

/** Defaults that changed in rev 2 (2026-09-27). */
export const REV2_DEFAULTS = {
  stableford: { stake: 5, payout: 'pot', modified: false },
  quota: { stake: 5, payout: 'pot' },
  rabbit: { stake: 5, mode: 'free', tiesFree: false },
};

/**
 * Bring saved game defaults up to date. Rev 2: Stableford and Quota default to a pot, and Rabbit
 * defaults to "set free" with ties changing nothing. Stableford and Quota move only while they still
 * sit on the old defaults ($1 a point); a stake someone picked is kept. Nobody could pick "set free"
 * before rev 2, so Rabbit's rules always move. Returns a new object; settings at rev 2 come back as they are.
 */
export function migrateSettings(saved) {
  if (!saved || typeof saved !== 'object' || (saved.rev || 1) >= SETTINGS_REV) return saved;
  const out = { ...saved, rev: SETTINGS_REV };
  if (saved.stableford?.payout === 'per' && saved.stableford?.stake === 1) out.stableford = { ...REV2_DEFAULTS.stableford, modified: !!saved.stableford.modified };
  if (saved.quota?.payout === 'per' && saved.quota?.stake === 1) out.quota = { ...REV2_DEFAULTS.quota };
  if (saved.rabbit) out.rabbit = { ...saved.rabbit, mode: 'free', tiesFree: false };
  return out;
}
