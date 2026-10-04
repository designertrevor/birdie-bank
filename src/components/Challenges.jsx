// Challenges (challenges.js): the sheet that makes one, the card that shows one with its Accept,
// Counter and Decline buttons, and the lists on Up next, a planned round and a Player card. Copy
// stays friendly: a no is "passed this time", never anything worse.
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Numpad, Segmented, Sheet, useUI } from './ui.jsx';
import { getState, uid, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { BET_KINDS, BET_LABEL_MAX, BET_MAX } from '../lib/pair-bets.js';
import {
  CHALLENGE_KINDS, CHALLENGE_STAKES, HOLES_LABEL, canMove, challengeFmt, challengeHeadline, challengeInviteText, challengeLife, challengeLine, challengeProblem,
  challengeSetUpText, challengeState, challengeStatusText, challengeTone, markSides, newChallenge, planChallenges, planMe, planOf, proxiedFor, proxyNote, setUpHere, sideOf,
} from '../lib/challenges.js';
import { challengeShareLink, challengesOff, forgetChallenge, makeChallenge, moveChallenge, useChallengesOff } from '../lib/challenge-sync.js';
import { planShareLink } from '../lib/plan-sync.js';
import { sendReminder } from '../lib/pay.js';
import { shareAmountsOn } from '../lib/share.js';
import { challengeGroupText } from '../lib/share-cards.js';
import { useShareText } from '../lib/useShare.js';
import { dayLabel, planPeople } from '../lib/plans.js';

const first = n => String(n || '').trim().split(/\s+/)[0] || 'them';
const other = side => (side === 'from' ? 'to' : 'from');
const unitPad = unit => (unit === 'points' ? { prefix: '', suffix: n => (Math.abs(Number(n)) === 1 ? ' pt' : ' pts') } : { prefix: '$', suffix: '' });

/** Share or text something, and say so when it only got copied. */
function useSend() {
  const { showToast } = useUI();
  return async (text, copied) => {
    const r = await sendReminder(text);
    if (r === 'copied') showToast(copied);
    if (r === 'failed') showToast('Couldn’t share on this device');
  };
}

/**
 * The link that reaches the other person (or `toSide`, for one set up between two others): the
 * plan's own link for them, or the challenge's.
 */
function linkFor(state, ch, toSide = null) {
  if (!ch?.code) return null;
  if (!ch.plan) return challengeShareLink(ch);
  const plan = planOf(state, ch);
  return plan?.code ? planShareLink(plan, ch[toSide || other(sideOf(state, ch) || 'from')].who) : null;
}

/**
 * The link for the group: the plan's group link. A challenge's own link answers for one of the two,
 * so it never goes to the whole group; one for the next round together goes with no link.
 */
function groupLinkFor(state, ch) {
  if (!ch?.plan) return null;
  const plan = planOf(state, ch);
  return plan?.code ? planShareLink(plan) : null;
}

/**
 * Make a challenge. `from`: you ({ who, name }). `people`: who you can challenge ([{ who, name }]; one
 * for a Player card). `whens`: what it's for, [{ key, label, plan, to? }] (a plan, or plan null for the
 * next round together, with `to` the person's key on that plan); a planned round's own challenge has one. `holesCount`: 9 hides the nines.
 * `setUp`: the organizer (or the scorekeeper) can set one up between two other people too, picked
 * from the plan's people or, for the next round together, from `others` (saved players).
 */
export function ChallengeMaker({ open, onClose, from, people, whens, holesCount = 18, setUp = false, others = [] }) {
  const { showToast } = useUI();
  const send = useSend();
  const [toWho, setToWho] = useState(people.length === 1 ? people[0].who : null);
  const [aWho, setAWho] = useState(null); // who plays them, when it's not you (null: you)
  const [aName, setAName] = useState('');
  const [whenKey, setWhenKey] = useState(whens[0]?.key);
  const [kind, setKind] = useState('match');
  const [stake, setStake] = useState(10);
  const [holes, setHoles] = useState('all');
  const [label, setLabel] = useState('');
  const [pad, setPad] = useState(false);
  const [sending, setSending] = useState(false);
  if (!open) return null;
  const when = whens.find(w => w.key === whenKey) || whens[0];
  const plan = when?.plan || null;
  const unit = plan?.playFor?.kind === 'points' ? 'points' : 'money';
  const fmt = challengeFmt({ unit });
  const me = plan ? { who: planMe(plan), name: from.name } : from;
  // A Player card's friend, by their key on the plan when it's for one
  const fixed = people.length === 1 ? (when?.to || people[0]) : null;
  // Everyone else who could play: the plan's people who aren't out, or saved players for the next round together
  const pool = (plan ? planPeople(plan).filter(p => p.status !== 'out').map(p => ({ who: p.who, name: p.name })) : fixed ? others : people)
    .filter(p => p.who !== me.who && p.who !== fixed?.who);
  const a = (setUp && aWho && pool.find(p => p.who === aWho)) || me;
  const setter = a.who !== me.who ? me : null;
  // A plan knows each person by their key on it, which can differ from the id on their card
  const bPool = pool.filter(p => p.who !== a.who);
  const to = fixed || bPool.find(p => p.who === toWho) || null;
  const draft = { from: a, to, kind, stake, label, setBy: setter };
  const problem = challengeProblem(draft);
  const nines = (plan?.holesCount ?? holesCount) !== 9;
  const preview = !problem ? challengeLine(newChallenge({ id: 'x', from: a, to, kind, stake, holes: nines ? holes : 'all', label, plan: plan ? { date: plan.date } : null, unit })) : null;
  const names = setter ? `${first(a.name)} v ${first(to?.name)}` : null;

  const go = async () => {
    if (problem || sending) return;
    setSending(true);
    const ch = newChallenge({ id: uid('c'), from: a, to, kind, stake, holes: nines ? holes : 'all', label, plan: plan ? { id: plan.id, code: plan.code, date: plan.date } : null, unit, setBy: setter });
    const { code } = await makeChallenge(ch);
    setSending(false);
    onClose();
    // Set up between two others: their answers are put in here, or they answer from their own links
    if (setter) {
      showToast(`${names} is set up. Mark their answers when they tell you, or send it to them from its card.`);
      return;
    }
    // A friend's copy of a plan only reaches the organizer through the server: with challenges not
    // switched on it can't, so it isn't kept. One that just didn't get through (no signal) is kept
    // and goes up on the next refresh.
    if (!code && plan && !plan.host && challengesOff()) {
      forgetChallenge(ch.id);
      showToast(`Challenges aren’t switched on for the group yet. Tell ${first(plan.hostName)} and it can go in as a side bet at the tee.`);
      return;
    }
    const link = linkFor(getState(), getState().challenges?.[ch.id]);
    if (link) send(challengeInviteText(getState().challenges[ch.id], link, 'from'), `Challenge copied. Paste it to ${first(to.name)}`);
    else if (plan && !plan.code && !challengesOff()) showToast('Challenge saved. It goes to the group with the plan’s link.');
    else if (!challengesOff()) showToast(`Challenge saved. Once you’re back online, send it to ${first(to.name)} from its page.`);
    else showToast(`Challenge saved. Mark ${first(to.name)}’s answer when they tell you.`);
  };
  const chip = (p, on, pick, label = first(p.name)) => (
    <button key={p.who} role="radio" aria-checked={on} className={`pill-btn ${on ? 'on' : ''}`} onClick={() => pick(p.who)}>{label}</button>
  );
  const title = fixed ? (setter ? `${first(a.name)} v ${first(fixed.name)}` : `Challenge ${first(fixed.name)}`) : setter ? 'Set up a challenge' : 'Challenge someone';

  return (
    <>
      <Sheet open={!pad} onClose={onClose} title={title}>
        <p className="sheet-text">
          {setter
            ? `${to ? `A side bet between ${first(a.name)} and ${first(to.name)}` : `A side bet for ${first(a.name)} and whoever you pick`}, set up by you. Mark what they say when they tell you, or they answer from their own phone, and once both are in it goes into the round.`
            : `A side bet between the two of you. ${fixed ? first(fixed.name) : 'They'} can accept, pass or name their own amount, and once it’s agreed it goes into the round.`}
        </p>
        <div className="pb-edit">
          {setUp && pool.length > 0 && (
            <>
              <div className="field-label" id="ch-a">{fixed ? `Who’s playing ${first(fixed.name)}` : 'Who'}</div>
              <div className="chip-row flush" role="radiogroup" aria-labelledby="ch-a">
                {chip(me, a.who === me.who, () => setAWho(null), 'You')}
                {pool.map(p => chip(p, a.who === p.who, w => { setAWho(w); setAName(p.name); }))}
              </div>
            </>
          )}
          {!fixed && (
            <>
              <div className="field-label" id="ch-who">{setUp ? 'Against' : 'Who'}</div>
              <div className="chip-row flush" role="radiogroup" aria-labelledby="ch-who">
                {bPool.map(p => chip(p, toWho === p.who, setToWho))}
              </div>
            </>
          )}
          {whens.length > 1 && (
            <>
              <div className="field-label" id="ch-when">Which round</div>
              <div className="chip-row flush" role="radiogroup" aria-labelledby="ch-when">
                {whens.map(w => (
                  <button key={w.key} role="radio" aria-checked={when.key === w.key} className={`pill-btn ${when.key === w.key ? 'on' : ''}`} onClick={() => setWhenKey(w.key)}>{w.label}</button>
                ))}
              </div>
              {setUp && aWho && a.who !== aWho && <p className="field-help pb-help">{first(aName)} isn’t on that round, so it’s you{fixed ? ` against ${first(fixed.name)}` : ''}. Pick someone else under Who, or another round.</p>}
            </>
          )}
          <div className="field-label" id="ch-kind">What’s the bet</div>
          <div className="chip-row flush" role="radiogroup" aria-labelledby="ch-kind">
            {CHALLENGE_KINDS.map(k => (
              <button key={k} role="radio" aria-checked={kind === k} className={`pill-btn ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                <Icon name={BET_KINDS[k].icon} fill={kind === k} /> {BET_KINDS[k].label}
              </button>
            ))}
          </div>
          <p className="field-help pb-help">{setter ? othersHelp(BET_KINDS[kind].help) : BET_KINDS[kind].help}</p>
          {kind === 'custom' && (
            <>
              <label className="field-label" htmlFor="ch-label">Call it</label>
              <input id="ch-label" className="name-input" value={label} maxLength={BET_LABEL_MAX} autoComplete="off" enterKeyHint="done"
                placeholder="e.g. Longest drive on 7" onChange={e => setLabel(e.target.value)} />
            </>
          )}
          <div className="field-label" id="ch-stake">{kind === 'hole' ? 'A hole' : kind === 'ctp' ? 'A par 3' : 'How much'}</div>
          <div className="chip-row flush" role="radiogroup" aria-labelledby="ch-stake">
            {CHALLENGE_STAKES.map(v => (
              <button key={v} role="radio" aria-checked={stake === v} className={`pill-btn ${stake === v ? 'on' : ''}`} onClick={() => setStake(v)}>{fmt(v)}</button>
            ))}
            <button className={`pill-btn ${CHALLENGE_STAKES.includes(stake) ? '' : 'on'}`} onClick={() => setPad(true)}>{CHALLENGE_STAKES.includes(stake) ? 'Other' : fmt(stake)}</button>
          </div>
          {nines && (
            <>
              <div className="field-label">Holes</div>
              <Segmented label="Holes" className="press-mode-row game-pick" btn="pm-btn" value={holes} onChange={setHoles}
                options={[{ value: 'all', label: 'All the holes' }, { value: 'front', label: HOLES_LABEL.front }, { value: 'back', label: HOLES_LABEL.back }]} />
            </>
          )}
        </div>
        {preview && <p className="field-help pad pb-sum">{preview}</p>}
        {unit === 'points' && <p className="field-help pad">This round is played for points, so the challenge is too.</p>}
        <div className="cta-wrap">
          <button className="full-btn" disabled={!!problem || sending} onClick={go}>{problem || (sending ? 'Sending…' : setter ? 'Set it up' : 'Send the challenge')} {!problem && !sending && <Icon name={setter ? 'check' : 'paper-plane-right'} />}</button>
        </div>
      </Sheet>
      <Numpad open={pad} title="The amount" {...unitPad(unit)} initial={stake} min={1} max={BET_MAX}
        onClose={() => setPad(false)} onDone={v => { setStake(v); setPad(false); }} />
    </>
  );
}

/**
 * Accept, counter, decline and call off for `side`, with the toasts and the text to send after.
 * `marking`: this phone is putting in that person's answer for them (they told the organizer or the
 * scorekeeper, or they aren't on the app), sent as an answer put in for them (challenges.js PROXY).
 */
function useChallengeMoves(ch, side, marking = false) {
  const { ask, showToast } = useUI();
  const send = useSend();
  const name = first(ch?.[other(side)]?.name);
  const self = first(ch?.[side]?.name);
  const proxy = !!marking;
  const after = text => {
    const cur = getState().challenges?.[ch.id];
    const link = marking ? null : linkFor(getState(), cur);
    if (link && cur) send(challengeInviteText(cur, link, side), `Copied. Paste it to ${name}`);
    else showToast(text);
  };
  const where = ch?.plan ? 'when the round starts' : ch?.setBy ? 'next time they play' : 'next time you two play';
  return {
    accept: async () => {
      if (!(await moveChallenge(ch.id, { side, move: 'accept', proxy }))) return;
      const s = challengeState(getState().challenges?.[ch.id] || ch);
      const lead = marking ? `${self}’s in.` : 'You’re on.';
      showToast(s.status === 'accepted' ? `${lead} It goes in as a side bet ${where}.` : `${lead} Waiting on ${name}.`);
    },
    decline: async () => {
      const q = marking
        ? { title: `${self} passed?`, text: 'It comes off as a no for this time. You can always set it up again.' }
        : { title: 'Pass on this one?', text: `${name} sees you passed this time. You can always challenge back.` };
      if (!(await ask({ ...q, confirmLabel: 'Decline', cancelLabel: 'Keep it' }))) return;
      if (await moveChallenge(ch.id, { side, move: 'decline', proxy })) showToast('No worries. Maybe next time.');
    },
    counter: async stake => {
      if (!(await moveChallenge(ch.id, { side, move: 'counter', stake, proxy }))) { showToast('That’s the amount already. Pick another one.'); return; }
      after(marking ? `${self} said ${challengeFmt(ch)(stake)}. ${name}’s call now.` : `${name} can take ${challengeFmt(ch)(stake)} or not.`);
    },
    withdraw: async () => {
      const whom = ch.setBy && side === 'keeper' ? `${first(ch.from.name)} and ${first(ch.to.name)} see` : `${name} sees`;
      if (!(await ask({ title: 'Call it off?', text: `${whom} it’s off. Nothing goes on the Tab.`, confirmLabel: 'Call it off', cancelLabel: 'Keep it on', danger: true }))) return false;
      return moveChallenge(ch.id, { side, move: 'withdraw' });
    },
  };
}

/** Accept, Counter and Decline for one side: yours, or someone's answer put in for them (`marking`). */
function AnswerRow({ ch, side, marking }) {
  const [countering, setCountering] = useState(false);
  const moves = useChallengeMoves(ch, side, marking);
  const s = challengeState(ch);
  const who = first(ch[side].name);
  // Only on this phone: "Mike isn't getting these yet"; else they could answer from the link too
  const ask = !ch.code ? `${who} isn’t getting these yet. What did they say?` : `Not on the app? Mark what ${who} said.`;
  return (
    <>
      {marking && <p className="ch-mark">{ask}</p>}
      <div className="ch-actions" role="group" aria-label={marking ? `${who}’s answer` : 'Your answer'}>
        {canMove(ch, side, 'accept', null, null, marking) && <button className="pill-btn ch-yes" onClick={moves.accept}><Icon name="check" /> {marking ? `${who}’s in` : 'Accept'}</button>}
        {canMove(ch, side, 'counter', null, null, marking) && <button className="pill-btn" onClick={() => setCountering(true)}><Icon name="arrows-left-right" /> {marking ? `${who} says…` : 'Counter'}</button>}
        {canMove(ch, side, 'decline', null, null, marking) && <button className="pill-btn" onClick={moves.decline}>{marking ? 'Passed' : 'Decline'}</button>}
      </div>
      <AtScreen><Numpad open={countering} title={marking ? `${who}’s amount, not ${challengeFmt(ch)(s.stake)}` : `Your amount, not ${challengeFmt(ch)(s.stake)}`} {...unitPad(ch.unit)} initial={s.stake} min={1} max={BET_MAX}
        quick={CHALLENGE_STAKES.filter(v => v !== s.stake)}
        onClose={() => setCountering(false)} onDone={v => { setCountering(false); moves.counter(v); }} /></AtScreen>
    </>
  );
}

/** A side bet kind's help for one set up between two others: "the two of them", "one of them". */
const othersHelp = text => text.replace('the two of you', 'the two of them').replace('one of you', 'one of them').replace('the bet is yours', 'the bet is theirs');

/**
 * The number pad opened from a card renders at the screen, a full-width bottom sheet like every
 * other one, never cut off inside the card (its rounded corners hide what spills out).
 */
function AtScreen({ children }) {
  const [target, setTarget] = useState(null);
  const ref = useCallback(el => { if (el) setTarget(el.closest('.screen') || document.body); }, []);
  return <><span ref={ref} hidden />{target && createPortal(children, target)}</>;
}

/** Whether `side` can answer (accept, counter or decline) now, as their own answer or put in for them. */
const canAnswer = (ch, side, proxy) => ['accept', 'decline', 'counter'].some(m => canMove(ch, side, m, null, null, proxy));

/**
 * One challenge: who and what, where it stands, and the buttons for whoever's call it is. The
 * organizer (or the scorekeeper, or whoever made one that only lives on this phone) can put the
 * other people's answers in for them; their own answer from their own phone wins.
 * `onOpen`: tapping the card (to its page, or its plan).
 */
export function ChallengeCard({ ch, onOpen = null }) {
  const state = useStore();
  const side = sideOf(state, ch);
  const life = challengeLife(state, ch);
  const s = challengeState(ch);
  const setter = setUpHere(state, ch);
  const live = life === 'live';
  const turnIs = x => s.turn === x || s.turn === 'both';
  // Yours when it's your call, or when someone put an answer in for you (yours replaces it)
  const mine = live && side && (turnIs(side) || proxiedFor(ch, side).length > 0) && canAnswer(ch, side, false) ? side : null;
  // The others' answers this phone can put in: whoever's call it is
  const marking = live ? markSides(state, ch).filter(x => turnIs(x) && canAnswer(ch, x, true)) : [];
  const note = proxyNote(state, ch, side, life);
  const tone = challengeTone(ch, side, life);
  const Main = onOpen ? 'button' : 'div';
  return (
    <div className={`ch-card ${tone}`}>
      <Main className="ch-main" {...(onOpen ? { onClick: onOpen } : {})}>
        <span className="set-icon"><Icon name={BET_KINDS[ch.kind]?.icon || 'sword'} fill /></span>
        <span className="row-main">
          <span className="ch-head">{challengeHeadline(ch, side, setter)}</span>
          <span className="ch-line">{challengeLine(ch)}</span>
        </span>
        <span className={`ch-status ${tone}`}>{challengeStatusText(ch, side, life)}</span>
        {onOpen && <span className="chevron" aria-hidden="true"><Icon name="caret-right" /></span>}
      </Main>
      {note && <p className="ch-proxy">{note}</p>}
      {mine && <AnswerRow ch={ch} side={mine} marking={false} />}
      {marking.map(x => <AnswerRow key={x} ch={ch} side={x} marking />)}
    </div>
  );
}

/** Your challenges on Up next: the ones waiting on you first, then on them, then the agreed. */
export function ChallengesUpNext({ list }) {
  const nav = useNav();
  if (!list.length) return null;
  return (
    <>
      <div className="sec-label">Challenges</div>
      {list.map(ch => <ChallengeCard key={ch.id} ch={ch} onOpen={() => nav.push('challenge', { id: ch.id })} />)}
    </>
  );
}

/**
 * A planned round's challenges and "Challenge someone", for anyone on the plan who isn't out. Until
 * challenges are switched on, a friend's copy of the plan says to tell the organizer instead.
 */
export function PlanChallenges({ plan, myName }) {
  const nav = useNav(); // none for a friend answering from the link with no install
  const state = useStore();
  const off = useChallengesOff();
  const [making, setMaking] = useState(false);
  const me = plan.host ? plan.hostWho : plan.localMe;
  const people = planPeople(plan);
  const mine = people.find(p => p.who === me);
  const list = planChallenges(state, plan);
  const planned = plan.status === 'planned' && !plan.gone;
  const others = people.filter(p => p.who !== me && p.status !== 'out').map(p => ({ who: p.who, name: p.name }));
  // The organizer can set one up between two others too (they may never open the app)
  const canMake = planned && me && (mine?.status !== 'out' || plan.host) && others.length > (mine?.status === 'out' ? 1 : 0) && (plan.host || !off);
  if (!list.length && !canMake) return null;
  return (
    <>
      <div className="sec-label">Challenges</div>
      {list.map(ch => <ChallengeCard key={ch.id} ch={ch} onOpen={nav && (sideOf(state, ch) || markSides(state, ch).length) ? () => nav.push('challenge', { id: ch.id }) : null} />)}
      {canMake && (
        <button className="add-row ch-add" onClick={() => setMaking(true)}>
          <div className="add-ci"><Icon name="sword" fill /></div>
          <span className="add-lbl">{plan.host ? 'Challenge someone, or set one up' : 'Challenge someone'}</span>
        </button>
      )}
      {!plan.host && off && planned && <p className="field-help pad">Challenges reach the group once they’re switched on. Until then, tell {first(plan.hostName)} and it can go in as a side bet at the tee.</p>}
      {making && (
        <ChallengeMaker open onClose={() => setMaking(false)} from={{ who: me, name: mine?.name || myName || 'Me' }} people={others}
          whens={[{ key: plan.id, label: 'This round', plan }]} holesCount={plan.holesCount} setUp={!!plan.host} />
      )}
    </>
  );
}

/**
 * "Challenge Mike" on a Player card, and your challenges with them. `plans`: upcoming plans you
 * organized that they're on, [{ plan, who }] with their key on each.
 */
export function PersonChallenges({ id, name, list, plans = [] }) {
  const nav = useNav();
  const state = useStore();
  const [making, setMaking] = useState(false);
  const me = state.players?.[state.me];
  if (!state.me || id === state.me) return null;
  const whens = [{ key: 'next', label: 'Next round together', plan: null }, ...plans.map(({ plan, who }) => ({ key: plan.id, label: dayLabel(plan.date) || 'The planned round', plan, to: { who, name } }))];
  // Anyone else saved here, to set one up between them and this friend (the scorekeeper's phone)
  const others = Object.values(state.players || {})
    .filter(p => p?.id && p.id !== state.me && p.id !== id && !p.mergedInto && !p.archived)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map(p => ({ who: p.id, name: p.name }));
  return (
    <>
      {list.length > 0 && <div className="sec-label">Challenges</div>}
      {list.map(ch => <ChallengeCard key={ch.id} ch={ch} onOpen={() => nav.push('challenge', { id: ch.id })} />)}
      <button className="quiet-row" onClick={() => setMaking(true)}>
        <Icon name="sword" /> <span>Fancy a game? <u>Challenge {first(name)}</u></span>
      </button>
      {making && (
        <ChallengeMaker open onClose={() => setMaking(false)} from={{ who: state.me, name: me?.name || 'Me' }} people={[{ who: id, name }]} whens={whens} setUp others={others} />
      )}
    </>
  );
}

/**
 * The page's other buttons: send it again, call it off, take a finished one off this phone. On one
 * set up between two others, whoever set it up sends it to each of them and can call it off.
 */
export function ChallengeExtras({ ch, onGone }) {
  const state = useStore();
  const send = useSend();
  const shareText = useShareText();
  const side = sideOf(state, ch);
  const s = challengeState(ch);
  const life = challengeLife(state, ch);
  const setter = setUpHere(state, ch);
  const moves = useChallengeMoves(ch, setter && !side ? 'keeper' : side || 'from');
  const link = linkFor(state, ch);
  const them = first(ch[other(side || 'from')].name);
  const waitingOnThem = life === 'live' && side && s.turn === other(side);
  const live = life === 'live';
  return (
    <>
      {waitingOnThem && link && (
        <button className="text-link" onClick={() => send(challengeInviteText(ch, link, side), `Copied. Paste it to ${them}`)}><Icon name="paper-plane-right" /> Send it to {them} again</button>
      )}
      {live && setter && !side && (s.status === 'open' || s.status === 'countered') && ['from', 'to'].filter(x => s.turn === x || s.turn === 'both').map(x => {
        const l = linkFor(state, ch, x);
        return l ? <button key={x} className="text-link" onClick={() => send(challengeSetUpText(ch, l, x), `Copied. Paste it to ${first(ch[x].name)}`)}><Icon name="paper-plane-right" /> Send it to {first(ch[x].name)}</button> : null;
      })}
      {/* For the group text: who challenged whom, with the stake only when Show amounts is on */}
      {(live || s.status === 'on') && s.status !== 'declined' && s.status !== 'off' && (
        <button className="text-link" onClick={() => shareText(challengeGroupText(ch, { showAmounts: shareAmountsOn(state) }), { url: groupLinkFor(state, ch), what: 'Challenge' })}><Icon name="share-network" /> Share with the group</button>
      )}
      {live && side && canMove(ch, side, 'withdraw') && <button className="danger-link" onClick={moves.withdraw}><Icon name="x-circle" /> Call it off</button>}
      {live && setter && !side && canMove(ch, 'keeper', 'withdraw') && <button className="danger-link" onClick={moves.withdraw}><Icon name="x-circle" /> Call it off</button>}
      {/* A planned round's challenge comes back with its plan, so it goes when the plan does */}
      {life !== 'live' && (!ch.plan || life === 'gone') && <button className="danger-link" onClick={() => { forgetChallenge(ch.id); onGone?.(); }}><Icon name="trash" /> Take it off this phone</button>}
    </>
  );
}
