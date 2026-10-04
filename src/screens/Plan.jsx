// An upcoming round: the plan, who's in, the group vote on the game and the bet, the nudge and
// the morning text, and the roll call at the tee. The organizer and friends see the same page;
// only the organizer can mark answers for others, call it off and start it.
// Friends open it from the group link with no install and no paywall (PlanLink below).
import { useEffect, useState } from 'react';
import { BallIllo, Empty, Header, Icon, Screen, Sheet, useUI } from '../components/ui.jsx';
import { Avatar } from '../components/Pay.jsx';
import { getState, update, uid, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { GAMES, SIDE_GAMES, createRound } from '../lib/round.js';
import { sideBetLine } from '../lib/stakes.js';
import { inUnits, noMoneyNote, playForLine } from '../lib/play-for.js';
import { money } from '../lib/golf.js';
import { findCourse } from '../lib/courses.js';
import { addRound } from '../lib/rounds.js';
import { usualIdFor } from '../lib/usuals.js';
import { payFields, sendReminder } from '../lib/pay.js';
import { shareLink, shareRound, syncConfigured } from '../lib/sync.js';
import {
  RSVPS, RSVP_LABEL, betLabel, betUnitLabel, cleanName, countsLine, daysUntil, inviteText, isoDate, morningText, nudgeAllText, nudgeText,
  planChoice, planCounts, planPeople, planRules, planSides, planStart, rollCallDefault, tally, tallySides, whenLabel,
} from '../lib/plans.js';
import { PlansOffError } from '../lib/plan-adapters.js';
import { CountForTrip } from '../components/Trips.jsx';
import { tripOf, tripOnDay, tripStamp } from '../lib/trips.js';
import { answerPlan, editPlan, openPlanLink, planShareLink, removePlan, sharePlan, usePlanLive, usePlansOff } from '../lib/plan-sync.js';

const first = name => String(name || '').trim().split(/\s+/)[0];
const listNames = n => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
const STATUS_ICON = { in: 'check-circle', maybe: 'question', out: 'x-circle' };

/** Share or text something, and say so when it only got copied. */
function useSend() {
  const { showToast } = useUI();
  return async (text, copied = 'Copied. Paste it in your group text') => {
    const r = await sendReminder(text);
    if (r === 'copied') showToast(copied);
    if (r === 'failed') showToast('Couldn’t share on this device');
  };
}

export default function PlanScreen({ id }) {
  const nav = useNav();
  const plan = useStore(s => s.plans?.[id]);
  usePlanLive(id, plan?.code);
  if (!plan) {
    return (
      <Screen>
        <Header title="Upcoming round" small onBack={nav.pop} />
        <div className="scroll"><Empty title="This plan is gone" text="It was deleted from this phone." /></div>
      </Screen>
    );
  }
  return (
    <Screen>
      <Header title={plan.host ? 'Your round' : 'Upcoming round'} small onBack={nav.pop}
        right={plan.host && plan.status === 'planned' && !plan.gone ? <button className="pill-btn sm" onClick={() => nav.push('newRound', { edit: plan.id })}><Icon name="pencil-simple" /> Edit</button> : null} />
      {plan.trip?.id && <button className="trip-line" onClick={() => nav.push('trip', { id: plan.trip.id })}><Icon name="suitcase-rolling" /> Part of {plan.trip.name} <Icon name="caret-right" /></button>}
      <PlanBody plan={plan} />
    </Screen>
  );
}

/** The plan page itself. `standalone`: a friend who opened the link and hasn't set up the app. */
function PlanBody({ plan, standalone = false, onSkip }) {
  const nav = useNav();
  const { ask, showToast } = useUI();
  const settings = useStore(s => s.settings);
  const myPlayer = useStore(s => s.players?.[s.me]);
  const off = usePlansOff();
  const send = useSend();
  const [marking, setMarking] = useState(null); // the organizer marking someone's answer
  const [sharing, setSharing] = useState(false);
  const me = plan.host ? plan.hostWho : plan.localMe;
  const people = planPeople(plan);
  const counts = planCounts(plan);
  const choice = planChoice(plan);
  const game = GAMES[choice.game];
  const mine = plan.answers?.[me] || null;
  // The organizer's house rules for the ballot's games, so every phone shows the same units
  const rules = planRules(plan, settings);
  // A points or reward plan votes on the same bets, read as points
  const unit = (g, b) => inUnits(plan, betUnitLabel(g, rules, b) || money(b));
  const days = daysUntil(plan.date);
  const planned = plan.status === 'planned' && !plan.gone;
  const host = plan.hostName || 'The organizer';

  if (!plan.host && !me && planned) return <WhoAreYou plan={plan} defaultName={myPlayer?.name || ''} standalone={standalone} onSkip={onSkip} />;

  const answer = patch => answerPlan(plan.id, me, { name: mine?.name || people.find(p => p.who === me)?.name || myPlayer?.name || 'Guest', ...payFields(myPlayer), ...patch });
  const link = planShareLink(plan);

  // The group link: share the plan first if it hasn't been yet
  const groupLink = async () => {
    if (plan.code) return planShareLink(plan);
    setSharing(true);
    try {
      await sharePlan(plan.id);
      return planShareLink(getState().plans[plan.id]);
    } catch (e) {
      // The first try is how this phone learns the SQL hasn't run, so ask the error, not `off`
      showToast(e instanceof PlansOffError ? 'Group links aren’t switched on yet' : 'Couldn’t reach Birdie Bank. Check your signal');
      return null;
    } finally { setSharing(false); }
  };
  const invite = async () => {
    const l = await groupLink();
    if (l) send(inviteText(getState().plans[plan.id], l), 'Invite copied. Paste it in your group text');
  };
  const nudgeAll = async () => {
    const l = await groupLink();
    if (l) send(nudgeAllText(plan, l), 'Nudge copied. Paste it in your group text');
  };
  const nudgeOne = async p => {
    if (!(await groupLink())) return;
    send(nudgeText(plan, p.name, planShareLink(getState().plans[plan.id], p.who)), `Nudge copied. Paste it to ${first(p.name)}`);
  };
  const morning = () => send(morningText(plan, link, settings), 'Text copied. Paste it in your group text');
  const callOff = async () => {
    if (!(await ask({ title: 'Call it off?', text: 'Everyone with the link sees it’s off. Nobody’s tab changes.', confirmLabel: 'Call it off', cancelLabel: 'Keep it on', danger: true }))) return;
    editPlan(plan.id, p => { p.status = 'off'; });
  };
  const del = async () => {
    const text = plan.host ? 'It comes off Up next here and for the group.' : 'It comes off your Up next. The plan stays on for everyone else.';
    if (!(await ask({ title: 'Delete this plan?', text, confirmLabel: 'Delete plan', danger: true }))) return;
    await removePlan(plan.id);
    if (standalone) onSkip?.(); else nav.pop();
  };

  const gameT = tally(plan, 'game');
  // The bet vote is for the game you voted for (or the group's pick), in that game's own unit
  const betGame = mine?.game && plan.ballot?.games?.includes(mine.game) ? mine.game : choice.game;
  const betT = tally(plan, 'bet', betGame);
  const myBet = mine?.bet != null && (!mine.betGame || mine.betGame === betGame) ? mine.bet : null;
  const manyGames = gameT.rows.length > 1;
  const voters = people.filter(p => p.status !== 'out' && (p.game || p.bet)).length;
  const sideT = tallySides(plan);
  const onSides = planSides(plan, choice.game);
  const sugGame = plan.suggested?.game;
  const sugBet = sugGame ? tally(plan, 'bet', sugGame).rows.find(r => r.suggested)?.choice ?? plan.suggested?.bet : null;

  return (
    <>
      <div className="scroll">
        <div className="invite-card plan-hero">
          <div className="ic-from">
            {plan.host ? <span>You’re getting a game together</span> : <><Avatar name={host} /> <span><strong>{host}</strong> is getting a game together</span></>}
          </div>
          <div className="eyebrow ph-when">{whenLabel(plan) || 'Date to be set'}</div>
          <div className="ic-game"><Icon name={game?.icon || 'golf'} fill /> {game?.name || 'Golf'}</div>
          <div className="ic-course">{plan.course?.name || 'Course to be set'} · {plan.holesCount} holes{choice.bet ? ` · ${inUnits(plan, betLabel(choice.game, rules, choice.bet, plan.holesCount ?? 18) || money(choice.bet))}` : ''}</div>
          {playForLine(plan) && <div className="ic-playfor"><Icon name={plan.playFor?.kind === 'reward' ? 'gift' : 'trophy'} fill /> {playForLine(plan)}</div>}
          {plan.status === 'off' && <p className="ic-note"><Icon name="calendar-x" fill /> {plan.host ? 'You called this one off.' : `${host} called this one off.`}</p>}
          {plan.gone && plan.status === 'planned' && <p className="ic-note"><Icon name="calendar-x" fill /> {host} deleted this plan.</p>}
          {plan.status === 'started' && (
            <p className="ic-note"><Icon name="flag-pennant" fill /> The round is on.{plan.liveCode ? ' Follow the money live.' : ''}</p>
          )}
          {plan.status === 'started' && plan.liveCode && (
            <a className="pill-btn ph-follow" href={shareLink(plan.liveCode)}><Icon name="broadcast" fill /> Follow along</a>
          )}
        </div>

        {planned && (
          <>
            <div className="sec-label">Are you in?</div>
            <div className="rsvp-row" role="radiogroup" aria-label="Are you in?">
              {RSVPS.map(s => (
                <button key={s} role="radio" aria-checked={mine?.status === s} className={`rsvp-btn ${s} ${mine?.status === s ? 'on' : ''}`} onClick={() => answer({ status: s })}>
                  <Icon name={STATUS_ICON[s]} fill /> {RSVP_LABEL[s]}
                </button>
              ))}
            </div>
            {mine?.status && mine.status !== 'out' && (
              <>
                <VoteBlock label="Your vote: the game" kind="game" t={gameT} mineValue={mine.game} onVote={v => answer({ game: v })}
                  render={g => GAMES[g]?.name || g} />
                <VoteBlock label={manyGames ? `Your vote: the bet for ${GAMES[betGame]?.name || 'the game'}` : 'Your vote: the bet'} kind="bet" t={betT} mineValue={myBet}
                  onVote={v => answer({ bet: v, betGame: v == null ? null : betGame })} render={b => unit(betGame, b)} />
                <SideVote plan={plan} rows={sideT} rules={rules} mine={mine.sides || {}} onVote={(k, v) => answer({ sides: { ...(mine.sides || {}), [k]: v } })} />
                <p className="field-help pad">
                  {voters > 1
                    ? `The group’s pick so far: ${GAMES[choice.game]?.name}${choice.bet ? `, ${unit(choice.game, choice.bet)}` : ''}${onSides.length ? `, with ${onSides.map(k => SIDE_GAMES[k].label).join(' and ')}` : ''}.`
                    : `${plan.host ? 'You suggested' : `${host} suggested`} ${GAMES[sugGame]?.name || 'a game'}${sugBet ? ` at ${unit(sugGame, sugBet)}` : ''}. The group decides; a tie goes to the suggestion.`}
                </p>
              </>
            )}
          </>
        )}

        <div className="sec-label">Who’s in · {countsLine(counts)}</div>
        <div className="who-list">
          {people.map(p => (
            <div key={p.who} className="who-row">
              <Avatar id={p.who} name={p.name} />
              <div className="row-main">
                <div className="set-name">{first(p.name)}{p.who === me ? ' (you)' : ''}</div>
                {(p.game || p.bet || sideYes(plan, p).length > 0) && p.status !== 'out' && (
                  <div className="set-sub">Votes {[GAMES[p.game]?.name, voteBetLabel(p, unit), ...sideYes(plan, p)].filter(Boolean).join(', ')}</div>
                )}
              </div>
              {plan.host && planned && !p.status && plan.code && (
                <button className="pill-btn sm" onClick={() => nudgeOne(p)} aria-label={`Nudge ${first(p.name)}`}><Icon name="bell-ringing" /> Nudge</button>
              )}
              {plan.host && planned && p.who !== me ? (
                <button className={`who-status ${p.status || 'none'}`} onClick={() => setMarking(p)} aria-label={`${first(p.name)}: ${p.status ? RSVP_LABEL[p.status] : 'No answer yet'}. Change`}>
                  {p.status ? RSVP_LABEL[p.status] : 'No answer'}
                </button>
              ) : (
                <span className={`who-status ${p.status || 'none'}`}>{p.status ? RSVP_LABEL[p.status] : 'No answer'}</span>
              )}
            </div>
          ))}
        </div>
        {plan.host && planned && counts.waiting > 0 && plan.code && (
          <button className="text-link" onClick={nudgeAll}><Icon name="bell-ringing" fill /> Nudge the {counts.waiting} who {counts.waiting === 1 ? 'hasn’t' : 'haven’t'} answered</button>
        )}
        {plan.host && planned && !plan.code && off && (
          <p className="hint-card"><Icon name="info" fill /> Group links aren’t switched on yet, so this plan lives on your phone. Tap a name to mark who’s in.</p>
        )}
        {plan.host && planned && plan.code && (
          <p className="field-help pad">Tap a name to mark someone who told you in person. Friends answer from the link, no download needed.</p>
        )}

        {planned && plan.host && <button className="text-link" onClick={() => nav.push('newRound', { edit: plan.id })}><Icon name="pencil-simple" /> Change the day, time, course or holes</button>}
        {planned && plan.host && <button className="danger-link" onClick={callOff}><Icon name="calendar-x" /> Call it off</button>}
        {(!planned || !plan.host) && !standalone && <button className="danger-link" onClick={del}><Icon name="trash" /> Delete plan</button>}
        {standalone && <p className="field-help pad">{noMoneyNote(plan) || 'Friendly wagers only. Birdie Bank never holds or moves money. You settle up yourselves.'}</p>}
      </div>

      {planned && (
        <div className="cta-wrap">
          {plan.host && days != null && days <= 0 && (
            <button className="full-btn" onClick={() => nav.push('rollCall', { id: plan.id })}><Icon name="list-checks" /> Roll call</button>
          )}
          {(days != null && days <= 1 && (plan.code || !plan.host || off)) ? (
            <button className={`full-btn ${plan.host && days <= 0 ? 'outline' : ''}`} onClick={morning}><Icon name="chat-circle-text" /> {days <= 0 ? 'Send the morning text' : 'Text the group'}</button>
          ) : plan.host && !(off && !plan.code) ? (
            <button className={`full-btn ${days != null && days <= 0 ? 'outline' : ''}`} disabled={sharing} onClick={invite}><Icon name="share-network" /> {sharing ? 'Getting the link…' : plan.code ? 'Send the group link' : 'Invite the group'}</button>
          ) : null}
          {plan.host && days != null && days > 0 && (
            <button className="full-btn outline" onClick={() => nav.push('rollCall', { id: plan.id })}>Playing now? Roll call</button>
          )}
          {standalone && <button className="full-btn outline" onClick={onSkip}>Start my own round instead</button>}
        </div>
      )}
      {!planned && standalone && (
        <div className="cta-wrap"><button className="full-btn outline" onClick={onSkip}>Start my own round instead</button></div>
      )}

      <Sheet open={!!marking} onClose={() => setMarking(null)} title={marking ? `Is ${first(marking.name)} in?` : ''}>
        <p className="sheet-text">For someone who told you in person. They can still change it from the link.</p>
        <div className="rsvp-row sheet-pad">
          {marking && RSVPS.map(s => (
            <button key={s} className={`rsvp-btn ${s} ${marking.status === s ? 'on' : ''}`} onClick={() => { answerPlan(plan.id, marking.who, { name: marking.name, status: s }); setMarking(null); }}>
              <Icon name={STATUS_ICON[s]} fill /> {RSVP_LABEL[s]}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/** A bet vote in its game's unit: "$5 a side", or "$1 a point in Wolf" when it's for another game than theirs. */
function voteBetLabel(p, unit) {
  if (!p.bet) return null;
  if (!p.betGame) return money(p.bet); // from before bets were per game: one amount for every game
  return `${unit(p.betGame, p.bet)}${p.betGame !== p.game ? ` in ${GAMES[p.betGame]?.name}` : ''}`;
}

/** The side games someone said yes to, by name ("Skins"). */
function sideYes(plan, p) {
  return Object.entries(p.sides || {}).filter(([k, v]) => v && plan.ballot?.sides?.includes(k)).map(([k]) => SIDE_GAMES[k]?.label).filter(Boolean);
}

/** The side game vote: yes or no to each side game on the ballot, with how the group is going. */
function SideVote({ plan, rows, rules, mine, onVote }) {
  if (!rows.length) return null;
  return (
    <div className="block vote-block side-vote">
      <div className="eyebrow" id="vote-sides">Your vote: side games</div>
      {rows.map(r => {
        const meta = SIDE_GAMES[r.side];
        const v = mine[r.side];
        const name = meta.label;
        return (
          <div key={r.side} className="sv-row">
            <div className="row-main">
              <div className="set-name">{name}{rules[r.side] ? <span className="sv-bet"> · {inUnits(plan, sideBetLine(r.side, rules[r.side]))}</span> : null}</div>
              <div className="set-sub">{r.yes} yes · {r.no} no · {r.on ? 'On so far' : 'Off so far'}</div>
            </div>
            <div className="sv-btns" role="group" aria-label={`${name}: play it?`}>
              <button className={`pill-btn sm ${v === true ? 'on' : ''}`} aria-pressed={v === true} onClick={() => onVote(r.side, v === true ? null : true)}>Yes</button>
              <button className={`pill-btn sm ${v === false ? 'on' : ''}`} aria-pressed={v === false} onClick={() => onVote(r.side, v === false ? null : false)}>No</button>
            </div>
          </div>
        );
      })}
      <p className="field-help">More yes than no and it’s on. A tie keeps it on.</p>
    </div>
  );
}

/** One vote: the choices with their tally, yours marked. */
function VoteBlock({ label, kind, t, mineValue, onVote, render }) {
  if (t.rows.length < 2) return null;
  const top = Math.max(1, ...t.rows.map(r => r.votes));
  return (
    <div className="block vote-block">
      <div className="eyebrow" id={`vote-${kind}`}>{label}</div>
      <div className="vote-rows" role="radiogroup" aria-labelledby={`vote-${kind}`}>
        {t.rows.map(r => {
          const on = kind === 'bet' ? Number(mineValue) === Number(r.choice) : mineValue === r.choice;
          return (
            <button key={r.choice} role="radio" aria-checked={on} className={`vote-row ${on ? 'on' : ''} ${r.leading ? 'leading' : ''}`} onClick={() => onVote(on ? null : r.choice)}>
              <span className="vr-bar" style={{ width: `${Math.round((r.votes / top) * 100)}%` }} aria-hidden="true" />
              <span className="vr-name">{render(r.choice)}{r.suggested && <span className="vr-tag">Suggested</span>}</span>
              <span className="vr-n">{r.votes} {r.votes === 1 ? 'vote' : 'votes'}</span>
              <span className="vr-check" aria-hidden="true"><Icon name={on ? 'check-circle' : 'circle'} fill={on} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A friend from the group link says who they are, from the names the organizer invited or their own. */
function WhoAreYou({ plan, defaultName, standalone, onSkip }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(defaultName);
  const taken = new Set(Object.keys(plan.answers || {}));
  const pick = who => update(s => { const p = s.plans?.[plan.id]; if (p) p.localMe = who; });
  const addMe = () => {
    const who = uid('g_');
    pick(who);
    answerPlan(plan.id, who, { name: cleanName(name), status: 'in' });
  };
  const host = plan.hostName || 'The organizer';
  const choice = planChoice(plan);
  const game = GAMES[choice.game];
  const settings = useStore(s => s.settings);
  const bet = choice.bet ? inUnits(plan, betLabel(choice.game, planRules(plan, settings), choice.bet, plan.holesCount ?? 18) || money(choice.bet)) : '';
  return (
    <>
      <div className="scroll join-body plan-who">
        <div className="invite-card">
          <div className="ic-from"><Avatar name={host} /> <span><strong>{host}</strong> is getting a game together</span></div>
          <div className="eyebrow ph-when">{whenLabel(plan)}</div>
          <div className="ic-game"><Icon name={game?.icon || 'golf'} fill /> {game?.name || 'Golf'}</div>
          <div className="ic-course">{plan.course?.name} · {plan.holesCount} holes{bet ? ` · ${bet}` : ''}</div>
          {playForLine(plan) && <div className="ic-playfor"><Icon name={plan.playFor?.kind === 'reward' ? 'gift' : 'trophy'} fill /> {playForLine(plan)}</div>}
        </div>
        {!adding ? (
          <>
            <h2 className="step-q d">Which one are you?</h2>
            <div className="seat-grid">
              {(plan.people || []).filter(p => p.id !== plan.hostWho).map(p => (
                <button key={p.id} className="seat-tile" onClick={() => pick(p.id)}>
                  <Avatar id={p.id} name={p.name} />
                  <span className="seat-name">{first(p.name)}</span>
                  <span className="seat-sub">{taken.has(p.id) ? RSVP_LABEL[plan.answers[p.id].status] || ' ' : ' '}</span>
                </button>
              ))}
              <button className="seat-tile add" onClick={() => setAdding(true)}>
                <span className="avatar"><Icon name="plus" /></span>
                <span className="seat-name">Not on the list?</span>
                <span className="seat-sub">Add me</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="step-q d">What’s your name?</h2>
            <label className="field-label" htmlFor="plan-name">Your name</label>
            <input id="plan-name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sam" autoComplete="given-name" maxLength={24} />
            <p className="field-help">{host} sees it with your answer.</p>
          </>
        )}
      </div>
      <div className="cta-wrap">
        {adding && <button className="full-btn" disabled={!cleanName(name)} onClick={addMe}>I’m in <Icon name="arrow-right" /></button>}
        {adding && <button className="full-btn outline" onClick={() => setAdding(false)}>Back</button>}
        {!adding && standalone && <button className="full-btn outline" onClick={onSkip}>Start my own round instead</button>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/** At the tee: confirm who showed, then start with the voted game and bet in one tap. */
export function RollCall({ id }) {
  const nav = useNav();
  const state = useStore();
  const plan = state.plans?.[id];
  const [present, setPresent] = useState(() => (plan ? rollCallDefault(plan) : []));
  const [walkUp, setWalkUp] = useState('');
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [countTrip, setCountTrip] = useState(true);
  if (!plan) return <Screen><Header title="Roll call" small onBack={nav.pop} /><div className="scroll"><Empty title="This plan is gone" /></div></Screen>;
  const people = planPeople(plan);
  const course = findCourse(state, plan.course?.id);
  const setup = planStart(state, plan, present, { newId: () => uid('p_'), course });
  const g = GAMES[setup.game];
  const t = tally(plan, 'game');
  const toggle = who => setPresent(p => (p.includes(who) ? p.filter(x => x !== who) : [...p, who]));
  // A round planned for a trip counts for it; one that wasn't asks when a trip is on today
  const planTrip = plan.trip ? tripOf(state, plan.trip.id) || plan.trip : null;
  const tripToday = planTrip ? null : tripOnDay(state, isoDate());
  const tripPick = planTrip || (tripToday && countTrip ? tripToday : null);
  const addWalkUp = () => {
    const who = uid('w_');
    answerPlan(id, who, { name: cleanName(walkUp), status: 'in' });
    setPresent(p => [...p, who]);
    setWalkUp(''); setAdding(false);
  };

  // Save anyone new first, so setup (or the round) can find them
  const saveNew = () => update(s => { for (const p of setup.newPlayers) s.players[p.id] = p; });
  const start = () => {
    // One round per tee time, even on a double tap
    if (starting || getState().plans?.[id]?.status !== 'planned') return;
    setStarting(true);
    const rid = uid('r_');
    saveNew();
    const round = createRound({
      id: rid, game: setup.game, course, holesCount: setup.holesCount, nine: setup.nine, startHole: null,
      players: setup.players, settings: setup.settings, hcPct: setup.hcPct, useHandicaps: setup.useHandicaps, teams: setup.teams, halfStrokes: setup.halfStrokes,
    });
    // The side games the group voted for ride along
    if (setup.sideGames.length) round.sideGames = structuredClone(setup.sideGames);
    // Planned from a saved usual (and still its game at its course): finishing it updates "Last played"
    const usualId = usualIdFor(getState(), plan.usualId, setup.game, course);
    if (usualId) round.usualId = usualId;
    // Played for points or a reward, as planned (money plans have none)
    if (setup.playFor) round.playFor = structuredClone(setup.playFor);
    // Planned for a trip (or teeing off while one is on, and counted): the stamp rides in the round
    if (tripPick) round.trip = tripStamp(tripPick);
    update(s => { addRound(s, round); });
    editPlan(id, p => { p.status = 'started'; p.roundId = rid; });
    // Friends on the plan can follow the round live from the same page
    if (plan.code && syncConfigured) {
      shareRound(rid).then(code => editPlan(id, p => { p.liveCode = code; })).catch(() => { /* the round still starts; share it from the round menu */ });
    }
    nav.reset('upnext', ['play', { id: rid }]);
  };
  const toSetup = () => {
    saveNew();
    nav.push('newRound', { fromPlan: id, present });
  };

  return (
    <Screen>
      <Header title="Roll call" small onBack={nav.pop} />
      <div className="scroll">
        <div className="block summary-card">
          <div className="li-sub">{plan.course?.name} · {setup.holesCount} holes</div>
          <div className="d stake-big">{g?.name || 'Pick a game'}{setup.bet && setup.settings?.[setup.game] ? ` · ${inUnits(plan, betLabel(setup.game, setup.settings, setup.bet, setup.holesCount ?? 18))}` : ''}</div>
          {setup.sideGames.length > 0 && <div className="li-sub">+ {setup.sideGames.map(sg => `${SIDE_GAMES[sg.game].label}, ${inUnits(plan, sideBetLine(sg.game, sg.settings))}`).join(' + ')}</div>}
          {playForLine(plan) && <div className="li-sub">{playForLine(plan)}</div>}
          <div className="li-sub">{t.total > 1 ? `The group’s pick (${t.rows.find(r => r.choice === setup.game)?.votes || 0} of ${t.total} votes)` : 'Your suggestion. Nobody else voted'}</div>
        </div>
        <h2 className="step-q d">Who showed up?</h2>
        <div style={{ padding: '0 16px' }}>
          {people.map(p => {
            const on = present.includes(p.who);
            return (
              <button key={p.who} className={`list-item ${on ? 'on' : ''}`} onClick={() => toggle(p.who)} aria-pressed={on}>
                <div className="row-main">
                  <div className="li-name">{p.who === plan.hostWho ? `${first(p.name)} (you)` : p.name}</div>
                  <div className="li-sub">{p.who.startsWith('w_') ? 'Walked up' : <>{p.status ? `Said ${RSVP_LABEL[p.status].toLowerCase()}` : 'Didn’t answer'}{!p.invited ? ' · from the link' : ''}</>}</div>
                </div>
                <span className={`li-check ${on ? 'on' : 'add'}`}><Icon name={on ? 'check' : 'plus'} /></span>
              </button>
            );
          })}
        </div>
        {adding ? (
          <div className="block">
            <label className="field-label" htmlFor="rc-walkup">Name</label>
            <input id="rc-walkup" className="name-input" value={walkUp} onChange={e => setWalkUp(e.target.value)} maxLength={24} placeholder="Name" autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="full-btn outline" onClick={() => setAdding(false)}>Cancel</button>
              <button className="full-btn" disabled={!cleanName(walkUp)} onClick={addWalkUp}>Add</button>
            </div>
          </div>
        ) : (
          <button className="add-row" onClick={() => setAdding(true)}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Someone else showed up</span></button>
        )}
        {setup.problem && <p className="hint-card" role="status"><Icon name="warning" fill /> {setup.problem} Change the setup to pick another game or fix the course.</p>}
        {setup.newPlayers.length > 0 && !setup.problem && (
          <p className="hint-card"><Icon name="user-plus" fill /> {listNames(setup.newPlayers.map(p => first(p.name)))} {setup.newPlayers.length === 1 ? 'gets' : 'get'} saved to your players.</p>
        )}
      </div>
      <div className="cta-wrap">
        {planTrip ? <p className="field-help trip-counts"><Icon name="suitcase-rolling" /> Counts for {planTrip.name}</p>
          : <CountForTrip trip={tripToday} on={countTrip} onChange={setCountTrip} />}
        <button className="full-btn" disabled={!!setup.problem || starting} onClick={start}>Tee off with {setup.players.length} <Icon name="arrow-right" /></button>
        <button className="full-btn outline" onClick={toSetup}>Change the setup</button>
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/**
 * Opened from a plan link (?plan=CODE, or &p=WHO for one person's own link). Finds the plan,
 * keeps it on this phone and shows it. `standalone`: someone who hasn't set up Birdie Bank;
 * they answer and vote without an account and without seeing a paywall.
 */
export function PlanLink({ code, who = null, standalone = false, onSkip }) {
  const nav = useNav();
  const [id, setId] = useState(null);
  const [err, setErr] = useState(null);
  const [tries, setTries] = useState(0);
  const plan = useStore(s => (id ? s.plans?.[id] : null));
  usePlanLive(standalone ? id : null, plan?.code);

  useEffect(() => {
    let cancelled = false;
    openPlanLink(code, who)
      .then(found => { if (cancelled) return; if (found) { setId(found); setErr(null); } else setErr('missing'); })
      .catch(e => { if (!cancelled) setErr(e instanceof PlansOffError ? 'off' : 'offline'); });
    return () => { cancelled = true; };
  }, [code, who, tries]);

  if (id && !standalone) return <PlanScreen id={id} />;
  if (id && plan) {
    return (
      <Screen className="plan-standalone">
        <PlanBody plan={plan} standalone onSkip={onSkip} />
      </Screen>
    );
  }
  const missing = err === 'missing' || err === 'off';
  return (
    <Screen className="onboard">
      {!standalone && <Header title="Upcoming round" small onBack={nav.pop} />}
      <div className="scroll onboard-body">
        <BallIllo className="onboard-illo" face={!err} />
        <h1 className="onboard-title" style={{ fontSize: 34 }}>{err ? (err === 'off' ? 'Not quite ready' : missing ? 'Plan not found' : 'No signal') : 'Finding the plan…'}</h1>
        <p className="onboard-text">
          {!err && <>Code {code}</>}
          {err === 'off' && <>Group links aren’t switched on yet. Ask whoever sent it to tell you the plan instead.</>}
          {err === 'missing' && <>We can’t find plan {code}. It may have been deleted, or the link is old. Ask for a fresh one.</>}
          {err === 'offline' && <>Couldn’t reach Birdie Bank. Check your signal and try again.</>}
        </p>
      </div>
      {err && (
        <div className="cta-wrap">
          {!missing && <button className="full-btn" onClick={() => { setErr(null); setTries(t => t + 1); }}>Try again <Icon name="arrow-clockwise" /></button>}
          {standalone && <button className={`full-btn ${missing ? '' : 'outline'}`} onClick={onSkip}>Start my own round instead</button>}
        </div>
      )}
    </Screen>
  );
}
