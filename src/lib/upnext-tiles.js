// Up next's number tiles (Layout Lab C, the mini dashboard): a few numbers about your golf once
// you've finished a few rounds (TILES_FROM in upnext-first.js). Each tile only shows with
// something real in it, so it never reads as a row of zeros. Display only: every amount comes
// from myTab() and seasonBoard(), the same money the Tab and the Season view show.
// Pure, tested in upnext-tiles.test.js.
import { myTab } from './history.js';
import { seasonBoard } from './season.js';
import { roundTime } from './rounds-live.js';
import { firstName, myIds } from './format.js';
import { canonicalOf } from './pair-debts.js';
import { openRewards } from './play-for.js';
import { money } from './golf.js';

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

  // Your money this season, from the rounds with money of yours in them
  const board = seasonBoard(state, year);
  const meRow = board.balances.find(b => b.me);
  if (board.rounds && meRow) {
    tiles.push({ id: 'season', label: `${year} so far`, big: signed(meRow.net), tone: tone(meRow.net), sub: `Over ${plural(board.rounds, 'round')}`, go: { tab: 'history' } });
  }

  // Rounds finished this year, and this month
  const done = Object.values(state?.rounds || {}).filter(r => r?.status === 'done').map(r => new Date(roundTime(r)));
  const thisYear = done.filter(d => d.getFullYear() === year);
  const thisMonth = thisYear.filter(d => d.getMonth() === now.getMonth()).length;
  if (thisYear.length) {
    tiles.push({ id: 'played', label: 'Rounds played', big: String(thisYear.length), tone: null, sub: thisMonth ? `${thisMonth} this month` : 'This year', go: { tab: 'history' } });
  } else if (done.length) {
    tiles.push({ id: 'played', label: 'Rounds played', big: String(done.length), tone: null, sub: 'All time', go: { tab: 'history' } });
  }

  // Your best day out this season
  if (board.biggestDay) {
    tiles.push({ id: 'best', label: 'Best day', big: money(board.biggestDay.amount, { sign: true }), tone: 'pos', sub: board.biggestDay.course || 'This season', go: { push: 'roundDetail', params: { id: board.biggestDay.id } } });
  }

  // You against the friend you play most, as a record (kept as quiet as the Players list keeps it)
  if (board.rival) {
    const r = board.rival;
    tiles.push({ id: 'rival', label: `You vs ${firstName(r.name)}`, big: r.won + r.lost ? `${r.won}–${r.lost}` : 'Even', tone: null, sub: `${plural(r.rounds, 'round')} together`, go: { push: 'person', params: { id: r.id } } });
  }

  const shown = tiles.slice(0, 4);
  return shown.length % 2 ? shown.slice(0, -1) : shown;
}
