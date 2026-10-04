// The server's lock on upcoming rounds, as plain rules. supabase/2026-10-04-plan-lock.sql does the
// same thing in the database, and the dev "two tabs" transport (plan-adapters.js) uses this copy, so
// the tests here are the spec for both. Pure, so tests can load it.
//
// A writer is { dev, user }: the hash of the phone's device key (device.js) and its account, either
// of which can be null. The server keeps who made the plan (`host`) and who made each answer
// (`owners`, by who), never sent to any phone:
//  • The plan itself: only the organizer (their phone, or their account once signed in).
//  • Each answer: only whoever made it. The first phone to answer for a name owns that answer. The
//    organizer can mark someone who told them in person; that answer stays open, the person's own
//    answer replaces it, and from then on it's theirs. The organizer's own answer is theirs alone.
//  • A plan shared before the lock (no host on record) is open to everyone with the code, as are
//    answers made with no device key and no account (an older app).
// Votes follow the answer: they never take one, so a phone votes only on an answer it owns.

const isStr = v => typeof v === 'string' && v.length > 0;
const isMe = (rec, w) => !!rec && ((isStr(rec.dev) && rec.dev === w?.dev) || (isStr(rec.user) && rec.user === w?.user));
const known = rec => !!rec && (isStr(rec.dev) || isStr(rec.user));

/** Who to note as the organizer of a new plan, or null when the writer can't be known (an older app). */
export function hostOf(w) {
  return isStr(w?.dev) || isStr(w?.user) ? { dev: w.dev ?? null, user: w.user ?? null } : null;
}

/**
 * Whether `w` may change or delete the plan. `host` is who made it (null: shared before the lock).
 * Returns { ok, host } with the organizer's account noted once they've signed in.
 */
export function planWrite(host, w) {
  if (!known(host)) return { ok: true, host: host ?? null };
  if (!isMe(host, w)) return { ok: false, host };
  return { ok: true, host: !isStr(host.user) && isStr(w?.user) ? { ...host, user: w.user } : host };
}

/**
 * Who is writing `who`'s answer: 'open' (no lock on it), 'host' (the organizer), 'self' (the person's
 * own phone or account), or null when it isn't theirs to change. `take` is an RSVP write, which can
 * take an answer nobody owns yet or one the organizer marked; a vote never does.
 * `owner` is the answer's record ({ dev, user, byHost } or null). Returns { as, owner } with the
 * record as it is after the write.
 */
export function answerWrite({ host, hostWho = 'host', who, owner = null, w, take = false }) {
  if (!known(host)) return { as: 'open', owner };
  const isHost = isMe(host, w);
  if (who === (hostWho || 'host')) return { as: isHost ? 'host' : null, owner };
  const owned = known(owner);
  if (owned && !owner.byHost) {
    if (!isMe(owner, w)) return { as: null, owner };
    return { as: 'self', owner: !isStr(owner.user) && isStr(w?.user) ? { ...owner, user: w.user } : owner };
  }
  if (isHost) {
    return { as: 'host', owner: take && !owned ? { dev: w?.dev ?? null, user: w?.user ?? null, byHost: true } : owner };
  }
  if (!take) return { as: owned ? null : 'open', owner };
  if (!isStr(w?.dev) && !isStr(w?.user)) return { as: 'open', owner };
  return { as: 'self', owner: { dev: w.dev ?? null, user: w.user ?? null, byHost: false } };
}
