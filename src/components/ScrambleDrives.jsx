// Scramble house rule "minimum drives": tap whose drive each team used on the hole, with the count so far.
import { playsHole } from '../lib/round.js';
import { drivesNeeded, drivesShortfall, scrambleDrives, shortfallText } from '../lib/scramble-drives.js';
import { Icon } from './ui.jsx';
import { buzz } from '../lib/delight.js';

const firstName = n => (n || '').split(' ')[0];

/** One row per team on the hole. `marks.drives` is { teamId: pid }; read-only without setMarks. */
export function ScrambleDrivesPicker({ round, hole, marks, setMarks }) {
  const need = drivesNeeded(round);
  if (!need || !marks) return null;
  // The counts include this hole's pick as it stands, so tapping shows the new count straight away
  const counted = { ...round, marks: { ...(round.marks || {}), [hole.no]: marks } };
  const teams = scrambleDrives(counted).filter(t => round.teams.find(x => x.id === t.id)?.players.some(pid => playsHole(round, pid, hole)));
  const picked = marks.drives || {};
  const pick = (tid, pid) => {
    const drives = { ...picked, [tid]: picked[tid] === pid ? null : pid };
    if (!drives[tid]) delete drives[tid];
    setMarks?.({ ...marks, drives });
    buzz(8);
  };
  return (
    <div className="marks-card">
      <div className="drives-head">Whose drive? {need} each over the round</div>
      {teams.map(t => {
        const owed = t.players.filter(p => p.short > 0);
        const sub = !owed.length ? `${need} each: done`
          : !t.left ? `${owed.map(p => `${firstName(p.name)} ${p.short}`).join(', ')} short`
          : t.tight ? `Must use ${owed.map(p => firstName(p.name)).join(' & ')}`
            : `${owed.map(p => `${firstName(p.name)} ${p.short}`).join(', ')} more`;
        return (
          <div key={t.id} className="marks-row">
            <div className="marks-lbl"><strong>{t.name}</strong><span className={t.tight ? 'drives-tight' : undefined}>{sub}</span></div>
            <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label={`${t.name}: whose drive`}>
              {t.players.filter(p => playsHole(round, p.id, hole)).map(p => (
                <button key={p.id} role="radio" aria-checked={picked[t.id] === p.id} disabled={!setMarks}
                  className={`pill-btn sm ${picked[t.id] === p.id ? 'on' : ''}`} onClick={() => pick(t.id, p.id)}>
                  {firstName(p.name)} <span className="drives-n">{p.drives}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A quiet line on the Play screen once a shortfall is worth flagging. It never blocks scoring. */
export function DrivesShortfall({ round, done = false }) {
  const short = drivesShortfall(round, { soon: !done });
  // Nothing tagged all round means the rule wasn't used, so the results stay quiet
  if (!short.length || (done && scrambleDrives(round).every(t => t.players.every(p => !p.drives)))) return null;
  const gaps = done ? untagged(round) : 0;
  return (
    <p className="drives-short" role="status">
      <Icon name="golf" />
      <span>{short.map(s => shortfallText(s, { done })).join('. ')}.{done && gaps > 0 && ` ${gaps} hole${gaps === 1 ? ' wasn’t' : 's weren’t'} tagged.`}</span>
    </p>
  );
}

// Holes some team never tagged a drive on, for the results note
function untagged(round) {
  return Math.max(0, ...scrambleDrives(round).map(t => t.left));
}
