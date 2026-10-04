// Teams or sides and the playing order during a round, from the round menu (Players): everything
// setup's Teams and Order sections offer, changeable once the round is under way. Sides and teams
// count for the whole round, holes already played too. The Banker and Wolf order counts from the
// next hole (each hole played keeps its banker or wolf). Sixes partners count for the whole round.
// Hammer adds who throws the first hammer. The sheet says whose money moves before it's saved. The
// engine is lineup.js.
import { useState } from 'react';
import { Icon, Segmented, Sheet, useUI } from './ui.jsx';
import { SixesPreview, TeamPicker } from './GameOptions.jsx';
import { update } from '../lib/store.js';
import { gameView, pressMode } from '../lib/round.js';
import { teamsProblem } from '../lib/teams.js';
import {
  changeHammerWho, changeOrder, changeTeams, lineupKind, lineupLabel, orderNow, orderRuns, pressesOn, teamGroups, teamsChangeProblem, teamsLocked,
} from '../lib/lineup.js';
import { countsMoney } from '../lib/play-for.js';
import { moneyLine } from '../lib/hole-fix.js';
import { logChange } from '../lib/agreed.js';
import { buzz } from '../lib/delight.js';

const runLabel = r => (r.from === r.to ? `Hole ${r.from}` : `Holes ${r.from}–${r.to}`);

/** Mounted only while open, so it starts from the round as it is each time. */
export function LineupSheet({ round, onClose }) {
  const { showToast } = useUI();
  const kind = lineupKind(round);
  const game = round.game;
  const main = gameView(round, 'main');
  const first = id => round.players.find(p => p.id === id)?.name.split(' ')[0] || '?';
  const names = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const now = orderNow(round);
  const [ids, setIds] = useState(now.ids);
  const [groups, setGroups] = useState(() => teamGroups(round));
  const [who, setWho] = useState(round.settings.hammer?.who || 'either');
  const move = (i, d) => setIds(list => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return list; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const label = lineupLabel(round);
  const fromNext = game === 'banker' || game === 'wolf';
  const nextNo = now.idx >= 0 ? round.holes[now.idx].no : null;
  const locked = kind === 'teams' ? teamsLocked(round) : null;
  const problem = kind === 'teams' && !locked ? teamsChangeProblem(round, groups) : null;
  // The split itself is checked under the team letters; a side bet that needs two apart is said here
  const betClash = problem && !teamsProblem(game, groups, main.players.map(p => p.id)) ? problem : null;
  const build = r => {
    let next = r;
    if (kind === 'order') next = changeOrder(next, ids);
    if (kind === 'teams' && !locked) next = changeTeams(next, groups);
    if (game === 'hammer') next = changeHammerWho(next, who);
    return next;
  };
  const after = build(round);
  const same = after === round;
  const money = same ? null : moneyLine(round, after);
  const orderChanged = kind === 'order' && after.players !== round.players;
  const runs = fromNext ? orderRuns(after).slice(0, 4) : [];
  const banker = main.settings.banker || {};
  const rotates = game === 'wolf' || (game === 'banker' && banker.rotation !== 'low' && banker.rotation !== 'choice');
  const role = game === 'banker' ? 'banks' : 'is the wolf';
  // A fixed banker, or a banker each nine with one nine left: the first name banks every hole still to play
  const oneBanker = game === 'banker' && (banker.rotation === 'fixed' || (banker.rotation === 'nine' && (now.idx >= 9 || round.holes.length <= 9)));

  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      if (!r) return;
      const next = build(r);
      // The Banker and Wolf order is listed on the rules card with the hole it starts from
      if (fromNext && next.players !== r.players && nextNo != null) {
        const agreed = logChange(next, `${label} from hole ${nextNo}: ${ids.map(first).join(', ')}`, nextNo);
        if (agreed) next.agreed = agreed;
      }
      s.rounds[round.id] = next;
    });
    onClose();
    showToast(fromNext && orderChanged ? `${label} set from hole ${nextNo}. The holes played keep theirs.`
      : kind === 'teams' && after.teams !== round.teams ? `${label} updated. Every hole is worked out again.`
        : game === 'sixes' ? 'Partners updated. Every hole is worked out again.'
          : 'First hammer rule updated.');
    buzz(20);
  };

  const lede = kind === 'teams'
    ? (locked || 'A change here counts for the whole round, holes already played too.')
    : game === 'sixes' ? 'Partners count for the whole round, holes already played too. Everyone partners everyone once, so the order sets who’s with who on each stretch.'
      : !fromNext ? null
        : nextNo == null ? 'Every hole has been played, so there’s no hole left for a new order.'
          : oneBanker ? `From hole ${nextNo} on: the first name banks every hole left. Holes already played keep their banker.`
          : game === 'banker' && banker.rotation === 'nine' ? `From hole ${nextNo} on: the first name banks the rest of this nine, the next name the nine after. Holes already played keep their banker.`
          : rotates ? `From hole ${nextNo} on: the first name ${role} on hole ${nextNo}, then down the list. Holes already played keep their ${game === 'banker' ? 'banker' : 'wolf'}.`
            : banker.rotation === 'low' ? `From hole ${nextNo} on. The lowest score on the last hole banks the next, and the order settles a tie. Holes already played keep their banker.`
              : `From hole ${nextNo} on. The banker is picked at each hole, and the order is how the card lists everyone. Holes already played keep their banker.`;
  // Only said when there's something to say: a round with no presses, or no hammer thrown, has none to move
  const presses = round.presses || [];
  const pressNote = pressesOn(game) && kind === 'teams' && !locked && (presses.length || pressMode(round) === 'auto')
    ? (presses.some(p => !p.auto) ? 'Auto presses are worked out again for the new sides. A press someone called stays with its side.' : 'Auto presses are worked out again for the new sides.')
    : game === 'hammer' && kind === 'teams' && Object.values(round.marks || {}).some(m => m?.hammers?.length) ? 'Hammers already thrown stay with their side of the card, the first or the second.' : null;

  return (
    <Sheet open onClose={onClose} title={kind ? label : 'First hammer'} className="sc-sheet">
      {lede && <p className="sheet-text">{lede}</p>}

      {kind === 'teams' && groups && (
        locked
          ? <p className="field-help" style={{ padding: '0 20px' }}>{groups.map((g, i) => `${'ABCD'[i]}: ${g.map(first).join(' & ')}`).join(' · ')}</p>
          : <TeamPicker game={game} picked={main.players.map(p => p.id)} names={names} teams={groups} setTeams={setGroups} />
      )}
      {betClash && <p className="hint-card warn"><Icon name="warning" fill /> {betClash}</p>}
      {pressNote && <p className="field-help" style={{ padding: '0 20px' }}>{pressNote}</p>}

      {kind === 'order' && (nextNo != null || game === 'sixes') && (
        <>
          <div className="sec-label">{game === 'sixes' ? 'Order: sets who partners who' : `From hole ${nextNo}`}</div>
          {ids.map((pid, i) => (
            <div key={pid} className="set-row static">
              <div className="order-num">{i + 1}</div>
              <div className="row-main set-name">{names[pid]}</div>
              <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${first(pid)} up`}><Icon name="caret-up" /></button>
              <button className="icon-btn sm" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${first(pid)} down`}><Icon name="caret-down" /></button>
            </div>
          ))}
          {game === 'sixes' && <SixesPreview names={ids.map(first)} holesCount={round.holes.length} />}
          {runs.length > 0 && (
            <div className="block lineup-runs" aria-label={game === 'banker' ? 'Who banks next' : 'Who’s the wolf next'}>
              {runs.map(r => (
                <div key={r.from} className="lineup-run"><span className="lineup-holes">{runLabel(r)}</span><span>{first(r.id)} {role}</span></div>
              ))}
              {orderRuns(after).length > runs.length && <div className="lineup-run more">Then round again in this order</div>}
            </div>
          )}
        </>
      )}

      {game === 'hammer' && (
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Who throws the first hammer</div>
          <Segmented label="Who throws the first hammer" className="press-mode-row" btn="pm-btn" value={who} onChange={setWho}
            options={[{ value: 'either', label: 'Either side' }, { value: 'trailing', label: 'Side behind' }]} />
          <p className="field-help">{who === 'trailing'
            ? 'Only the side behind can throw the first hammer on a hole (either side when it’s level). It counts for every hole, and only decides who may hammer, never the money.'
            : 'Either side can throw the first hammer. Then it goes back and forth. It counts for every hole, and only decides who may hammer, never the money.'}</p>
        </div>
      )}

      {!same && (
        <div className="hint-card fix-impact" role="status">
          <Icon name="scales" fill />
          <div>
            <div className="eyebrow">What this changes</div>
            <p><strong>{money || `${countsMoney(round) ? 'No money moves' : 'No points move'}${fromNext ? `: the holes played keep their ${game === 'banker' ? 'banker' : 'wolf'}.` : '.'}`}</strong></p>
          </div>
        </div>
      )}
      <div className="cta-wrap">
        <button className="full-btn" disabled={same} onClick={apply}>
          {same ? 'No change yet' : fromNext && orderChanged ? <>Save from hole {nextNo} <Icon name="check" /></> : <>Save for the whole round <Icon name="check" /></>}
        </button>
      </div>
    </Sheet>
  );
}
