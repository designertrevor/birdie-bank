// Up next's number tiles (Layout Lab C, the mini dashboard): a few numbers about your golf once
// you've finished a few rounds (TILES_FROM in upnext-first.js). Each tile only shows with
// something real in it, so it never reads as a row of zeros. Display only: every amount comes
// from myTab() and seasonBoard(), the same money the Tab and the Season view show.
// Bragging rights before bankroll (BRAND.md): after the Tab, the days you won and your record
// against your rival come ahead of the season's dollars.
// Pure, tested in upnext-tiles.test.js.
import { myTab } from './history.js';
import { seasonBoard } from './season.js';
import { roundTime } from './rounds-live.js';
import { firstName, myIds } from './format.js';
import { canonicalOf } from './pair-debts.js';
import { openRewards } from './play-for.js';
import { money } from './golf.js';
import { winnersOf } from './callouts.js';

const tone = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : null);
// Dead level reads as a word, not a $0
const signed = v => (v ? money(v, { sign: true }) : 'Even');
// Square on money can still leave a reward to sort out ("You owe Sam lunch"), as the Tab at a glance says
const squareSub = state => {
  const n = openRewards(state, { ids: myIds(state), canon: canonicalOf(state) }).length;
  return n ? `${n} reward${n === 1 ? '' : 's'} to sort out` : 'Nobody owes anybody';
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The tiles, in order: [{ id, label, big, sub, tone, go }], two or four of them (a 2 by 2 grid
 * never has a hole). `go` is where a tap goes: { tab } for a bottom tab, { push, params } for a screen.
 */
export function homeTiles(state, now = new Date()) {
  const year = now.getFullYear();
  const tiles = [];

  // The Tab: what's between you and everyone, or square
  const tab = myTab(state);
  tiles.push(tab.people
    ? { id: 'tab', label: 'The Tab', big: signed(tab.net), tone: tone(tab.net), go: { tab: 'ledger' },
      sub: tab.owed && tab.owe ? `${money(tab.owed)} in, ${money(tab.owe)} out` : tab.owed ? 'Owed to you' : 'You owe' }
    : { id: 'tab', label: 'The Tab', big: 'Square', tone: null, sub: squareSub(state), go: { tab: 'ledger' } });

  const board = seasonBoard(state, year);
  const meRow = board.balances.find(b => b.me);
  const ids = myIds(state);
  const canon = canonicalOf(state || {});
  const isMe = id => ids.has(id) || ids.has(canon(id));

  // Rounds finished this year: the days you won outright (callouts.js's winner, a team counts),
  // or how many you played when you haven't won one yet
  const done = Object.values(state?.rounds || {}).filter(r => r?.status === 'done');
  const thisYear = done.filter(r => new Date(roundTime(r)).getFullYear() === year);
  const won = thisYear.filter(r => winnersOf(r).some(isMe)).length;
  const thisMonth = thisYear.filter(r => new Date(roundTime(r)).getMonth() === now.getMonth()).length;
  if (won) {
    tiles.push({ id: 'won', label: 'Days won', big: String(won), tone: null, sub: `Of ${plural(thisYear.length, 'round')} this year`, go: { tab: 'history' } });
  } else if (thisYear.length) {
    tiles.push({ id: 'played', label: 'Rounds played', big: String(thisYear.length), tone: null, sub: thisMonth ? `${thisMonth} this month` : 'This year', go: { tab: 'history' } });
  } else if (done.length) {
    tiles.push({ id: 'played', label: 'Rounds played', big: String(done.length), tone: null, sub: 'All time', go: { tab: 'history' } });
  }

  // You against the friend you play most, as a record (kept as quiet as the Players list keeps it)
  if (board.rival) {
    const r = board.rival;
    tiles.push({ id: 'rival', label: `You vs ${firstName(r.name)}`, big: r.won + r.lost ? `${r.won}–${r.lost}` : 'Even', tone: null, sub: `${plural(r.rounds, 'round')} together`, go: { push: 'person', params: { id: r.id } } });
  }

  // Your money this season, from the rounds with money of yours in them
  if (board.rounds && meRow) {
    tiles.push({ id: 'season', label: `${year} so far`, big: signed(meRow.net), tone: tone(meRow.net), sub: `Over ${plural(board.rounds, 'round')}`, go: { tab: 'history' } });
  }

  // Your best day out this season
  if (board.biggestDay) {
    tiles.push({ id: 'best', label: 'Best day', big: money(board.biggestDay.amount, { sign: true }), tone: 'pos', sub: board.biggestDay.course || 'This season', go: { push: 'roundDetail', params: { id: board.biggestDay.id } } });
  }

  const shown = tiles.slice(0, 4);
  return shown.length % 2 ? shown.slice(0, -1) : shown;
}
