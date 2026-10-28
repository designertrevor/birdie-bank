// The Tab: your net with each friend across every round, squared in the fewest payments.
// Layout Lab E (overhaul, 2026-10-26): one card says what's still owed, then two sections, "Owes
// you" and "You owe", a card per person with Paid and Roll to next time side by side. The sections
// come from tab-sections.js, which only reads the plan the Tab always had (ledger.js outstanding).
import { useEffect, useMemo, useState } from 'react';
import './tab.css';
import { Empty, Header, Icon, Screen, useUI } from '../components/ui.jsx';
import FreePromise from '../components/FreePromise.jsx';
import { Avatar, SettleSheet } from '../components/Pay.jsx';
import { PersonActions, RecentPaid, RewardLines, SquareStrip } from '../components/TabCard.jsx';
import { avatarFor, avatarModel } from '../lib/avatars.js';
import { useStore } from '../lib/store.js';
import { headToHeadSummary, nameOf, outstanding } from '../lib/ledger.js';
import { paymentGroups } from '../lib/shared-tab.js';
import { sharedDebts } from '../lib/pair-debts.js';
import { undoPayments, usePaymentsOff, useTabSync, useTabWaiting } from '../lib/tab-sync.js';
import { useTripPlans } from '../lib/trip-plan-sync.js';
import { useBigSync } from '../lib/big-sync.js';
import { useCupSync } from '../lib/cup-sync.js';
import { money } from '../lib/golf.js';
import { myIds } from '../lib/format.js';
import { tabSections, tabSummary } from '../lib/tab-sections.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { isOrganizer } from '../lib/paywall.js';
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
  const h2h = headToHeadSummary(state, mine);

  // Who owes you, who you owe, and who's square: the plan's lines with you, person by person
  const sections = tabSections(state, { plan, mine, h2h });
  const { owesYou, youOwe, people, others, recentSquare, rewardOnly, squareIds, meId } = sections;
  const summary = tabSummary(sections, id => nameOf(state, id));
  const squareNames = squareIds.map(id => first(nameOf(state, id)));
  // One row per tap: a tap that paid several rounds, or went both ways, is one payment
  const history = paymentGroups(state);
  // A payment talks on its round's settle-up line (talk.js paymentTalk): reactions and jabs on a paid mark
  const payTalks = new Map(history.slice(0, 30).map(s => [s.key, paymentTalk(state, s)]));
  useTalkSync([...new Set([...payTalks.values()].filter(Boolean).map(t => roundThread(t.round)))]);
  const hasRounds = Object.values(state.rounds).some(r => r.status === 'done');
  const hasShared = sharedDebts(state).length > 0;
  // Trips on now (or just settled): a card each under the summary. Their money is already in each total below
  const trips = currentTrips(state);
  const tripNames = tripsOf(state);
  const tripOf = s => s.settlements.map(x => tripSettleOf(x)?.id).find(Boolean);
  // For the all square scene: the buddies of the people you've played with
  const squareBuddies = [...h2h.keys()].slice(0, 2).map((id, i) => { const m = avatarModel(avatarFor(state, id), { key: id, name: nameOf(state, id) }); return m.kind === 'buddy' ? m.buddy : ['visor', 'snapback'][i]; });

  // One tap, no confirm: it can be put back from the toast, and a shared payment updates both phones
  const undo = s => {
    const redo = undoPayments(s.settlements);
    showToast(`${nameOf(state, s.from).split(' ')[0]} owes ${nameOf(state, s.to).split(' ')[0]} again`, { label: 'Undo', run: redo });
  };

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
      <div key={p.id} className="tab-card te-card">
        <button className="tab-person" onClick={() => nav.push('person', { id: p.id })} aria-label={`${name}: ${owesMe ? 'owes you' : 'you owe'} ${money(amount)}. See the story`}>
          <Avatar id={p.id} name={name} />
          <div className="row-main">
            <div className="tp-name">{name}</div>
            {/* The section already says which way it goes, so the line under the name is the story */}
            <div className="tp-sub">{n ? `${n} round${n === 1 ? '' : 's'} together` : owesMe ? 'Owes you' : 'You owe'}</div>
          </div>
          <div className={`tp-amt ${owesMe ? 'pos' : 'neg'}`}>{money(amount)}</div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        {/* Compact: the reminder bell and where it comes from are on the person's screen; Paid part
            of it? shares the payment app's row, so the card is three short rows */}
        <PersonActions other={p.id} net={p.net} meId={state.me || me} compact extra={<button className="link-btn tab-part" onClick={() => setOpen(partDebt(p))}>Paid part of it?</button>} />
        <RewardLines other={p.id} />
      </div>
    );
  };

  const squareCard = ({ id, pay }) => {
    const name = nameOf(state, id);
    return (
      <div key={id} className="tab-card te-card square-card">
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
      <div key={`reward:${id}`} className="tab-card te-card">
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

  // A section's head: its name, how many, and its total on the right
  const sectionHead = (title, list, total, tone) => (
    <div className="te-head">
      <h2 className="te-title">{title}<span className="te-count">{list.length}</span></h2>
      <span className={`te-total ${tone}`}>{money(total)}</span>
    </div>
  );

  const anySquare = recentSquare.length > 0 || rewardOnly.length > 0 || (squareIds.length > 0 && people.length > 0);

  return (
    <Screen>
      <Header title="Tab" right={<AvatarButton />} />
      <div className="scroll tab-e">
        <TabSwitch tabs={switches} value={view} onChange={setView} />
        {one ? <OneTab tab={one} /> : <>
        {plan.length > 0 && summary.lead && (
          // What's still owed, big, and what you owe under it: the one thing to read on the screen
          <div className="te-summary">
            <span className="te-label">{summary.lead.label}</span>
            <span className={`te-big ${summary.lead.tone}`}>{money(summary.lead.amount)}</span>
            {summary.sub && <span className="te-sub">{summary.sub.text} <b className="neg">{money(summary.sub.amount)}</b></span>}
            {people.length > 1 && (
              <span className="te-net">
                <span className="tab-faces">{people.slice(0, 5).map(p => <Avatar key={p.id} id={p.id} name={nameOf(state, p.id)} size="sm" />)}</span>
                {sections.net > 0 ? 'You’re up' : sections.net < 0 ? 'You’re down' : 'You’re even'} {money(Math.abs(sections.net))} across {people.length} people
              </span>
            )}
          </div>
        )}
        <TabWaiting />
        {/* You're square but others still owe each other: the all-square moment still leads */}
        {plan.length > 0 && !summary.lead && people.length === 0 && (
          <Empty title="You’re all square" illo="highfive" ids={squareBuddies} text="Nobody owes you, you owe nobody. What the others owe each other is below." />
        )}
        {trips.map(t => <TripTabCard key={t.trip.id} status={t} />)}
        {trips.some(t => t.money.length > 0) && plan.length > 0 && <p className="field-help pad trip-folded">{trips.filter(t => t.money.length > 0).every(t => t.big) ? 'The game’s money is in each person’s total below.' : 'Trip money is in each person’s total below.'}</p>}
        {plan.length === 0 ? (
          <Empty title={hasRounds ? 'All square' : 'Nothing owed yet'} illo={hasRounds ? 'highfive' : 'coinstack'} ids={squareBuddies}
            text={hasRounds ? 'Nobody owes anybody. Time to go win it back.' : 'Finish a round and the Tab fills in. Money nets out across every round, so you pay less often.'}
            action={!hasRounds && <button className="ec" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>} />
        ) : (
          <>
            <SinceBooks scope={ALL} />
            {owesYou.length > 0 && (
              <section className="te-section" aria-label="Owes you">
                {sectionHead('Owes you', owesYou, sections.owedToYou, 'pos')}
                {owesYou.map(personRow)}
              </section>
            )}
            {youOwe.length > 0 && (
              <section className="te-section" aria-label="You owe">
                {sectionHead('You owe', youOwe, sections.youOweTotal, 'neg')}
                {youOwe.map(personRow)}
              </section>
            )}
            {/* Where you stand from the last round: context for the sections above, so it sits under them */}
            <SquareStrip />
            {anySquare && (
              <section className="te-section" aria-label="Square">
                <div className="te-head"><h2 className="te-title">Square</h2></div>
                {(recentSquare.length > 0 || rewardOnly.length > 0) && <div className="te-list">{recentSquare.map(squareCard)}{rewardOnly.map(rewardCard)}</div>}
                {squareIds.length > 0 && people.length > 0 && (
                  <div className="square-line">
                    <span className="tab-faces">{squareIds.slice(0, 5).map(id => <Avatar key={id} id={id} name={nameOf(state, id)} size="sm" />)}</span>
                    <span><Icon name="check-circle" fill /> All square with {listNames(squareNames)}</span>
                  </div>
                )}
              </section>
            )}
            {others.length > 0 && (
              <>
                <h2 className="sec-label">{people.length ? 'Everyone else' : 'Who owes who'}</h2>
                <div className="te-list">{others.map(otherRow)}</div>
              </>
            )}
            <details className="how pad"><summary>How the Tab works</summary><p>Netted across every round, then squared in the fewest payments. Nobody is asked to pay someone they haven’t played with.{hasShared ? ' Money from rounds you shared live stays between the two players, so both phones agree on it.' : ''}</p></details>
          </>
        )}
        {plan.length === 0 && <SquareStrip />}
        {plan.length === 0 && <SinceBooks scope={ALL} />}
        {plan.length === 0 && (recentSquare.length > 0 || rewardOnly.length > 0) && <div className="te-list">{rewardOnly.map(rewardCard)}{recentSquare.map(squareCard)}</div>}
        {history.length > 0 && (
          <>
            <h2 className="sec-label">Payments</h2>
            <div className="te-list">
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
            </div>
          </>
        )}
        {/* The season's tools, together in one short list. Season moved here from the switch at the
            top, so the summary card has the top of the screen to itself */}
        {(showSeason || hasRounds || trips.length === 0) && (
          <div className={`tab-tools ${showSeason || hasRounds ? '' : 'solo'}`}>
            {showSeason && (
              <button className="text-link stats-link" onClick={() => nav.push('season')}>
                <Icon name="chart-line-up" fill /> <span className="row-main">Season{PAYWALL_ON && <span className="pro-tag"><span className="sr-only">, </span>Pro</span>}<span className="sl-sub">Your net over the season, the standings and records</span></span> <Icon name="caret-right" />
              </button>
            )}
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

/**
 * Changes made here (a payment, an ask to roll it over) that haven't reached the other phones yet:
 * said quietly once they've waited a few seconds, so a tap with signal never flashes it, and gone
 * as soon as they're sent. The money on this phone already counts them.
 */
function TabWaiting() {
  // With payments off (no server, or its table not there yet) changes stay on this phone by design: nothing to say
  const off = usePaymentsOff();
  const any = useTabWaiting() > 0 && !off;
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!any) return undefined;
    const t = setTimeout(() => setLate(true), WAIT_SAY_MS);
    return () => { clearTimeout(t); setLate(false); };
  }, [any]);
  if (!any || !late) return null;
  return <p className="te-waiting" role="status"><Icon name="cloud-slash" /> Not sent yet. Your latest changes reach the group when there’s signal.</p>;
}
const WAIT_SAY_MS = 6000;

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
