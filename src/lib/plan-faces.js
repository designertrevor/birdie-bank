// Faces on a plan: everyone wears the face they have everywhere else, on every phone. A friend's
// phone doesn't know the organizer's player ids, so the organizer's phone stamps the faces it knows
// onto the plan when it goes up (plan-sync.js): its own as `hostAvatar`, everyone else's in `faces`.
import { avatarFor, shareableAvatar } from './avatars.js';

/**
 * The faces the organizer's phone knows for the people on a plan, by who: { [who]: avatar }. The
 * organizer's own goes in `hostAvatar` instead. Null when it knows none.
 */
export function planFaces(state, plan) {
  const out = {};
  for (const p of plan?.people || []) {
    if (!p?.id || p.id === plan.hostWho) continue;
    const a = shareableAvatar(avatarFor(state, p.id));
    if (a) out[p.id] = a;
  }
  return Object.keys(out).length ? out : null;
}

/** Put the organizer's phone's faces on its plan (a draft inside update), before it goes up. */
export function stampPlanFaces(state, plan) {
  if (!plan?.host) return plan;
  const host = shareableAvatar(state?.profile?.avatar);
  if (host) plan.hostAvatar = host;
  const faces = planFaces(state, plan);
  if (faces) plan.faces = faces; else delete plan.faces;
  return plan;
}

/**
 * Which avatar a seat on a plan shows, as props for <Avatar>: { id, seat }. `me` is this phone's
 * own player id. The organizer is `hostWho` (not a player id): their profile on their own phone,
 * the face the plan carried on a friend's. Your own seat on a friend's plan is you (your profile,
 * else the face the organizer has for you). Anyone else on a friend's phone is the face the plan
 * carried, never a lookup by the organizer's ids, which mean nothing (or someone else) here.
 */
export function planSeatAvatar(plan, who, me) {
  const carried = a => (a ? { avatar: a } : null);
  if (!who || who === plan?.hostWho) return plan?.host ? { id: me, seat: null } : { id: null, seat: carried(plan?.hostAvatar) };
  const face = carried(plan?.faces?.[who]);
  if (plan?.host) return { id: who, seat: face };
  if (who === plan?.localMe) return { id: me, seat: face };
  // A plan from before faces were carried: their id is the best guess left
  return face ? { id: null, seat: face } : { id: who, seat: null };
}
