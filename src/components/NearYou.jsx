// The "Near you" part of the course picker: the "Courses near me" button, the rows it finds
// (passed in as children, so they look and pick like the rest of the picker), and a plain
// note when location is off or nothing is close.
import { Icon } from './ui.jsx';
import { RADIUS_MI } from '../lib/nearby.js';

const placeName = p => (p ? [p.town, p.region].filter(Boolean).join(', ') : '');

const NOTES = {
  denied: 'Location is off for Birdie Bank. Turn it on for this site in your settings (on iPhone: Settings, Privacy & Security, Location Services, Safari Websites), then tap Try again. Search works as usual.',
  unavailable: 'This phone can’t share its location here. Search by course or town instead.',
  nofix: 'Couldn’t tell where you are just now. Try again in a moment, or search by course or town.',
  off: 'Courses near you need the course database, which isn’t on here. Search your saved courses or add one.',
  error: 'Couldn’t look up courses near you right now. Try again, or search by course or town.',
};

export default function NearYou({ near, count, children }) {
  const { status, place } = near;
  const looking = status === 'looking';
  const note = NOTES[status];
  const found = count > 0;

  // Before the first look: just the button
  if (status === 'idle' || (looking && !found && !place)) {
    return (
      <div className="near-ask">
        <button className="pill-btn near-btn" onClick={near.ask} disabled={looking} aria-busy={looking}>
          <Icon name={looking ? 'circle-notch' : 'navigation-arrow'} className={looking ? 'spin' : ''} fill={!looking} />
          {looking ? 'Looking near you' : 'Courses near me'}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="sec-label">Near you{looking ? ' · looking' : ''}</div>
      {found && <div style={{ padding: '0 16px' }}>{children}</div>}
      {!found && status === 'ready' && (
        <p className="hint-card"><Icon name="map-pin" fill /> No courses in our database within {RADIUS_MI} miles of {placeName(place) || 'you'} yet. Search by name, or add yours from the scorecard.</p>
      )}
      {note && <p className="hint-card"><Icon name={status === 'denied' ? 'navigation-arrow' : 'info'} fill /> {note}</p>}
      <div className="near-foot">
        {place && found && <span>Around {placeName(place)}</span>}
        <button className="near-again" onClick={near.ask} disabled={looking}>
          {looking ? <><Icon name="circle-notch" className="spin" /> Looking</> : <><Icon name="arrow-clockwise" /> {status === 'ready' ? 'Look again' : 'Try again'}</>}
        </button>
      </div>
    </>
  );
}
