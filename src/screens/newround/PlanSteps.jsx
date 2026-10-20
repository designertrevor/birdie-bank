// Planning a round for later (NewRound.jsx): who's invited, and what goes up for the group's vote.
// The When step is the course step with the day and tee time on top (Pickers.jsx WhenPicker).
import { useState } from 'react';
import { Callout, Icon, PickChip, PickRow } from '../../components/ui.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import PlayForPicker from '../../components/PlayFor.jsx';
import { update, uid, useStore } from '../../lib/store.js';
import { inviteeLine, savePerson, tripInvitees } from '../../lib/trip-people.js';
import { canonicalOf } from '../../lib/pair-debts.js';
import { GAMES, MAX_GAMES, SIDE_GAMES } from '../../lib/round.js';
import { sortedPlayers } from '../../lib/format.js';
import { money } from '../../lib/golf.js';
import { BET_LADDER, MAX_BALLOT_GAMES, betChoices, betLabel, betOf, betUnitLabel } from '../../lib/plans.js';
import { sideBetLine } from '../../lib/stakes.js';
import { inUnits, playForLine } from '../../lib/play-for.js';
import { nearbyBets } from '../../lib/setup-screen.js';

/** Who gets asked. Optional: anyone with the group link can answer too. */
export function InviteStep({ invited, setInvited, onNext }) {
  const state = useStore();
  const players = sortedPlayers(state).filter(p => p.id !== state.me);
  // The same people as a trip's Who's going: your players, your usuals and friends from your rounds
  // (trip-people.js), each saved to your players once invited
  const who = canonicalOf(state);
  const on = new Set(invited.map(who));
  const list = tripInvitees(state, { picked: invited });
  const toggle = p => {
    if (on.has(p.id)) { setInvited(v => v.filter(x => who(x) !== p.id)); return; }
    update(s => savePerson(s, p));
    setInvited(v => [...v, p.id]);
  };
  const n = invited.length;
  // A name typed here becomes a saved player and is invited; a name already saved just gets invited
  const [newName, setNewName] = useState('');
  const [selfNote, setSelfNote] = useState(false);
  const t = newName.trim();
  const addName = e => {
    e.preventDefault();
    if (!t) return;
    // Your own name: you're already in, so don't save a second you
    if (state.players[state.me]?.name.trim().toLowerCase() === t.toLowerCase()) { setNewName(''); setSelfNote(true); return; }
    const same = players.find(p => p.name.trim().toLowerCase() === t.toLowerCase());
    const id = same?.id || uid('p_');
    if (!same) update(s => { s.players[id] = { id, name: t, index: null, venmo: '', createdAt: Date.now() }; });
    setInvited(v => (v.includes(id) ? v : [...v, id]));
    setNewName('');
  };
  return (
    <>
      <div className="scroll">
        <Callout spot="link" title="You’re in" className="invite-intro">Pick who to ask, or skip this and send one group link. Anyone with it can answer.</Callout>
        <form className="add-name-row" onSubmit={addName}>
          <label className="field-label" htmlFor="invite-add-name">Add a name</label>
          <div className="add-name-line">
            <input id="invite-add-name" aria-label="Add a name" className="name-input" value={newName} onChange={e => { setNewName(e.target.value); setSelfNote(false); }} placeholder="e.g. Dave" autoComplete="off" maxLength={24} enterKeyHint="done" />
            <button type="submit" className="add-name-btn" disabled={!t} aria-label={t ? `Add ${t} and invite them` : 'Add this name'}><Icon name="plus" /> Add</button>
          </div>
          {selfNote && <p className="field-help" role="status">That’s you, and you’re already in.</p>}
        </form>
        <div className="pick-list">
          {list.map(p => (
            <PickRow key={p.id} on={on.has(p.id)} onClick={() => toggle(p)} label={`Invite ${p.name}`} lead={<Avatar id={p.id} name={p.name} />}
              title={p.name} sub={inviteeLine(p)} />
          ))}
        </div>
        {list.length === 0 && <p className="field-help pad">No players saved yet. Add their names above, or send the group link and they’ll show up as they answer.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onNext}>{n ? `Next: Vote (${n} invited)` : 'Skip, I’ll send a link'} <Icon name="arrow-right" /></button>
      </div>
    </>
  );
}

/** The organizer suggests a game and a bet, and picks what else the group can vote for. */
export function VoteStep({ game, holesCount = 18, opts, onPlan, ballot = [], initialSides = [], playFor = null, setPlayFor, tripRow = null }) {
  const start = betOf(game, opts) || 5;
  const [bet, setBet] = useState(start);
  const [others, setOthers] = useState(() => ballot.filter(k => k !== game && GAMES[k]).slice(0, MAX_BALLOT_GAMES - 1));
  const [extraBets, setExtraBets] = useState(() => nearbyBets(start));
  // Side games from a saved usual start picked (the group still says yes or no to each)
  const [sides, setSides] = useState(() => initialSides.filter(k => SIDE_GAMES[k] && k !== game));
  const toggleSide = k => setSides(v => (v.includes(k) ? v.filter(x => x !== k) : [...v, k]));
  const ladder = [...new Set([...BET_LADDER, start])].sort((a, b) => a - b);
  const toggleGame = k => setOthers(v => (v.includes(k) ? v.filter(x => x !== k) : v.length >= MAX_BALLOT_GAMES - 1 ? v : [...v, k]));
  const toggleBet = b => setExtraBets(v => (v.includes(b) ? v.filter(x => x !== b) : [...v, b]));
  const ballotBets = [...new Set([bet, ...extraBets])].sort((a, b) => a - b);
  return (
    <>
      <div className="scroll">
        <div className="block summary-card">
          <div className="li-sub">You suggest</div>
          <div className="d stake-big">{GAMES[game].name} · {inUnits({ playFor }, betLabel(game, opts, bet, holesCount))}</div>
          {playForLine({ playFor }) && <div className="li-sub">{playForLine({ playFor })}</div>}
          <div className="li-sub">The group votes when they answer. Most votes wins; a tie goes to your suggestion.</div>
        </div>
        {tripRow && <div className="trip-in-setup">{tripRow}</div>}
        {/* Play for first, so the bet chips below read in points when it isn't money */}
        <PlayForPicker value={playFor} onChange={setPlayFor} planning />
        <div className="sec-label">Your bet</div>
        <div className="chip-row" role="radiogroup" aria-label="Your bet">
          {ladder.map(b => (
            <PickChip key={b} radio on={b === bet} onClick={() => { setBet(b); setExtraBets(v => v.filter(x => x !== b)); }}>{inUnits({ playFor }, money(b))}</PickChip>
          ))}
        </div>
        <div className="sec-label">Other bets to vote on</div>
        <div className="chip-row">
          {ladder.filter(b => b !== bet).map(b => (
            <PickChip key={b} small on={extraBets.includes(b)} onClick={() => toggleBet(b)}>{inUnits({ playFor }, money(b))}</PickChip>
          ))}
        </div>
        <p className="field-help pad">{GAMES[game].name} bets on the ballot: {ballotBets.map(b => inUnits({ playFor }, betUnitLabel(game, opts, b))).join(', ')}.</p>
        <div className="sec-label">Other games to vote on <span className="opt">up to {MAX_BALLOT_GAMES - 1}</span></div>
        <div className="chip-row">
          {Object.entries(GAMES).filter(([k]) => k !== game).map(([k, g]) => {
            const on = others.includes(k);
            return (
              <PickChip key={k} small on={on} icon={g.icon} disabled={!on && others.length >= MAX_BALLOT_GAMES - 1} onClick={() => toggleGame(k)}>{g.name}</PickChip>
            );
          })}
        </div>
        {others.length > 0 && (
          <p className="field-help pad">
            {others.map(k => <span key={k} style={{ display: 'block' }}>{GAMES[k].name}: {betChoices(betOf(k, opts)).map(b => betUnitLabel(k, opts, b)).join(', ')}</span>)}
            Each game gets its own bet vote, around your usual bet for it.
          </p>
        )}
        <div className="sec-label">Side games to vote on</div>
        <div className="chip-row">
          {Object.entries(SIDE_GAMES).map(([k, sg]) => {
            const on = sides.includes(k);
            return (
              <PickChip key={k} small on={on} icon={sg.icon} onClick={() => toggleSide(k)}>{sg.label}</PickChip>
            );
          })}
        </div>
        {sides.length > 0 && (
          <p className="field-help pad">
            {sides.map(k => <span key={k} style={{ display: 'block' }}>{SIDE_GAMES[k].label}{opts[k] ? `: ${sideBetLine(k, opts[k])}` : ''}</span>)}
            Everyone says yes or no to each. Roll call adds the ones the group wants{sides.length > MAX_GAMES - 1 ? `, up to ${MAX_GAMES - 1}` : ''}.
          </p>
        )}
        {others.length === 0 && extraBets.length === 0 && sides.length === 0 && <p className="field-help pad">Nothing else on the ballot, so everyone just says if they’re in.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => onPlan({ ballotGames: others, suggestedBet: bet, ballotBets, ballotSides: sides })}>Plan it <Icon name="arrow-right" /></button>
      </div>
    </>
  );
}
