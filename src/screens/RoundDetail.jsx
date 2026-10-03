import { Fragment, useEffect, useRef, useState } from 'react';
import { Empty, Header, Icon, Screen, useUI } from '../components/ui.jsx';
import { getState, update, useStore } from '../lib/store.js';
import { GAMES, gameView, holeAtPos, holeComplete, playsHole, roundLegs, roundNotes, roundResults, scoreSummary, scorers, sideNames, skinsKinds, skinsTable, popsFor, netFor } from '../lib/round.js';
import { halfStrokesOn, netText, strokesWords } from '../lib/allowances.js';
import { matchLabel } from '../lib/games.js';
import { money } from '../lib/golf.js';
import { canEdit, keeperMe } from '../lib/keeper.js';
import { useNav } from '../lib/nav.js';
import { leaveRound } from '../lib/rounds.js';
import { gameLabel, meFor, placeOf, roundDate, roundPlayerName } from '../lib/format.js';
import { gamesLine } from '../lib/side-games.js';
import { betStretchLine } from '../lib/stakes.js';
import { ByGameTable } from '../components/SideGames.jsx';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import { SignInSheet } from '../components/Account.jsx';
import { HowWasIt, Reveal, RewardCard, SettleUp, ShareCard } from '../components/Finale.jsx';
import { TripRoundNote } from '../components/Trips.jsx';
import { countsMoney, playForOf, tabResults, unitFmt } from '../lib/play-for.js';
import { SaveUsualButton } from '../components/Usuals.jsx';
import { DrivesShortfall } from '../components/ScrambleDrives.jsx';
import { strokeKey } from '../lib/stroke-key.js';
import { getsStrokes, toParOf, toParText, toParTone, toParWords } from '../lib/to-par.js';
import { BetsBreakdown } from '../components/PairBets.jsx';
import { RoundWhereFrom } from '../components/WhereFrom.jsx';

// Where the finale was, so coming back from another screen (e.g. Suggest) doesn't replay the reveal.
// Keyed by round and its finish time, so finishing the round again starts over.
const finaleStage = new Map();

// The finale's beats in order, so a stage change knows which way to slide
const STAGE_ORDER = ['reveal', 'settle', 'share'];

export default function RoundDetail({ id, celebrate }) {
  const nav = useNav();
  const { ask } = useUI();
  const state = useStore();
  const round = state.rounds[id];
  const hero = useRef();
  const acct = useAccount();
  const [signingIn, setSigningIn] = useState(false);
  // Opening the results means the fixing is over, however you got here (the tab bar, History).
  // Only on arrival, so tapping Edit scores here doesn't undo itself on the way out.
  useEffect(() => {
    if (getState().rounds[id]?.editing) update(s => { delete s.rounds[id].editing; });
  }, [id]);
  // A round that just finished plays out in beats: reveal, settle up, share. The full breakdown is one tap away.
  const [stage, setStageRaw] = useState(() => {
    const saved = celebrate && finaleStage.get(id);
    return saved && saved.at === round?.finishedAt ? saved.stage : celebrate ? 'reveal' : 'detail';
  });
  // Which way the next beat slides in: on toward Share, or back toward the reveal
  const [stageBack, setStageBack] = useState(false);
  const setStage = s => {
    if (celebrate) finaleStage.set(id, { stage: s, at: round?.finishedAt });
    setStageBack(STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(stage));
    setStageRaw(s);
  };
  // Coming back to the reveal (from Settle up or Suggest) shows the end state instead of replaying it
  const [revealSeen, setRevealSeen] = useState(() => celebrate && finaleStage.get(id)?.at === round?.finishedAt);
  // Share from the saved round opens the same results image, and comes back here after
  const [shareFrom, setShareFrom] = useState(null);

  if (!round) {
    return <Screen><Header title="Round" onBack={nav.pop} /><Empty title="Round not found" text="It may have been deleted." /></Screen>;
  }
  const res = roundResults(round);
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  const top = res.standings[0];
  const meRow = res.standings.find(p => p.id === meFor(round, state));
  const tie = res.standings.filter(p => p.amount === top.amount).length > 1;
  const allSquare = res.standings.every(p => p.amount === 0);
  // A points or reward round is never money: amounts read as points and there's nobody to pay
  const fmt = unitFmt(round);
  const isMoney = countsMoney(round);
  // What goes on the Tab: the whole round, or a reward round's side bets for money alone (in dollars)
  const tab = tabResults(round, res);
  const pays = tab.transfers.length > 0;
  // A trip round has no settle up of its own: the trip is settled once, after its last round
  const ownSettle = pays && !round.trip?.id;

  const del = async () => {
    if (!(await ask({ title: 'Delete this round?', text: 'It’ll be removed from History and the tab.', confirmLabel: 'Delete round', danger: true }))) return;
    update(s => {
      delete s.rounds[id];
      leaveRound(s, id);
      s.settlements = s.settlements.filter(x => x.roundId !== id);
    });
    nav.reset('history');
  };
  // Fixing scores keeps the round finished, so it keeps counting on the tab while you edit.
  // Any other round in progress is left alone.
  const edit = () => {
    update(st => { const r = st.rounds[id]; if (r.status === 'done') r.editing = true; r.current = 0; });
    nav.reset('upnext', ['play', { id }]);
  };

  let heroTitle, heroAmt;
  if (allSquare) { heroTitle = 'All square'; heroAmt = fmt(0); }
  else if (tie) {
    // Partners who won together are one winning side, not a tie (same as the reveal)
    const leaders = res.standings.filter(p => p.amount === top.amount);
    const side = round.teams?.find(tm => tm.players.length === leaders.length && tm.players.every(pid => leaders.some(p => p.id === pid)));
    heroTitle = side ? `${side.name} win the day` : `${listNames(leaders.map(p => p.name.split(' ')[0]))} tie for top`;
    heroAmt = fmt(top.amount, { sign: true });
  }
  else { heroTitle = `${top.name} wins the day`; heroAmt = fmt(top.amount, { sign: true }); }

  const saveRow = accountsEnabled && !acct.user && round.status === 'done' && (
    <button className="set-row" onClick={() => setSigningIn(true)}>
      <div className="set-icon"><Icon name="cloud-arrow-up" fill /></div>
      <div className="row-main"><div className="set-name">{isMoney && meRow && meRow.amount > 0 ? `You won ${money(meRow.amount)}. Save it to your tab` : 'Save this round to your account'}</div><div className="set-sub">Free. Keeps your rounds and tab safe on any device.</div></div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  const done = () => { finaleStage.delete(id); nav.reset('history'); };
  // Who left and which holes didn't count, said plainly so nobody wonders where the money went
  const notes = roundNotes(round);
  const notesEl = notes.length > 0 && (
    <div style={{ marginTop: 12 }}>
      {notes.map(n => <p key={n.text} className="hint-card"><Icon name={n.kind === 'left' ? 'user-minus' : n.kind === 'joined' ? 'user-plus' : 'warning'} fill /> {n.text}</p>)}
    </div>
  );
  if (stage !== 'detail') {
    return (
      <Screen key={stage} className={`finale-stage ${stageBack ? 'back' : ''}`}>
        {stage === 'reveal' && <Reveal round={round} res={res} instant={revealSeen} onNext={() => { setRevealSeen(true); setStage(ownSettle ? 'settle' : 'share'); }} onDetail={() => { setRevealSeen(true); setStage('detail'); }} extra={<>{round.trip?.id && <div style={{ marginTop: 12 }}><TripRoundNote round={round} /></div>}{notesEl}{saveRow && <div style={{ marginTop: 12 }}>{saveRow}</div>}</>} />}
        {stage === 'settle' && <SettleUp round={round} res={tab} onBack={() => setStage('reveal')} onNext={() => setStage('share')} />}
        {stage === 'share' && (shareFrom === 'detail'
          ? <ShareCard round={round} res={res} onBack={() => setStage('detail')} onDone={() => setStage('detail')} doneLabel="Back to the round" />
          : <ShareCard round={round} res={res} onBack={() => setStage(ownSettle ? 'settle' : 'reveal')} onDone={done} />)}
        {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} />}
      </Screen>
    );
  }

  // In a scramble the team gets the strokes, not each player
  const strokesNote = p => {
    const team = round.game === 'scramble' && round.teams?.find(t => t.players.includes(p.id));
    const n = team ? team.plays || 0 : p.plays;
    if (!n) return null;
    return <span className="li-sub"> · {team ? 'team got' : 'got'} {strokesWords(n, halfStrokesOn(round))}</span>;
  };

  return (
    <Screen>
      <Header title={celebrate ? 'Final results' : 'Round'} onBack={celebrate ? undefined : nav.pop} small
        right={<button className="header-btn" onClick={() => { setShareFrom('detail'); setStage('share'); }}><Icon name="share-network" /> Share</button>} />
      <div className="scroll">
        <div className="winner-hero" ref={hero}>
          <Icon name={allSquare ? 'handshake' : 'crown'} fill className="crown" />
          <div className="wn">{heroTitle}</div>
          <div className="wa">{heroAmt}</div>
          <div className="ws">{round.course.name} · {roundDate(round)} · {gameLabel(round)} · {played === round.holes.length ? `${played} holes` : `${played} of ${round.holes.length} holes`}</div>
          {meRow && meRow.id !== top.id && !allSquare && <div className="me-line">You: {fmt(meRow.amount, { sign: true })}</div>}
        </div>

        {round.trip?.id && <TripRoundNote round={round} />}
        {notesEl}
        {saveRow}

        <div className="sec-label">Standings</div>
        {res.standings.map((p, i) => (
          <div key={p.id} className="settle-row">
            <div className="sr">{placeOf(res.standings, i)}</div>
            <div className="sn">{p.name}{strokesNote(p)}{res.detail.byGame && <span className="rv-games">{gamesLine(res.detail.byGame, p.id, fmt)}</span>}</div>
            <div className={`sa ${p.amount > 0 ? 'pos' : p.amount < 0 ? 'neg' : ''}`}>{fmt(p.amount, { sign: true })}</div>
          </div>
        ))}

        {!isMoney && (
          <>
            <div className="sec-label">{playForOf(round).kind === 'reward' ? 'The reward' : 'Bragging rights'}</div>
            <div style={{ padding: '0 16px' }}>
              {playForOf(round).kind === 'reward'
                ? <RewardCard round={round} res={res} />
                : <p className="hint-card" style={{ margin: 0 }}><Icon name="trophy" fill /> Played for points, so nothing goes on the Tab. Just bragging rights.</p>}
            </div>
          </>
        )}
        {/* A reward round's side bets for money: dollars on the Tab, apart from the reward's points */}
        {!isMoney && res.cash && <>
        <div className="sec-label">Side bets for money</div>
        <div style={{ padding: '0 16px' }}>
          {tab.transfers.length === 0 && <p className="hint-card" style={{ margin: 0 }}><Icon name="handshake" fill /> The money bets came out square. Nothing goes on the Tab.</p>}
          {tab.transfers.map(t => (
            <div key={t.from + t.to} className="pay-row">
              <span className="pf">{roundPlayerName(round, t.from)}</span><span className="pa"><Icon name="arrow-right" /></span><span className="pt">{roundPlayerName(round, t.to)}</span>
              <span className="pm">{money(t.amount)}</span>
            </div>
          ))}
          {tab.transfers.length > 0 && <p className="field-help" style={{ padding: '0 4px' }}>Only the side bets played for money. They’re on the Tab until marked paid; the points above decide the reward.</p>}
        </div>
        </>}
        {isMoney && <>
        <div className="sec-label">Who pays who</div>
        <div style={{ padding: '0 16px' }}>
          {res.transfers.length === 0 && <p className="hint-card" style={{ margin: 0 }}><Icon name="handshake" fill /> Nobody owes anybody. First round’s on whoever three-putted last.</p>}
          {res.transfers.map(t => (
            <div key={t.from + t.to} className="pay-row">
              <span className="pf">{roundPlayerName(round, t.from)}</span><span className="pa"><Icon name="arrow-right" /></span><span className="pt">{roundPlayerName(round, t.to)}</span>
              <span className="pm">{money(t.amount)}</span>
            </div>
          ))}
          {res.transfers.length > 0 && <p className="field-help" style={{ padding: '0 4px' }}>{round.trip?.id
            ? `Fewest payments for this round alone. It’s on the trip, so it’s settled once with the trip’s other rounds, and it’s on the tab until then.`
            : 'Fewest payments to square everyone up. They’re on the tab until marked paid.'}</p>}
        </div>
        </>}

        <HowWasIt round={round} />

        {res.detail.byGame && (
          <>
            <div className="sec-label">By game</div>
            <ByGameTable round={round} byGame={res.detail.byGame} total={res.balances} fmt={fmt} />
          </>
        )}
        {/* A reward round's side bets for money get their own table, in dollars, never added to the points */}
        {res.cash && (
          <>
            {!res.detail.byGame && <div className="sec-label">By game</div>}
            <p className="field-help pad">{res.detail.byGame ? 'Above in points. ' : ''}Side bets for money, in dollars:</p>
            <ByGameTable round={round} byGame={{ cash: { label: res.cash.label, balances: res.cash.balances } }} total={res.cash.balances} fmt={money} caption="Side bets for money" />
          </>
        )}

        <GameBreakdown round={round} res={res} />
        {/* Each side game's own breakdown, worked out on its own like the main game */}
        {Object.entries(res.detail.byGame || {}).filter(([key]) => key !== 'main' && key !== 'bets').map(([key, g]) => (
          <Fragment key={key}>
            <GameBreakdown round={gameView(round, key)} res={{ detail: g.detail }} label={g.label} />
            {/* A side game whose bet changed mid-round: what each stretch of holes was played for */}
            {betStretchLine(round, key) && <p className="field-help pad">{betStretchLine(round, key)}</p>}
          </Fragment>
        ))}

        <BetsBreakdown round={round} res={res} />
        <RoundWhereFrom round={round} res={res} />
        {/* ...and for a reward round's side bets for money, what's between each pair in dollars */}
        {!isMoney && res.cash && <RoundWhereFrom round={round} res={tab} fmt={money} title="Where the money comes from" />}

        <div className="sec-label">Scorecard</div>
        <Scorecard round={round} />

        <div className="detail-actions">
          {round.status === 'done' && GAMES[round.game] && (
            <button className="full-btn" onClick={() => nav.push('newRound', { rematch: id })}><Icon name="arrow-counter-clockwise" /> Run it back</button>
          )}
          {round.status === 'done' && !round.localMe && round.shared?.host !== false && <SaveUsualButton round={round} />}
          {canEdit(round, keeperMe(round, state), !!round.shared?.host) && <button className="full-btn outline" onClick={edit}><Icon name="pencil-simple" /> Edit scores</button>}
          <button className="danger-link" onClick={del}><Icon name="trash" /> Delete round</button>
        </div>
      </div>
      {celebrate && (
        <div className="cta-wrap">
          {ownSettle && <button className="full-btn" onClick={() => setStage('settle')}><Icon name="receipt" /> Settle up</button>}
          <button className="full-btn outline" onClick={done}>Done</button>
        </div>
      )}
      {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} />}
    </Screen>
  );
}

function GameBreakdown({ round, res, label = null }) {
  // The bets in the round's own unit: points for a points or reward round
  const money = unitFmt(round);
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
    // After a bet change the point value differs from hole to hole, so the header names each value
    const points = [...new Set(rows.map(r => r.point ?? round.settings.vegas.point))];
    const perPoint = points.length > 1 ? points.map(money).join(' then ') : money(points[0] ?? round.settings.vegas.point);
    return (
      <>
        <div className="sec-label">Hole by hole · {perPoint} a point</div>
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
          const who = m.off ? 'Off: a player left' : !s.played ? 'Not played' : s.leader === null ? (s.left === 0 ? 'Halved' : 'All square') : matchLabel(s, pair(m.sides[s.leader]));
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
      // A short round is measured against the quota for the holes played
      if (round.game === 'quota') return `${x.total} pts · quota ${x.target ?? x.quota} · ${x.vsQuota > 0 ? '+' : ''}${x.vsQuota}`;
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
            <div className="leg-amt">{x.played ? fmt(x) : '–'}{x.left && x.played ? <div className="li-sub">Left after {x.played} hole{x.played === 1 ? '' : 's'}</div> : null}</div>
          </div>
        ))}
        {round.game === 'scramble' && <DrivesShortfall round={round} done={round.status === 'done'} />}
      </>
    );
  }
  if (round.game === 'nines' || round.game === 'bbb' || round.game === 'dots') {
    const rows = res.detail.rows;
    const unit = round.game === 'dots' ? 'dots' : 'points';
    return (
      <>
        <div className="sec-label">{label || (unit === 'dots' ? 'Dots' : 'Points')} by hole</div>
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
            <div className={`leg-winner ${!l.pays ? 'leg-tie' : ''}`}>{!l.done ? (l.pays ? `${names[l.holder]} holds it` : 'Loose') : l.pays ? `${names[l.holder]} held it at the end` : 'Loose at the end, no payout'}</div>
            <div className={`leg-amt ${l.pays ? '' : 'zero'}`}>{money(l.pays ? l.amount : l.stake * (l.payers.length - 1))}</div>
          </div>
        ))}
      </>
    );
  }
  if (round.game === 'skins') {
    const kinds = skinsKinds(round);
    const both = kinds.length > 1;
    const pickPlayoff = (kind, pid) => update(st => {
      const r = st.rounds[round.id];
      r.skinsPlayoff = { ...(r.skinsPlayoff || {}), [kind]: r.skinsPlayoff?.[kind] === pid ? null : pid };
    });
    return kinds.map(kind => {
      const t = skinsTable(round, kind);
      const won = t.rows.filter(r => r.winner);
      // Usually one entry. With a late joiner, a carry from before they joined is claimed apart (see skinsTable)
      const ends = t.ends || (t.end ? [t.end] : []);
      const claimed = ends.some(e => e.winner || e.rule === 'split');
      return (
        <div key={kind}>
          <div className="sec-label">{both ? `${kind === 'net' ? 'Net' : 'Gross'} skins` : 'Skins won'}{label ? ' · side game' : ''}</div>
          {won.length === 0 && !claimed && <p className="hint-card"><Icon name="coins" fill /> No skins won. Every hole was tied.</p>}
          {won.map(r => (
            <div key={r.hole.no} className="leg-row">
              <div className="leg-name">H{r.hole.no}</div>
              <div className="leg-winner">{names[r.winner]}{r.canadian ? ' · natural birdie' : ''}{r.pending ? ' · to hold on the next hole' : ''}</div>
              <div className="leg-amt">{r.skins} skin{r.skins > 1 ? 's' : ''}</div>
            </div>
          ))}
          {/* Validate skins: a skin its winner didn't hold went back into the carry */}
          {t.rows.filter(r => r.lost).map(r => (
            <div key={`lost${r.hole.no}`} className="leg-row">
              <div className="leg-name">H{r.hole.no}</div>
              <div className="leg-winner">{first(names[r.lost])} didn’t hold it</div>
              <div className="leg-amt">back in</div>
            </div>
          ))}
          {ends.map((end, k) => (end.rule === 'split' || (end.rule === 'playoff' && end.tied.length === 1)) && (
            <div key={`end${k}`} className="leg-row">
              <div className="leg-name">H{end.row.hole.no}</div>
              <div className="leg-winner">{end.tied.length > 1 ? `Split: ${end.tied.map(pid => first(names[pid])).join(' & ')}` : `Carry to ${first(names[end.tied[0]])}`}</div>
              <div className="leg-amt">{end.skins} skin{end.skins > 1 ? 's' : ''}</div>
            </div>
          ))}
          {ends.map((end, k) => end.rule === 'playoff' && end.tied.length > 1 && (
            <div key={`off${k}`} className="block">
              <div className="eyebrow" style={{ marginBottom: 8 }}>Playoff for {end.skins} skin{end.skins > 1 ? 's' : ''}: who won it?</div>
              <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label={`Playoff for ${kind} skins`}>
                {end.tied.map(pid => (
                  <button key={pid} role="radio" aria-checked={end.winner === pid} className={`pill-btn sm ${end.winner === pid ? 'on' : ''}`} onClick={() => pickPlayoff(kind, pid)}>{first(names[pid])}</button>
                ))}
              </div>
              <p className="field-help">{end.winner ? `${first(names[end.winner])} takes the carried skins.` : 'Play a hole among the tied players, then tap who won it.'}</p>
            </div>
          ))}
          {t.unclaimed > 0 && !ends.some(e => e.rule === 'playoff' && e.tied.length > 1 && !e.winner) && <p className="field-help" style={{ padding: '0 20px' }}>{t.unclaimed} skin{t.unclaimed > 1 ? 's' : ''} still carried over at the end, unclaimed.</p>}
        </div>
      );
    });
  }
  if (round.game === 'birdies' && res.detail.birdies) {
    const b = res.detail.birdies;
    const byPlayer = round.players.filter(p => b.inPot.includes(p.id));
    return (
      <>
        <div className="sec-label">{label || 'Birdie pot'}</div>
        {b.holes.length === 0 && <p className="hint-card"><Icon name="bird" fill /> No net birdies, so nobody pays.</p>}
        {b.holes.length > 0 && byPlayer.map(p => (
          <div key={p.id} className="leg-row">
            <div className="leg-name">{first(p.name)}</div>
            <div className="leg-winner">{b.holes.filter(h => h.pid === p.id).map(h => `H${h.no}${h.shares > 1 ? ` (${h.shares})` : ''}`).join(', ') || '–'}</div>
            <div className="leg-amt">{b.shares[p.id] || 0} share{b.shares[p.id] === 1 ? '' : 's'}</div>
          </div>
        ))}
        {round.players.length > byPlayer.length && <p className="field-help" style={{ padding: '0 20px' }}>Players who joined late or left early aren’t in the pot.</p>}
      </>
    );
  }
  if (round.game === 'snake') {
    return (
      <>
        <div className="sec-label">Who had the snake</div>
        {res.detail.snake.legs.map(l => (
          <div key={l.seg.label} className="leg-row">
            <div className="leg-name">{res.detail.snake.legs.length > 1 ? l.seg.label : 'Snake'}</div>
            <div className={`leg-winner ${!l.holder ? 'leg-tie' : ''}`}>
              {l.holder ? `${names[l.holder]} ${l.done ? 'held it at the end' : 'holds it'}` : 'Nobody three-putted'}
              {l.count > 0 && <div className="li-sub">{l.count} three-putt{l.count === 1 ? '' : 's'} · worth {money(l.value)} a player</div>}
            </div>
            <div className={`leg-amt ${l.holder ? '' : 'zero'}`}>{money(l.amount)}</div>
          </div>
        ))}
      </>
    );
  }
  if (round.game === 'hammer') {
    const sn = sideNames(round);
    const rows = res.detail.hammer.filter(r => r.winner !== undefined);
    return (
      <>
        <div className="sec-label">Hole by hole{round.teams ? ` · ${sn[0]} v ${sn[1]}` : ''}</div>
        <div className="money-table-wrap">
          <table className="sc-table money-table">
            <thead><tr><th style={{ textAlign: 'left', paddingLeft: 12 }}>Hole</th><th>Hammers</th><th>Won by</th><th>Worth</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.hole.no}>
                  <td>{r.hole.no}</td>
                  <td>{r.hammers.length || '·'}{r.conceded != null ? ' · folded' : ''}</td>
                  <td>{r.winner == null ? 'Halved' : round.teams ? sn[r.winner] : first(sn[r.winner])}</td>
                  <td className={r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : 'zero'}>{r.value ? money(r.value) : '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  if (round.game === 'banker' || round.game === 'wolf' || round.game === 'aces') {
    const col = h => {
      if (round.game === 'banker') return first(names[h.banker]);
      if (round.game === 'aces') return [h.ace && `${first(names[h.ace])} ace`, h.deuce && `${first(names[h.deuce])} deuce`].filter(Boolean).join(' · ') || '·';
      return round.wolf[h.no]?.partner === null ? `${first(names[round.wolf[h.no].wolf])} (${round.wolf[h.no].blind ? 'blind' : 'lone'})` : first(names[round.wolf[h.no]?.wolf]);
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

/**
 * Gross scorecard, one column per hole. onHole makes columns tappable. Under each name, the
 * player's running to par (+3, E, −1) on the holes they've scored, and net too when anyone gets
 * strokes, so it shows without scrolling the card sideways.
 */
export function Scorecard({ round, current, onHole }) {
  const out = round.holes;
  const cls = (g, par) => (g === 'X' ? 'pu' : g <= par - 2 ? 'eagle' : g === par - 1 ? 'birdie' : g === par + 1 ? 'bogey' : g >= par + 2 ? 'dbl' : '');
  const hc = !!round.useHandicaps;
  const units = scorers(round);
  const anyStrokes = hc && units.some(p => out.some(h => popsFor(round, p, h) !== 0));
  // With half strokes each dot counts half, and the net total can end in ½
  const half = halfStrokesOn(round);
  // The dots are the main game's; a side game with its own % or half strokes gets its own key line
  const key = hc ? strokeKey(round) : { dots: '', lines: [] };
  // With onHole (during play), any cell in a hole's column jumps to that hole
  const colProps = no => (onHole ? { onClick: () => onHole(no), className: 'sc-tap' } : {});
  const netTotal = p => out.reduce((a, h) => { const n = holeComplete(round, h) ? netFor(round, p, h) : null; return n == null ? a : a + n; }, 0);
  return (
    <div className="sc-wrap">
      <table className="sc-table scorecard">
        <thead>
          <tr>
            <th className="sticky">Hole</th>
            {out.map(h => (
              <th key={h.no} className={h.no === current ? 'cur' : ''}>
                {onHole
                  ? <button className="sc-col-btn" onClick={() => onHole(h.no)} aria-label={`Go to hole ${h.no}${round.holeFixes?.[h.no] ? ', fixed for this round' : ''}`}>{h.no}{round.holeFixes?.[h.no] && <span className="sc-fixed" aria-hidden="true" />}</button>
                  : <>{h.no}{round.holeFixes?.[h.no] && <><span className="sc-fixed" aria-hidden="true" /><span className="sr-only">, fixed</span></>}</>}
              </th>
            ))}
            <th>Tot</th>
            {anyStrokes && <th>Net</th>}
          </tr>
          <tr className="par-row"><td className="sticky">Par</td>{out.map(h => <td key={h.no} {...colProps(h.no)}>{h.par}</td>)}<td>{round.par}</td>{anyStrokes && <td />}</tr>
          {hc && <tr className="hcp-row"><td className="sticky">HCP</td>{out.map(h => <td key={h.no} {...colProps(h.no)}>{h.hdcp ?? '–'}</td>)}<td />{anyStrokes && <td />}</tr>}
        </thead>
        <tbody>
          {units.map(p => {
            const sum = scoreSummary(round, p.id);
            // Net under the name only for someone who gets strokes: "E net E" says nothing
            const showNet = anyStrokes && getsStrokes(round, p);
            const par = toParOf(round, p, { withNet: showNet });
            return (
              <tr key={p.id}>
                <td className="sticky">
                  <span className="sc-name">{p.team ? p.name : p.name.split(' ')[0]}</span>
                  {par.played > 0 && (
                    <span className="sc-topar">
                      <span className={`sc-par ${toParTone(par.gross)}`} aria-label={showNet ? `Gross ${toParWords(par.gross)}` : toParWords(par.gross)}>{toParText(par.gross)}</span>
                      {showNet && <span className={`sc-par net ${toParTone(par.net)}`} aria-label={`Net ${toParWords(par.net)}`}>net {toParText(par.net)}</span>}
                    </span>
                  )}
                </td>
                {out.map(h => {
                  const g = round.scores[h.no]?.[p.id];
                  // A player who left shows an en dash on the holes after
                  const gone = g == null && !(p.team ? p.players.some(pid => playsHole(round, pid, h)) : playsHole(round, p.id, h));
                  const st = hc && !gone ? popsFor(round, p, h) : 0;
                  const tap = colProps(h.no);
                  return (
                    <td key={h.no} className={`${h.no === current ? 'cur' : ''} ${tap.className || ''}`} onClick={tap.onClick}>
                      <span className="sc-cell">
                        {gone ? <span className="empty-dot">–</span> : g == null ? <span className="empty-dot">·</span> : <span className={`sc-mark ${cls(g, h.par)}`}>{g}</span>}
                        {st > 0 && <span className="sc-strokes" role="img" aria-label={`Gets ${strokesWords(st, half)}`}>{Array.from({ length: st }, (_, i) => <i key={i} />)}</span>}
                        {st < 0 && <span className="sc-strokes give" aria-label={`Gives back ${strokesWords(-st, half)}`}>{'–'.repeat(-st)}</span>}
                      </span>
                    </td>
                  );
                })}
                <td className="tot">{sum.played ? sum.gross : '–'}</td>
                {anyStrokes && <td className="tot">{sum.played ? netText(netTotal(p)) : '–'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sc-legend">
        {/* Each mark stays on the same line as its words */}
        <span className="sc-key"><span className="sc-mark birdie">3</span> birdie</span>
        <span className="sc-key"><span className="sc-mark eagle">2</span> eagle</span>
        <span className="sc-key"><span className="sc-mark bogey">5</span> bogey</span>
        <span className="sc-key"><span className="sc-mark pu">X</span> picked up</span>
        {anyStrokes && <span className="sc-key"><span className="sc-strokes inline"><i /></span> {half ? 'half stroke' : 'gets a stroke'}</span>}
        {round.holeFixes && Object.keys(round.holeFixes).length > 0 && <span className="sc-key"><span className="sc-fixed inline" aria-hidden="true" /> par or HCP fixed</span>}
      </div>
      {key.lines.length > 0 && (
        <div className="sc-stroke-key">
          <span>{key.dots}.</span>
          {key.lines.map(l => <span key={l.key}>{l.text}.</span>)}
        </div>
      )}
    </div>
  );
}

/** "Mike and Sue", "Mike, Sue and Al". */
function listNames(names) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
