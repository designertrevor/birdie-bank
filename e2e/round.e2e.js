// End to end: start a round, score it, settle up (ROADMAP area 25). Run before each ship.
//
//   npm run e2e                 headless, about 45 seconds
//   E2E_HEADED=1 npm run e2e    watch it in a Chrome window
//   E2E_SLOWMO=150 npm run e2e  slower, to follow along
//
// What it proves, in a real browser at iPhone size (390 by 844) on a phone with nothing saved:
// a new organizer gets through onboarding (age check and friendly wagers note included), sets up
// an 18-hole Skins round for four on a built-in course, taps in every score with the + and - buttons,
// gets past the first tee card, the side bets card and the halfway sheet, and finishes. Then the
// money is checked everywhere it shows: the reveal, Settle up, the results page and the Tab. Every
// amount adds to zero and matches what this file works out on its own from the Skins rules
// (carryovers on, a carry left after 18 goes unclaimed), and no console error or page error fires.
//
// It starts its own Vite dev server on a free port from 5180 to 5189, with the cloud, crash reports,
// usage counts and the paywall switched off, so it never touches Supabase or another phone's data.
// It drives the Google Chrome already on the Mac through playwright-core (nothing to download). With
// no Chrome, set CHROME_PATH, or run `npx playwright-core install chromium` once.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLAYERS = ['Alex', 'Blake', 'Casey', 'Drew']; // Alex is this phone's owner
const SKIN = 2; // the default $2 a skin, per skin, carryovers on, a last carry goes to nobody

// Strokes against par, hole by hole, for Alex, Blake, Casey and Drew. Ties carry the skin; the last
// two holes tie, so two skins are left over at the end and go unclaimed. Holes 2, 8, 9 and 17 are
// all pars, which also covers Save on a hole where nothing was touched.
const STROKES = [
  [-1, 0, 0, 0], [0, 0, 0, 0], [1, -1, -1, 0], [1, 1, 1, 0], [0, 1, 0, 1], [1, 1, -1, 0],
  [0, -1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [-1, 0, -1, 0], [2, 1, 1, 0], [-1, 0, 0, 0],
  [0, 0, 1, 1], [0, -2, 0, 0], [1, 0, 1, 1], [0, 0, -1, 0], [0, 0, 0, 0], [-1, -1, 0, 0],
];

/**
 * Skins worked out here, apart from the app (src/lib/round.js skinsTable and skinsMoney): the low
 * score alone takes the hole's skin and every skin carried into it; a tie carries them on. Per skin,
 * each of the other players pays the winner the bet. No handicaps, so net and gross are the same.
 */
function expectedSkins(strokes, value) {
  const won = Object.fromEntries(PLAYERS.map(p => [p, 0]));
  let carry = 0;
  for (const hole of strokes) {
    const low = Math.min(...hole);
    const lows = PLAYERS.filter((_, i) => hole[i] === low);
    if (lows.length === 1) { won[lows[0]] += carry + 1; carry = 0; } else carry += 1;
  }
  const total = Object.values(won).reduce((a, b) => a + b, 0);
  const n = PLAYERS.length;
  // Collect from each other player for your skins, pay each winner for theirs
  const net = Object.fromEntries(PLAYERS.map(p => [p, value * (won[p] * (n - 1) - (total - won[p]))]));
  return { won, unclaimed: carry, net };
}

/** Fewest payments: the biggest debt pays the biggest credit, until everyone is square. */
function expectedPayments(net) {
  const up = Object.entries(net).filter(([, v]) => v > 0).map(([p, v]) => [p, v]).sort((a, b) => b[1] - a[1]);
  const down = Object.entries(net).filter(([, v]) => v < 0).map(([p, v]) => [p, -v]).sort((a, b) => b[1] - a[1]);
  const out = [];
  while (up.length && down.length) {
    const amt = Math.min(up[0][1], down[0][1]);
    out.push({ from: down[0][0], to: up[0][0], amount: amt });
    up[0][1] -= amt; down[0][1] -= amt;
    if (!up[0][1]) up.shift();
    if (!down[0][1]) down.shift();
  }
  return out;
}

/** "+$24", "−$16" (a real minus sign), "$0", "$1,250" to a number of dollars. */
function dollars(text) {
  const t = String(text).trim().replace(/−/g, '-').replace(/[$,+\s]/g, '');
  const v = Number(t);
  assert.ok(Number.isFinite(v), `not an amount: "${text}"`);
  return v;
}
const sum = xs => xs.reduce((a, b) => a + b, 0);

/** Whether nothing is listening on `port` at `host`. */
function open(port, host) {
  return new Promise(res => {
    const s = net.createServer().once('error', e => res(e.code === 'EADDRNOTAVAIL')).once('listening', () => s.close(() => res(true)));
    s.listen(port, host);
  });
}

/**
 * A free port from 5180 to 5189 (5173 belongs to Trevor's own dev server). Free on both loopbacks,
 * since a Vite started as "localhost" may hold only ::1.
 */
async function freePort() {
  for (let port = 5180; port <= 5189; port++) {
    if (await open(port, '127.0.0.1') && await open(port, '::1')) return port;
  }
  throw new Error('No free port from 5180 to 5189');
}

/** Chrome from /Applications, else CHROME_PATH, else playwright's own Chromium if it was installed. */
async function launch() {
  const opts = { headless: !process.env.E2E_HEADED, slowMo: Number(process.env.E2E_SLOWMO) || 0 };
  const tries = [
    process.env.CHROME_PATH ? { ...opts, executablePath: process.env.CHROME_PATH } : null,
    { ...opts, channel: 'chrome' },
    opts,
  ].filter(Boolean);
  let last;
  for (const o of tries) {
    try { return await chromium.launch(o); } catch (e) { last = e; }
  }
  throw new Error(`Could not start Chrome. Install Google Chrome, set CHROME_PATH, or run "npx playwright-core install chromium".\n${last?.message}`);
}

let server;
let browser;
let base;

before(async () => {
  // Off for the test whatever .env.local says: the variables already set win over Vite's env files
  for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SENTRY_DSN', 'VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST', 'VITE_VAPID_PUBLIC_KEY', 'VITE_COURSE_SAMPLES']) process.env[k] = '';
  process.env.VITE_PAYWALL = 'off';
  const port = await freePort();
  server = await createServer({ root: ROOT, logLevel: 'error', clearScreen: false, server: { port, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  base = `http://127.0.0.1:${port}`;
  browser = await launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

test('start a round, score all 18 holes, settle up', { timeout: 180_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'en-US', timezoneId: 'America/Denver' });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  const nav = page.getByRole('navigation', { name: 'Main' });
  const step = label => { if (process.env.E2E_VERBOSE) console.log(`  ${label}`); };
  try {
    await playThrough(page, nav, step, context, problems);
  } catch (e) {
    // A picture of where it stopped, for whoever reads the failure
    const shot = join(tmpdir(), 'birdie-bank-e2e-failure.png');
    await page.screenshot({ path: shot }).catch(() => {});
    e.message += `\nScreenshot: ${shot}${problems.length ? `\nConsole: ${problems.join(' | ')}` : ''}`;
    throw e;
  } finally {
    await context.close();
  }
});

async function playThrough(page, nav, step, context, problems) {
  // How much was saved before the app's own code ran: nothing, on a fresh browser profile
  await context.addInitScript(() => { window.__e2eSaved ??= localStorage.length; });
  await page.goto(`${base}/`);
  assert.equal(await page.evaluate(() => window.__e2eSaved), 0, 'starts with nothing saved');

  // --- Onboarding: the welcome, four questions, your name, the summary ---
  step('onboarding');
  const next = () => page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Set up my group' }).click();
  await page.getByRole('button', { name: /^Skins:/ }).click();
  await next();
  await page.getByRole('heading', { name: /Skins/ }).waitFor();
  await next();
  await page.getByRole('radio', { name: /^A foursome/ }).click();
  await next();
  await page.getByRole('radio', { name: /^A payment app/ }).click();
  await next();
  await next();
  await page.getByRole('radio', { name: /^Me, every time/ }).click();
  await next();
  await next();
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('checkbox', { name: 'Friendly wagers only' }).click();
  // Money comes up, so the age question does too
  await page.getByRole('radio', { name: 'Yes, I’m 18 or older' }).click();
  await next();
  await page.getByRole('heading', { name: 'Alex, your group is ready.' }).waitFor();
  await page.getByRole('button', { name: 'I’ll do it later' }).click();

  // --- Round setup: game, course, players, bets ---
  step('setup');
  await page.getByRole('button', { name: 'Start a round' }).first().click();
  // A game row holds its own Rules button in the middle, so pick it from the keyboard
  await page.getByRole('radio', { name: /^Skins:/ }).press('Enter');
  await page.getByRole('button', { name: 'Next: Course' }).click();
  await assert.doesNotReject(page.getByRole('radio', { name: '18', checked: true }).waitFor(), '18 holes by default');
  await page.getByRole('button', { name: /^Birch Creek GC,/ }).click();
  await page.getByRole('button', { name: 'Next: Players' }).click();
  await page.getByRole('radio', { name: 'No, play even', checked: true }).waitFor();
  for (const name of PLAYERS.slice(1)) {
    await page.getByRole('button', { name: 'Add a player' }).click();
    const sheet = page.getByRole('dialog', { name: 'Add a player' });
    await sheet.getByRole('textbox', { name: 'Name' }).fill(name);
    await sheet.getByRole('button', { name: 'Add to round' }).click();
    await sheet.waitFor({ state: 'hidden' });
  }
  await page.getByText('Players · 4 picked').waitFor();
  await page.getByRole('button', { name: 'Next: Bets' }).click();
  // The bet the expected numbers assume
  await page.getByRole('radio', { name: 'Money', checked: true }).waitFor();
  await page.getByRole('button', { name: `Value per skin: $${SKIN}. Change` }).waitFor();
  await page.getByRole('radio', { name: 'Per skin', checked: true }).waitFor();
  await page.getByRole('radiogroup', { name: 'Still carried after the last hole' }).getByRole('radio', { name: 'Nobody', checked: true }).waitFor();
  await page.getByRole('button', { name: 'Create round' }).click();
  await page.getByText('Round ready').waitFor();
  await page.getByRole('button', { name: 'Tee off on hole 1' }).click();

  // --- Scoring, all 18 holes ---
  step('scoring');
  await page.getByRole('dialog', { name: 'First tee' }).getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('group', { name: 'Any side bets this round?' }).getByRole('button', { name: 'Not this round' }).click();
  let par = 0;
  for (let h = 0; h < 18; h++) {
    await page.getByText(`Skins · Hole ${h + 1} of 18`).waitFor();
    const holePar = Number((await page.getByRole('button', { name: 'Open scorecard' }).textContent()).match(/Par\s*(\d)/i)[1]);
    par += holePar;
    for (let p = 0; p < 4; p++) {
      const d = STROKES[h][p];
      const button = page.getByRole('button', { name: `${PLAYERS[p]} one ${d < 0 ? 'less' : 'more'}` });
      for (let k = 0; k < Math.abs(d); k++) await button.click();
      // The score box reads out "Drew 3" (the skins chips above can say the same, so only the box counts)
      const box = page.locator('[aria-live="polite"]').filter({ hasText: new RegExp(`^${PLAYERS[p]}\\s*${holePar + d}$`) });
      await assert.doesNotReject(box.waitFor(), `${PLAYERS[p]} shows ${holePar + d} on hole ${h + 1}`);
    }
    // Save right after the last save, with nothing touched, counts as a double tap (Play.jsx, 800 ms)
    if (STROKES[h].every(d => d === 0)) await page.waitForTimeout(900);
    await page.getByRole('button', { name: h === 17 ? /^Finish round/ : /^Save & next hole/ }).click();
    if (h === 8) {
      // At the turn: the halfway sheet, once the ninth hole's banner has gone
      const half = page.getByRole('dialog', { name: 'Halfway' });
      await half.getByRole('button', { name: 'Play on' }).click();
      await half.waitFor({ state: 'hidden' });
    }
  }

  // --- What the money should be ---
  const want = expectedSkins(STROKES, SKIN);
  const wantPay = expectedPayments(want.net);
  assert.equal(sum(Object.values(want.net)), 0, 'the expected money adds to zero');
  const leader = Object.entries(want.net).sort((a, b) => b[1] - a[1])[0][0];

  // --- The reveal ---
  step('reveal');
  await page.getByText(`${leader} takes it`).waitFor({ timeout: 30_000 });
  await page.getByText('Skins won').waitFor();
  for (const p of PLAYERS) {
    if (want.won[p]) await page.getByText(`${want.won[p]} skin${want.won[p] === 1 ? '' : 's'}`, { exact: true }).first().waitFor();
  }
  if (want.unclaimed) await page.getByText('Nobody claimed them').waitFor();

  // --- Settle up (Who pays who) ---
  step('settle up');
  await page.getByRole('button', { name: 'Who pays who' }).click();
  await page.getByText(`${wantPay.length} payments square everyone up`).waitFor();
  // Where Alex's money comes from, pair by pair, adds up to Alex's total
  const pairs = await page.getByRole('button', { name: /and you: / }).evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  assert.equal(pairs.length, PLAYERS.length - 1, 'one line for each of the others');
  // "Blake and you: you pay Blake $4. −$4 Skins. See where it comes from": the signed amount
  const pairSum = sum(pairs.map(l => {
    const m = l.match(/\. ([+\u2212]?\$[\d,]+) /);
    assert.ok(m, `pair line reads as money: ${l}`);
    return dollars(m[1]);
  }));
  assert.equal(pairSum, want.net.Alex, 'Alex’s pair lines add to Alex’s total');
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  // --- The results page ---
  step('results');
  await page.getByRole('button', { name: 'See the full breakdown' }).click();
  await page.getByText(`${leader} wins the day`).waitFor();
  const standings = await page.getByTestId('standing').evaluateAll(rows => rows.map(r => [...r.children].map(c => c.innerText.trim()).filter(Boolean)));
  const got = Object.fromEntries(standings.map(cells => [cells.at(-2), dollars(cells.at(-1))]));
  assert.deepEqual(got, want.net, 'standings match the Skins rules');
  assert.equal(sum(Object.values(got)), 0, 'standings add to zero');
  const payments = await page.getByTestId('payment').evaluateAll(rows => rows.map(r => [...r.children].map(c => c.innerText.trim()).filter(Boolean)));
  const gotPay = payments.map(([from, to, amount]) => ({ from, to, amount: dollars(amount) }));
  const byPair = xs => [...xs].sort((a, b) => `${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`));
  assert.deepEqual(byPair(gotPay), byPair(wantPay), 'who pays who matches');
  // Paying it all leaves everyone square
  for (const p of PLAYERS) {
    const flow = sum(gotPay.filter(x => x.to === p).map(x => x.amount)) - sum(gotPay.filter(x => x.from === p).map(x => x.amount));
    assert.equal(flow, got[p], `${p}’s payments cover their total`);
  }
  // The card has every score as entered
  const card = page.getByRole('table');
  assert.equal(Number((await card.getByRole('row', { name: /^Par / }).getByRole('cell').last().innerText()).trim()), par, 'course par');
  for (let p = 0; p < 4; p++) {
    const total = par + sum(STROKES.map(h => h[p]));
    assert.equal(Number((await card.getByRole('row', { name: new RegExp(`^${PLAYERS[p]} `) }).getByRole('cell').last().innerText()).trim()), total, `${PLAYERS[p]}’s total`);
  }

  // --- The Tab ---
  step('tab');
  await page.getByRole('button', { name: 'Done' }).click();
  // History lists the round with Alex's total
  const mine = `${want.net.Alex < 0 ? '\u2212' : want.net.Alex > 0 ? '+' : ''}$${Math.abs(want.net.Alex)}`;
  await page.getByRole('button', { name: new RegExp(`^Birch Creek GC, Skins, .+\\. You ${mine.replace('$', '\\$').replace('+', '\\+')}$`) }).waitFor();
  await nav.getByRole('button', { name: 'Tab' }).click();
  for (const t of wantPay) {
    // These scores leave Alex owing, so Alex is never the one paid here
    assert.notEqual(t.to, 'Alex');
    const name = t.from === 'Alex' ? `${t.to}: you owe $${t.amount}. See the story` : `${t.from} owes ${t.to} $${t.amount}`;
    await assert.doesNotReject(page.getByRole('button', { name }).waitFor(), `the Tab shows "${name}"`);
  }
  await page.getByRole('button', { name: `I paid ${wantPay.find(t => t.from === 'Alex').to} $${wantPay.find(t => t.from === 'Alex').amount}` }).waitFor();

  // Nothing went wrong on the way
  await page.waitForTimeout(500);
  assert.deepEqual(problems, [], 'no console errors or page errors');
}
