// Challenges (challenges.js): the sheet that makes one, the card that shows one with its Accept,
// Counter and Decline buttons, and the lists on Up next, a planned round and a Player card. Copy
// stays friendly: a no is "passed this time", never anything worse.
import { useState } from 'react';
import { Icon, Numpad, Segmented, Sheet, useUI } from './ui.jsx';
import { getState, uid, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { BET_KINDS, BET_LABEL_MAX, BET_MAX } from '../lib/pair-bets.js';
import {
  CHALLENGE_KINDS, CHALLENGE_STAKES, HOLES_LABEL, canMove, challengeFmt, challengeHeadline, challengeInviteText, challengeLife, challengeLine, challengeProblem,
  challengeState, challengeStatusText, challengeTone, newChallenge, planChallenges, planOf, sideOf,
} from '../lib/challenges.js';
import { challengeShareLink, challengesOff, forgetChallenge, makeChallenge, moveChallenge, useChallengesOff } from '../lib/challenge-sync.js';
import { planShareLink } from '../lib/plan-sync.js';
import { sendReminder } from '../lib/pay.js';
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

/** The link that reaches the other person: the plan's own link for them, or the challenge's. */
function linkFor(state, ch) {
  if (!ch?.code) return null;
  if (!ch.plan) return challengeShareLink(ch);
  const plan = planOf(state, ch);
  return plan?.code ? planShareLink(plan, ch[other(sideOf(state, ch) || 'from')].who) : null;
}

/**
 * Make a challenge. `from`: you ({ who, name }). `people`: who you can challenge ([{ who, name }]; one
 * for a Player card). `whens`: what it's for, [{ key, label, plan, to? }] (a plan, or plan null for the
 * next round together, with `to` the person's key on that plan); a planned round's own challenge has one. `holesCount`: 9 hides the nines.
 */
export function ChallengeMaker({ open, onClose, from, people, whens, holesCount = 18 }) {
  const { showToast } = useUI();
  const send = useSend();
  const [toWho, setToWho] = useState(people.length === 1 ? people[0].who : null);
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
  // A plan knows each person by their key on it, which can differ from the id on their card
  const to = when?.to || people.find(p => p.who === toWho) || null;
  const me = plan ? { who: plan.host ? plan.hostWho : plan.localMe, name: from.name } : from;
  const draft = { from: me, to, kind, stake, label };
  const problem = challengeProblem(draft);
  const nines = (plan?.holesCount ?? holesCount) !== 9;
  const preview = !problem ? challengeLine(newChallenge({ id: 'x', from: me, to, kind, stake, holes: nines ? holes : 'all', label, plan: plan ? { date: plan.date } : null, unit })) : null;

  const go = async () => {
    if (problem || sending) return;
    setSending(true);
    const ch = newChallenge({ id: uid('c'), from: me, to, kind, stake, holes: nines ? holes : 'all', label, plan: plan ? { id: plan.id, code: plan.code, date: plan.date } : null, unit });
    const { code } = await makeChallenge(ch);
    setSending(false);
    onClose();
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

  return (
    <>
      <Sheet open={!pad} onClose={onClose} title={people.length === 1 ? `Challenge ${first(people[0].name)}` : 'Challenge someone'}>
        <p className="sheet-text">A side bet between the two of you. {people.length === 1 ? first(people[0].name) : 'They'} can accept, pass or name their own amount, and once it’s agreed it goes into the round.</p>
        <div className="pb-edit">
          {people.length > 1 && (
            <>
              <div className="field-label" id="ch-who">Who</div>
              <div className="chip-row flush" role="radiogroup" aria-labelledby="ch-who">
                {people.map(p => (
                  <button key={p.who} role="radio" aria-checked={toWho === p.who} className={`pill-btn ${toWho === p.who ? 'on' : ''}`} onClick={() => setToWho(p.who)}>{first(p.name)}</button>
                ))}
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
          <p className="field-help pb-help">{BET_KINDS[kind].help}</p>
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
          <button className="full-btn" disabled={!!problem || sending} onClick={go}>{problem || (sending ? 'Sending…' : 'Send the challenge')} {!problem && !sending && <Icon name="paper-plane-right" />}</button>
        </div>
      </Sheet>
      <Numpad open={pad} title="The amount" {...unitPad(unit)} initial={stake} min={1} max={BET_MAX}
        onClose={() => setPad(false)} onDone={v => { setStake(v); setPad(false); }} />
    </>
  );
}

/**
 * Accept, counter, decline and call off for `side`, with the toasts and the text to send after.
 * `marking`: this phone is putting in the other person's answer for them (a challenge on this phone only).
 */
function useChallengeMoves(ch, side, marking = false) {
  const { ask, showToast } = useUI();
  const send = useSend();
  const name = first(ch?.[other(side)]?.name);
  const self = first(ch?.[side]?.name);
  const after = text => {
    const cur = getState().challenges?.[ch.id];
    const link = linkFor(getState(), cur);
    if (link && cur) send(challengeInviteText(cur, link, side), `Copied. Paste it to ${name}`);
    else showToast(text);
  };
  return {
    accept: async () => {
      if (!(await moveChallenge(ch.id, { side, move: 'accept' }))) return;
      const lead = marking ? `${self}’s in.` : 'You’re on.';
      showToast(`${lead} It goes in as a side bet ${ch.plan ? 'when the round starts' : 'next time you two play'}.`);
    },
    decline: async () => {
      const q = marking
        ? { title: `${self} passed?`, text: 'It comes off as a no for this time. You can always challenge again.' }
        : { title: 'Pass on this one?', text: `${name} sees you passed this time. You can always challenge back.` };
      if (!(await ask({ ...q, confirmLabel: 'Decline', cancelLabel: 'Keep it' }))) return;
      if (await moveChallenge(ch.id, { side, move: 'decline' })) showToast('No worries. Maybe next time.');
    },
    counter: async stake => {
      if (!(await moveChallenge(ch.id, { side, move: 'counter', stake }))) { showToast('That’s the amount already. Pick another one.'); return; }
      after(marking ? `${self} said ${challengeFmt(ch)(stake)}. Your call now.` : `${name} can take ${challengeFmt(ch)(stake)} or not.`);
    },
    withdraw: async () => {
      if (!(await ask({ title: 'Call it off?', text: `${name} sees it’s off. Nothing goes on the Tab.`, confirmLabel: 'Call it off', cancelLabel: 'Keep it on', danger: true }))) return false;
      return moveChallenge(ch.id, { side, move: 'withdraw' });
    },
  };
}

/**
 * One challenge: who and what, where it stands, and the buttons for whoever's call it is. On a
 * challenge that only lives on this phone, the one who made it marks the other person's answer.
 * `onOpen`: tapping the card (to its page, or its plan).
 */
export function ChallengeCard({ ch, onOpen = null }) {
  const state = useStore();
  const side = sideOf(state, ch);
  const life = challengeLife(state, ch);
  const s = challengeState(ch);
  const [countering, setCountering] = useState(false);
  // Whose answer this phone can give: yours, or (only here) the other person's when they tell you
  const marking = !side || s.turn === side ? null : !ch.code && ch.made && s.turn ? s.turn : null;
  const actFor = life === 'live' && s.turn && (s.turn === side || marking) ? s.turn : null;
  const moves = useChallengeMoves(ch, actFor || side || 'from', !!marking);
  const tone = challengeTone(ch, side, life);
  const Main = onOpen ? 'button' : 'div';
  return (
    <div className={`ch-card ${tone}`}>
      <Main className="ch-main" {...(onOpen ? { onClick: onOpen } : {})}>
        <span className="set-icon"><Icon name={BET_KINDS[ch.kind]?.icon || 'sword'} fill /></span>
        <span className="row-main">
          <span className="ch-head">{challengeHeadline(ch, side)}</span>
          <span className="ch-line">{challengeLine(ch)}</span>
        </span>
        <span className={`ch-status ${tone}`}>{challengeStatusText(ch, side, life)}</span>
        {onOpen && <span className="chevron" aria-hidden="true"><Icon name="caret-right" /></span>}
      </Main>
      {actFor && (
        <>
          {marking && <p className="ch-mark">{first(ch[marking].name)} isn’t getting these yet. What did they say?</p>}
          <div className="ch-actions" role="group" aria-label={marking ? `${first(ch[marking].name)}’s answer` : 'Your answer'}>
            <button className="pill-btn ch-yes" onClick={moves.accept}><Icon name="check" /> Accept</button>
            {canMove(ch, actFor, 'counter') && <button className="pill-btn" onClick={() => setCountering(true)}><Icon name="arrows-left-right" /> Counter</button>}
            <button className="pill-btn" onClick={moves.decline}>Decline</button>
          </div>
        </>
      )}
      <Numpad open={countering} title={`Your amount, not ${challengeFmt(ch)(s.stake)}`} {...unitPad(ch.unit)} initial={s.stake} min={1} max={BET_MAX}
        quick={CHALLENGE_STAKES.filter(v => v !== s.stake)}
        onClose={() => setCountering(false)} onDone={v => { setCountering(false); moves.counter(v); }} />
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
  const canMake = planned && me && mine?.status !== 'out' && others.length > 0 && (plan.host || !off);
  if (!list.length && !canMake) return null;
  return (
    <>
      <div className="sec-label">Challenges</div>
      {list.map(ch => <ChallengeCard key={ch.id} ch={ch} onOpen={nav && sideOf(state, ch) ? () => nav.push('challenge', { id: ch.id }) : null} />)}
      {canMake && (
        <button className="add-row ch-add" onClick={() => setMaking(true)}>
          <div className="add-ci"><Icon name="sword" fill /></div>
          <span className="add-lbl">Challenge someone</span>
        </button>
      )}
      {!plan.host && off && planned && <p className="field-help pad">Challenges reach the group once they’re switched on. Until then, tell {first(plan.hostName)} and it can go in as a side bet at the tee.</p>}
      {making && (
        <ChallengeMaker open onClose={() => setMaking(false)} from={{ who: me, name: mine?.name || myName || 'Me' }} people={others}
          whens={[{ key: plan.id, label: 'This round', plan }]} holesCount={plan.holesCount} />
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
  return (
    <>
      {list.length > 0 && <div className="sec-label">Challenges</div>}
      {list.map(ch => <ChallengeCard key={ch.id} ch={ch} onOpen={() => nav.push('challenge', { id: ch.id })} />)}
      <button className="quiet-row" onClick={() => setMaking(true)}>
        <Icon name="sword" /> <span>Fancy a game? <u>Challenge {first(name)}</u></span>
      </button>
      {making && (
        <ChallengeMaker open onClose={() => setMaking(false)} from={{ who: state.me, name: me?.name || 'Me' }} people={[{ who: id, name }]} whens={whens} />
      )}
    </>
  );
}

/** The page's other buttons: send it again, call it off, take a finished one off this phone. */
export function ChallengeExtras({ ch, onGone }) {
  const state = useStore();
  const send = useSend();
  const side = sideOf(state, ch);
  const s = challengeState(ch);
  const life = challengeLife(state, ch);
  const moves = useChallengeMoves(ch, side || 'from');
  const link = linkFor(state, ch);
  const them = first(ch[other(side || 'from')].name);
  const waitingOnThem = life === 'live' && side && s.turn === other(side);
  return (
    <>
      {waitingOnThem && link && (
        <button className="text-link" onClick={() => send(challengeInviteText(ch, link, side), `Copied. Paste it to ${them}`)}><Icon name="paper-plane-right" /> Send it to {them} again</button>
      )}
      {life === 'live' && side && canMove(ch, side, 'withdraw') && <button className="danger-link" onClick={moves.withdraw}><Icon name="x-circle" /> Call it off</button>}
      {/* A planned round's challenge comes back with its plan, so it goes when the plan does */}
      {life !== 'live' && (!ch.plan || life === 'gone') && <button className="danger-link" onClick={() => { forgetChallenge(ch.id); onGone?.(); }}><Icon name="trash" /> Take it off this phone</button>}
    </>
  );
}
