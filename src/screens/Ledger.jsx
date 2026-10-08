// The Tab: your net with each friend across every round, squared in the fewest payments.
import { useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented, useUI } from '../components/ui.jsx';
import FreePromise from '../components/FreePromise.jsx';
import { Avatar, SettleSheet } from '../components/Pay.jsx';
import { PersonActions, RecentPaid, RewardLines, SquareStrip } from '../components/TabCard.jsx';
import { SeasonChart } from '../components/SeasonChart.jsx';
import { Insight, RangePill } from '../components/DataCards.jsx';
import { tabInsight } from '../lib/data-insights.js';
import { defaultRange, netSeries, roundsInRange } from '../lib/history.js';
import { avatarFor, avatarModel } from '../lib/avatars.js';
import { useStore } from '../lib/store.js';
import { headToHeadSummary, nameOf, outstanding } from '../lib/ledger.js';
import { allTripPays } from '../lib/trip-expenses.js';
import { canonicalOf, paymentGroups, recentPayment } from '../lib/shared-tab.js';
import { sharedDebts } from '../lib/pair-debts.js';
import { undoPayments, useTabSync } from '../lib/tab-sync.js';
import { useTripPlans } from '../lib/trip-plan-sync.js';
import { useBigSync } from '../lib/big-sync.js';
import { useCupSync } from '../lib/cup-sync.js';
import { money } from '../lib/golf.js';
import { myIds } from '../lib/format.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { isOrganizer } from '../lib/paywall.js';
import { openRewards } from '../lib/play-for.js';
import { StartTripLink, TripTabCard } from '../components/Trips.jsx';
import { currentTrips, tripHidden, tripsOf } from '../lib/trips.js';
import { tripSettleOf } from '../lib/trip-pay.js';
import { OneTab, SinceBooks, TabSwitch } from '../components/CrewTabs.jsx';
import { switchTabs, tabsOf } from '../lib/crew-tabs.js';
import { ALL } from '../lib/books.js';
import { TalkBar } from '../components/Talk.jsx';
import { paymentTalk, roundTalk, roundThread } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';

const first = name => name.split(' ')[0];
// The tab you last looked at this visit (Everyone, or a crew's or trip's), so coming back keeps it
const VIEW_KEY = 'bb-tab-view';
const readView = () => { try { return sessionStorage.getItem(VIEW_KEY) || 'everyone'; } catch { return 'everyone'; } };

export default function Ledger() {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  useTabSync({ live: true });
  // A trip's published plan sets what each pair on it owes (trip-plan.js)
  useTripPlans();
  // A Big Game decided on another group's scores lands here too (big-sync.js)
  useBigSync();
  useCupSync();
  const plan = outstanding(state);
  // A tab for each crew or trip (crew-tabs.js), one tap from Everyone; they add up to it
  const all = useMemo(() => tabsOf(state), [state]);
  const switches = switchTabs(all, { hidden: id => tripHidden(state, id) });
  const [viewRaw, setViewRaw] = useState(readView);
  const view = switches.some(t => t.key === viewRaw) ? viewRaw : 'everyone';
  const setView = v => { setViewRaw(v); try { sessionStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };
  const one = view === 'everyone' ? null : switches.find(t => t.key === view);
  const [open, setOpen] = useState(null);
  const [free, setFree] = useState(false);
  // Before launch Season is open to everyone who has played a round. With the paywall flag on it's
  // the Pro preview again: organizers only, with the Pro tag
  const showSeason = PAYWALL_ON ? isOrganizer(state) : Object.values(state.rounds).some(r => r.status === 'done');
  const mine = myIds(state);
  const isMe = id => mine.has(id);

  // One row per friend: what the plan has between you (a friend you pass money on for can be both ways, so it's netted)
  const byPerson = new Map();
  for (const t of plan) {
    if (isMe(t.from) === isMe(t.to)) continue;
    const other = isMe(t.from) ? t.to : t.from;
    const cur = byPerson.get(other) || { id: other, net: 0, debts: [] };
    cur.net = Math.round((cur.net + (isMe(t.to) ? t.amount : -t.amount)) * 100) / 100;
    cur.debts.push(t);
    byPerson.set(other, cur);
  }
  const people = [...byPerson.values()].filter(p => p.net).sort((a, b) => b.net - a.net);
  const others = plan.filter(t => !isMe(t.from) && !isMe(t.to));
  const overall = Math.round(people.reduce((a, p) => a + p.net, 0) * 100) / 100;
  const h2h = headToHeadSummary(state, mine);
  // One row per tap: a tap that paid several rounds, or went both ways, is one payment
  const history = paymentGroups(state);
  // A payment talks on its round's settle-up line (talk.js paymentTalk): reactions and jabs on a paid mark
  const payTalks = new Map(history.slice(0, 30).map(s => [s.key, paymentTalk(state, s)]));
  useTalkSync([...new Set([...payTalks.values()].filter(Boolean).map(t => roundThread(t.round)))]);
  const hasRounds = Object.values(state.rounds).some(r => r.status === 'done');
  const hasShared = sharedDebts(state).length > 0;
  // Trips on now (or just settled): a card each on top. Their money is already in each total below
  const trips = currentTrips(state);
  const tripNames = tripsOf(state);
  const tripOf = s => s.settlements.map(x => tripSettleOf(x)?.id).find(Boolean);

  // One tap, no confirm: it can be put back from the toast, and a shared payment updates both phones
  const undo = s => {
    const redo = undoPayments(s.settlements);
    showToast(`${nameOf(state, s.from).split(' ')[0]} owes ${nameOf(state, s.to).split(' ')[0]} again`, { label: 'Undo', run: redo });
  };
  // People you squared with lately keep a card for a few days, so the last payment can be taken back
  const who = canonicalOf(state);
  const meId = state.me || [...mine][0] || null;
  const recentSquare = [...new Set([...state.settlements, ...allTripPays(state)].flatMap(s => [s.from, s.to]).map(who))]
    .filter(id => meId && !isMe(id) && !people.some(p => p.id === id))
    .map(id => ({ id, pay: recentPayment(state, meId, id) }))
    .filter(x => x.pay)
    .sort((a, b) => b.pay.at - a.pay.at);
  // Rewards from reward rounds ("You owe Sam lunch"): on the person's card, or a card of their own
  // for someone square on money (a Square card of their own carries it). Never counted in dollars or in who's square.
  const rewardOnly = [...new Set(openRewards(state, { ids: mine, canon: who }).map(l => l.other))].filter(id => !people.some(p => p.id === id) && !recentSquare.some(x => x.id === id));
  const squareIds = [...h2h.keys()].filter(id => !byPerson.has(id) && !recentSquare.some(x => x.id === id) && !rewardOnly.includes(id));
  const squareNames = squareIds.map(id => first(nameOf(state, id)));
  // For the all square scene: the buddies of the people you've played with
  const squareBuddies = [...h2h.keys()].slice(0, 2).map((id, i) => { const m = avatarModel(avatarFor(state, id), { key: id, name: nameOf(state, id) }); return m.kind === 'buddy' ? m.buddy : ['visor', 'snapback'][i]; });
  // Your running net, this season or over every round, for the chart under the big number and the
  // hero's headline and sentence (data-insights.js). The pill starts on the season when it has a
  // line to draw, else on all time
  const season = useMemo(() => netSeries(roundsInRange(state, defaultRange()), state), [state]);
  const allTime = useMemo(() => netSeries(roundsInRange(state, { kind: 'all' }), state), [state]);
  const [spanRaw, setSpan] = useState(null);
  const span = spanRaw || (season.length >= 2 || allTime.length < 2 ? 'season' : 'all');
  const series = span === 'season' ? season : allTime;
  const insight = tabInsight(series, { scope: span === 'season' ? 'this season' : 'overall' });
  const seriesEnd = series.length ? series.at(-1).total : 0;

  // The same Settle up sheet the person screen opens for a part payment
  const partDebt = p => {
    const amount = Math.abs(p.net);
    if (p.debts.length === 1) return p.debts[0];
    return p.net > 0 ? { from: p.id, to: state.me, amount } : { from: state.me, to: p.id, amount };
  };

  const personRow = p => {
    const name = nameOf(state, p.id);
    const owesMe = p.net > 0;
    const amount = Math.abs(p.net);
    const n = h2h.get(p.id)?.rounds || 0;
    const me = owesMe ? p.debts[0].to : p.debts[0].from;
    return (
      <div key={p.id} className="tab-card">
        <button className="tab-person" onClick={() => nav.push('person', { id: p.id })} aria-label={`${name}: ${owesMe ? 'owes you' : 'you owe'} ${money(amount)}. See the story`}>
          <Avatar id={p.id} name={name} />
          <div className="row-main">
            <div className="tp-name">{name}</div>
            <div className="tp-sub">{owesMe ? 'Owes you' : 'You owe'}{n ? ` · ${n} round${n === 1 ? '' : 's'} together` : ''}</div>
          </div>
          <div className={`tp-amt ${owesMe ? 'pos' : 'neg'}`}>{money(amount)}</div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <PersonActions other={p.id} net={p.net} meId={state.me || me} />
        {/* Part payments and where it comes from are a tap away on the person, so the card has one job */}
        <button className="link-btn tab-part" onClick={() => setOpen(partDebt(p))}>Paid part of it?</button>
        <RewardLines other={p.id} />
      </div>
    );
  };

  const squareCard = ({ id, pay }) => {
    const name = nameOf(state, id);
    return (
      <div key={id} className="tab-card square-card">
        <button className="tab-person" onClick={() => nav.push('person', { id })} aria-label={`Square with ${name}. See the story`}>
          <Avatar id={id} name={name} />
          <div className="row-main">
            <div className="tp-name">Square with {first(name)}</div>
            <div className="tp-sub">All paid up</div>
          </div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <RecentPaid meId={meId} other={id} pay={pay} />
        <RewardLines other={id} />
      </div>
    );
  };

  const rewardCard = id => {
    const name = nameOf(state, id);
    return (
      <div key={`reward:${id}`} className="tab-card">
        <button className="tab-person" onClick={() => nav.push('person', { id })} aria-label={`${name}. See the story`}>
          <Avatar id={id} name={name} />
          <div className="row-main">
            <div className="tp-name">{name}</div>
            <div className="tp-sub">Square on money</div>
          </div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <RewardLines other={id} />
      </div>
    );
  };

  const otherRow = d => (
    <button key={d.from + d.to} className="ledger-row" onClick={() => setOpen(d)}>
      <div className="lr-info">
        <div className="lr-name" style={{ fontSize: 16 }}>{nameOf(state, d.from)} owes {nameOf(state, d.to)}</div>
      </div>
      <div className="lr-amt">{money(d.amount)}</div>
    </button>
  );

  return (
    <Screen>
      <Header title="Tab" right={<AvatarButton />} />
      <div className="scroll">
        {showSeason && (
          <div className="tab-view">
            <Segmented label="Tab view" className="press-mode-row" btn="pm-btn" value="person"
              onChange={v => v === 'season' && nav.push('season')}
              options={[{ value: 'person', label: 'By person' }, { value: 'season', label: PAYWALL_ON ? <>Season<span className="pro-tag"><span className="sr-only">, </span>Pro</span></> : 'Season' }]} />
          </div>
        )}
        <TabSwitch tabs={switches} value={view} onChange={setView} />
        {one ? <OneTab tab={one} /> : <>
        <SquareStrip />
        {trips.map(t => <TripTabCard key={t.trip.id} status={t} />)}
        {trips.some(t => t.money.length > 0) && plan.length > 0 && <p className="field-help pad trip-folded">{trips.filter(t => t.money.length > 0).every(t => t.big) ? 'The game’s money is in each person’s total below.' : 'Trip money is in each person’s total below.'}</p>}
        {plan.length === 0 ? (
          <Empty title={hasRounds ? 'All square' : 'Nothing owed yet'} illo={hasRounds ? 'highfive' : 'wallet'} ids={squareBuddies}
            text={hasRounds ? 'Nobody owes anybody. Time to go win it back.' : 'Finish a round and the Tab fills in. Money nets out across every round, so you pay less often.'}
            action={!hasRounds && <button className="ec" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>} />
        ) : (
          <>
            {people.length > 0 && (
              <div className="tab-overall tab-hero">
                {/* One big number, who it's with under it, then how the season's gone in a line */}
                <div className={`tab-big d ${overall > 0 ? 'pos' : overall < 0 ? 'neg' : ''}`}>{money(overall, { sign: true })}</div>
                <div className="tab-who">
                  <span className="tab-faces">{people.slice(0, 5).map(p => <Avatar key={p.id} id={p.id} name={nameOf(state, p.id)} size="sm" />)}</span>
                  <span>{overall > 0 ? 'You’re up' : overall < 0 ? 'You’re down' : 'You’re even'} · {people.length === 1 ? `with ${first(nameOf(state, people[0].id))}` : `across ${people.length} people`}</span>
                </div>
                <h2 className="d tab-headline">{insight.headline}</h2>
                <Insight insight={insight} />
              </div>
            )}
            {people.length > 0 && (season.length >= 2 || allTime.length >= 2) && (
              <div className="chart-card tab-spark">
                <div className="cc-head">
                  <div>
                    <div className="eyebrow">Your net</div>
                    <div className={`cc-big ${seriesEnd > 0 ? 'pos' : seriesEnd < 0 ? 'neg' : ''}`}>{money(seriesEnd, { sign: true })}</div>
                    <div className="cc-cap">{series.length ? `${series.length} round${series.length === 1 ? '' : 's'} for money` : 'No rounds for money yet'}{span === 'season' ? ' this season' : ' all time'}</div>
                  </div>
                  <RangePill label="Chart range" value={span} onChange={setSpan} options={[{ value: 'season', label: 'Season' }, { value: 'all', label: 'All time' }]} />
                </div>
                {series.length >= 2
                  ? <SeasonChart series={series} label={span === 'season' ? 'This season' : 'All time'} />
                  : <p className="cc-none">{series.length ? 'One round so far. The line starts at two.' : 'Finish a round for money and the line starts here.'}</p>}
              </div>
            )}
            <SinceBooks scope={ALL} />
            {people.map(personRow)}
            {recentSquare.map(squareCard)}
            {rewardOnly.map(rewardCard)}
            {squareIds.length > 0 && people.length > 0 && (
              <div className="square-line">
                <span className="tab-faces">{squareIds.slice(0, 5).map(id => <Avatar key={id} id={id} name={nameOf(state, id)} size="sm" />)}</span>
                <span><Icon name="check-circle" fill /> All square with {listNames(squareNames)}</span>
              </div>
            )}
            {others.length > 0 && (
              <>
                <div className="sec-label">{people.length ? 'Everyone else' : 'Who owes who'}</div>
                {others.map(otherRow)}
              </>
            )}
            <details className="how pad"><summary>How the Tab works</summary><p>Netted across every round, then squared in the fewest payments. Nobody is asked to pay someone they haven’t played with.{hasShared ? ' Money from rounds you shared live stays between the two players, so both phones agree on it.' : ''}</p></details>
          </>
        )}
        {plan.length === 0 && <SinceBooks scope={ALL} />}
        {plan.length === 0 && rewardOnly.map(rewardCard)}
        {plan.length === 0 && recentSquare.map(squareCard)}
        {history.length > 0 && (
          <>
            <div className="sec-label">Payments</div>
            {history.slice(0, 30).map(s => {
              const line = `${isMe(s.from) ? 'You' : nameOf(state, s.from)} paid ${isMe(s.to) ? 'you' : nameOf(state, s.to)}`;
              const pt = payTalks.get(s.key);
              return (
                <div key={s.key} className={pt ? 'pay-talk' : undefined}>
                  <div className="ledger-row static">
                    <div className="lr-info">
                      <div className="lr-name" style={{ fontSize: 16 }}>{line}</div>
                      <div className="lr-status">{new Date(s.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{tripNames.get(tripOf(s))?.name ? ` · ${tripNames.get(tripOf(s)).name}` : ''}</div>
                    </div>
                    <div className="lr-amt" style={{ marginRight: 8 }}>{money(s.amount)}</div>
                    <button className="icon-btn sm" onClick={() => undo(s)} aria-label="Undo payment"><Icon name="arrow-counter-clockwise" /></button>
                  </div>
                  {pt && <TalkBar ctx={roundTalk(pt.round, state)} on={pt.on} title={line} />}
                </div>
              );
            })}
          </>
        )}
        {/* The season's tools, together in one short list */}
        {(hasRounds || trips.length === 0) && (
          <div className={`tab-tools ${hasRounds ? '' : 'solo'}`}>
            {hasRounds && (
              <button className="text-link stats-link" onClick={() => nav.push('closeBooks', { scope: ALL })}>
                <Icon name="book-bookmark" fill /> <span className="row-main">Close the books<span className="sl-sub">Keep everyone’s totals, then settle up or roll to next season</span></span> <Icon name="caret-right" />
              </button>
            )}
            {trips.length === 0 && <StartTripLink onMade={t => nav.push('trip', { id: t.id })} />}
          </div>
        )}
        {/* The free-forever list is held until Trevor says so: only with the paywall preview flag */}
        {PAYWALL_ON && (
          <div className="tab-free">
            <span className="tf-title">The Tab is free, always</span>
            <button className="link-btn" onClick={() => setFree(true)}>See what’s free forever</button>
          </div>
        )}
        </>}
      </div>
      <BottomNav />
      <SettleSheet debt={open} onClose={() => setOpen(null)} />
      <FreePromise open={free} onClose={() => setFree(false)} />
    </Screen>
  );
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
