// The Big Game's page: every group at a glance (how far each is, who's keeping score, waiting on
// one whose scores aren't on this phone yet), the leaderboards across the whole field (the pot,
// field skins, team best ball, the side bets), and once every group is in, each person's money
// and one settle-up for the whole game in the fewest payments, the same on every phone. The game's
// money is already in each person's total on the Tab, so paying here pays the Tab too. Only the
// organizer starts the groups, adds side bets or closes the game early. See big-game.js,
// big-money.js and big-sync.js for how it's all worked out.
import { useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented, Sheet, useUI } from '../components/ui.jsx';
import { Avatar, PayButton, RequestButton } from '../components/Pay.jsx';
import { BetsList, BigBetSheet, BigDots, GroupCard, MoneyTable, PotTable, SkinsList, TeamsTable } from '../components/BigGame.jsx';
import { bigWho, myBigMoney, myPlaceLine } from '../lib/big-view.js';
import { getState, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { PAY_APPS, payInfoFor } from '../lib/pay.js';
import { dayLabel, daysUntil } from '../lib/plans.js';
import { buzz } from '../lib/delight.js';
import { keeperName, keeperOf } from '../lib/keeper.js';
import { nameOf } from '../lib/ledger.js';
import { shareLink } from '../lib/sync.js';
import { allTripPays } from '../lib/trip-expenses.js';
import { markTripPayment, undoPayments, usePaymentsOff, useTabSync } from '../lib/tab-sync.js';
import { canMarkLine, tripStatus } from '../lib/trips.js';
import { useTripPlans } from '../lib/trip-plan-sync.js';
import { BIG_NAME, POT_KINDS, bigSummary, buyIns, placesLabel } from '../lib/big-game.js';
import { bigStatus } from '../lib/big-money.js';
import { useBigSync } from '../lib/big-sync.js';
import { bigChangesReach, closeBig, deleteBig, removeBigBet, shareGroups, startGroups } from '../lib/big-store.js';

const first = n => String(n || '').trim().split(/\s+/)[0];
const sign = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

/** The text that sends every group its own link at once. */
function linksText(trip, big) {
  const lines = big.groups.filter(g => g.code).map(g => `${g.name} (${g.players.map(id => first(big.people[id]?.name)).join(', ')}): ${shareLink(g.code)}`);
  return `${trip.name}${trip.where ? ` at ${trip.where}` : ''}. Find your group and take your seat, no download. One player in each group keeps score.\n\n${lines.join('\n')}`;
}

export default function BigGame({ id, view: firstView = null }) {
  const nav = useNav();
  const state = useStore();
  const { ask, showToast } = useUI();
  // Other groups' rounds and the organizer's copy of the game, the payments, and the trip's plan
  useBigSync({ live: true });
  useTabSync({ live: true });
  useTripPlans();
  const off = usePaymentsOff();
  const [pickedView, setView] = useState(firstView);
  const [betSheet, setBetSheet] = useState(null);
  const [groupOpen, setGroupOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const st = tripStatus(state, id);
  const bs = st?.big || bigStatus(state, id);
  if (!st || !bs) {
    return <Screen><Header title={BIG_NAME} small onBack={nav.pop} /><div className="scroll"><Empty title="This Big Game is gone" text="Its rounds and their money are still in History and on the Tab." /></div></Screen>;
  }
  const { trip } = st;
  const { big } = bs;
  const { me, isMe, name } = bigWho(state, big);
  const organizer = st.organizer;
  const started = big.groups.some(g => g.roundId);
  const mine = myBigMoney(bs, isMe);
  const views = [
    { value: 'board', label: big.pot.on ? 'Board' : 'Groups' },
    ...(big.skins.on ? [{ value: 'skins', label: 'Skins' }] : []),
    ...(big.teams.on ? [{ value: 'teams', label: 'Teams' }] : []),
    { value: 'bets', label: 'Bets' },
    { value: 'money', label: 'Money' },
  ];
  const view = views.some(v => v.value === pickedView) ? pickedView : bs.final && st.phase === 'ready' ? 'money' : 'board';
  const day = dayLabel(trip.start);
  const soon = (daysUntil(trip.start) ?? 0) > 0;
  const paidAny = st.paid.length > 0;
  // Until the game's record is on the server, a change only reaches the groups whose card this
  // phone keeps, so once a scorekeeper has one, the bets and the close stay as they are
  const reach = organizer && bigChangesReach(state, id);
  // Who set it up, by the name the game has for them
  const host = trip.by && !isMe(trip.by) ? first(big.people[trip.by]?.name || nameOf(state, trip.by)) : null;

  const eyebrow = [day, trip.where, `${big.groups.length} groups`].filter(Boolean).join(' · ');
  const headline = !started ? (soon ? `Set for ${day.toLowerCase() === 'tomorrow' ? 'tomorrow' : day}` : 'Ready to start the groups')
    : bs.final ? (mine == null ? 'Every group is in' : mine > 0 ? `You won ${money(mine)}` : mine < 0 ? `You’re down ${money(-mine)}` : 'You broke even')
    : myPlaceLine(bs, isMe) || 'Under way';
  const hint = !started ? `Each group gets its own round and its own link, and one player in each keeps score. ${organizer ? 'Start the groups on the day, at the course.' : ''}`
    : bs.final ? (st.phase === 'square' ? 'Everyone’s square on the game.' : `Every group is in. ${st.plan.length} payment${st.plan.length === 1 ? '' : 's'} square${st.plan.length === 1 ? 's' : ''} the whole game${st.money.some(r => r.bets?.length || r.sideGames?.length) ? ', the groups’ own bets included' : ''}, the same on every phone. It’s already in each person’s total on the Tab.`)
    : bs.waiting.length ? `Waiting on ${bs.waiting.map(g => g.name).join(', ')}: ${bs.waiting.length === 1 ? 'its' : 'their'} scores aren’t on this phone yet. Nothing’s paid until every group is in.`
    : 'Every group’s scores come in as they’re played. Nothing’s paid until every group is in, then it’s settled once.';

  const start = async () => {
    setBusy(true);
    const res = await startGroups(id);
    setBusy(false);
    if (!res.ok) { showToast(res.why); return; }
    showToast(res.shared === big.groups.length ? 'The groups are on. Send them their links' : 'The groups are on. No signal for the links yet: try Share again');
  };
  const share = async () => {
    const text = linksText(trip, bigStatus(getState(), id)?.big || big);
    try { if (navigator.share) { await navigator.share({ title: trip.name, text }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); showToast('Every group’s link is copied'); } catch { showToast('Couldn’t copy the links'); }
  };
  const reshare = async () => {
    setBusy(true);
    const n = await shareGroups(id);
    setBusy(false);
    showToast(n === big.groups.length ? 'Every group has its link' : 'Still no signal for some groups. Try again in a bit');
  };
  const close = async () => {
    const out = bs.field.groups.filter(g => g.status !== 'done');
    const ok = await ask({
      title: 'Close the game now?',
      text: `${out.map(g => g.name).join(', ')} ${out.length === 1 ? 'is' : 'are'} still playing. ${out.length === 1 ? 'Its' : 'Their'} scores count as they stand: a card not finished doesn’t place in stroke play, and holes not played don’t count for skins.`,
      confirmLabel: 'Close the game',
    });
    if (ok) { closeBig(id); showToast('The game is closed. Settle it once every group’s card is in'); }
  };
  const del = async () => {
    if (!(await ask({ title: `Delete ${trip.name}?`, text: 'Nobody else has it yet, since the groups haven’t started.', confirmLabel: 'Delete the game', danger: true }))) return;
    if (deleteBig(id)) nav.pop();
  };
  const unbet = async bet => {
    setBetSheet(null);
    if (removeBigBet(id, bet.id)) showToast('That side bet is off');
  };

  return (
    <Screen>
      <Header title={trip.name} small onBack={nav.pop} right={organizer && !started ? <button className="header-btn" onClick={() => nav.push('bigGameSetup', { id })}><Icon name="pencil-simple" /> Edit</button> : null} />
      <div className="scroll">
        <div className="trip-hero">
          <div className="eyebrow pink">{eyebrow}</div>
          <div className={`tab-big d ${mine != null ? sign(mine) : ''}`}>{headline}</div>
          <div className="trip-sub">{bigSummary(big, money)}</div>
          {started && <BigDots bs={bs} />}
        </div>
        <p className="hint-card"><Icon name={bs.final ? 'handshake' : 'users-four'} fill /> {hint}</p>

        <Groups bs={bs} state={state} name={name} organizer={organizer} onOpen={g => (g.card && state.rounds[g.card.id] ? nav.push('play', { id: g.card.id }) : setGroupOpen(g))} />
        {organizer && started && !bs.final && (
          <div className="chip-row">
            {big.groups.every(g => g.code) && <button className="pill-btn" onClick={share}><Icon name="share-network" /> Send every group its link</button>}
            {big.groups.some(g => !g.code) && <button className="pill-btn" disabled={busy} onClick={reshare}><Icon name="broadcast" /> {busy ? 'Sharing…' : 'Share the groups again'}</button>}
          </div>
        )}

        {started && (
          <div className="tab-view">
            <Segmented label="Big Game view" className="press-mode-row trip-views" btn="pm-btn" value={view} onChange={setView} options={views} />
          </div>
        )}

        {started && view === 'board' && (big.pot.on ? (
          <>
            <PotTable bs={bs} isMe={isMe} name={name} />
            <p className="field-help pad">{POT_KINDS[big.pot.kind].name} across every group, {placesLabel(big.pot.places).toLowerCase()}{big.useHandicaps && big.pot.kind !== 'gross' ? `, strokes from full handicaps at ${big.hcPct}%` : ''}. {big.pot.kind === 'stableford' ? 'Points so far.' : 'To par on the holes played so far. A card has to be finished to place.'} Ties share the places they cover.</p>
          </>
        ) : <p className="field-help pad">No pot on this game. The groups are above, and the skins, teams and bets have their own tabs.</p>)}
        {started && view === 'skins' && <SkinsList bs={bs} name={name} />}
        {started && view === 'teams' && <TeamsTable bs={bs} isMe={isMe} name={name} />}
        {started && view === 'bets' && (
          <>
            <BetsList bs={bs} name={name} onEdit={reach && !bs.final ? setBetSheet : null} />
            {reach && !bs.final && <button className="add-row" onClick={() => setBetSheet('new')}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add a side bet</span></button>}
            {!organizer && !bs.final && <p className="field-help pad">Want one with someone? Ask {host || 'the organizer'} to add it. Bets inside your own group go on your round as usual.</p>}
            {organizer && !reach && !bs.final && <p className="field-help pad">The scorekeepers have the cards now, so a change to the game’s bets wouldn’t reach every group yet. Bets inside a group still go on its round as usual.</p>}
          </>
        )}
        {started && view === 'money' && <Money bs={bs} st={st} id={id} state={state} me={me} isMe={isMe} name={name} off={off} />}

        {!started && <Setup bs={bs} name={name} />}
        {organizer && !started && <button className="text-link danger" onClick={del}><Icon name="trash" /> Delete the game</button>}
        {!organizer && <p className="field-help pad">{host ? `${host} set up the game. ` : ''}Only the organizer changes it.</p>}
      </div>
      <div className="cta-wrap">
        {organizer && !started && <button className="full-btn pink" disabled={busy || soon} onClick={start}>{busy ? 'Starting…' : soon ? `Start the groups ${day.toLowerCase() === 'tomorrow' ? 'tomorrow' : `on ${day}`}` : <>Start the groups <Icon name="flag-pennant" fill /></>}</button>}
        {reach && started && !bs.final && !bs.ended && bs.field.groups.some(g => g.status === 'done') && <button className="link-btn center" onClick={close}>Group still out there? Close the game now</button>}
        {reach && bs.ended && !paidAny && <button className="link-btn center" onClick={() => closeBig(id, false)}>Still playing? Open the game again</button>}
        {/* A weekly game: next time's starts from this one, the same players, groups and pots */}
        {organizer && bs.final && <button className="full-btn outline" onClick={() => nav.push('bigGameSetup', { from: id })}><Icon name="arrow-counter-clockwise" /> Set it up for next time</button>}
      </div>
      {betSheet && <BigBetSheet open tripId={id} big={big} bet={betSheet === 'new' ? null : betSheet} name={name} onClose={() => setBetSheet(null)} onRemove={betSheet !== 'new' ? () => unbet(betSheet) : null} />}
      <Sheet open={!!groupOpen} onClose={() => setGroupOpen(null)} title={groupOpen?.name || ''}>
        {groupOpen && <GroupCard group={bs.field.groups.find(g => g.id === groupOpen.id) || groupOpen} big={big} name={name} />}
        <div className="cta-wrap"><button className="full-btn outline" onClick={() => setGroupOpen(null)}>Close</button></div>
      </Sheet>
    </Screen>
  );
}

/** Every group at a glance: who's in it, how far they are, who's keeping score. */
function Groups({ bs, state, name, organizer, onOpen }) {
  const { isMe } = bigWho(state, bs.big);
  // Who has the card: a player, or the phone that started the round (the organizer's)
  const keeping = g => {
    const k = keeperOf(g.card);
    if (k?.id) return isMe(k.id) ? 'You’re keeping score' : `${first(name(k.id))} is keeping score`;
    return organizer && state.rounds[g.card.id] ? 'Your phone is keeping score' : `${keeperName(g.card)} is keeping score`;
  };
  return (
    <>
      <div className="sec-label">The groups</div>
      {bs.field.groups.map(g => {
        const local = g.card && state.rounds[g.card.id];
        const status = !g.roundId ? (g.keeper ? `${name(g.keeper) === 'You' ? 'You keep' : `${first(name(g.keeper))} keeps`} score` : 'One player keeps score')
          : g.status === 'waiting' ? (g.code ? 'Scores not on this phone yet' : organizer ? 'No link yet: share the groups again' : 'Not shared yet')
          : g.status === 'done' ? 'Finished'
          : `${g.thru ? `Thru ${g.thru}` : 'Not teed off'} · ${keeping(g)}`;
        return (
          <button key={g.id} className={`ledger-row big-group ${g.status}`} onClick={() => onOpen(g)} disabled={!g.roundId}>
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>{g.name}{local ? ' · your phone has it' : ''}</div>
              <div className="lr-status">{g.players.map(name).join(', ')}</div>
              <div className={`lr-status big-group-st ${g.status}`}>{status}</div>
            </div>
            {g.roundId && <span className="chevron"><Icon name="caret-right" /></span>}
          </button>
        );
      })}
    </>
  );
}

/** Before the groups start: what's on the game and what everyone puts in. */
function Setup({ bs, name }) {
  const { big } = bs;
  const ins = buyIns(big);
  const each = new Set(Object.values(ins));
  return (
    <>
      <div className="sec-label">On the line</div>
      <div className="block">
        {big.pot.on && <p className="big-line"><b>{money(big.pot.stake)} pot</b> · {POT_KINDS[big.pot.kind].name}, {placesLabel(big.pot.places).toLowerCase()}</p>}
        {big.skins.on && <p className="big-line"><b>{money(big.skins.stake)} skins</b> · {big.skins.kind === 'net' ? 'Net' : 'Gross'}, one skin a hole across every group{big.skins.carry ? ', ties carry' : ''}{big.skins.out.length ? `. Sitting out: ${big.skins.out.map(name).join(', ')}` : ''}</p>}
        {big.teams.on && <p className="big-line"><b>{money(big.teams.stake)} team best {big.teams.best === 2 ? 'two' : 'ball'}</b> · {big.teams.list.map(t => t.players.map(name).join(' & ')).join(' · ')}</p>}
        {big.bets.length > 0 && <p className="big-line"><b>{big.bets.length} side bet{big.bets.length === 1 ? '' : 's'}</b> · {big.bets.map(b => `${name(b.sides[0])} v ${name(b.sides[1])}`).join(', ')}</p>}
        <p className="field-help">{each.size === 1 ? `Everyone puts in ${money([...each][0] / 100)}.` : 'What each person puts in depends on what they’re in.'} Nothing is paid until every group is in, then it’s settled once in the fewest payments.</p>
      </div>
    </>
  );
}

/** Each person's money from the game and one settle-up for the whole of it, once every group is in. */
function Money({ bs, st, id, state, me, isMe, name, off }) {
  const { showToast } = useUI();
  const { big } = bs;
  if (!bs.final) {
    const ins = buyIns(big);
    const mineIn = Object.entries(ins).filter(([pid]) => isMe(pid)).reduce((a, [, c]) => a + c, 0);
    return (
      <>
        <p className="field-help pad">The money is worked out once every group is in, the same on every phone{bs.waiting.length ? `. Still waiting on ${bs.waiting.map(g => g.name).join(', ')}` : ''}.{mineIn ? ` You’re in for ${money(mineIn / 100)}.` : ''}</p>
        <p className="field-help pad">{big.pot.on ? `The pot is ${money(bs.results.money.pot.pool / 100 || big.pot.stake * Object.keys(big.people).length)}, paying ${placesLabel(big.pot.places).toLowerCase()}. ` : ''}{big.skins.on ? `The skins pot is ${money((Object.keys(big.people).length - big.skins.out.length) * big.skins.stake)}. ` : ''}</p>
      </>
    );
  }
  const who = canonicalOf(state);
  const lines = st.plan;
  const mineLines = lines.filter(t => t.from === me || t.to === me);
  const others = lines.filter(t => t.from !== me && t.to !== me);
  const short = x => (x === me ? 'You' : first(big.people[x]?.name || nameOf(state, x)));
  const myApp = payInfoFor(state, state.me);
  const mark = t => {
    const { shared, at } = markTripPayment({ tripId: id, from: t.from, to: t.to });
    buzz(15);
    const text = t.from === me ? `You paid ${short(t.to)}` : t.to === me ? `${short(t.from)} paid you` : `${short(t.from)} paid ${short(t.to)}`;
    showToast(shared ? `${text}. Everyone in the game sees it.` : text, { label: 'Undo', run: () => {
      const pair = [t.from, t.to].sort().join();
      const list = [...getState().settlements, ...allTripPays(getState())].filter(x => x.at === at && [who(x.from), who(x.to)].sort().join() === pair);
      if (list.length) undoPayments(list);
    } });
  };
  const undo = g => {
    const redo = undoPayments(g.settlements);
    showToast(`${short(g.from)} ${g.from === me ? 'owe' : 'owes'} ${g.to === me ? 'you' : short(g.to)} again`, { label: 'Undo', run: redo });
  };
  return (
    <>
      <MoneyTable bs={bs} isMe={isMe} name={name} />
      <p className="field-help pad">Adds up to $0 across the game. The pot and skins pay what each person won less their buy-in.</p>
      <div className="sec-label">Settle the game</div>
      {!lines.length && <p className="hint-card"><Icon name="handshake" fill /> Everyone’s square on the game.</p>}
      {mineLines.map((t, i) => {
        const iPay = t.from === me;
        const other = iPay ? t.to : t.from;
        const app = payInfoFor(state, iPay ? other : state.me);
        return (
          <div key={t.from + t.to} className="pay-card" style={{ '--i': i }}>
            <div className="pay-who">
              <Avatar id={other} name={nameOf(state, other)} />
              <span className="trip-pay-name">{iPay ? `You pay ${short(other)}` : `${short(other)} pays you`}</span>
              <span className="pm">{money(t.amount)}</span>
            </div>
            {app && <div className="trip-pay-sub">To {iPay ? `${short(other)}’s` : 'your'} {PAY_APPS[app.app]?.name || 'pay app'}</div>}
            <div className="pay-acts wrap">
              {iPay ? <PayButton info={payInfoFor(state, other)} amount={t.amount} note={st.trip.name} />
                : <RequestButton payer={payInfoFor(state, other)} mine={myApp} amount={t.amount} note={st.trip.name} />}
              <button className="pay-btn ink" onClick={() => mark(t)}><span className="pay-in"><Icon name="check-circle" fill /><span className="pay-lbl">{iPay ? 'I paid' : 'I got it'}</span></span></button>
            </div>
          </div>
        );
      })}
      {others.length > 0 && (
        <>
          <div className="sec-label">{mineLines.length ? 'Everyone else' : 'Who pays who'}</div>
          {others.map(t => (
            <div key={t.from + t.to} className="ledger-row static trip-other">
              <div className="lr-info">
                <div className="lr-name" style={{ fontSize: 16 }}>{short(t.from)} pays {short(t.to)}</div>
                {PAY_APPS[payInfoFor(state, t.to)?.app] && <div className="lr-status">{short(t.to)} picked {PAY_APPS[payInfoFor(state, t.to).app].name}</div>}
              </div>
              <div className="lr-amt" style={{ marginRight: 8 }}>{money(t.amount)}</div>
              {canMarkLine(state, t) && <button className="pill-btn sm" onClick={() => mark(t)}>Mark paid</button>}
            </div>
          ))}
        </>
      )}
      {st.payments.length > 0 && (
        <>
          <div className="sec-label">Paid</div>
          {st.payments.map(g => (
            <div key={g.key} className="ledger-row static">
              <div className="lr-info">
                <div className="lr-name" style={{ fontSize: 16 }}>{short(g.from)} paid {g.to === me ? 'you' : short(g.to)}</div>
                <div className="lr-status">{new Date(g.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
              <div className="lr-amt" style={{ marginRight: 8 }}>{money(g.amount)}</div>
              <button className="icon-btn sm" onClick={() => undo(g)} aria-label="Undo payment"><Icon name="arrow-counter-clockwise" /></button>
            </div>
          ))}
        </>
      )}
      <p className="field-help pad">One settle-up for the whole game in the fewest payments, worked out the same on every phone from every group’s card. It’s already in each person’s total on the Tab, so paying here pays the Tab too.{off ? '' : ' A payment marked here shows on the phones of everyone in the game.'}</p>
    </>
  );
}
