// Sharing into the group text (share.js): one helper for every card, the one Show amounts switch
// (off by default), nobody's money on a card when they keep it private, the short link back, and
// what the results and preview cards say with amounts hidden or held back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { shareText } from './format.js';
import { resultsAlt, shareCardModel } from './shareImage.js';
import { amountsNote, amountsRule, appLink, keepsMoneyPrivate, roundLink, shareAmountsOn, shareOut, shareToast, slugName, withLink } from './share.js';
import { planPreview, previewAlt, previewCardModel, previewText } from './preview.js';
import { newPlan } from './plans.js';

const ORIGIN = 'https://golf.test';
const DOLLAR = /\$/;
const EM = String.fromCharCode(0x2014);
const course9 = { id: 'c9', name: 'Pebble Creek', city: 'Town', tees: [{ name: 'Blue', rating: 36, slope: 113 }], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NAMES = { me: 'Trevor Nielsen', sam: 'Sam Ray', mike: 'Mike Lee' };

function nassau(ids = ['me', 'sam']) {
  const r = createRound({ id: 'r1', game: 'nassau', course: course9, holesCount: 9, players: ids.map(id => ({ id, name: NAMES[id], index: 0 })), settings: { nassau: { front: 5, back: 5, total: 10, pressMode: 'manual', threshold: 2 } }, hcPct: 100, useHandicaps: false });
  for (let h = 1; h <= 9; h++) r.scores[h] = Object.fromEntries(ids.map((id, i) => [id, i === 0 && h <= 4 ? 3 : 4]));
  r.createdAt = new Date(2026, 9, 3).getTime();
  r.finishedAt = r.createdAt;
  r.status = 'done';
  return r;
}
/** A phone with Sam on an account: `sam` is what the server sent of his profile (null: none it may see). */
function stateWith({ sam = undefined, mike = undefined, on = false } = {}) {
  const s = { me: 'me', players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])), rounds: {}, settings: { shareAmounts: on }, accountOf: {}, profiles: {} };
  if (sam !== undefined) { s.accountOf.sam = 'acct-sam'; if (sam) s.profiles['acct-sam'] = sam; }
  if (mike !== undefined) { s.accountOf.mike = 'acct-mike'; if (mike) s.profiles['acct-mike'] = mike; }
  return s;
}
const OPEN = { name: 'Sam Ray', stats: { rounds: 4, record: { won: 2, lost: 2, even: 0 } } }; // People you've played with
const MONEY = { name: 'Sam Ray', stats: { rounds: 4, money: { net: 12 } } }; // Show my money on
const ONLY_YOU = { name: 'Sam Ray', stats: null, index: null, homeCourse: null }; // Only you sends no stats

/** A stand-in for the browser: records what was shared, copied and saved. */
function fakeEnv({ files = false, share = true, phone = false, refuse = null, copyOk = true } = {}) {
  const log = { shared: [], copied: [], saved: [], sms: [] };
  const nav = {
    canShare: files ? () => true : undefined,
    share: share ? async data => { if (refuse) { const e = new Error('no'); e.name = refuse; throw e; } log.shared.push(data); } : undefined,
  };
  return {
    log,
    env: {
      nav, phone,
      makeFile: img => ({ name: img.name, blob: img.blob }),
      copy: async t => { if (copyOk) log.copied.push(t); return copyOk; },
      save: img => { log.saved.push(img.name); return true; },
      sms: t => { log.sms.push(t); return true; },
    },
  };
}

// --------------------------- who shows money --------------------------------

test('show amounts: off until you turn it on, and remembered', () => {
  assert.equal(shareAmountsOn({ settings: {} }), false);
  assert.equal(shareAmountsOn({ settings: { shareAmounts: true } }), true);
  const s = stateWith();
  assert.equal(amountsRule(s, { people: [{ id: 'sam', name: 'Sam' }] }).show, false, 'off by default');
  assert.equal(amountsRule(s, { on: true, people: [{ id: 'sam', name: 'Sam' }] }).show, true);
});

test('show amounts: a points or reward card always shows its points', () => {
  const r = amountsRule(stateWith({ sam: ONLY_YOU }), { money: false, on: false, people: [{ id: 'sam', name: 'Sam' }] });
  assert.deepEqual(r, { show: true, held: [], money: false });
});

test('privacy: someone whose profile is Only you keeps their money off the card, for everyone on it', () => {
  const s = stateWith({ sam: ONLY_YOU });
  assert.equal(keepsMoneyPrivate(s, 'sam'), true);
  assert.equal(keepsMoneyPrivate(s, 'me'), false, 'your own money is yours to share');
  const rule = amountsRule(s, { on: true, people: [{ id: 'me', name: 'Trevor Nielsen' }, { id: 'sam', name: 'Sam Ray' }] });
  // In a round of two, Trevor's +$15 would say what Sam lost, so no amount shows at all
  assert.equal(rule.show, false);
  assert.deepEqual(rule.held, ['Sam']);
  assert.equal(amountsNote(rule, { onText: 'on', offText: 'off' }), 'Amounts stay off: Sam keeps their money private');
  // With the switch off there's nothing held back to explain
  assert.deepEqual(amountsRule(s, { on: false, people: [{ id: 'sam', name: 'Sam' }] }).held, []);
});

test('privacy: an account with no profile this phone may see counts as private; an open profile, or no account, follows the round', () => {
  assert.equal(keepsMoneyPrivate(stateWith({ sam: null }), 'sam'), true);
  assert.equal(keepsMoneyPrivate(stateWith({ sam: OPEN }), 'sam'), false);
  assert.equal(keepsMoneyPrivate(stateWith({ sam: MONEY }), 'sam'), false);
  assert.equal(keepsMoneyPrivate(stateWith(), 'sam'), false, 'a player with no account has no setting');
  const two = stateWith({ sam: ONLY_YOU, mike: ONLY_YOU });
  const rule = amountsRule(two, { on: true, people: [{ id: 'sam', name: 'Sam Ray' }, { id: 'mike', name: 'Mike Lee' }] });
  assert.equal(amountsNote(rule, {}), 'Amounts stay off: Sam and Mike keep their money private');
});

test('privacy: one friend with two ids is one person, and a seat you took is you', () => {
  const s = stateWith({ sam: ONLY_YOU });
  s.players.sam2 = { id: 'sam2', name: 'Sam R', mergedInto: 'sam' };
  assert.equal(keepsMoneyPrivate(s, 'sam2'), true);
  s.rounds.j1 = { id: 'j1', localMe: 'seat9', players: [{ id: 'seat9', name: 'Trevor' }] };
  s.accountOf.seat9 = 'acct-me';
  assert.equal(keepsMoneyPrivate(s, 'seat9'), false);
});

// --------------------------- the results card --------------------------------

test('results: with amounts held back for privacy, nothing on the image, its alt text or the text has a dollar', () => {
  const s = stateWith({ sam: ONLY_YOU, on: true });
  const r = nassau();
  const rule = amountsRule(s, { on: shareAmountsOn(s), people: r.players });
  const m = shareCardModel(r, roundResults(r), { showAmounts: rule.show });
  assert.doesNotMatch(JSON.stringify(m), DOLLAR);
  assert.doesNotMatch(resultsAlt(m), DOLLAR);
  assert.doesNotMatch(shareText(r, roundResults(r), { amounts: rule.show }), DOLLAR);
  assert.match(resultsAlt(m), /^Results card: Pebble Creek, Oct 3 · Nassau\. Trevor takes it\. 1\. Trevor Nielsen, 2\. Sam Ray/);
});

test('results: with the switch on and nobody private, the amounts are on the card and the alt text says them', () => {
  const s = stateWith({ sam: OPEN, on: true });
  const r = nassau();
  const rule = amountsRule(s, { on: true, people: r.players });
  const m = shareCardModel(r, roundResults(r), { showAmounts: rule.show, link: `${ORIGIN}/?join=AB12` });
  assert.equal(m.sub, '+$15');
  assert.match(resultsAlt(m), /1\. Trevor Nielsen \+\$15, 2\. Sam Ray −\$15/);
  assert.equal(m.footer, 'golf.test/?join=AB12', 'the short link is printed on the card');
});

test('results text: the order and the settle-up, then the link once (no app name in it)', () => {
  const r = nassau();
  const text = shareText(r, roundResults(r), { amounts: false });
  assert.doesNotMatch(text, /Birdie Bank|vercel/);
  assert.equal(withLink(text, `${ORIGIN}/?join=AB12`).split('\n').at(-1), `${ORIGIN}/?join=AB12`);
  assert.equal(withLink(withLink(text, 'x'), 'x').match(/\nx$/g).length, 1);
});

// --------------------------- links -------------------------------------------

test('links: a round shared live links to it; one that never was links to the app; trips and the cup to the app', () => {
  assert.equal(roundLink({ shared: { code: 'AB12' } }, ORIGIN), `${ORIGIN}/?join=AB12`);
  assert.equal(roundLink({ shareCode: 'ZZ99' }, ORIGIN), `${ORIGIN}/?join=ZZ99`);
  assert.equal(roundLink({ id: 'r1' }, ORIGIN), ORIGIN);
  assert.equal(appLink(ORIGIN), ORIGIN);
  assert.equal(slugName('recap', 'Pebble Creek G.C.', new Date(2026, 9, 3)), 'recap-pebble-creek-g-c-2026-10-03.png');
  assert.equal(slugName('trip', ''), 'trip-golf.png');
});

// --------------------------- the one share helper ----------------------------

const IMG = { blob: { type: 'image/png' }, name: 'card.png' };

test('shareOut: a phone that shares files gets the image with the text and the link', async () => {
  const { env, log } = fakeEnv({ files: true });
  assert.equal(await shareOut({ text: 'Sam took it', url: `${ORIGIN}/?join=AB12`, image: IMG }, env), 'shared');
  assert.equal(log.shared.length, 1);
  assert.equal(log.shared[0].files[0].name, 'card.png');
  assert.equal(log.shared[0].text, `Sam took it\n${ORIGIN}/?join=AB12`);
  assert.deepEqual(log.copied, []);
});

test('shareOut: closing the share sheet is not a failure and nothing else happens', async () => {
  const { env, log } = fakeEnv({ files: true, refuse: 'AbortError' });
  assert.equal(await shareOut({ text: 'x', image: IMG }, env), 'cancelled');
  assert.deepEqual([log.copied, log.saved], [[], []]);
  assert.equal(shareToast('cancelled'), null);
});

test('shareOut: a desktop that can\'t share files copies the text and saves the image', async () => {
  const { env, log } = fakeEnv({ files: false });
  assert.equal(await shareOut({ text: 'Sam took it', url: ORIGIN, image: IMG }, env), 'copied-saved');
  assert.deepEqual(log.copied, [`Sam took it\n${ORIGIN}`]);
  assert.deepEqual(log.saved, ['card.png']);
  assert.equal(shareToast('copied-saved'), 'Image saved and the text copied. Paste them in the group text');
});

test('shareOut: text goes to the share sheet, else a text message on a phone, else the clipboard', async () => {
  let f = fakeEnv();
  assert.equal(await shareOut({ text: 'I owe Sam $10. It’s coming, promise.' }, f.env), 'shared');
  assert.equal(f.log.shared[0].text, 'I owe Sam $10. It’s coming, promise.');
  f = fakeEnv({ share: false, phone: true });
  assert.equal(await shareOut({ text: 'Hi', url: ORIGIN }, f.env), 'sms');
  assert.deepEqual(f.log.sms, [`Hi\n${ORIGIN}`]);
  f = fakeEnv({ share: false });
  assert.equal(await shareOut({ text: 'Hi' }, f.env), 'copied');
  assert.equal(shareToast('copied', 'The recap'), 'The recap copied. Paste it in the group text');
  f = fakeEnv({ share: false, copyOk: false });
  assert.equal(await shareOut({ text: 'Hi' }, f.env), 'failed');
  assert.equal(shareToast('failed'), 'Couldn’t share on this device');
  // A share sheet that errors for another reason falls back to the clipboard
  f = fakeEnv({ refuse: 'NotAllowedError' });
  assert.equal(await shareOut({ text: 'Hi' }, f.env), 'copied');
});

// --------------------------- the preview card --------------------------------

const PCOURSE = { id: 'c1', name: 'Rancho Park', city: 'LA', holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })), tees: [{ name: 'Blue', rating: 72, slope: 113 }] };
function previewState(samProfile) {
  const s = stateWith({ sam: samProfile });
  s.customCourses = { c1: PCOURSE };
  s.settings = { hcPct: 100, skins: { value: 2, carryover: true, kind: 'net', payout: 'per', lastCarry: 'void' } };
  s.settlements = []; s.carries = [];
  // Sam beat Mike for $10 in June
  const r = createRound({ id: 'm1', game: 'match', course: PCOURSE, holesCount: 18, nine: 'front', players: [{ id: 'sam', name: 'Sam Ray', index: null, tee: 'Blue' }, { id: 'mike', name: 'Mike Lee', index: null, tee: 'Blue' }], settings: { match: { stake: 10, pressMode: 'off' } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { sam: 4, mike: 4 };
  r.scores[1] = { sam: 3, mike: 5 };
  r.status = 'done';
  r.finishedAt = new Date(2026, 5, 1).getTime();
  s.rounds.m1 = r;
  const p = newPlan({ id: 'pl1', hostName: 'Trevor Nielsen', game: 'skins', holesCount: 18, date: '2026-10-03', teeTime: '08:10', course: PCOURSE, people: [{ id: 'sam', name: 'Sam Ray' }, { id: 'mike', name: 'Mike Lee' }], ballot: { games: [], bets: [2], sides: [] }, suggestedBet: 2, settings: s.settings, useHc: false, now: 1 });
  for (const w of ['sam', 'mike']) p.answers[w] = { name: w, status: 'in', at: 5 };
  return { s, pv: planPreview(s, p, { now: new Date(2026, 9, 1, 5, 10) }) };
}

test('preview: the money between two players stays off when one of them keeps it private, the bet still shows', () => {
  const { s, pv } = previewState(ONLY_YOU);
  const people = pv.records.flatMap(r => [{ id: r.aId, name: r.aName }, { id: r.bId, name: r.bName }]);
  const recordAmounts = amountsRule(s, { on: true, people }).show;
  assert.equal(recordAmounts, false);
  const m = previewCardModel(pv, { showAmounts: true, recordAmounts });
  assert.equal(m.sub, '$2 a skin', 'the bet is the round\'s terms, nobody\'s money');
  assert.deepEqual(m.records, ['Sam is 1 and 0 against Mike this season']);
  assert.doesNotMatch(previewText(pv, { showAmounts: true, recordAmounts }), /up \$/);
  assert.doesNotMatch(previewAlt(m), /up \$/);
  // An open profile: the record's money shows with the switch on
  const open = previewState(OPEN);
  const m2 = previewCardModel(open.pv, { showAmounts: true, recordAmounts: amountsRule(open.s, { on: true, people }).show });
  assert.deepEqual(m2.records, ['Sam is 1 and 0 against Mike this season, up $10']);
});

test('preview: off by default nothing has a dollar, and the alt text reads the card', () => {
  const { pv } = previewState(OPEN);
  const m = previewCardModel(pv);
  assert.doesNotMatch(JSON.stringify(m) + previewAlt(m), DOLLAR);
  assert.match(previewAlt(m), /^Preview card: Skins at Rancho Park, Saturday · 8:10 AM · 18 holes\. 3 in: Trevor, Sam and Mike/);
});

test('copy: nothing a share says has a long dash', () => {
  const r = nassau();
  const m = shareCardModel(r, roundResults(r), { showAmounts: true });
  for (const t of [resultsAlt(m), shareText(r, roundResults(r)), amountsNote({ held: ['A'], show: false }, {}), shareToast('copied-saved')]) assert.ok(!t.includes(EM), t);
});
