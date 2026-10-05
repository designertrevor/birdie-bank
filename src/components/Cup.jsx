// A team points trip's pieces (cup.js): the scoreboard, every match, the leaderboard, picking the
// teams (a captains' draft on one phone or live on the captains' own, balanced by handicap or by
// flights), a round's matches in setup, and
// the stake on Settle the trip (trip money on the Tab once decided, cup-stake.js). The trip's page
// and cards put them together (Trip.jsx, Trips.jsx).
import { useState } from 'react';
import { Icon, Segmented, Sheet, useUI } from './ui.jsx';
import { Avatar, PayButton } from './Pay.jsx';
import { useStore } from '../lib/store.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { payInfoFor } from '../lib/pay.js';
import { buzz } from '../lib/delight.js';
import { CUP_KINDS, FOURSOMES_GAME, MAX_STAKE, balanceTeams, cleanStake, cupCounts, cupHeadline, cupKindsFor, cupPoints, moveTo, pairMatches, teamHandicaps } from '../lib/cup.js';
import { DRAFT_ORDERS, draftOrder } from '../lib/draft.js';
import { FLIGHT_NAMES, flightTeams, flightsOf } from '../lib/flights.js';
import { schedulePoints } from '../lib/trip-templates.js';
import { canRecount } from '../lib/trips.js';
import { GAMES } from '../lib/round.js';
import { markStake, resetRoundCup, setRoundCup, undoStake } from '../lib/cup-store.js';

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Player';
const both = names => names.join(' & ');

/** A team's color dot. */
export const TeamDot = ({ team }) => <span className={`cup-dot t${team}`} aria-hidden="true" />;

/** "Blue 3½ · Red 2½", for a card. */
export function CupLine({ cup }) {
  return (
    <span className="cup-line">
      {[0, 1].map(i => <span key={i} className="cup-line-team"><TeamDot team={i} />{cup.names[i]} <b>{cupPoints(cup.score.points[i])}</b></span>)}
    </span>
  );
}

/** The scoreboard: each team's points, what's in play, and what's on the cup. */
export function CupScore({ cup }) {
  const [a, b] = cup.score.points;
  const lead = a > b ? 0 : b > a ? 1 : null;
  const live = cup.score.live.length;
  const stake = cup.def.stake;
  // A Trip Mode schedule (trip-templates.js) says how many points win it, with the teams as they are
  const per = Math.min(cup.def.teams[0].length, cup.def.teams[1].length);
  const toWin = cup.def.schedule && per > 1 && !cup.final ? schedulePoints(cup.def.schedule, per).toWin : null;
  return (
    <div className="block cup-score" role="group" aria-label={cupHeadline(cup)}>
      <div className="cup-board">
        {[0, 1].map(i => (
          <div key={i} className={`cup-team t${i} ${lead === i ? 'lead' : ''} ${cup.final && cup.winner === i ? 'won' : ''}`}>
            <div className="cup-team-name"><TeamDot team={i} /> {cup.names[i]}</div>
            <div className="cup-team-pts d">{cupPoints(i ? b : a)}</div>
            {cup.final && cup.winner === i && <div className="cup-team-tag"><Icon name="trophy" fill /> Wins the cup</div>}
          </div>
        ))}
      </div>
      <div className="cup-headline">{cupHeadline(cup)}</div>
      <div className="cup-sub">
        {cup.score.done} match{cup.score.done === 1 ? '' : 'es'} played{live ? ` · ${live} in play` : ''}
        {toWin && ` · ${cupPoints(toWin)} wins it`}
        {stake > 0 && ` · ${money(stake)} a person on the cup`}
        {cup.myTeam != null && ` · You’re on ${cup.names[cup.myTeam]}`}
      </div>
    </div>
  );
}

/** Each round's matches, newest first, with how each one went (or stands, while it's being played). */
export function CupMatches({ cup }) {
  const state = useStore();
  const [editing, setEditing] = useState(null);
  const entries = [...cup.entries].reverse().filter(e => e.matches.length || e.mixed);
  if (!entries.length) return <p className="trip-empty">No matches yet. Each round counted for the trip pairs off its players by team: four-ball for two against two, or singles. An Alternate shot round is foursomes, partners taking turns on one ball.</p>;
  const nameIn = (e, id) => first(e.players.find(p => p.id === id)?.name);
  return (
    <>
      {entries.map(e => {
        const round = e.local ? state.rounds[e.roundId] : null;
        // Foursomes is the round's own teams: they change on the card's lineup, not here
        const canChange = round && round.game !== FOURSOMES_GAME && canRecount(state, round);
        const day = e.day ? new Date(`${e.day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        // The round's own points, day by day
        const pts = e.matches.reduce((acc, m) => (m.result.points ? [acc[0] + m.result.points[0], acc[1] + m.result.points[1]] : acc), [0, 0]);
        const scored = e.matches.some(m => m.result.points);
        return (
          <div key={e.key} className="block cup-round">
            <div className="cup-round-head">
              <span className="row-main">
                <span className="cup-round-title">{[day, e.course].filter(Boolean).join(' · ')}</span>
                <span className="cup-round-sub">{[...new Set(e.matches.map(m => CUP_KINDS[m.kind].name))].join(' and ')}{e.status === 'active' ? ' · being played' : ''}{!e.local ? ' · another group' : ''}</span>
              </span>
              {scored && <span className="cup-round-pts" role="img" aria-label={`${cup.names[0]} ${cupPoints(pts[0])}, ${cup.names[1]} ${cupPoints(pts[1])}`}><b className="t0">{cupPoints(pts[0])}</b>–<b className="t1">{cupPoints(pts[1])}</b></span>}
              {canChange && <button className="pill-btn sm" onClick={() => setEditing(round.id)} aria-label="Change the matches"><Icon name="pencil-simple" /></button>}
            </div>
            {e.matches.map((m, i) => <MatchRow key={i} names={cup.names} m={m} left={m.sides[0].map(id => nameIn(e, id))} right={m.sides[1].map(id => nameIn(e, id))} />)}
            {e.mixed && <p className="field-help">{mixedNote(cup)}</p>}
          </div>
        );
      })}
      {editing && (
        <CupMatchesSheet open onClose={() => setEditing(null)} names={cup.names}
          players={state.rounds[editing].players} value={state.rounds[editing].cup} live={state.rounds[editing].status === 'active'}
          onSave={c => { setRoundCup(editing, c); setEditing(null); }} onReset={() => { resetRoundCup(editing); setEditing(null); }} />
      )}
    </>
  );
}

/** One match: each side's players, and the result between them. */
function MatchRow({ names, m, left, right }) {
  const r = m.result;
  const done = !!r.points;
  const side = done ? r.winner : r.leader;
  const label = r.void ? 'Not played' : done ? r.label : `${r.label}${r.thru ? ` thru ${r.thru}` : ''}`;
  const who = side == null ? '' : `${names[side]} `;
  return (
    <div className={`cup-match ${done ? 'done' : 'live'}`} role="group" aria-label={`${both(left)} against ${both(right)}: ${r.void ? label : side == null ? label : `${who}${done ? 'won' : 'leads'} ${label}`}`}>
      <span className={`cm-side t0 ${side === 0 ? 'ahead' : ''}`}><TeamDot team={0} />{both(left)}</span>
      <span className={`cm-res ${side == null ? '' : `t${side}`}`}>{label}</span>
      <span className={`cm-side t1 right ${side === 1 ? 'ahead' : ''}`}>{both(right)}<TeamDot team={1} /></span>
    </div>
  );
}

/** Everyone's points across the trip's matches: won, lost and halved. */
export function CupBoard({ cup }) {
  const state = useStore();
  const me = canonicalOf(state)(state.me);
  const rows = cup.leaderboard;
  if (!rows.length) return <p className="trip-empty">The leaderboard fills in as matches finish: 1 point a win, ½ a halved match.</p>;
  return (
    <div className="trip-table cup-table">
      {rows.map((p, i) => {
        const rank = rows.findIndex(x => x.points === p.points) + 1;
        const name = p.id ? (p.id === me ? 'You' : nameOf(state, p.id)) : p.name;
        return (
          <div key={p.key} className={`trip-row ${p.id === me ? 'me' : ''}`} style={{ '--i': i }}>
            <span className="tr-rank">{rank}</span>
            <Avatar id={p.id} name={p.id ? nameOf(state, p.id) : p.name} />
            <span className="tr-main">
              <span className="tr-name">{name}</span>
              <span className="tr-sub"><TeamDot team={p.team} /> {p.won}-{p.lost}-{p.halved} · {p.played} match{p.played === 1 ? '' : 'es'}</span>
            </span>
            <span className="tr-amt">{cupPoints(p.points)}</span>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------- picking the teams ---------------------------

/** The draft order in words, with the team names: "Blue, Red, Red, Blue, Blue, Red and so on: ...". */
function orderLine(opts, names) {
  const seq = draftOrder(6, opts).map(i => names[i]).join(', ');
  return `${seq} and so on. ${opts.order === 'snake' ? 'Whoever picks second gets two in a row, so the first pick isn’t worth more than the rest.' : 'One pick each, the same team first every time.'}`;
}

/**
 * The teams for a trip, picked from who's going (`people`: [{ id, name, index }]): the team names,
 * a captains' draft (passing this phone around, or live on the captains' own phones, draft.js),
 * balanced by handicap or by flights (each team gets the same number of A, B, C and D players,
 * flights.js), a tap to move anyone across, and the stake. `value` and `onChange` work with the cup
 * (cup.js cleanCup's shape). `live`: the live draft can be offered (a trip being started).
 */
export function TeamsPicker({ people, value, onChange, live: liveOk = true }) {
  const cup = value;
  const set = patch => onChange({ ...cup, ...patch });
  const placed = new Set(cup.teams.flat().map(p => p.id));
  const free = people.filter(p => !placed.has(p.id));
  const byId = id => people.find(p => p.id === id);
  const hcs = teamHandicaps(cup.teams, id => byId(id)?.index ?? null);
  const drafting = cup.pick === 'draft';
  const opts = cup.draft || { live: false, order: 'snake', first: 0 };
  const live = drafting && opts.live && liveOk;
  const captainsSet = cup.captains[0] && cup.captains[1];
  // Captains first (the first team's, then the second's), then the picks in the draft's order
  const made = Math.max(0, cup.teams.flat().length - 2);
  const turn = !captainsSet ? (cup.captains[0] ? 1 : 0) : draftOrder(made + 1, opts)[made];
  const mode = drafting ? 'draft' : cup.pick === 'flights' ? 'flights' : 'balance';
  const letters = new Map(flightsOf(people).flatMap((f, i) => f.map(p => [p.id, FLIGHT_NAMES[i]])));
  const [stakeText, setStakeText] = useState(cup.stake ? String(cup.stake) : '');

  const balance = () => set({ pick: 'balance', teams: balanceTeams(people), captains: [null, null] });
  const byFlights = () => set({ pick: 'flights', teams: flightTeams(people), captains: [null, null] });
  const toDraft = (patch = {}) => set({ pick: 'draft', teams: [[], []], captains: [null, null], draft: { ...opts, ...patch } });
  const setOpts = patch => {
    // Live or passed around changes who picks where, so the draft starts again from the captains
    if ('live' in patch && patch.live !== opts.live) return set({ draft: { ...opts, ...patch }, teams: cup.captains.map(c => (c ? [{ id: c, name: byId(c)?.name || 'Player' }] : [])) });
    set({ draft: { ...opts, ...patch } });
  };
  const pickFree = p => {
    if (!drafting) return set({ teams: moveTo(cup.teams, p, cup.teams[0].length <= cup.teams[1].length ? 0 : 1), pick: 'hand' });
    if (live && captainsSet) return;
    const teams = moveTo(cup.teams, p, turn);
    const captains = captainsSet ? cup.captains : cup.captains.map((c, i) => (i === turn ? p.id : c));
    buzz(10);
    set({ teams, captains });
  };
  const flip = (p, from) => {
    if (live) return set({ teams: cup.teams.map((t, i) => (i === from ? t.filter(x => x.id !== p.id) : t)), captains: cup.captains.map(c => (c === p.id ? null : c)) });
    set({ teams: moveTo(cup.teams, p, 1 - from), captains: cup.captains.map(c => (c === p.id ? null : c)), pick: drafting && free.length ? 'draft' : 'hand' });
  };
  const help = mode === 'flights'
    ? 'Everyone sorted into flights A to D by handicap index, then each flight split between the teams, so both have the same number of A players, B players and so on. Tap anyone to move them across.'
    : mode === 'balance' ? 'Best player first, then picks snake back and forth so neither team gets every low handicap. Tap anyone to move them across.'
    : live ? (captainsSet ? 'Each captain gets a link once the trip is started and picks on their own phone, on their turn. Every phone sees each pick as it’s made.' : 'Pick a captain for each team. Each one gets a link and picks on their own phone, on their turn.')
    : 'Pick a captain for each team, then the captains take turns picking. Pass the phone around.';

  return (
    <div className="cup-pick">
      <div className="cup-names">
        {[0, 1].map(i => (
          <div key={i}>
            <label className="field-label" htmlFor={`cup-name-${i}`}><TeamDot team={i} /> Team {i + 1}</label>
            <input id={`cup-name-${i}`} className="text-input" value={cup.names[i]} maxLength={16} onChange={e => set({ names: cup.names.map((n, k) => (k === i ? e.target.value : n)) })} />
          </div>
        ))}
      </div>

      <div className="field-label">Pick the teams</div>
      <Segmented label="How the teams are picked" className="press-mode-row" btn="pm-btn" value={mode}
        onChange={v => (v === 'draft' ? toDraft() : v === 'flights' ? byFlights() : balance())}
        options={[{ value: 'draft', label: 'Captains’ draft' }, { value: 'balance', label: 'By handicap' }, { value: 'flights', label: 'By flights' }]} />
      {drafting && (
        <div className="tm-draft-opts">
          {liveOk && (
            <>
              <div className="field-label" aria-hidden="true">Where the captains pick</div>
              <Segmented label="Where the captains pick" className="press-mode-row" btn="pm-btn" value={opts.live ? 'live' : 'here'} onChange={v => setOpts({ live: v === 'live' })}
                options={[{ value: 'here', label: 'Pass this phone' }, { value: 'live', label: 'Their own phones' }]} />
            </>
          )}
          <div className="field-label" aria-hidden="true">Draft order</div>
          <Segmented label="Draft order" className="press-mode-row" btn="pm-btn" value={opts.order} onChange={order => setOpts({ order })}
            options={Object.entries(DRAFT_ORDERS).map(([k, o]) => ({ value: k, label: o.name }))} />
          <div className="field-label" aria-hidden="true">Who picks first</div>
          <Segmented label="Who picks first" className="press-mode-row" btn="pm-btn" value={opts.first} onChange={f => setOpts({ first: f })}
            options={[0, 1].map(i => ({ value: i, label: `${cup.names[i]} first` }))} />
          <p className="field-help">{orderLine(opts, cup.names)}</p>
        </div>
      )}
      <p className="field-help">{help}</p>

      <div className="cup-cols">
        {[0, 1].map(i => (
          <div key={i} className={`cup-col t${i} ${drafting && free.length && turn === i && !(live && captainsSet) ? 'turn' : ''}`}>
            <div className="cup-col-head"><TeamDot team={i} /> {cup.names[i]}<span className="cup-col-hc">{cup.teams[i].length ? `${cup.teams[i].length} · hcp ${hcs[i]}` : ''}</span></div>
            {cup.teams[i].map(p => (
              <button key={p.id} type="button" className="cup-chip" onClick={() => flip(p, i)} aria-label={live ? `${p.name}, captain of ${cup.names[i]}. Pick someone else` : `${p.name}${cup.captains[i] === p.id ? ', captain' : ''}, on ${cup.names[i]}. Move to ${cup.names[1 - i]}`}>
                <Avatar id={p.id} name={p.name} size="sm" />
                <span className="cup-chip-name">{first(p.name)}</span>
                {mode === 'flights' && letters.has(p.id) && <span className="tm-flight-tag">{letters.get(p.id)}</span>}
                {cup.captains[i] === p.id && <span className="cup-cap" title="Captain">C</span>}
                <Icon name={live ? 'x' : 'arrows-left-right'} />
              </button>
            ))}
            {!cup.teams[i].length && <div className="cup-col-empty">Nobody yet</div>}
          </div>
        ))}
      </div>

      {free.length > 0 && !(live && captainsSet) && (
        <>
          <div className="field-label">{drafting ? <><TeamDot team={turn} /> {!captainsSet ? `Who captains ${cup.names[turn]}?` : `${cup.names[turn]}’s pick`}</> : 'Not on a team yet'}</div>
          <div className="cup-free">
            {free.map(p => (
              <button key={p.id} type="button" className={`cup-chip free ${drafting ? `pick t${turn}` : ''}`} onClick={() => pickFree(p)} aria-label={drafting ? `Pick ${p.name}` : `Put ${p.name} on a team`}>
                <Avatar id={p.id} name={p.name} size="sm" />
                <span className="cup-chip-name">{first(p.name)}</span>
                {p.index != null && <span className="cup-chip-hc">{p.index}</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {live && captainsSet && free.length > 0 && <p className="field-help">{free.length} to pick in the draft.</p>}
      {drafting && !live && cup.teams.flat().length > 0 && <button type="button" className="link-btn" onClick={() => toDraft()}>Start the draft over</button>}

      <label className="field-label" htmlFor="cup-stake">On the cup <span className="opt">optional</span></label>
      <div className="cup-stake-row">
        <span className="cup-stake-sign">$</span>
        <input id="cup-stake" className="text-input" inputMode="numeric" placeholder="0" value={stakeText}
          onChange={e => { const t = e.target.value.replace(/[^0-9]/g, '').slice(0, 3); setStakeText(Number(t) > MAX_STAKE ? String(MAX_STAKE) : t); set({ stake: cleanStake(t) }); }} />
        <span className="cup-stake-unit">a person</span>
      </div>
      <p className="field-help">{cup.stake > 0
        ? `Everyone on the losing team pays ${money(cup.stake)}, and the winners split it. Once the trip is over it’s trip money like the rest: in each person’s total, on the Tab and in Settle the trip. A halved cup pays nothing.`
        : `Leave it at $0 to play for the cup alone, up to ${money(MAX_STAKE)}. Each round’s own bets work as they always do.`}</p>
    </div>
  );
}

// --------------------------- a round's matches ---------------------------

/** "Trevor & Sam v Mike & Dave", one line a match, for a round's matches. */
function matchLines(players, cup) {
  const name = id => first(players.find(p => p.id === id)?.name);
  const { matches, out } = pairMatches(cup);
  return { lines: matches.map(m => ({ kind: m.kind, text: `${both(m.sides[0].map(name))} v ${both(m.sides[1].map(name))}` })), out: out.map(name) };
}

/**
 * In setup, under "Count it for the trip?": the round's matches from the trip's teams, with
 * Change. `value` null is the default from the teams; `onChange(cup)` keeps a change.
 */
export function CupRoundSetup({ trip, players, value, names, game, onChange }) {
  const [open, setOpen] = useState(false);
  if (!trip || !value) return null;
  if (!cupCounts(game)) return <p className="field-help cup-setup-note"><Icon name="trophy" /> {GAMES[game]?.name || 'This game'} is played with one ball a team, so it doesn’t count for the cup. Its own bets still go on the trip.</p>;
  const { lines, out } = matchLines(players, value);
  // Foursomes is the round's two teams: Change sets the partners for both
  const pairs = game === FOURSOMES_GAME;
  return (
    <div className="cup-setup">
      <div className="row-main">
        <div className="toggle-lbl">Cup matches</div>
        {lines.length ? lines.map((l, i) => <div key={i} className="toggle-sub">{CUP_KINDS[l.kind].name}: {l.text}</div>)
          : <div className="toggle-sub">{pairs ? 'Foursomes needs two partners from each team' : 'Both teams need a player here for a match'}</div>}
        {out.length > 0 && <div className="toggle-sub">{out.join(' and ')} sit{out.length === 1 ? 's' : ''} this one out</div>}
      </div>
      <button type="button" className="pill-btn sm" onClick={() => setOpen(true)} aria-label="Change the cup matches">Change</button>
      {open && <CupMatchesSheet open onClose={() => setOpen(false)} names={names} players={players} value={value} game={game} onSave={c => { onChange(c); setOpen(false); }} />}
    </div>
  );
}

/**
 * Change a round's matches: four-ball or singles, which team each player is on, and the order
 * they're paired off in (first with first). `live`: the round is being played, so it says the
 * matches recount from the scores so far.
 */
export function CupMatchesSheet({ open, onClose, names, players, value, onSave, onReset = null, live = false, game = null }) {
  const kinds = cupKindsFor(game);
  const [draft, setDraft] = useState(() => ({ kind: kinds.includes(value?.kind) ? value.kind : kinds[0], sides: [[...(value?.sides?.[0] || [])], [...(value?.sides?.[1] || [])]] }));
  const placed = new Set(draft.sides.flat());
  const free = players.filter(p => !placed.has(p.id));
  const name = id => players.find(p => p.id === id)?.name || 'Player';
  const move = (id, to) => setDraft(d => ({ ...d, sides: d.sides.map((s, i) => (i === to ? [...s.filter(x => x !== id), id] : s.filter(x => x !== id))) }));
  const up = (team, k) => setDraft(d => {
    const s = [...d.sides[team]];
    [s[k - 1], s[k]] = [s[k], s[k - 1]];
    return { ...d, sides: d.sides.map((x, i) => (i === team ? s : x)) };
  });
  const { lines, out } = matchLines(players, draft);
  return (
    <Sheet open={open} onClose={onClose} title="Cup matches">
      <div className="block cup-sheet">
        {kinds.length > 1 && (
          <Segmented label="Match format" className="press-mode-row" btn="pm-btn" value={draft.kind} onChange={kind => setDraft(d => ({ ...d, kind }))}
            options={kinds.map(k => ({ value: k, label: CUP_KINDS[k].name }))} />
        )}
        <p className="field-help">{draft.kind === 'foursomes'
          ? `${CUP_KINDS.foursomes.name}: ${CUP_KINDS.foursomes.blurb.toLowerCase()}, worked out from each pair’s one ball and its team strokes. The first two on each team are the round’s partners.`
          : `${CUP_KINDS[draft.kind].blurb}, worked out from each player’s own scores and strokes. Players are paired off in order, first with first.`}</p>
        <div className="cup-cols">
          {[0, 1].map(t => (
            <div key={t} className={`cup-col t${t}`}>
              <div className="cup-col-head"><TeamDot team={t} /> {names[t]}</div>
              {draft.sides[t].map((id, k) => (
                <div key={id} className="cup-order">
                  <span className="cup-order-n">{k + 1}</span>
                  <span className="cup-chip-name">{name(id)}</span>
                  {k > 0 && <button type="button" className="icon-btn sm" onClick={() => up(t, k)} aria-label={`Move ${name(id)} up`}><Icon name="arrow-up" /></button>}
                  <button type="button" className="icon-btn sm" onClick={() => move(id, 1 - t)} aria-label={`Move ${name(id)} to ${names[1 - t]}`}><Icon name="arrows-left-right" /></button>
                </div>
              ))}
              {!draft.sides[t].length && <div className="cup-col-empty">Nobody yet. Move a player over from the other team.</div>}
            </div>
          ))}
        </div>
        {free.length > 0 && (
          <>
            <div className="field-label">Not in a match</div>
            <div className="cup-free">
              {free.map(p => (
                <span key={p.id} className="cup-chip free static">
                  <span className="cup-chip-name">{p.name}</span>
                  <button type="button" className="pill-btn sm" onClick={() => move(p.id, 0)}>{names[0]}</button>
                  <button type="button" className="pill-btn sm" onClick={() => move(p.id, 1)}>{names[1]}</button>
                </span>
              ))}
            </div>
          </>
        )}
        <div className="sec-label flush">The matches</div>
        {lines.length ? lines.map((l, i) => <div key={i} className="cup-preview"><b>{CUP_KINDS[l.kind].name}</b> {l.text}</div>) : <p className="field-help">Put someone on each team for a match.</p>}
        {out.length > 0 && <p className="field-help">{out.join(' and ')} sit{out.length === 1 ? 's' : ''} this one out: the other team has nobody left to play {out.length === 1 ? 'them' : 'them all'}.</p>}
        {live && <p className="field-help">The matches recount from the scores so far, on every phone in the round.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => onSave(value?.worth ? { ...draft, worth: value.worth } : draft)}>Save the matches</button>
        {onReset && <button className="link-btn center" onClick={onReset}>Start over from the teams</button>}
      </div>
    </Sheet>
  );
}

/** A foursomes round whose pairs mix the teams, in a line. */
const mixedNote = cup => `Foursomes: a pair here has a player from ${cup.names[0]} and one from ${cup.names[1]}, so this round doesn’t count for the cup. Partners from the same team make it a match.`;

/** On a trip round's results: how its matches went, and the cup now. */
export function CupRoundNote({ cup, round }) {
  const entry = cup.entries.find(e => e.local && e.roundId === round.id);
  if (entry?.mixed) return <div className="cup-note"><div className="trip-sub">{mixedNote(cup)}</div></div>;
  if (!entry || !entry.matches.length) return null;
  const won = [0, 0];
  for (const m of entry.matches) if (m.result.points) { won[0] += m.result.points[0]; won[1] += m.result.points[1]; }
  const nameIn = id => first(entry.players.find(p => p.id === id)?.name);
  return (
    <div className="cup-note">
      {entry.matches.map((m, i) => <MatchRow key={i} names={cup.names} m={m} left={m.sides[0].map(nameIn)} right={m.sides[1].map(nameIn)} />)}
      <div className="trip-sub">
        {entry.status === 'done' ? `${cup.names[0]} ${cupPoints(won[0])}, ${cup.names[1]} ${cupPoints(won[1])} from this round. ` : 'Counts for the cup when the round is done. '}
        {cupHeadline(cup)}.
      </div>
    </div>
  );
}

// --------------------------- the stake ---------------------------

/**
 * The stake on Settle the trip. Once decided it's trip money (cup-stake.js): a line between two
 * people who played a cup round shared live together is in the trip's payments above and on the
 * Tab, on every phone, so here it just says so. A line between two who never did is marked paid
 * here, on every phone alike, yours first with your payee's app, and every phone on the trip sees
 * it. So do the marks made before.
 */
export function StakeLines({ st }) {
  const state = useStore();
  const { showToast } = useUI();
  const cup = st.cup;
  if (!cup?.stakeOn) return null;
  const me = canonicalOf(state)(state.me);
  const label = (id, name) => (id === me ? 'You' : first(id ? nameOf(state, id) : name));
  const open = cup.lines.filter(l => l.open > 0 && !l.onTab);
  const onTab = cup.lines.some(l => l.open > 0 && l.onTab);
  const mine = open.filter(l => l.fromId === me || l.toId === me);
  const others = open.filter(l => l.fromId !== me && l.toId !== me);
  const mark = l => {
    const m = markStake(st.trip.id, l);
    if (!m) return;
    buzz(15);
    const text = l.fromId === me ? `You paid ${label(l.toId, l.toName)}` : l.toId === me ? `${label(l.fromId, l.fromName)} paid you` : `${label(l.fromId, l.fromName)} paid ${label(l.toId, l.toName)}`;
    showToast(`${text}. Everyone on the trip sees it.`, { label: 'Undo', run: () => undoStake(st.trip.id, m.id) });
  };
  const winners = cup.names[cup.winner];
  return (
    <>
      <div className="sec-label">The cup</div>
      <p className="field-help pad">{winners} won the cup, so each player on {cup.names[1 - cup.winner]} pays {money(cup.def.stake)} and {winners} splits it.{onTab ? ' It’s in the payments above and on the Tab, with the rest of the trip.' : ''}{open.length ? ` ${open.length === 1 ? 'One payment is' : `${open.length} payments are`} between two people who haven’t played a round together on the trip, so ${open.length === 1 ? 'it’s' : 'they’re'} marked paid here.` : ''}</p>
      {mine.map(l => {
        const iPay = l.fromId === me;
        const otherId = iPay ? l.toId : l.fromId;
        const otherName = iPay ? l.toName : l.fromName;
        return (
          <div key={l.key} className="pay-card cup-pay">
            <div className="pay-who">
              <Avatar id={otherId} name={otherId ? nameOf(state, otherId) : otherName} />
              <span className="trip-pay-name">{iPay ? `You pay ${label(otherId, otherName)}` : `${label(otherId, otherName)} pays you`}</span>
              <span className="pm">{money(l.open / 100)}</span>
            </div>
            <div className="pay-acts wrap">
              {iPay && otherId && <PayButton info={payInfoFor(state, otherId)} amount={l.open / 100} note={`${st.trip.name} cup`} />}
              <button className="pay-btn got" onClick={() => mark(l)}><span className="pay-in"><Icon name="check-circle" fill /><span className="pay-lbl">{iPay ? 'I paid' : 'I got it'}</span></span></button>
            </div>
          </div>
        );
      })}
      {others.map(l => (
        <div key={l.key} className="ledger-row static trip-other">
          <div className="lr-info">
            <div className="lr-name" style={{ fontSize: 16 }}>{label(l.fromId, l.fromName)} pays {label(l.toId, l.toName)}</div>
            <div className="lr-status">Cup stake</div>
          </div>
          <div className="lr-amt" style={{ marginRight: 8 }}>{money(l.open / 100)}</div>
          <button className="pill-btn sm" onClick={() => mark(l)}>Mark paid</button>
        </div>
      ))}
      {!open.length && !onTab && <p className="field-help pad">The cup stake is all paid.</p>}
      {cup.marks.length > 0 && <StakePaid st={st} label={label} me={me} />}
    </>
  );
}

/** The stake payments marked so far; this phone's own can be undone. */
function StakePaid({ st, label, me }) {
  const cup = st.cup;
  const local = id => cup.localOf({ id, name: '' });
  return (
    <>
      <div className="sec-label">Cup stake paid</div>
      {cup.marks.map(m => {
        const line = cup.lines.find(l => l.key === m.key);
        const fromId = line?.fromId ?? local(m.from), toId = line?.toId ?? local(m.to);
        return (
          <div key={m.id} className="ledger-row static">
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>{label(fromId, line?.fromName)} paid {toId === me ? 'you' : label(toId, line?.toName)}</div>
              <div className="lr-status">{new Date(m.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{m.mine ? '' : m.byName ? ` · marked on ${m.byName}’s phone` : ' · marked on another phone'}</div>
            </div>
            <div className="lr-amt" style={{ marginRight: 8 }}>{money(m.amount)}</div>
            {m.mine && <button className="icon-btn sm" onClick={() => undoStake(st.trip.id, m.id)} aria-label="Undo payment"><Icon name="arrow-counter-clockwise" /></button>}
          </div>
        );
      })}
    </>
  );
}
