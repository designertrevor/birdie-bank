import { useEffect, useRef, useState } from 'react';
import { Empty, Header, Icon, Screen, useUI } from '../components/ui.jsx';
import { update, useStore } from '../lib/store.js';
import { GAMES, holeAtPos, holeComplete, roundLegs, roundResults, scoreSummary, scorers, sideNames, skinsTable } from '../lib/round.js';
import { matchLabel } from '../lib/games.js';
import { money } from '../lib/golf.js';
import { confettiFrom } from '../lib/delight.js';
import { useNav } from '../lib/nav.js';
import { meFor, roundDate, roundPlayerName, shareRound } from '../lib/format.js';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import { SignInSheet } from '../components/Account.jsx';

export default function RoundDetail({ id, celebrate }) {
  const nav = useNav();
  const { ask, showToast } = useUI();
  const state = useStore();
  const round = state.rounds[id];
  const hero = useRef();
  const acct = useAccount();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (celebrate && hero.current) setTimeout(() => confettiFrom(hero.current, 70), 250);
  }, [celebrate]);

  if (!round) {
    return <Screen><Header title="Round" onBack={nav.pop} /><Empty title="Round not found" text="It may have been deleted." /></Screen>;
  }
  const res = roundResults(round);
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  const top = res.standings[0];
  const meRow = res.standings.find(p => p.id === meFor(round, state));
  const tie = res.standings.filter(p => p.amount === top.amount).length > 1;
  const allSquare = res.standings.every(p => p.amount === 0);

  const del = async () => {
    if (!(await ask({ title: 'Delete this round?', text: 'It’ll be removed from History and the Ledger.', confirmLabel: 'Delete round', danger: true }))) return;
    update(s => {
      delete s.rounds[id];
      if (s.activeRoundId === id) s.activeRoundId = null;
      s.settlements = s.settlements.filter(x => x.roundId !== id);
    });
    nav.reset('history');
  };
  const edit = async () => {
    const s = state;
    if (s.activeRoundId && s.activeRoundId !== id) { showToast('Finish your current round first'); return; }
    update(st => { st.rounds[id].status = 'active'; st.activeRoundId = id; st.rounds[id].current = 0; });
    nav.reset('history', ['play', { id }]);
  };

  let heroTitle, heroAmt;
  if (allSquare) { heroTitle = 'All square'; heroAmt = '$0'; }
  else if (tie) { heroTitle = `${res.standings.filter(p => p.amount === top.amount).map(p => p.name).join(' & ')} tie for top`; heroAmt = money(top.amount, { sign: true }); }
  else { heroTitle = `${top.name} takes the pot`; heroAmt = money(top.amount, { sign: true }); }

  return (
    <Screen>
      <Header title={celebrate ? 'Final results' : 'Round'} onBack={celebrate ? undefined : nav.pop} small
        right={<button className="header-btn" onClick={() => shareRound(round, res, showToast)}><Icon name="share-network" /> Share</button>} />
      <div className="scroll">
        <div className="winner-hero" ref={hero}>
          <Icon name={allSquare ? 'handshake' : 'crown'} fill className="crown" />
          <div className="wn">{heroTitle}</div>
          <div className="wa">{heroAmt}</div>
          <div className="ws">{round.course.name} · {roundDate(round)} · {GAMES[round.game].name} · {played === round.holes.length ? `${played} holes` : `${played} of ${round.holes.length} holes`}</div>
          {meRow && meRow.id !== top.id && !allSquare && <div className="me-line">You: {money(meRow.amount, { sign: true })}</div>}
        </div>

        {accountsEnabled && !acct.user && round.status === 'done' && (
          <button className="set-row" onClick={() => setSigningIn(true)}>
            <div className="set-icon"><Icon name="cloud-arrow-up" fill /></div>
            <div className="row-main"><div className="set-name">{meRow && meRow.amount > 0 ? `You won ${money(meRow.amount)}. Save it to your tab` : 'Save this round to your account'}</div><div className="set-sub">Free. Keeps your rounds and tab safe on any device.</div></div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        )}

        <div className="sec-label">Standings</div>
        {res.standings.map((p, i) => (
          <div key={p.id} className="settle-row">
            <div className="sr">{i + 1}</div>
            <div className="sn">{p.name}{p.plays ? <span className="li-sub"> · got {p.plays}</span> : null}</div>
            <div className={`sa ${p.amount > 0 ? 'pos' : p.amount < 0 ? 'neg' : ''}`}>{money(p.amount, { sign: true })}</div>
          </div>
        ))}

        <div className="sec-label">Who pays who</div>
        <div style={{ padding: '0 16px' }}>
          {res.transfers.length === 0 && <p className="hint-card" style={{ margin: 0 }}><Icon name="handshake" fill /> Nobody owes anybody. Beers are on whoever lost the match.</p>}
          {res.transfers.map(t => (
            <div key={t.from + t.to} className="pay-row">
              <span className="pf">{roundPlayerName(round, t.from)}</span><span className="pa"><Icon name="arrow-right" /></span><span className="pt">{roundPlayerName(round, t.to)}</span>
              <span className="pm">{money(t.amount)}</span>
            </div>
          ))}
          {res.transfers.length > 0 && <p className="field-help" style={{ padding: '0 4px' }}>Fewest payments to square everyone up. Track them in the Ledger.</p>}
        </div>

        <GameBreakdown round={round} res={res} />

        <div className="sec-label">Scorecard</div>
        <Scorecard round={round} />

        <div className="detail-actions">
          <button className="full-btn outline" onClick={edit}><Icon name="pencil-simple" /> Edit scores</button>
          <button className="danger-link" onClick={del}><Icon name="trash" /> Delete round</button>
        </div>
      </div>
      {celebrate && (
        <div className="cta-wrap">
          <button className="full-btn" onClick={() => nav.reset('ledger')}><Icon name="receipt" /> Settle up in the Ledger</button>
          <button className="full-btn outline" onClick={() => nav.reset('history')}>Done</button>
        </div>
      )}
      {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} />}
    </Screen>
  );
}

function GameBreakdown({ round, res }) {
  const names = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const first = n => (n || '').split(' ')[0];
  if (round.game === 'nassau' || round.game === 'match') {
    const LEGS = roundLegs(round);
    const sn = sideNames(round);
    return (
      <>
        <div className="sec-label">Bets{round.teams ? ` · ${sn[0]} v ${sn[1]}` : ''}</div>
        {res.detail.lines.map(l => {
          const s = l.status;
          const who = s.leader === null ? (s.left === 0 ? 'Halved' : 'All square') : matchLabel(s, sn[s.leader]);
          return (
            <div key={l.key} className="leg-row">
              <div className="leg-name">{l.press ? 'Press' : LEGS[l.leg].label}</div>
              <div className={`leg-winner ${s.leader === null ? 'leg-tie' : ''}`}>{l.press ? `${round.game === 'nassau' ? `${LEGS[l.leg].label} ` : ''}from H${holeAtPos(round, l.start)} · ` : ''}{who}</div>
              <div className={`leg-amt ${l.value === 0 ? 'zero' : ''}`}>{money(Math.abs(l.value))}</div>
            </div>
          );
        })}
      </>
    );
  }
  if (round.game === 'vegas') {
    const rows = res.detail.vegas.filter(r => r.played);
    const t = round.teams;
    return (
      <>
        <div className="sec-label">Hole by hole · {money(round.settings.vegas.point)} a point</div>
        <div className="money-table-wrap">
          <table className="sc-table money-table">
            <thead><tr><th style={{ textAlign: 'left', paddingLeft: 12 }}>Hole</th><th>{t[0].name}</th><th>{t[1].name}</th><th>Points</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.hole.no}>
                  <td>{r.hole.no}</td>
                  <td className={r.flipped[0] ? 'neg' : ''}>{r.numbers[0]}{r.flipped[0] ? ' ↺' : ''}</td>
                  <td className={r.flipped[1] ? 'neg' : ''}>{r.numbers[1]}{r.flipped[1] ? ' ↺' : ''}</td>
                  <td className={r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : 'zero'}>{r.diff === 0 ? '·' : `${r.diff > 0 ? t[0].name : t[1].name} +${Math.abs(r.diff)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.some(r => r.flipped.some(Boolean)) && <p className="field-help" style={{ padding: '0 20px' }}>↺ number flipped by the other team’s birdie.</p>}
      </>
    );
  }
  if (round.game === 'sixes') {
    const pair = side => side.map(pid => first(names[pid])).join(' & ');
    return (
      <>
        <div className="sec-label">Three matches</div>
        {res.detail.matches.map(m => {
          const s = m.status;
          const who = !s.played ? 'Not played' : s.leader === null ? (s.left === 0 ? 'Halved' : 'All square') : matchLabel(s, pair(m.sides[s.leader]));
          return (
            <div key={m.index} className="leg-row">
              <div className="leg-name">{m.seg.label}</div>
              <div className={`leg-winner ${s.leader === null ? 'leg-tie' : ''}`}>{pair(m.sides[0])} v {pair(m.sides[1])} · {who}</div>
              <div className={`leg-amt ${m.net === 0 ? 'zero' : ''}`}>{money(Math.abs(m.net))}</div>
            </div>
          );
        })}
      </>
    );
  }
  if (round.game === 'scramble' || round.game === 'stroke' || round.game === 'stableford' || round.game === 'quota') {
    const rows = res.detail.totals;
    const fmt = x => {
      if (round.game === 'quota') return `${x.total} pts · quota ${x.quota} · ${x.vsQuota > 0 ? '+' : ''}${x.vsQuota}`;
      if (round.game === 'stableford') return `${x.total} pts`;
      return `Net ${x.total} · ${x.toPar === 0 ? 'E' : x.toPar > 0 ? `+${x.toPar}` : x.toPar}`;
    };
    const lowerWins = round.game === 'stroke' || round.game === 'scramble';
    const sorted = [...rows].sort((a, b) => (lowerWins ? a.total - b.total : round.game === 'quota' ? b.vsQuota - a.vsQuota : b.total - a.total));
    return (
      <>
        <div className="sec-label">{round.game === 'scramble' ? 'Team totals' : 'Totals'}</div>
        {sorted.map((x, i) => (
          <div key={x.id} className="leg-row">
            <div className="leg-name">{i + 1}</div>
            <div className="leg-winner">{x.name}{round.game === 'scramble' ? <span className="li-sub"> · {round.teams.find(t => t.id === x.id)?.players.map(pid => first(names[pid])).join(', ')}</span> : null}</div>
            <div className="leg-amt">{x.played ? fmt(x) : '–'}</div>
          </div>
        ))}
      </>
    );
  }
  if (round.game === 'nines' || round.game === 'bbb' || round.game === 'dots') {
    const rows = res.detail.rows;
    const unit = round.game === 'dots' ? 'dots' : 'points';
    return (
      <>
        <div className="sec-label">{unit === 'dots' ? 'Dots' : 'Points'} by hole</div>
        {rows.length === 0 && <p className="hint-card"><Icon name="info" fill /> Nothing scored yet.</p>}
        {rows.length > 0 && (
          <div className="money-table-wrap">
            <table className="sc-table money-table">
              <thead><tr><th style={{ textAlign: 'left', paddingLeft: 12 }}>Hole</th>{round.players.map(p => <th key={p.id}>{first(p.name)}</th>)}</tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.hole.no}><td>{r.hole.no}</td>{round.players.map(p => <td key={p.id} className={r.points[p.id] ? 'pos' : 'zero'}>{r.points[p.id] || '·'}</td>)}</tr>
                ))}
                <tr><td><strong>Total</strong></td>{round.players.map(p => <td key={p.id}><strong>{res.detail.points[p.id]}</strong></td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }
  if (round.game === 'rabbit') {
    return (
      <>
        <div className="sec-label">Who had the rabbit</div>
        {res.detail.rabbit.legs.map(l => (
          <div key={l.seg.label} className="leg-row">
            <div className="leg-name">{l.seg.label}</div>
            <div className={`leg-winner ${!l.holder ? 'leg-tie' : ''}`}>{!l.done ? (l.holder ? `${names[l.holder]} holds it` : 'Loose') : l.holder ? `${names[l.holder]} held it at the end` : 'Loose at the end, no payout'}</div>
            <div className={`leg-amt ${l.done && l.holder ? '' : 'zero'}`}>{money(round.settings.rabbit.stake * (round.players.length - 1))}</div>
          </div>
        ))}
      </>
    );
  }
  if (round.game === 'skins') {
    const t = skinsTable(round);
    const won = t.rows.filter(r => r.winner);
    return (
      <>
        <div className="sec-label">Skins won</div>
        {won.length === 0 && <p className="hint-card"><Icon name="coins" fill /> No skins won. Every hole was tied.</p>}
        {won.map(r => (
          <div key={r.hole.no} className="leg-row">
            <div className="leg-name">H{r.hole.no}</div>
            <div className="leg-winner">{names[r.winner]}</div>
            <div className="leg-amt">{r.skins} skin{r.skins > 1 ? 's' : ''}</div>
          </div>
        ))}
        {t.unclaimed > 0 && <p className="field-help" style={{ padding: '0 20px' }}>{t.unclaimed} skin{t.unclaimed > 1 ? 's' : ''} still carried over at the end, unclaimed.</p>}
      </>
    );
  }
  if (round.game === 'banker' || round.game === 'wolf' || round.game === 'aces') {
    const col = h => {
      if (round.game === 'banker') return first(names[h.banker]);
      if (round.game === 'aces') return [h.ace && `${first(names[h.ace])} ace`, h.deuce && `${first(names[h.deuce])} deuce`].filter(Boolean).join(' · ') || '·';
      return round.wolf[h.no]?.partner === null ? `${first(names[round.wolf[h.no].wolf])} (lone)` : first(names[round.wolf[h.no]?.wolf]);
    };
    return (
      <>
        <div className="sec-label">Hole by hole</div>
        <div className="money-table-wrap">
          <table className="sc-table money-table">
            <thead><tr><th style={{ textAlign: 'left', paddingLeft: 12 }}>Hole</th><th>{{ banker: 'Banker', wolf: 'Wolf', aces: 'Ace / deuce' }[round.game]}</th>{round.players.map(p => <th key={p.id}>{p.name.split(' ')[0]}</th>)}</tr></thead>
            <tbody>
              {res.detail.holes.map(h => (
                <tr key={h.no}>
                  <td>{h.no}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{col(h)}</td>
                  {round.players.map(p => { const v = h.deltas[p.id]; return <td key={p.id} className={v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}>{v ? money(v, { sign: true }) : '·'}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  return null;
}

/** Gross scorecard, one column per hole. onHole makes columns tappable. */
export function Scorecard({ round, current, onHole }) {
  const out = round.holes;
  const cls = (g, par) => (g === 'X' ? 'pu' : g <= par - 2 ? 'eagle' : g === par - 1 ? 'birdie' : g === par + 1 ? 'bogey' : g >= par + 2 ? 'dbl' : '');
  return (
    <div className="sc-wrap">
      <table className="sc-table scorecard">
        <thead>
          <tr>
            <th className="sticky">Hole</th>
            {out.map(h => (
              <th key={h.no} className={h.no === current ? 'cur' : ''}>
                {onHole ? <button className="sc-col-btn" onClick={() => onHole(h.no)} aria-label={`Go to hole ${h.no}`}>{h.no}</button> : h.no}
              </th>
            ))}
            <th>Tot</th>
          </tr>
          <tr className="par-row"><td className="sticky">Par</td>{out.map(h => <td key={h.no}>{h.par}</td>)}<td>{round.par}</td></tr>
        </thead>
        <tbody>
          {scorers(round).map(p => {
            const sum = scoreSummary(round, p.id);
            return (
              <tr key={p.id}>
                <td className="sticky">{p.name.split(' ')[0]}</td>
                {out.map(h => {
                  const g = round.scores[h.no]?.[p.id];
                  return <td key={h.no} className={`${h.no === current ? 'cur' : ''}`}>{g == null ? <span className="empty-dot">·</span> : <span className={`sc-mark ${cls(g, h.par)}`}>{g}</span>}</td>;
                })}
                <td className="tot">{sum.played ? sum.gross : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sc-legend"><span className="sc-mark birdie">3</span> birdie <span className="sc-mark eagle">2</span> eagle <span className="sc-mark bogey">5</span> bogey <span className="sc-mark pu">X</span> picked up</div>
    </div>
  );
}
