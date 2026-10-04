// The Big Game's pieces (big-game.js, big-money.js): the card on Up next and the Tab, the bar on a
// group's round, the note on a group's results, each group at a glance, the leaderboards (the pot,
// field skins, the teams, the side bets), the money, and adding a side bet between any two players.
// The game's page and setup put them together (BigGame.jsx, BigGameSetup.jsx).
import { useState } from 'react';
import { Icon, Numpad, Segmented, Sheet, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { hideTrip } from '../lib/trip-store.js';
import { dayLabel } from '../lib/plans.js';
import { BIG_BET_KINDS, BIG_MAX_STAKE, POT_KINDS, SKINS_KINDS, betStrokesFor, bigName, bigPlayers, groupOf } from '../lib/big-game.js';
import { bigWho, myBigMoney, myPlaceLine, toParText } from '../lib/big-view.js';
import { bigStatus } from '../lib/big-money.js';
import { saveBigBet } from '../lib/big-store.js';
import { newBetId } from '../lib/pair-bets.js';

const sign = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

// --------------------------- Up next and the Tab ------------------------------

/** The game's card on Up next (and on the Tab, `onTab`): where you stand, the groups, and Settle the game once it's decided. */
export function BigCard({ status: st, onTab = false }) {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  const bs = st.big || bigStatus(state, st.trip.id);
  if (!bs) return null;
  const { isMe } = bigWho(state, bs.big);
  const mine = myBigMoney(bs, isMe);
  const playing = bs.field.groups.filter(g => g.status === 'live');
  const notStarted = !bs.big.groups.some(g => g.roundId);
  const title = notStarted ? `${dayLabel(st.trip.start) || 'Coming up'}: ${bigPlayers(bs.big).length} players, ${bs.big.groups.length} groups`
    : bs.final ? (mine == null ? 'Every group is in' : mine > 0 ? `You won ${money(mine)}` : mine < 0 ? `You’re down ${money(-mine)}` : 'You broke even')
    : myPlaceLine(bs, isMe) || `${playing.length || bs.big.groups.length} group${(playing.length || bs.big.groups.length) === 1 ? '' : 's'} out`;
  const sub = notStarted ? 'Start the groups on the day, each with its own scorekeeper'
    : bs.final ? (st.phase === 'square' ? 'Settled' : 'Settle the game')
    : bs.waiting.length ? `Waiting on ${bs.waiting.map(g => g.name).join(', ')}` : playing.map(g => `${g.name} thru ${g.thru}`).join(' · ');
  const open = () => nav.push('bigGame', { id: st.trip.id });
  const hide = e => {
    e.stopPropagation();
    hideTrip(st.trip.id);
    showToast(`${st.trip.name} is hidden. Its rounds and money stay as they are.`, { label: 'Undo', run: () => hideTrip(st.trip.id, false) });
  };
  return (
    <>
      {!onTab && <div className="sec-label">The Big Game</div>}
      <div className="trip-card-wrap">
        <button className={`trip-card big-card ${onTab ? 'on-tab' : ''}`} onClick={open} aria-label={`${st.trip.name}. ${title}. ${sub}. See the game`}>
          <div className="row-main">
            <div className="eyebrow">{st.trip.name}{st.trip.where ? ` · ${st.trip.where}` : ''}</div>
            <div className="trip-name d">{title}</div>
            {!notStarted && <BigDots bs={bs} />}
            <div className={`trip-sub ${bs.final && st.phase === 'ready' ? 'strong' : ''}`}>{sub}{bs.final && st.phase === 'ready' && <> <Icon name="arrow-right" /></>}</div>
          </div>
          {mine != null && onTab && (
            <div className="trip-amt-col">
              <div className={`trip-amt d ${sign(mine)}`}>{money(mine, { sign: true })}</div>
              <div className="trip-amt-sub">{st.phase === 'square' ? (mine > 0 ? 'won' : mine < 0 ? 'lost' : 'even') : 'to settle'}</div>
            </div>
          )}
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        {(bs.final || !st.organizer) && <button className="trip-hide" onClick={hide} aria-label={`Hide ${st.trip.name}`}><Icon name="x" /></button>}
      </div>
    </>
  );
}

/** One chip a group: waiting, how far they are, or done. */
export function BigDots({ bs }) {
  return (
    <div className="trip-days" aria-hidden="true">
      {bs.field.groups.map(g => (
        <span key={g.id} className={`trip-day ${g.status === 'done' ? 'done' : g.status === 'live' ? 'now' : ''}`}>
          {g.name.replace(/^Group /, 'G')}{g.status === 'live' ? ` · ${g.thru}` : g.status === 'waiting' ? ' · –' : ''}
        </span>
      ))}
    </div>
  );
}

// --------------------------- On a group's round ------------------------------

/**
 * On a group's round, in place of a money bar when the round has no money of its own: the group's
 * players in the whole field (to par or points, and their place), and one tap to the full board.
 */
export function BigBar({ round }) {
  const nav = useNav();
  const state = useStore();
  const bs = round?.trip?.id ? bigStatus(state, round.trip.id) : null;
  if (!bs) return null;
  const g = bs.big.groups.find(x => x.roundId === round.id || x.code === round.shareCode) || groupOf(bs.big, round.players[0]?.id);
  const rows = (g?.players || []).map(id => bs.results.pot.find(r => r.id === id)).filter(Boolean);
  const stableford = bs.big.pot.kind === 'stableford';
  const others = bs.field.groups.filter(x => x.id !== g?.id);
  const away = others.filter(x => x.status === 'waiting').length;
  return (
    <button type="button" className="money-bar mb-tap big-bar" onClick={() => nav.push('bigGame', { id: round.trip.id })} aria-label={`${round.trip.name}: the board across every group`}>
      <div className="mb-head">
        <span>{bs.big.pot.on ? POT_KINDS[bs.big.pot.kind].name : 'The Big Game'}</span>
        <span>{away ? `${away} group${away === 1 ? '' : 's'} not in yet · Board` : `${bigPlayers(bs.big).length} players · Board`}</span>
      </div>
      {bs.big.pot.on && (
        <div className="mb-items" style={{ gridTemplateColumns: `repeat(${Math.max(1, rows.length)}, minmax(0, 1fr))` }}>
          {rows.map(r => (
            <div key={r.id} className={`mb-item ${r.place === '1' || r.place === 'T1' ? 'lead' : ''}`}>
              <div className="mb-p">{bigName(bs.big, r.id)}</div>
              <div className="mb-a">{stableford ? r.points : toParText(r.toPar)}</div>
              <div className="mb-d">{r.thru ? `${r.place === '–' ? 'Not placed' : r.place} in the field` : ' '}</div>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

/** On a group's results: it's part of the Big Game, and how the game stands. */
export function BigRoundNote({ round }) {
  const nav = useNav();
  const state = useStore();
  const bs = round?.trip?.id ? bigStatus(state, round.trip.id) : null;
  if (!bs) return null;
  const { isMe } = bigWho(state, bs.big);
  const mine = myBigMoney(bs, isMe);
  const line = bs.final
    ? (mine == null ? 'Every group is in.' : `Every group is in: ${mine > 0 ? `you won ${money(mine)}` : mine < 0 ? `you’re down ${money(-mine)}` : 'you broke even'}.`)
    : bs.waiting.length ? `Waiting on ${bs.waiting.map(g => g.name).join(', ')}. The money is worked out once every group is in.`
    : 'The money is worked out once every group is in.';
  return (
    <button className="trip-card note" onClick={() => nav.push('bigGame', { id: round.trip.id })} aria-label={`Part of ${round.trip.name}. See the board`}>
      <div className="row-main">
        <div className="eyebrow">Part of {round.trip.name}</div>
        <div className="trip-sub">{myPlaceLine(bs, isMe) ? `${myPlaceLine(bs, isMe)}. ` : ''}{line}</div>
      </div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
}

// --------------------------- The boards ---------------------------------------

/** The individual leaderboard across every group. */
export function PotTable({ bs, isMe, name }) {
  const { big, results } = bs;
  const stableford = big.pot.kind === 'stableford';
  const won = bs.final ? results.money.pot.won : null;
  return (
    <div className="trip-table big-table">
      {results.pot.map(r => {
        const g = big.groups.find(x => x.id === r.group);
        return (
          <div key={r.id} className={`trip-row ${isMe(r.id) ? 'me' : ''}`}>
            <span className="tr-rank">{r.place}</span>
            <Avatar id={r.id} name={big.people[r.id]?.name} />
            <span className="tr-main">
              <span className="tr-name">{name(r.id)}</span>
              <span className="tr-sub">{g?.name}{r.thru ? ` · ${r.complete ? 'done' : `thru ${r.thru}`}` : ''}{won?.[r.id] ? ` · wins ${money(won[r.id] / 100)}` : ''}</span>
            </span>
            <span className="tr-amt">{stableford ? (r.thru ? `${r.points}` : '–') : toParText(r.toPar)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Field skins, hole by hole: who took each, what tied (and carried), and what's still out. */
export function SkinsList({ bs, name }) {
  const { big, results } = bs;
  const m = results.money.skins;
  const won = results.skins.filter(h => h.state === 'won');
  const kind = SKINS_KINDS[big.skins.kind].toLowerCase();
  return (
    <>
      <div className="trip-table big-table">
        {results.skins.map(h => (
          <div key={h.no} className="trip-row">
            <span className="tr-rank">{h.no}</span>
            <span className="tr-main">
              <span className="tr-name">{h.state === 'won' ? name(h.winner) : h.state === 'open' ? 'Still out' : h.state === 'none' ? 'Nobody scored' : 'Tied'}</span>
              <span className="tr-sub">{h.state === 'won' ? `${kind} ${h.score}${big.skins.carry && h.carry > 1 ? ` · worth ${h.carry} holes` : ''}`
                : h.state === 'tied' ? `${h.tied.length} at ${kind} ${h.score}${big.skins.carry ? ', carries' : ''}` : h.state === 'open' ? 'Not every group has played it' : ''}</span>
            </span>
            {h.state === 'won' && <Icon name="coins" fill />}
          </div>
        ))}
      </div>
      <p className="field-help pad">{won.length} skin{won.length === 1 ? '' : 's'} so far across every group. {big.skins.carry
        ? 'A tied hole carries to the next, and anything carried past the last hole is shared by every skin.'
        : 'The pot is split by skins won, so each skin is worth the same.'}{bs.final && m.pool ? ` ${money(m.pool / 100)} in the pot${won.length && !big.skins.carry ? `, ${money(m.perSkin / 100)} a skin` : ''}.` : ''}</p>
    </>
  );
}

/** Team best ball across groups. */
export function TeamsTable({ bs, isMe, name }) {
  const { big, results } = bs;
  return (
    <>
      <div className="trip-table big-table">
        {results.teams.map(t => (
          <div key={t.id} className={`trip-row ${t.players.some(isMe) ? 'me' : ''}`}>
            <span className="tr-rank">{t.place}</span>
            <span className="tr-main">
              <span className="tr-name">{t.players.map(name).join(' & ')}</span>
              <span className="tr-sub">{t.name}{t.thru ? ` · thru ${t.thru}` : ''}</span>
            </span>
            <span className="tr-amt">{toParText(t.toPar)}</span>
          </div>
        ))}
      </div>
      <p className="field-help pad">The best {big.teams.best === 2 ? 'two scores' : 'score'} on each hole counts, {SKINS_KINDS[big.teams.kind].toLowerCase()}, wherever each partner is playing. A ball not played counts as net double bogey.</p>
    </>
  );
}

/** The side bets between players, as they stand. */
export function BetsList({ bs, name, onEdit = null }) {
  const { results } = bs;
  if (!results.bets.length) return <p className="field-help pad">No side bets yet. Any two players can have one, in the same group or not: a match or per hole, with strokes between the two of them.</p>;
  return (
    <div className="trip-table big-table">
      {results.bets.map(({ bet, result, line }) => {
        const strokes = bet.strokes ? `${name(bet.strokes.to)} ${name(bet.strokes.to) === 'You' ? 'get' : 'gets'} ${bet.strokes.count}` : 'No strokes';
        const Row = onEdit ? 'button' : 'div';
        return (
          <Row key={bet.id} className="trip-row big-bet" {...(onEdit ? { type: 'button', onClick: () => onEdit(bet) } : {})}>
            <span className="tr-main">
              <span className="tr-name">{name(bet.sides[0])} v {name(bet.sides[1])}</span>
              <span className="tr-sub">{money(bet.stake)} {bet.kind === 'match' ? 'match' : 'a hole'} · {strokes} · {line}</span>
            </span>
            {bs.final && result.amount !== 0 && <span className={`tr-amt ${sign(result.amount)}`}>{money(Math.abs(result.amount))}</span>}
            {onEdit && <Icon name="pencil-simple" />}
          </Row>
        );
      })}
    </div>
  );
}

/** Each person's money from the game by format, once every group is in: the pot, the skins, the teams, the bets. */
export function MoneyTable({ bs, isMe, name }) {
  const { big, results } = bs;
  const m = results.money;
  const cols = [
    big.pot.on && { key: 'pot', label: 'Pot' },
    big.skins.on && { key: 'skins', label: 'Skins' },
    big.teams.on && { key: 'teams', label: 'Teams' },
    big.bets.length > 0 && { key: 'bets', label: 'Bets' },
  ].filter(Boolean);
  const ids = bigPlayers(big).sort((a, b) => (results.balances[b] || 0) - (results.balances[a] || 0) || name(a).localeCompare(name(b)));
  const cell = (part, id) => (id in (part.balances || {}) ? part.balances[id] : null);
  return (
    <div className="block trip-games-wrap">
      <table className="trip-games">
        <thead><tr><th scope="col"><span className="sr-only">Player</span></th>{cols.map(c => <th key={c.key} scope="col">{c.label}</th>)}<th scope="col">Total</th></tr></thead>
        <tbody>
          {ids.map(id => {
            const tot = (results.balances[id] || 0) / 100;
            return (
              <tr key={id} className={isMe(id) ? 'me' : ''}>
                <th scope="row">{name(id)}</th>
                {cols.map(c => { const v = cell(m[c.key], id); return <td key={c.key} className={v == null ? 'none' : sign(v)}>{v == null ? '–' : money(v / 100, { sign: true })}</td>; })}
                <td className={`tot ${sign(tot)}`}>{money(tot, { sign: true })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One group's card, hole by hole, for anyone in the game. */
export function GroupCard({ group, big, name }) {
  const card = group.card;
  if (!card) return <p className="field-help pad">{group.name}’s scores aren’t on this phone yet. They show as soon as its round can be read.</p>;
  const holes = card.holes || [];
  return (
    <div className="block trip-games-wrap">
      <table className="trip-games big-card-table">
        <thead><tr><th scope="col"><span className="sr-only">Player</span></th>{holes.map(h => <th key={h.no} scope="col">{h.no}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Par</th>{holes.map(h => <td key={h.no} className="none">{h.par}</td>)}</tr>
          {group.players.map(id => (
            <tr key={id}>
              <th scope="row">{name(id)}</th>
              {holes.map(h => { const v = card.scores?.[h.no]?.[id]; return <td key={h.no} className={v == null ? 'none' : v === 'X' ? '' : v < h.par ? 'pos' : v > h.par ? 'neg' : ''}>{v == null ? '–' : v === 'X' ? 'P' : v}</td>; })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="field-help">{group.status === 'done' ? 'Finished.' : `Thru ${group.thru}.`} Gross scores; P is a pickup. {big.useHandicaps ? 'Strokes are worked out on the board.' : ''}</p>
    </div>
  );
}

// --------------------------- Side bets -----------------------------------------

/**
 * Add or change a side bet between any two players in the game (the organizer). Strokes start at the
 * difference of the two playing handicaps and can be changed. In setup, `onSave` takes the bet
 * instead of saving it to the game.
 */
export function BigBetSheet({ open, onClose, tripId = null, big, bet = null, onRemove = null, onSave = null, name }) {
  const { showToast } = useUI();
  const [sides, setSides] = useState(() => bet?.sides || []);
  const [kind, setKind] = useState(bet?.kind || 'match');
  const [stake, setStake] = useState(bet?.stake ?? 10);
  const [count, setCount] = useState(bet?.strokes?.count ?? null);
  const [to, setTo] = useState(bet?.strokes?.to ?? null);
  const [pad, setPad] = useState(false);
  const ids = bigPlayers(big);
  const pick = id => {
    setSides(s => (s.includes(id) ? s.filter(x => x !== id) : s.length < 2 ? [...s, id] : [s[0], id]));
    setCount(null); setTo(null);
  };
  const auto = sides.length === 2 ? betStrokesFor(big, sides[0], sides[1]) : null;
  const strokes = count == null ? auto : count > 0 && to ? { to, count } : null;
  const save = () => {
    if (sides.length !== 2 || !(stake > 0)) return;
    const next = { id: bet?.id || newBetId(), kind, sides, stake, ...(strokes ? { strokes } : {}) };
    if (onSave) { onSave(next); onClose(); return; }
    if (saveBigBet(tripId, next)) { showToast(`${name(sides[0])} v ${name(sides[1])} is on`); onClose(); }
    else showToast('The game is decided, so its bets stay as they are');
  };
  const nudge = d => {
    const base = strokes || { to: sides[1], count: 0 };
    const n = Math.max(0, Math.min(36, base.count + d));
    setTo(base.to || sides[1]); setCount(n);
  };
  return (
    <>
      <Sheet open={open && !pad} onClose={onClose} title={bet ? 'Change the side bet' : 'Add a side bet'}>
        <div style={{ padding: '4px 16px 0' }}>
          <p className="field-help">Any two players, in the same group or not. It’s worked out on their own scores, wherever they’re playing.</p>
          <div className="field-label">Who {sides.length === 2 ? '' : `(pick ${2 - sides.length})`}</div>
          <div className="chip-row flush">
            {ids.map(id => <button key={id} type="button" className={`pill-btn ${sides.includes(id) ? 'on' : ''}`} aria-pressed={sides.includes(id)} onClick={() => pick(id)}>{name(id)}</button>)}
          </div>
          <div className="field-label">The bet</div>
          <Segmented label="Kind of bet" className="press-mode-row" btn="pm-btn" value={kind} onChange={setKind}
            options={Object.entries(BIG_BET_KINDS).map(([value, k]) => ({ value, label: k.label }))} />
          <p className="field-help">{BIG_BET_KINDS[kind].help}</p>
          <div className="field-label">How much {kind === 'hole' ? 'a hole' : ''}</div>
          <button type="button" className="amt-btn" onClick={() => setPad(true)}>{money(stake)}</button>
          {sides.length === 2 && big.useHandicaps && (
            <>
              <div className="field-label">Strokes between them</div>
              <div className="big-strokes">
                <button type="button" className="icon-btn" aria-label="One stroke fewer" onClick={() => nudge(-1)} disabled={!strokes}><Icon name="minus" /></button>
                <span className="big-strokes-txt">{strokes ? `${name(strokes.to)} ${name(strokes.to) === 'You' ? 'get' : 'gets'} ${strokes.count}` : 'Played even'}</span>
                <button type="button" className="icon-btn" aria-label="One stroke more" onClick={() => nudge(1)}><Icon name="plus" /></button>
                {strokes && <button type="button" className="pill-btn sm" onClick={() => { setTo(strokes.to === sides[0] ? sides[1] : sides[0]); setCount(strokes.count); }}>Switch</button>}
              </div>
              <p className="field-help">{auto ? `From their handicaps at ${big.hcPct}%: ${name(auto.to)} ${name(auto.to) === 'You' ? 'get' : 'gets'} ${auto.count} on the hardest holes.` : 'Their handicaps are the same, so nobody gets strokes.'} Only in this bet, never in the pot or the skins.</p>
            </>
          )}
          <div className="cta-wrap" style={{ padding: '14px 0 0' }}>
            <button className="full-btn" disabled={sides.length !== 2 || !(stake > 0)} onClick={save}>{sides.length === 2 ? (bet ? 'Save the bet' : 'Add the bet') : 'Pick two players'}</button>
            {onRemove && <button className="text-link danger" onClick={onRemove}><Icon name="trash" /> Take this bet off</button>}
          </div>
        </div>
      </Sheet>
      <Numpad open={pad} title={kind === 'hole' ? 'How much a hole' : 'How much on the match'} prefix="$" initial={stake} min={1} max={BIG_MAX_STAKE} quick={[5, 10, 20, 50]}
        onClose={() => setPad(false)} onDone={v => { setStake(v); setPad(false); }} />
    </>
  );
}
