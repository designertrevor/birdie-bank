// The live captains' draft (draft.js, draft-sync.js): the organizer's view (both captains' links,
// who's on which phone, picking for a captain here, starting over) and a captain's own, opened
// from their link (?draft=TRIP&c=0 or 1). Each pick shows on every phone within a few seconds.
// When everyone is picked the teams go on the trip from the organizer's phone, and the trip's
// schedule (if it has one) plans every round with its matches.
import { useEffect } from 'react';
import { BallIllo, Empty, Header, Icon, Screen, useUI } from '../components/ui.jsx';
import { LinkBrand } from '../components/LinkBrand.jsx';
import { Avatar } from '../components/Pay.jsx';
import { TeamDot } from '../components/Cup.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { buzz } from '../lib/delight.js';
import { sendReminder } from '../lib/pay.js';
import { DRAFT_ORDERS, draftLink, seatPhones } from '../lib/draft.js';
import { draftPick, draftState, draftUndo, joinDraft, mySeats, pickForHere, startDraft, useDraftSync } from '../lib/draft-sync.js';
import { cupOf } from '../lib/cup.js';
import { isOrganizer, tripOf } from '../lib/trips.js';

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Player';

/** The organizer's draft (or a captain's, once their link has been opened on this phone). */
export default function Draft({ id }) {
  const nav = useNav();
  return (
    <Screen>
      <Header title="Captains’ draft" small onBack={nav.pop} />
      <DraftBody tripId={id} />
    </Screen>
  );
}

/**
 * Opened from a captain's link: this phone claims that captain's picks, then shows the draft.
 * `standalone`: someone who hasn't set up the app picks without setting it up.
 */
export function DraftLink({ tripId, seat, standalone = false, onSkip }) {
  const nav = useNav();
  useEffect(() => { joinDraft(tripId, seat); }, [tripId, seat]);
  return (
    <Screen>
      {standalone && <LinkBrand />}
      {standalone ? <Header title="Captains’ draft" small /> : <Header title="Captains’ draft" small onBack={nav.pop} />}
      <DraftBody tripId={tripId} />
      {standalone && onSkip && <div className="cta-wrap"><button className="link-btn center" onClick={onSkip}>Done here</button></div>}
    </Screen>
  );
}

function DraftBody({ tripId }) {
  const state = useStore();
  const { ask, showToast } = useUI();
  const status = useDraftSync(tripId);
  const { def, merged, rows, mine } = draftState(state, tripId);
  const seats = mySeats(state, tripId);
  const organizer = !!state.tripDrafts?.[tripId]?.def;
  const trip = tripOf(state, tripId);
  const cup = cupOf(trip);

  if (!def) {
    // The organizer on a phone without the draft yet (it was started on another of theirs, say)
    if (trip && isOrganizer(state, trip) && cup?.draft?.live && cup.captains[0] && cup.captains[1] && status === 'ok') {
      return (
        <div className="scroll">
          <Empty title="Start the draft" text={`${first(state.players[cup.captains[0]]?.name)} and ${first(state.players[cup.captains[1]]?.name)} pick on their own phones, on their turns.`}
            action={<button className="full-btn" onClick={() => startDraft(tripId, cup.draft)}>Start the draft</button>} />
        </div>
      );
    }
    const off = status === 'off';
    return (
      <div className="scroll onboard-body">
        <BallIllo className="onboard-illo" face={!off && status !== 'offline'} />
        <h1 className="onboard-title" style={{ fontSize: 30 }}>{off ? 'Not switched on yet' : status === 'offline' ? 'No signal' : 'Finding the draft…'}</h1>
        <p className="onboard-text">{off
          ? 'Live drafts aren’t switched on yet, so the organizer runs this one on their phone and passes it around.'
          : status === 'offline' ? 'Couldn’t reach the draft. It tries again every few seconds.'
          : mine ? 'Waiting for the organizer’s phone to post the draft.' : 'One moment.'}</p>
      </div>
    );
  }

  const name = id => def.pool.find(p => p.id === id)?.name || 'Player';
  const capName = i => first(name(def.captains[i]));
  const total = def.pool.length - 2;
  const turn = merged.turn;
  const myTurn = turn != null && seats.has(turn);
  const last = merged.picks.at(-1);
  const canUndo = last && seats.has(last.seat) && !merged.done;
  const phones = seatPhones(def, rows);
  const order = merged.picks.length;

  const pick = id => {
    if (!myTurn) return;
    if (draftPick(tripId, turn, id)) buzz(15);
    else showToast('Not your pick right now');
  };
  const share = async seat => {
    const link = draftLink(location.origin, tripId, seat);
    const text = `You’re captain of ${def.names[seat]} for ${trip?.name || def.title || 'the trip'}. Pick your team here when it’s your turn: ${link}`;
    const r = await sendReminder(text);
    if (r === 'copied') showToast(`${capName(seat)}’s link is copied. Paste it in a text to them`);
    if (r === 'failed') showToast('Couldn’t share on this device');
  };
  const again = async () => {
    if (!(await ask({ title: 'Start the draft over?', text: 'Every pick so far is taken back, on every phone. The captains stay.', confirmLabel: 'Start over', danger: true }))) return;
    startDraft(tripId, { order: def.order, first: def.first, here: def.here });
    showToast('The draft starts over');
  };

  const headline = merged.done ? 'The draft is done'
    : myTurn ? (seats.size > 1 ? `${capName(turn)}’s pick for ${def.names[turn]}` : `Your pick for ${def.names[turn]}`)
    : `${capName(turn)}’s pick for ${def.names[turn]}`;
  const sub = merged.done
    ? (organizer ? (cup?.schedule ? 'The teams are on the trip, and every round on its schedule is planned with its matches.' : 'The teams are on the trip.') : `The teams go on the trip from ${def.byName ? `${def.byName}’s` : 'the organizer’s'} phone.`)
    : `${order} of ${total} picked · ${DRAFT_ORDERS[def.order].name.toLowerCase()}, ${def.names[def.first]} first`;

  return (
    <div className="scroll">
      <div className={`block tm-draft-head ${turn != null ? `t${turn}` : ''}`} role="status" aria-live="polite">
        <div className="eyebrow">{trip?.name || def.title || `${def.names[0]} v ${def.names[1]}`}</div>
        <div className="d tm-draft-big">{headline}</div>
        <div className="tm-draft-sub">{sub}</div>
        {status === 'offline' && <div className="tm-draft-sub warn"><Icon name="wifi-slash" /> No signal. Picks go up when it’s back.</div>}
      </div>

      <div className="cup-cols tm-draft-cols">
        {[0, 1].map(i => (
          <div key={i} className={`cup-col t${i} ${turn === i ? 'turn' : ''}`}>
            <div className="cup-col-head"><TeamDot team={i} /> {def.names[i]}<span className="cup-col-hc">{merged.teams[i].length}</span></div>
            {merged.teams[i].map((id, k) => (
              <div key={id} className="cup-chip static-row">
                <span className="cup-order-n">{k === 0 ? '' : merged.picks.findIndex(p => p.id === id) + 1}</span>
                <Avatar id={state.players?.[id] ? id : null} name={name(id)} size="sm" />
                <span className="cup-chip-name">{name(id)}</span>
                {k === 0 && <span className="cup-cap" title="Captain">C</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {!merged.done && (
        <>
          <div className="sec-label">{myTurn ? 'Tap to pick' : 'Still to pick'}</div>
          <div className="cup-free tm-draft-pool">
            {merged.left.map(id => {
              const p = def.pool.find(x => x.id === id);
              return (
                <button key={id} type="button" className={`cup-chip free ${myTurn ? `pick t${turn}` : ''}`} disabled={!myTurn} onClick={() => pick(id)} aria-label={myTurn ? `Pick ${p.name} for ${def.names[turn]}` : p.name}>
                  <Avatar id={state.players?.[id] ? id : null} name={p.name} size="sm" />
                  <span className="cup-chip-name">{p.name}</span>
                  {p.index != null && <span className="cup-chip-hc">{p.index}</span>}
                </button>
              );
            })}
          </div>
          {canUndo && <button className="link-btn" style={{ margin: '8px 16px 0' }} onClick={() => draftUndo(tripId, last.seat)}><Icon name="arrow-counter-clockwise" /> Take back {first(name(last.id))}</button>}
        </>
      )}

      {organizer && (
        <>
          <div className="sec-label">The captains</div>
          {[0, 1].map(i => {
            const here = def.here[i];
            const phone = phones[i];
            return (
              <div key={i} className="ledger-row static tm-captain">
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}><TeamDot team={i} /> {name(def.captains[i])}</div>
                  <div className="lr-status">{here ? 'Picking on this phone' : phone ? `Picking on ${phone.row.name ? `${first(phone.row.name)}’s` : 'their'} phone` : status === 'off' ? 'Pick here for them' : 'Hasn’t opened the link yet'}</div>
                </div>
                {!here && !merged.done && status !== 'off' && <button className="pill-btn sm" onClick={() => share(i)}><Icon name="share" /> Link</button>}
                {!here && !merged.done && <button className="pill-btn sm" onClick={() => pickForHere(tripId, i)}>Pick here</button>}
              </div>
            );
          })}
          <p className="field-help pad">{status === 'off'
            ? 'Live drafts aren’t switched on yet, so the captains can’t pick on their own phones. Pick here for both and pass this phone around.'
            : 'Each captain picks on their own phone from their link. No signal on one? Pick here for them: what they’ve picked stays theirs.'}</p>
          {!merged.done && merged.picks.length > 0 && <button className="text-link danger" onClick={again}><Icon name="arrow-counter-clockwise" /> Start the draft over</button>}
        </>
      )}
      {!organizer && !merged.done && !seats.size && mine && <p className="field-help pad">Someone else opened this captain’s link first, so their phone picks. You can watch here.</p>}
    </div>
  );
}
