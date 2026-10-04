// Which player ids the server links to an account, as plain rules. supabase/2026-10-04-seat-links.sql
// does the same thing in the database (link_my_players), so the tests here are its spec. Pure.
//
// An id is linked only from what the server saw for itself, never from the account's own saved data
// (a profile's player id or a saved round's localMe are that phone's own word):
//  1. A seat this phone took in a live round: devs[seat] is this phone's device hash (only that
//     phone can put its own hash there) and the round's claims give the seat to you now. Any phone
//     with the link can take a seat that isn't the keeper's, so this never moves another account's link.
//  2. Your own player id when this phone holds it as a seat in a live round (devs[your id]).
//  3. Your own player id when nobody else could know it: no other account's saved rounds have it,
//     and no live round has it as a seat that isn't this phone's.
// 1 and 2 also need a sealed round (its host phone on it from the start) and the seat in that
// round's group: everyone else who saved a round with that id also saved one shared from the same
// host phone. The first account to link an id keeps it (links made before the rule, with no `dev`,
// included): nothing here moves an id from one account to another. A seat linked from a round that still exists comes off when the round's claims
// no longer give it to you (you switched seats); links only change from the phone that made them.

const isStr = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const playersOf = meta => (Array.isArray(meta?.players) ? meta.players.map(p => p?.id).filter(isStr) : []);

/**
 * Whether everyone but `me` who saved a round with `id` also saved a round shared from the phone
 * `host`. `saved`: every account's saved rounds, [{ user, players: [ids], hostDev, deleted }].
 */
export function seatInGroup(saved, id, host, me) {
  if (!isStr(host)) return false;
  const live = (saved || []).filter(r => !r.deleted);
  const holders = new Set(live.filter(r => r.user !== me && (r.players || []).includes(id)).map(r => r.user));
  for (const u of holders) if (!live.some(r => r.user === u && r.hostDev === host)) return false;
  return true;
}

/** Evidence 1 and 2: [{ id, code }], one round per id (the first code in order). */
export function strongSeats({ me, device, myPlayer, liveRounds = [], saved = [] }) {
  if (!isStr(device) || !isStr(myPlayer)) return [];
  const found = [];
  for (const r of liveRounds) {
    if (!r?.sealed) continue;
    const meta = r.meta || {};
    const devs = isObj(meta.devs) ? meta.devs : {};
    const seats = playersOf(meta);
    const claims = isObj(meta.claims) ? meta.claims : {};
    for (const [seat, who] of Object.entries(claims)) {
      if (who === myPlayer && isStr(seat) && devs[seat] === device && seats.includes(seat)) found.push({ id: seat, code: r.code, host: meta.hostDev });
    }
    if (seats.includes(myPlayer) && devs[myPlayer] === device) found.push({ id: myPlayer, code: r.code, host: meta.hostDev });
  }
  const out = new Map();
  for (const f of found.filter(f => seatInGroup(saved, f.id, f.host, me)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : String(a.code) < String(b.code) ? -1 : 1))) {
    if (!out.has(f.id)) out.set(f.id, { id: f.id, code: f.code });
  }
  return [...out.values()];
}

/** Evidence 3: your own id, when no other account's rounds and no other phone's seat have it. */
export function ownIdFree({ me, device, myPlayer, liveRounds = [], saved = [] }) {
  if (!isStr(myPlayer)) return false;
  if ((saved || []).some(r => !r.deleted && r.user !== me && (r.players || []).includes(myPlayer))) return false;
  return !liveRounds.some(r => playersOf(r.meta).includes(myPlayer) && (!isStr(device) || r.meta?.devs?.[myPlayer] !== device));
}

/**
 * One run of link_my_players for account `me` from phone `device`. `links`: every account's links,
 * [{ playerId, user, dev, roundCode }]. Returns { links (all of them, after the run), mine (ids) }.
 */
export function linkMyPlayers({ me, device = null, myPlayer = null, liveRounds = [], saved = [], links = [] }) {
  const input = { me, device, myPlayer: isStr(myPlayer) ? myPlayer : null, liveRounds, saved };
  const strong = strongSeats(input);
  const ownOk = !!input.myPlayer && !strong.some(s => s.id === input.myPlayer) && ownIdFree(input);
  let out = links.map(l => ({ ...l }));

  // A seat this phone linked from a round still there, whose claims don't give it to you any more
  if (isStr(device) && input.myPlayer) {
    out = out.filter(l => {
      if (l.user !== me || l.dev !== device || !l.roundCode || l.playerId === input.myPlayer) return true;
      const r = liveRounds.find(x => x.code === l.roundCode);
      return !r || r.meta?.claims?.[l.playerId] === input.myPlayer;
    });
  }
  // The server's evidence: a new link, or one of yours brought up to date. Another account's stays theirs
  for (const s of strong) {
    const cur = out.find(l => l.playerId === s.id);
    if (!cur) out.push({ playerId: s.id, user: me, dev: device, roundCode: s.code });
    else if (cur.user === me) Object.assign(cur, { dev: device, roundCode: s.code });
  }
  if (ownOk) {
    const cur = out.find(l => l.playerId === input.myPlayer);
    if (!cur) out.push({ playerId: input.myPlayer, user: me, dev: device, roundCode: null });
    else if (cur.user === me && cur.dev == null) cur.dev = device;
  }
  return { links: out, mine: out.filter(l => l.user === me).map(l => l.playerId) };
}
