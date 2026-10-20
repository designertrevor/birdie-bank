import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ZONE, TEE_HOUR, cleanZone, teeDays, zoneClock } from './push-zones.js';

const at = iso => new Date(iso);
/** Every hourly run (minute 0, as the cron "0 * * * *") from `from` for `hours` hours. */
const runs = (from, hours) => Array.from({ length: hours }, (_, i) => new Date(Date.parse(from) + i * 3600000));

test('the wall clock in zones west and east of UTC, and on UTC itself', () => {
  const t = at('2026-10-20T15:00:00Z');
  assert.deepEqual(zoneClock(t, 'America/Denver'), { date: '2026-10-20', hour: 9, minute: 0 });
  assert.deepEqual(zoneClock(t, 'America/Los_Angeles'), { date: '2026-10-20', hour: 8, minute: 0 });
  assert.deepEqual(zoneClock(t, 'America/New_York'), { date: '2026-10-20', hour: 11, minute: 0 });
  assert.deepEqual(zoneClock(t, 'UTC'), { date: '2026-10-20', hour: 15, minute: 0 });
  assert.deepEqual(zoneClock(t, 'Europe/London'), { date: '2026-10-20', hour: 16, minute: 0 });
  assert.deepEqual(zoneClock(t, 'Asia/Tokyo'), { date: '2026-10-21', hour: 0, minute: 0 });
  assert.deepEqual(zoneClock(t, 'Australia/Sydney'), { date: '2026-10-21', hour: 2, minute: 0 });
  // Half and quarter hour zones read their real minutes
  assert.deepEqual(zoneClock(t, 'Asia/Kolkata'), { date: '2026-10-20', hour: 20, minute: 30 });
  assert.deepEqual(zoneClock(t, 'Asia/Kathmandu'), { date: '2026-10-20', hour: 20, minute: 45 });
});

test('an organizer in the US west gets it at 8 their time, and their own today', () => {
  assert.deepEqual(teeDays(['America/Denver', 'America/Los_Angeles'], at('2026-10-20T14:00:00Z')), { 'America/Denver': '2026-10-20' });
  assert.deepEqual(teeDays(['America/Denver', 'America/Los_Angeles'], at('2026-10-20T15:00:00Z')), { 'America/Los_Angeles': '2026-10-20' });
  // 7:59 is too early, 8:59 still counts
  assert.deepEqual(teeDays(['America/Denver'], at('2026-10-20T13:59:00Z')), {});
  assert.deepEqual(teeDays(['America/Denver'], at('2026-10-20T14:59:00Z')), { 'America/Denver': '2026-10-20' });
});

test('east of UTC "today" is already tomorrow in UTC terms, and the old UTC minus 7 day would be wrong', () => {
  // 23:00 UTC on the 20th is 8:00 on the 21st in Tokyo
  const t = at('2026-10-20T23:00:00Z');
  assert.deepEqual(teeDays(['Asia/Tokyo', 'Europe/London', 'America/Denver'], t), { 'Asia/Tokyo': '2026-10-21' });
  assert.notEqual(new Date(t.getTime() - 7 * 3600000).toISOString().slice(0, 10), '2026-10-21');
  // London in summer time (UTC+1): 7:00 UTC is 8:00 there
  assert.deepEqual(teeDays(['Europe/London'], at('2026-10-20T07:00:00Z')), { 'Europe/London': '2026-10-20' });
});

test('across the date line two zones are both at 8 at the same moment, on different days', () => {
  // Honolulu is UTC-10, Kiritimati UTC+14: 24 hours apart, so the same clock and a day between them
  const t = at('2026-10-20T18:00:00Z');
  assert.deepEqual(teeDays(['Pacific/Honolulu', 'Pacific/Kiritimati'], t), { 'Pacific/Honolulu': '2026-10-20', 'Pacific/Kiritimati': '2026-10-21' });
  // Samoa (UTC+13) is a day ahead of American Samoa (UTC-11) next door
  assert.equal(zoneClock(at('2026-10-20T19:00:00Z'), 'Pacific/Apia').date, '2026-10-21');
  assert.equal(zoneClock(at('2026-10-20T19:00:00Z'), 'Pacific/Pago_Pago').date, '2026-10-20');
  assert.deepEqual(teeDays(['Pacific/Apia', 'Pacific/Pago_Pago'], at('2026-10-20T19:00:00Z')), { 'Pacific/Apia': '2026-10-21', 'Pacific/Pago_Pago': '2026-10-20' });
});

test('daylight saving: Denver\u2019s 8 o\u2019clock moves an hour in UTC, and never goes twice or not at all', () => {
  // Summer time ends 2026-11-01 at 2:00 (MDT, UTC-6, to MST, UTC-7)
  assert.deepEqual(teeDays(['America/Denver'], at('2026-10-31T14:00:00Z')), { 'America/Denver': '2026-10-31' });
  assert.deepEqual(teeDays(['America/Denver'], at('2026-11-01T14:00:00Z')), {});
  assert.deepEqual(teeDays(['America/Denver'], at('2026-11-01T15:00:00Z')), { 'America/Denver': '2026-11-01' });
  // Summer time starts 2026-03-08 at 2:00
  assert.deepEqual(teeDays(['America/Denver'], at('2026-03-07T15:00:00Z')), { 'America/Denver': '2026-03-07' });
  assert.deepEqual(teeDays(['America/Denver'], at('2026-03-08T14:00:00Z')), { 'America/Denver': '2026-03-08' });
  // Phoenix keeps one offset all year
  assert.deepEqual(teeDays(['America/Phoenix'], at('2026-11-01T15:00:00Z')), { 'America/Phoenix': '2026-11-01' });
});

test('over every hourly run of a day, each zone has exactly one 8 o’clock hour, on change days too', () => {
  const zones = ['America/Denver', 'America/Phoenix', 'America/New_York', 'America/St_Johns', 'Europe/London', 'Europe/Berlin',
    'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Tokyo', 'Australia/Sydney', 'Australia/Adelaide', 'Pacific/Auckland',
    'Pacific/Honolulu', 'Pacific/Kiritimati', 'Pacific/Chatham', 'UTC'];
  // Ordinary days, the US and Europe change days, and Australia and New Zealand's spring forward
  for (const day of ['2026-10-20', '2026-10-25', '2026-11-01', '2026-03-08', '2026-03-29', '2026-10-04', '2026-09-27']) {
    for (const z of zones) {
      // The local day `day`: look at runs from two days around it and keep the ones on that day
      const hits = runs(`${day}T00:00:00Z`, 72).map(t => new Date(t.getTime() - 24 * 3600000))
        .filter(t => teeDays([z], t)[z] === day);
      assert.equal(hits.length, 1, `${z} on ${day}`);
    }
  }
});

test('half hour zones get theirs at half past 8', () => {
  const hit = runs('2026-10-20T00:00:00Z', 24).find(t => teeDays(['Asia/Kolkata'], t)['Asia/Kolkata']);
  assert.deepEqual(zoneClock(hit, 'Asia/Kolkata'), { date: '2026-10-20', hour: 8, minute: 30 });
  const nf = runs('2026-10-20T00:00:00Z', 24).find(t => teeDays(['America/St_Johns'], t)['America/St_Johns']);
  assert.equal(zoneClock(nf, 'America/St_Johns').minute, 30);
});

test('zone names: what a phone may save, and what the job does with a stray one', () => {
  assert.equal(cleanZone('America/Denver'), 'America/Denver');
  assert.equal(cleanZone(' Europe/London '), 'Europe/London');
  assert.equal(cleanZone('America/Argentina/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assert.equal(cleanZone('Etc/GMT+7'), 'Etc/GMT+7');
  assert.equal(cleanZone('UTC'), 'UTC');
  for (const bad of ['', 'Mars/Olympus_Mons', 'America/Denver; drop table', '../etc', 'x'.repeat(65), null, 7, {}]) assert.equal(cleanZone(bad), null, String(bad));
  // A name the server can't read follows Utah's clock, under its own name so the database matches it
  assert.deepEqual(teeDays(['Mars/Olympus_Mons'], at('2026-10-20T14:00:00Z')), { 'Mars/Olympus_Mons': '2026-10-20' });
  // Rows from the database, duplicates and junk
  assert.deepEqual(teeDays([{ time_zone: DEFAULT_ZONE }, DEFAULT_ZONE, null, { time_zone: 5 }, ''], at('2026-10-20T14:00:00Z')), { [DEFAULT_ZONE]: '2026-10-20' });
  assert.deepEqual(teeDays(null, at('2026-10-20T14:00:00Z')), {});
  assert.equal(TEE_HOUR, 8);
});

// push_tee_due in supabase/2026-10-20-push-timezones.sql, as plain data: the organizer's newest
// phone picks the zone, the plan is due on that zone's today, and each plan is marked sent once.
function teeDueModel(db, days) {
  const out = [];
  for (const p of db.plans) {
    const phones = db.phones.filter(s => s.user === p.host).sort((a, b) => b.updatedAt - a.updatedAt);
    const today = phones.length ? days[phones[0].zone] : undefined;
    if (!today || db.sent.has(p.code) || p.booked || !(p.remindOn <= today) || !(p.date >= today)) continue;
    db.sent.add(p.code);
    out.push(p.code);
  }
  return out;
}

test('once per plan: flying Tokyo to Denver gives a second 8 o’clock, and the plan still goes once', () => {
  const db = { plans: [{ code: 'AB12CD', host: 'u1', remindOn: '2026-10-21', date: '2026-10-24' }], phones: [{ user: 'u1', zone: 'Asia/Tokyo', updatedAt: 1 }], sent: new Set() };
  const sends = [];
  for (const t of runs('2026-10-20T00:00:00Z', 96)) {
    // Lands in Denver on the 21st at 12:00 UTC, opens the app, and the phone saves its new zone
    if (t.toISOString() === '2026-10-21T12:00:00.000Z') db.phones[0] = { ...db.phones[0], zone: 'America/Denver', updatedAt: 2 };
    const days = teeDays(db.phones.map(s => s.zone), t);
    for (const code of teeDueModel(db, days)) sends.push([code, t.toISOString()]);
  }
  // Tokyo's 8:00 on the 21st is 23:00 UTC on the 20th; Denver's 8:00 on the 21st (14:00 UTC) finds it sent
  assert.deepEqual(sends, [['AB12CD', '2026-10-20T23:00:00.000Z']]);
  // Without the sent mark, the move would have sent it again on each later morning
  db.sent.clear();
  assert.deepEqual(teeDueModel(db, teeDays(['America/Denver'], at('2026-10-21T14:00:00Z'))), ['AB12CD']);
});

test('once per plan: a job that runs twice in the hour, and two phones in different zones, send once', () => {
  const db = {
    plans: [{ code: 'ZZ99ZZ', host: 'u2', remindOn: '2026-10-20', date: '2026-10-22' }],
    // An old laptop in New York and the phone they used last in Denver: the newest one counts
    phones: [{ user: 'u2', zone: 'America/New_York', updatedAt: 1 }, { user: 'u2', zone: 'America/Denver', updatedAt: 5 }],
    sent: new Set(),
  };
  const zones = db.phones.map(s => s.zone);
  assert.deepEqual(teeDueModel(db, teeDays(zones, at('2026-10-20T12:00:00Z'))), []); // 8:00 in New York
  assert.deepEqual(teeDueModel(db, teeDays(zones, at('2026-10-20T14:00:00Z'))), ['ZZ99ZZ']); // 8:00 in Denver
  assert.deepEqual(teeDueModel(db, teeDays(zones, at('2026-10-20T14:20:00Z'))), []); // a second run that hour
});

test('a reminder day that falls on the round day still goes that morning, and never after the round', () => {
  const db = { plans: [{ code: 'RD0001', host: 'u3', remindOn: '2026-10-24', date: '2026-10-24' }], phones: [{ user: 'u3', zone: 'Europe/London', updatedAt: 1 }], sent: new Set() };
  assert.deepEqual(teeDueModel(db, teeDays(['Europe/London'], at('2026-10-23T07:00:00Z'))), []);
  assert.deepEqual(teeDueModel(db, teeDays(['Europe/London'], at('2026-10-24T07:00:00Z'))), ['RD0001']);
  db.sent.clear();
  // London leaves summer time on the 25th: 8:00 is 8:00 UTC, and the round has gone by
  assert.deepEqual(teeDueModel(db, teeDays(['Europe/London'], at('2026-10-25T08:00:00Z'))), []);
});
