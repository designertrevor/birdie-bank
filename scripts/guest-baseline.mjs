// Today's guest-to-account share, before the invite and sign-in events (analytics-core.js) have
// any history: of the seats friends took from a link in live rounds, how many are linked to an
// account (account_players). It only reads, and prints counts, never a name, a code or an id.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/guest-baseline.mjs
//
// The data walls (scripts/data-walls.mjs) keep live rounds and account_players from a stranger, so
// this needs the service role key: Supabase dashboard, Project Settings, API keys, service_role.
// Paste it in the terminal for one run; never put it in a file, the app or Vercel.
//
// A seat is claimed when a phone took it: the round's devs map says which phone holds each seat
// (keeper-lock.js). Seats held by the phone that shared the round (hostDev) are the organizer's
// and are counted on their own line. Rounds shared before the keeper lock have no devs and are skipped.

const URL_ = process.env.VITE_SUPABASE_URL || 'https://yffribkjqvkncmypexfa.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!KEY) {
  console.log('Set SUPABASE_SERVICE_ROLE_KEY for this run (see the top of this file).');
  process.exit(1);
}

async function readAll(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`${path.split('?')[0]}: status ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '–');

const [rounds, links] = await Promise.all([
  readAll('live_rounds?select=meta,updated_at'),
  readAll('account_players?select=player_id'),
]);
const linked = new Set(links.map(l => l.player_id));

let withPhones = 0;
let finished = 0;
const guest = { seats: 0, linked: 0, finished: 0, finishedLinked: 0 };
const organizer = { seats: 0, linked: 0 };
for (const { meta } of rounds) {
  if (!isObj(meta?.devs)) continue;
  withPhones += 1;
  const done = meta.status === 'done';
  if (done) finished += 1;
  for (const [seat, phone] of Object.entries(meta.devs)) {
    if (!seat || !phone) continue;
    const isLinked = linked.has(seat);
    if (phone === meta.hostDev) { organizer.seats += 1; if (isLinked) organizer.linked += 1; continue; }
    guest.seats += 1;
    if (isLinked) guest.linked += 1;
    if (done) { guest.finished += 1; if (isLinked) guest.finishedLinked += 1; }
  }
}

console.log(`Live rounds: ${rounds.length} (${withPhones} with phones on record, ${finished} of those finished)`);
console.log(`Seat ids linked to an account: ${linked.size}`);
console.log('');
console.log(`Friends' seats taken from a link: ${guest.seats}`);
console.log(`  linked to an account:           ${guest.linked} (${pct(guest.linked, guest.seats)})`);
console.log(`  in finished rounds:             ${guest.finished}, linked ${guest.finishedLinked} (${pct(guest.finishedLinked, guest.finished)})`);
console.log(`Organizer seats (the sharing phone): ${organizer.seats}, linked ${organizer.linked} (${pct(organizer.linked, organizer.seats)})`);
console.log('');
console.log('A friend who plays in several rounds counts once per round. Only rounds still on the server');
console.log('count, so this is a snapshot of today, not every round ever played.');
