import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addSent, canVote, cleanLocal, commentCount, commentName, countsFromRows, dropSynced, emptyLocal, markTold, markVotesSynced,
  myIdeas, myVote, pendingVotes, requestItemId, requestTitle, roadmapItems, roadmapOff, section, shippedLabel,
  shippedNotes, syncedVotes, tabFor, toggleVote, voteCount, NOTE_DAYS,
} from './roadmap.js';

const NOW = Date.parse('2026-10-07T18:00:00Z');
const DAY = 86400e3;
const IDEA = '0f6b4f2a-1d3c-4e5f-8a9b-0c1d2e3f4a5b';
const IDEA2 = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';

const BASE = [
  { id: 'r-calcutta', title: 'Calcutta', blurb: null, area: 'Games and rounds', status: 'planned', shipped: null, step: 'S5', kind: 'game', order: 0 },
  { id: 'r-push', title: 'Push notifications', blurb: null, area: 'Notifications', status: 'planned', shipped: null, step: 'S3', kind: 'feature', order: 1 },
  { id: 'r-house-rules', title: 'House rules for every game', blurb: null, area: 'Games and rounds', status: 'progress', shipped: null, step: 'S2', kind: 'feature', order: 2 },
  { id: 'r-big-game', title: 'The Big Game', blurb: null, area: 'Games and rounds', status: 'shipped', shipped: '2026-10-05', step: 'S3', kind: 'game', order: 3 },
  { id: 'r-tab', title: 'The Tab', blurb: null, area: 'The Tab', status: 'shipped', shipped: null, step: null, kind: 'feature', order: 4 },
  { id: 'r-old', title: 'Old thing', blurb: null, area: 'The Tab', status: 'shipped', shipped: '2026-07-01', step: 'S2', kind: 'feature', order: 5 },
  { id: 'r-recap', title: 'The day-after recap', blurb: null, area: 'Between rounds', status: 'shipped', shipped: '2026-10-04', step: 'S3', kind: 'feature', order: 6 },
];

// --------------------------- the list ----------------------------------------

test('approved ideas join the list with their public title only, after the ROADMAP.md items', () => {
  const items = roadmapItems(BASE, [
    { id: requestItemId(IDEA), title: '  Bingo Bango Bongo with carries ', status: 'planned', kind: 'game', shipped_on: null },
    { id: 'q-bad', title: '', status: 'planned', kind: 'feature' },
    { id: 'r-push', title: 'A duplicate id', status: 'planned', kind: 'feature' },
    { id: 'q-2', title: 'Wrong status', status: 'maybe', kind: 'feature' },
  ]);
  assert.equal(items.length, BASE.length + 1);
  const idea = items.at(-1);
  assert.equal(idea.id, `q-${IDEA}`);
  assert.equal(idea.title, 'Bingo Bango Bongo with carries');
  assert.equal(idea.area, 'Games and rounds');
  assert.equal(idea.request, true);
  assert.equal(items.find(i => i.id === 'r-push').title, 'Push notifications');
});

test('Planned sorts by votes, then by how soon, then file order; Shipped newest first, undated last', () => {
  const items = roadmapItems(BASE);
  assert.deepEqual(section(items, 'planned').map(i => i.id), ['r-push', 'r-calcutta']);
  const counts = { 'r-calcutta': { votes: 4, comments: 0 }, 'r-push': { votes: 2, comments: 1 } };
  assert.deepEqual(section(items, 'planned', { counts }).map(i => i.id), ['r-calcutta', 'r-push']);
  assert.deepEqual(section(items, 'shipped').map(i => i.id), ['r-big-game', 'r-recap', 'r-old', 'r-tab']);
  assert.deepEqual(section(items, 'progress').map(i => i.id), ['r-house-rules']);
});

test('the tab an item is on, and an idea folded into another item opens on that one', () => {
  const items = roadmapItems(BASE);
  assert.equal(tabFor(items, 'r-big-game'), 'shipped');
  assert.equal(tabFor(items, `q-${IDEA}`), 'planned');
  const ideas = [{ id: IDEA, itemId: 'r-house-rules', state: 'merged' }];
  assert.equal(tabFor(items, `q-${IDEA}`, ideas), 'progress');
});

// --------------------------- votes -------------------------------------------

test('one vote per item: tapping again takes it back', () => {
  let local = emptyLocal();
  local = toggleVote(local, 'r-push', [], NOW);
  assert.equal(myVote(local, [], 'r-push'), true);
  local = toggleVote(local, 'r-push', [], NOW + 1);
  assert.equal(myVote(local, [], 'r-push'), false);
  assert.deepEqual(pendingVotes(local), [{ item: 'r-push', on: false, at: NOW + 1 }]);
});

test('the count adds your vote until the server has it, and never counts it twice', () => {
  const counts = { 'r-push': { votes: 5, comments: 2 } };
  // Signed out: the vote lives on this phone and shows in the count
  let local = toggleVote(emptyLocal(), 'r-push', [], NOW);
  assert.equal(voteCount('r-push', { counts, local, myVotes: [] }), 6);
  // Signed in and sent: the server's count already has it
  local = markVotesSynced(local, pendingVotes(local));
  assert.equal(voteCount('r-push', { counts: { 'r-push': { votes: 6 } }, local, myVotes: ['r-push'] }), 6);
  // Taken back but not sent yet: one fewer than the server says
  local = toggleVote(local, 'r-push', ['r-push'], NOW + 5);
  assert.equal(voteCount('r-push', { counts: { 'r-push': { votes: 6 } }, local, myVotes: ['r-push'] }), 5);
  // Never below zero, even with odd server numbers
  assert.equal(voteCount('r-push', { counts: { 'r-push': { votes: 0 } }, local, myVotes: ['r-push'] }), 0);
  assert.equal(voteCount('r-none', { counts: {}, local: emptyLocal(), myVotes: [] }), 0);
});

test('once the server has a vote, its list of your votes wins, so taking it back on another phone shows here', () => {
  let local = toggleVote(emptyLocal(), 'r-push', [], NOW);
  local = toggleVote(local, 'r-calcutta', [], NOW + 1);
  local = markVotesSynced(local, pendingVotes(local));
  const before = syncedVotes(local);
  assert.deepEqual(before.map(v => v.item).sort(), ['r-calcutta', 'r-push']);
  // Tapped again while the server was asked: that one stays this phone's say
  local = toggleVote(local, 'r-calcutta', ['r-push', 'r-calcutta'], NOW + 2);
  // The account took r-push back on another phone, so the server's list no longer has it
  local = dropSynced(local, before);
  assert.deepEqual(Object.keys(local.votes), ['r-calcutta']);
  assert.equal(local.votes['r-calcutta'].on, false);
  assert.equal(myVote(local, ['r-calcutta'], 'r-push'), false);
  assert.equal(voteCount('r-push', { counts: { 'r-push': { votes: 3 } }, local, myVotes: ['r-calcutta'] }), 3);
  // Nothing sent: nothing dropped
  const fresh = toggleVote(emptyLocal(), 'r-push', [], NOW);
  assert.deepEqual(syncedVotes(fresh), []);
  assert.deepEqual(dropSynced(fresh, [{ item: 'r-push', on: true, at: NOW }]).votes, fresh.votes);
});

test('a vote from your account on another phone shows as yours here', () => {
  assert.equal(myVote(emptyLocal(), ['r-push'], 'r-push'), true);
  const local = toggleVote(emptyLocal(), 'r-push', ['r-push'], NOW);
  assert.equal(local.votes['r-push'].on, false, 'tapping it takes that vote back');
});

test('a vote changed again while one was sending stays pending', () => {
  let local = toggleVote(emptyLocal(), 'r-push', [], NOW);
  const sent = pendingVotes(local);
  local = toggleVote(local, 'r-push', [], NOW + 10);
  local = markVotesSynced(local, sent);
  assert.equal(local.votes['r-push'].synced, false);
  assert.deepEqual(pendingVotes(local), [{ item: 'r-push', on: false, at: NOW + 10 }]);
});

test('voting: not on the web page, not on shipped items, not on an idea still waiting', () => {
  assert.equal(canVote({ status: 'planned' }), true);
  assert.equal(canVote({ status: 'progress' }), true);
  assert.equal(canVote({ status: 'shipped' }), false);
  assert.equal(canVote({ status: 'planned' }, { web: true }), false);
  assert.equal(canVote({ status: 'planned', waiting: true }), false);
  assert.equal(canVote(null), false);
});

test('server counts are cleaned: bad ids and negative numbers left out', () => {
  assert.deepEqual(countsFromRows([
    { item: 'r-push', votes: 3, comments: '2' },
    { item: 'BAD ID', votes: 9, comments: 9 },
    { item: 'q-x', votes: -4, comments: null },
    null,
  ]), { 'r-push': { votes: 3, comments: 2 }, 'q-x': { votes: 0, comments: 0 } });
  assert.equal(commentCount('r-push', { 'r-push': { votes: 1, comments: 4 } }), 4);
  assert.equal(commentCount('r-none', {}), 0);
});

test('a local record from storage keeps only what makes sense', () => {
  const clean = cleanLocal({
    votes: { 'r-push': { on: true, at: '12', synced: 1 }, 'NOT OK': { on: true }, 'r-x': 'yes' },
    sent: [{ id: IDEA.toUpperCase(), kind: 'game', title: 'Wolf with a twist', at: 5 }, { id: 'nope', kind: 'game' }, { id: IDEA2, kind: 'weird' }],
    told: { 'r-big-game': 9, 'bad id!': 1 },
  });
  assert.deepEqual(clean.votes, { 'r-push': { on: true, at: 12, synced: false } });
  assert.deepEqual(clean.sent.map(s => [s.id, s.kind]), [[IDEA, 'game'], [IDEA2, 'feature']]);
  assert.deepEqual(clean.told, { 'r-big-game': 9 });
  assert.deepEqual(cleanLocal(null), emptyLocal());
});

// --------------------------- your ideas --------------------------------------

test('an idea’s title is the game’s name or the first line of the idea, kept short', () => {
  assert.equal(requestTitle('game', { name: ' Bingo Bango Bongo ' }), 'Bingo Bango Bongo');
  assert.equal(requestTitle('feature', { idea: '\n  Let me split the cart fee\nand more detail' }), 'Let me split the cart fee');
  const long = requestTitle('feature', { idea: 'A really long idea about how the group could track the cart fees and the beer and the range balls too' });
  assert.ok(long.length <= 71 && long.endsWith('…'), long);
  assert.equal(requestTitle('feature', {}), '');
});

test('your ideas: waiting for a look, on the roadmap, or folded into an item', () => {
  let local = addSent(emptyLocal(), { id: IDEA, kind: 'game', title: 'Bingo Bango Bongo', at: NOW - 1000 });
  local = addSent(local, { id: IDEA2, kind: 'feature', title: 'Split the cart fee', at: NOW });
  const items = roadmapItems(BASE);
  // Before the SQL runs, or before Trevor looks: both waiting, newest first
  let ideas = myIdeas(local, [], items);
  assert.deepEqual(ideas.map(i => [i.id, i.state, i.itemId]), [[IDEA2, 'waiting', `q-${IDEA2}`], [IDEA, 'waiting', `q-${IDEA}`]]);
  // Trevor lists one as its own item and folds the other into an item on the list
  const mine = [
    { id: IDEA, kind: 'game', item: `q-${IDEA}`, status: 'planned', title: 'Bingo Bango Bongo, with carries' },
    { id: IDEA2, kind: 'feature', item: 'r-push', status: null, title: null },
  ];
  ideas = myIdeas(local, mine, items);
  assert.deepEqual(ideas.find(i => i.id === IDEA), { id: IDEA, itemId: `q-${IDEA}`, title: 'Bingo Bango Bongo, with carries', kind: 'game', state: 'listed', linkedTo: null, at: NOW - 1000 });
  assert.deepEqual(ideas.find(i => i.id === IDEA2), { id: IDEA2, itemId: 'r-push', title: 'Split the cart fee', kind: 'feature', state: 'merged', linkedTo: 'r-push', at: NOW });
});

test('ideas the server knows are yours from another phone show too; course requests only once listed', () => {
  const mine = [
    { id: IDEA, kind: 'feature', item: null, status: null, title: null },
    { id: IDEA2, kind: 'course', item: null, status: null, title: null },
  ];
  const ideas = myIdeas(emptyLocal(), mine, []);
  assert.deepEqual(ideas.map(i => [i.id, i.title, i.state]), [[IDEA, 'Your idea', 'waiting']]);
});

test('the newest 50 ideas are kept, and sending one twice keeps one', () => {
  let local = emptyLocal();
  for (let i = 0; i < 55; i++) local = addSent(local, { id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, kind: 'feature', title: `Idea ${i}`, at: i });
  assert.equal(local.sent.length, 50);
  assert.equal(local.sent[0].title, 'Idea 5');
  local = addSent(local, { id: '00000000-0000-4000-8000-000000000054', kind: 'feature', title: 'Again', at: 99 });
  assert.equal(local.sent.length, 50);
  assert.equal(local.sent.at(-1).title, 'Again');
});

// --------------------------- "it's live" -------------------------------------

test('something you voted for ships: one note, and only once', () => {
  const items = roadmapItems(BASE);
  let local = toggleVote(emptyLocal(), 'r-big-game', [], NOW - 30 * DAY);
  let notes = shippedNotes(items, { local, now: NOW });
  assert.deepEqual(notes, [{ key: 'r-big-game', itemId: 'r-big-game', title: 'The Big Game', line: 'A game you voted for is live', shipped: '2026-10-05' }]);
  local = markTold(local, notes.map(n => n.key), NOW);
  notes = shippedNotes(items, { local, now: NOW });
  assert.deepEqual(notes, []);
});

test('a feature you voted for reads "Something you voted for is live"; a vote taken back gets nothing', () => {
  const items = roadmapItems(BASE);
  let local = toggleVote(emptyLocal(), 'r-recap', [], NOW);
  assert.equal(shippedNotes(items, { local, now: NOW })[0].line, 'Something you voted for is live');
  local = toggleVote(local, 'r-recap', [], NOW + 1);
  assert.deepEqual(shippedNotes(items, { local, now: NOW }), []);
});

test('the idea you sent in ships: the line says so, by the kind of idea', () => {
  const requests = [{ id: `q-${IDEA}`, title: 'Bingo Bango Bongo, with carries', status: 'shipped', kind: 'game', shipped_on: '2026-10-06' }];
  const items = roadmapItems(BASE, requests);
  const local = addSent(emptyLocal(), { id: IDEA, kind: 'game', title: 'BBB', at: NOW - 9 * DAY });
  const mine = [{ id: IDEA, kind: 'game', item: `q-${IDEA}`, status: 'shipped', title: 'Bingo Bango Bongo, with carries', shipped_on: '2026-10-06' }];
  const notes = shippedNotes(items, { local, mine, now: NOW });
  assert.deepEqual(notes.map(n => [n.itemId, n.line, n.title]), [[`q-${IDEA}`, 'The game you asked for is live', 'Bingo Bango Bongo, with carries']]);
});

test('an idea folded into an item hears when that item ships, and asking beats voting for the line', () => {
  const items = roadmapItems(BASE);
  const local = toggleVote(emptyLocal(), 'r-recap', [], NOW);
  const mine = [{ id: IDEA, kind: 'feature', item: 'r-recap', status: null, title: null }];
  assert.deepEqual(shippedNotes(items, { local, mine, now: NOW }).map(n => n.line), ['The idea you sent in is live']);
  const course = [{ id: IDEA, kind: 'course', item: 'r-recap' }];
  assert.deepEqual(shippedNotes(items, { local: emptyLocal(), mine: course, now: NOW }).map(n => n.line), ['The course you asked for is in']);
});

test('a vote from your account counts for the note on a phone that never voted', () => {
  const notes = shippedNotes(roadmapItems(BASE), { local: emptyLocal(), myVotes: ['r-big-game'], now: NOW });
  assert.deepEqual(notes.map(n => n.key), ['r-big-game']);
});

test('no note for old news, undated items, items still planned, or things you never touched', () => {
  const items = roadmapItems(BASE);
  let local = emptyLocal();
  for (const id of ['r-old', 'r-tab', 'r-push', 'r-house-rules']) local = toggleVote(local, id, [], NOW);
  assert.deepEqual(shippedNotes(items, { local, now: NOW }), []);
  assert.deepEqual(shippedNotes(items, { local: emptyLocal(), now: NOW }), []);
  // The window: NOTE_DAYS after the ship date
  const voted = toggleVote(emptyLocal(), 'r-big-game', [], NOW);
  const later = Date.parse('2026-10-05T12:00:00Z') + (NOTE_DAYS + 1) * DAY;
  assert.deepEqual(shippedNotes(items, { local: voted, now: later }), []);
});

test('several notes come newest first', () => {
  let local = toggleVote(emptyLocal(), 'r-recap', [], NOW);
  local = toggleVote(local, 'r-big-game', [], NOW);
  assert.deepEqual(shippedNotes(roadmapItems(BASE), { local, now: NOW }).map(n => n.key), ['r-big-game', 'r-recap']);
});

// --------------------------- the rest ----------------------------------------

test('comments go out under your first name only when your profile is open to everyone', () => {
  assert.equal(commentName('Trevor Nielsen', 'everyone'), 'Trevor');
  assert.equal(commentName('Trevor Nielsen', 'played'), null);
  assert.equal(commentName('Trevor Nielsen', 'hidden'), null);
  assert.equal(commentName('Trevor Nielsen', undefined), null);
  assert.equal(commentName('  ', 'everyone'), null);
});

test('a server without the roadmap SQL reads as switched off, not as an error', () => {
  assert.equal(roadmapOff({ code: 'PGRST202', message: 'Could not find the function public.roadmap_counts' }), true);
  assert.equal(roadmapOff({ code: '42883' }), true);
  assert.equal(roadmapOff({ code: '42P01' }), true);
  assert.equal(roadmapOff({ message: 'TypeError: Failed to fetch' }), false);
  assert.equal(roadmapOff({ code: '42501', message: 'Sign in to vote' }), false);
  assert.equal(roadmapOff(null), false);
});

test('shipped labels', () => {
  assert.equal(shippedLabel('2026-10-04'), 'Shipped Oct 4');
  assert.equal(shippedLabel(null), 'From the start');
});
