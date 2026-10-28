// "Get a round going": the one-screen ask (overhaul, 2026-10-27). A message, three optional details
// that start as Not yet (When, Where, Game and bet), who to ask, and Send. Nothing has to be set to
// send: the group sorts out the rest on the plan page. Opened by "Plan ahead" and Up next's "Get a
// round going" (nav.push('newRound', { ahead: true }), NewRound.jsx). The full setup's "Schedule
// for later" still carries a whole setup into a plan (newround/PlanSteps.jsx).
import { useState } from 'react';
import { Header, Icon, Screen, useUI } from '../../components/ui.jsx';
import { getState, uid, update, useStore } from '../../lib/store.js';
import { track } from '../../lib/analytics.js';
import { useNav } from '../../lib/nav.js';
import { useKept } from '../../lib/kept.js';
import { GAMES } from '../../lib/round.js';
import { money } from '../../lib/golf.js';
import { canonicalOf } from '../../lib/pair-debts.js';
import { cleanPersonName, savePerson, tripInvitees } from '../../lib/trip-people.js';
import { copyText, sendReminder } from '../../lib/pay.js';
import { inviteText } from '../../lib/plans.js';
import { sharePlan, planShareLink } from '../../lib/plan-sync.js';
import { PlansOffError } from '../../lib/plan-adapters.js';
import { cleanAsk, groupGames, newAskPlan } from '../../lib/plan-ask.js';
import { ASK_DEFAULT, ASK_MAX, whenWords } from '../../lib/plan-open.js';
import { DetailRows, GameBetSheet, WhenSheet, WhereSheet } from './PlanParts.jsx';

export default function PlanAsk() {
  const nav = useNav();
  const { ask, showToast } = useUI();
  const state = useStore();
  // Kept with your place, so a reload (or the share sheet sending the page away) comes back to them
  const [msg, setMsg] = useKept('ask:msg', ASK_DEFAULT);
  const [when, setWhen] = useKept('ask:when', { mode: 'open', date: null, days: [], part: null });
  const [course, setCourse] = useKept('ask:course', null);
  const [pick, setPick] = useKept('ask:pick', { game: null, bet: null });
  const [invited, setInvited] = useKept('ask:invited', []);
  const [sheet, setSheet] = useState(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const games = groupGames(state);
  const who = canonicalOf(state);
  const on = new Set(invited.map(who));
  const list = tripInvitees(state, { picked: invited });

  const toggle = p => {
    if (on.has(p.id)) { setInvited(v => v.filter(x => who(x) !== p.id)); return; }
    update(s => savePerson(s, p));
    setInvited(v => [...v, p.id]);
  };
  // A name typed here is saved as a player and asked; a name already on the list is just asked
  const addName = e => {
    e.preventDefault();
    const t = cleanPersonName(name);
    if (!t) return;
    const meName = String(state.players?.[state.me]?.name || '').trim().toLowerCase();
    if (t.toLowerCase() !== meName) {
      const same = list.find(p => p.name.trim().toLowerCase() === t.toLowerCase());
      const id = same?.id || uid('p_');
      if (!same) update(s => { s.players[id] = { id, name: t, index: null, venmo: '', createdAt: Date.now() }; });
      setInvited(v => (v.includes(id) ? v : [...v, id]));
    }
    setName(''); setAdding(false);
  };

  // Save the plan on this phone, then get its group link (null when links aren't switched on)
  const make = async () => {
    const s = getState();
    const id = uid('pl_');
    const people = invited.map(pid => s.players[pid] || s.players[who(pid)]).filter(p => p && p.id !== s.me).map(p => ({ id: p.id, name: p.name }));
    const plan = newAskPlan({ id, hostName: s.players[s.me]?.name || 'Me', ask: msg, when, course, people, pick, games, settings: s.settings });
    update(st => {
      if (!st.plans) st.plans = {};
      st.plans[id] = plan;
      if (course?.id && !st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6);
    });
    track('plan_created', { game: pick.game || 'group', holes: 18, invited: people.length, trip: false, from: 'ask', when: plan.when.mode });
    try {
      await sharePlan(id);
      return { id, link: planShareLink(getState().plans[id]) };
    } catch (e) {
      showToast(e instanceof PlansOffError ? 'Group links aren’t switched on yet, so this plan lives on your phone' : 'Couldn’t get the link. Send it from the plan when you have signal');
      return { id, link: null };
    }
  };
  // The plan page next, with Up next under it (what this screen kept goes as it closes)
  const done = id => nav.reset('upnext', ['plan', { id }]);
  const send = async () => {
    if (busy) return;
    setBusy(true);
    const { id, link } = await make();
    if (link) {
      const r = await sendReminder(inviteText(getState().plans[id], link));
      if (r === 'copied') showToast('Copied. Paste it in your group text');
    }
    done(id);
  };
  const copy = async () => {
    if (busy) return;
    setBusy(true);
    const { id, link } = await make();
    if (link) showToast((await copyText(link)) ? 'Link copied. Paste it anywhere' : 'Couldn’t copy. Share it from the plan');
    done(id);
  };
  const close = async () => {
    const touched = msg !== ASK_DEFAULT || invited.length || course || pick.game || when.mode !== 'open';
    if (!touched || await ask({ title: 'Cancel this plan?', text: 'Nothing gets sent until you tap Send.', confirmLabel: 'Cancel plan', cancelLabel: 'Keep going', danger: true })) nav.pop();
  };

  const rows = [
    { key: 'when', icon: 'calendar-blank', label: 'When', s: { state: when.mode === 'set' && when.date ? 'set' : when.mode === 'options' && when.days.length ? 'vote' : 'not', label: whenWords(when) }, onOpen: () => setSheet('when') },
    { key: 'where', icon: 'map-pin', label: 'Where', s: course ? { state: 'set', label: course.name } : { state: 'not', label: 'Any course' }, onOpen: () => setSheet('where') },
    {
      key: 'game', icon: 'cards', label: 'Game and bet', onOpen: () => setSheet('game'),
      s: pick.game ? { state: pick.bet ? 'set' : 'vote', label: `${GAMES[pick.game]?.name}${pick.bet ? ` · ${money(pick.bet)}` : ' · bet up for a vote'}` } : { state: 'not', label: 'Group picks' },
    },
  ];

  return (
    <Screen className="plan-ask">
      {/* One title and a close (Trevor, 2026-10-28): the screen is named for what it does, and the
          message below is what the group gets, so it reads as a text field, not a second heading */}
      <Header title="Get a round going" onClose={close} />
      <div className="scroll">
        <label className="sec-label pa-label" htmlFor="pa-msg">Your message</label>
        <div className="pa-text">
          <textarea id="pa-msg" className="pa-msg" rows={2} maxLength={ASK_MAX} value={msg} aria-describedby="pa-msg-foot"
            onChange={e => setMsg(e.target.value)} onBlur={() => setMsg(cleanAsk(msg))} />
          <p className="pa-foot" id="pa-msg-foot"><Icon name="link" /> Goes to the group with the link to answer</p>
        </div>

        <div className="sec-label">The details</div>
        <DetailRows rows={rows} />
        <p className="pa-hint">Each one can wait. Leave it open and the group sorts it out.</p>

        <div className="sec-label">Who to ask</div>
        <div className="pa-people" role="group" aria-label="Who to ask">
          {list.map(p => (
            <button key={p.id} type="button" className={`pa-chip ${on.has(p.id) ? 'on' : ''}`} aria-pressed={on.has(p.id)} onClick={() => toggle(p)}>
              {on.has(p.id) && <Icon name="check" />}{p.name.split(' ')[0]}
            </button>
          ))}
          {!adding && <button type="button" className="pa-chip add" onClick={() => setAdding(true)}><Icon name="plus" /> Name</button>}
        </div>
        {adding && (
          <form className="add-name-row pa-add" onSubmit={addName}>
            <label className="sr-only" htmlFor="pa-name">Add a name</label>
            <div className="add-name-line">
              <input id="pa-name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dave" autoComplete="off" maxLength={24} enterKeyHint="done" autoFocus />
              <button type="submit" className="add-name-btn" disabled={!cleanPersonName(name)}><Icon name="plus" /> Add</button>
            </div>
          </form>
        )}
        <p className="pa-hint">{invited.length ? `${invited.length} asked. Anyone else with the link can answer too.` : 'Or skip this and send one link to the group text. Anyone with it can answer.'}</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn pink" disabled={busy} onClick={send}><Icon name="paper-plane-tilt" fill /> {busy ? 'Getting the link…' : 'Send to the group'}</button>
        <button className="text-link centered" disabled={busy} onClick={copy}><Icon name="link" /> Or copy the link</button>
      </div>
      <WhenSheet open={sheet === 'when'} value={when} onClose={() => setSheet(null)} onDone={v => { setWhen(v); setSheet(null); }} />
      <WhereSheet open={sheet === 'where'} current={course} onClose={() => setSheet(null)} onPick={c => { setCourse(c); setSheet(null); }} />
      <GameBetSheet open={sheet === 'game'} value={pick} games={games} onClose={() => setSheet(null)} onDone={v => { setPick(v); setSheet(null); }} />
    </Screen>
  );
}
