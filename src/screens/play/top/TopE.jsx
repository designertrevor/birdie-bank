// Trial top E, "Say it plainly": the top is a couple of sentences, not a dashboard. "Hole 3, par 4."
// as the headline, what's riding as the next line ("1 skin, $6 riding."), and the money grouped into
// one line ("Dev +$12 · Trevor, Jackson and Marcus −$4"). The idea it tests: a sentence reads at a
// glance where a grid of labels and numbers has to be scanned.
// Pinned: the sentences and the money line stay put; the game's panel (pickers, tiles) scrolls away.
import { Icon } from '../../../components/ui.jsx';
import { useMoneyStrip } from '../useMoneyStrip.jsx';
import { skinsWorth, strokesHere } from '../hole-info.js';
import { holeStakes, listWords } from './stakes.js';
import { Amount } from './MoneyNums.jsx';
import './top-shared.css';
import './top-e.css';

export function Pinned(t) {
  const { round, hole, units, solo, holeFixed } = t;
  const m = useMoneyStrip(t);
  const s = holeStakes(t);
  const getting = strokesHere(round, hole, units, solo);
  // Everyone with the same total in one group, the best first
  const groups = [];
  for (const r of [...m.rows].sort((a, b) => b.v - a.v)) {
    const g = groups.find(x => x.v === r.v);
    if (g) g.rows.push(r); else groups.push({ v: r.v, rows: [r] });
  }
  return (
    <div className="te">
      <div className="te-row">
        <p className="te-hole">Hole {hole.no}, par {hole.par}.</p>
        <button type="button" className="te-card" onClick={t.openCard} aria-label={holeFixed ? `Open scorecard. Hole ${hole.no}’s par or HCP was fixed for this round` : 'Open scorecard'}><Icon name="table" /> Card</button>
      </div>
      {s.sentence && <p className="te-stake">{s.sentence}</p>}
      <p className="te-meta">
        HCP {hole.hdcp ?? '–'}{holeFixed && ' (fixed)'}
        {getting && (getting.length ? <> · <span className="stroke-dots" aria-hidden="true">●</span> {getting.length > 3 ? `${getting.length} players get a stroke` : `${listWords(getting)} ${getting.length > 1 ? 'get' : 'gets'} a stroke`}</> : ' · No strokes here')}
      </p>
      <button type="button" className="te-money" aria-haspopup="dialog" onClick={m.show} aria-label={m.label}>
        {/* Each group wraps as one piece, so a name never lands on a line apart from its amount */}
        <span className="te-line">
          {groups.map((g, i) => (
            <span key={g.v} className="te-group">
              <span className={g.v > 0 && i === 0 ? 'te-lead' : ''}>{listWords(g.rows.map(r => r.name))}</span>{' '}
              <Amount m={m} r={{ ...g.rows[0], changed: g.rows.some(r => r.changed) }} />
            </span>
          ))}
        </span>
        <Icon name="caret-down" className="te-more" />
      </button>
      {m.sheet}
    </div>
  );
}

export function Head(t) {
  // The sentence says what a skin is worth; who's won what and the price to change it are the detail
  const w = t.game === 'skins' ? skinsWorth(t.main, t.hole) : null;
  return (
    <div className="te-game">
      {w && (
        <p className="te-won">
          <span>Skins won: {w.won.filter(x => x.n).map(x => `${x.name} ${x.n}`).join(' · ') || 'none yet'}</span>
          {t.editable && <button type="button" className="te-price" onClick={t.openBets}>{w.price}</button>}
        </p>
      )}
      {t.panels({ noSkins: true })}
    </div>
  );
}
