// Scramble house rule "minimum drives": tap whose drive each team used on the hole, with the count so far.
import { playsHole } from '../lib/round.js';
import { drivesNeeded, scrambleDrives } from '../lib/scramble-drives.js';
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
