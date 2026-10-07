import { Fragment, useEffect, useRef, useState } from 'react';
import { Empty, Header, Icon, PickChip, Screen, useUI } from '../components/ui.jsx';
import { BuddyArt } from '../components/BuddyArt.jsx';
import { getState, update, useStore } from '../lib/store.js';
import { GAMES, bettingRound, cardOnly, gameView, holeAtPos, isJustPlaying, holeComplete, isTeamGame, matchScored, oneBall, teamTable, playsHole, roundLegs, roundNotes, roundResults, scoreSummary, scorers, sideNames, skinsKinds, skinsTable, popsFor, netFor } from '../lib/round.js';
import { halfStrokesOn, netText, strokesWords } from '../lib/allowances.js';
import { matchLabel } from '../lib/games.js';
import { money } from '../lib/golf.js';
import { canEdit, keeperMe } from '../lib/keeper.js';
import { useNav } from '../lib/nav.js';
import { leaveRound } from '../lib/rounds.js';
import { bigGroupName, gameLabel, meFor, placeOf, roundDate, roundPlayerName } from '../lib/format.js';
import { bigRoundResults } from '../lib/big-money.js';
import { gamesLine } from '../lib/side-games.js';
import { betStretchLine } from '../lib/stakes.js';
import { teamLineText } from '../lib/reveal.js';
import { ByGameTable } from '../components/SideGames.jsx';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import { SignInSheet } from '../components/Account.jsx';
import { HowWasIt, NiceRound, Reveal, RewardCard, SettleUp, ShareCard } from '../components/Finale.jsx';
import { cardFromLine, justPlayingNote, niceRound } from '../lib/just-playing.js';
import { TripRoundNote } from '../components/Trips.jsx';
import { countsMoney, playForOf, tabResults, unitFmt } from '../lib/play-for.js';
import { SaveUsualButton } from '../components/Usuals.jsx';
import { DrivesShortfall } from '../components/ScrambleDrives.jsx';
import { strokeKey } from '../lib/stroke-key.js';
import { getsStrokes, toParOf, toParText, toParTone, toParWords } from '../lib/to-par.js';
import { BetsBreakdown } from '../components/PairBets.jsx';
import { betPeople } from '../lib/pair-bets.js';
import { RoundWhereFrom } from '../components/WhereFrom.jsx';
import { TalkBar, TalkSection } from '../components/Talk.jsx';
import { betTarget, payTarget, roundTalk, roundThread } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';

/** A signed number with a real minus sign, as the rest of the app writes it: +2, −1, 0. */
const signed = v => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
/** "1 pt", "3 pts". */
const pts = n => `${n} pt${n === 1 ? '' : 's'}`;

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
  // The round's trash talk: look now, and every so often while it's open
  useTalkSync(round?.status === 'done' ? [roundThread(round)] : [], { live: true });
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
    return <Screen><Header title="Round" onBack={nav.pop} /><Empty title="Round not found" text="It may have been deleted. Finished rounds are in History." action={<button className="ec" onClick={nav.pop}>Go back</button>} /></Screen>;
  }
  const own = roundResults(round);
  // The games' own round, without anyone just playing (round.js bettingRound), for the breakdowns
  const betRound = bettingRound(round);
  // You were just playing: a friendly "Nice round" with your score instead of a money reveal
  const meId = meFor(round, state);
  const solo = cardOnly(round);
  const casualMe = round.players.some(p => p.id === meId) && isJustPlaying(round, meId);
  const nice = casualMe ? niceRound(round, meId) : null;
  // A Big Game's group round with no money of its own shows each player's money from the whole game
  const res = bigGroupName(round) ? bigRoundResults(state, round, own) : own;
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  const top = res.standings[0];
  const meRow = res.standings.find(p => p.id === meFor(round, state));
  const tie = res.standings.filter(p => p.amount === top.amount).length > 1;
  const allSquare = res.standings.every(p => p.amount === 0);
  // A points or reward round is never money: amounts read as points and there's nobody to pay
  const fmt = unitFmt(round);
  const isMoney = countsMoney(round);
  // What goes on the Tab: the whole round, or a reward round's side bets for money alone (in dollars)
  const tab = tabResults(round, own);
  const pays = tab.transfers.length > 0;
  // A trip round has no settle up of its own: the trip is settled once, after its last round
  const ownSettle = pays && !round.trip?.id;
  // Trash talk on a finished round, its settle-up lines and its side bets (talk.js)
  const talk = round.status === 'done' ? roundTalk(round, state) : null;
  const payTitle = t => `${roundPlayerName(round, t.from).split(' ')[0]} pays ${roundPlayerName(round, t.to).split(' ')[0]}`;

  const del = async () => {
    if (!(await ask({ title: 'Delete this round?', text: 'It’ll be removed from History and the Tab.', confirmLabel: 'Delete round', danger: true }))) return;
    update(s => {
      delete s.rounds[id];
      if (s.talk) delete s.talk[`round:${id}`];
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
  if (res.big && !res.big.final) { heroTitle = 'Waiting on the other groups'; heroAmt = fmt(0); }
  else if (allSquare) { heroTitle = 'All square'; heroAmt = fmt(0); }
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
      <div className="row-main"><div className="set-name">{isMoney && meRow && meRow.amount > 0 ? `You won ${money(meRow.amount)}. Save it to your Tab` : 'Save this round to your account'}</div><div className="set-sub">Free. Keeps your rounds and the Tab safe on any device.</div></div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  const done = () => { finaleStage.delete(id); nav.reset('history'); };
  // Who left and which holes didn't count, said plainly so nobody wonders where the money went
  const notes = [...roundNotes(round), ...(justPlayingNote(round) ? [{ kind: 'casual', text: justPlayingNote(round) }] : [])];
  const notesEl = notes.length > 0 && (
    <div style={{ marginTop: 12 }}>
      {notes.map(n => <p key={n.text} className="hint-card"><Icon name={n.kind === 'left' ? 'user-minus' : n.kind === 'joined' ? 'user-plus' : n.kind === 'casual' ? 'smiley' : 'warning'} fill /> {n.text}</p>)}
    </div>
  );
  if (stage !== 'detail') {
    return (
      <Screen key={stage} className={`finale-stage ${stageBack ? 'back' : ''}`}>
        {stage === 'reveal' && casualMe && <NiceRound round={round} me={meId} onDetail={() => { setRevealSeen(true); setStage('detail'); }} onDone={done} />}
        {stage === 'reveal' && !casualMe && <Reveal round={round} res={res} instant={revealSeen} onNext={() => { setRevealSeen(true); setStage(ownSettle ? 'settle' : 'share'); }} onDetail={() => { setRevealSeen(true); setStage('detail'); }} extra={<>{round.trip?.id && <div style={{ marginTop: 12 }}><TripRoundNote round={round} /></div>}{notesEl}{saveRow && <div style={{ marginTop: 12 }}>{saveRow}</div>}</>} />}
        {stage === 'settle' && <SettleUp round={round} res={tab} onBack={() => setStage('reveal')} onNext={() => setStage('share')} />}
        {stage === 'share' && (shareFrom === 'detail'
          ? <ShareCard round={round} res={res} onBack={() => setStage('detail')} onDone={() => setStage('detail')} doneLabel="Done" />
          : <ShareCard round={round} res={res} onBack={() => setStage(ownSettle ? 'settle' : 'reveal')} onDone={done} />)}
        {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} />}
      </Screen>
    );
  }

  // In a one-ball game (scramble, alternate shot, Chapman) the team gets the strokes, not each player
  const strokesNote = p => {
    const team = oneBall(round.game) && round.teams?.find(t => t.players.includes(p.id));
    const n = team ? team.plays || 0 : p.plays;
    if (!n) return null;
    return <span className="li-sub"> · {team ? 'team got' : 'got'} {strokesWords(n, halfStrokesOn(round))}</span>;
  };

  return (
    <Screen>
      <Header title={celebrate ? 'Final results' : 'Round'} onBack={celebrate ? undefined : nav.pop} small
        right={solo ? null : <button className="header-btn" onClick={() => { setShareFrom('detail'); setStage('share'); }}><Icon name="share-network" /> Share</button>} />
      <div className="scroll">
        {solo ? (
          <div className="winner-hero nice-hero" ref={hero}>
            <Icon name="smiley" fill className="crown" />
            <div className="wn">{nice ? nice.title : 'Your card'}</div>
            <div className="wa">{nice ? <>{nice.score} <span className={`nice-par ${nice.tone}`}>{nice.toPar}</span></> : '–'}</div>
            <div className="ws">{round.course.name} · {roundDate(round)} · {nice ? nice.line : 'No scores yet'}</div>
            {cardFromLine(round) && <div className="me-line">{cardFromLine(round)}</div>}
          </div>
        ) : (
        <div className="winner-hero" ref={hero}>
          <Icon name={allSquare ? 'handshake' : 'crown'} fill className="crown" />
          <div className="wn">{heroTitle}</div>
          <div className="wa">{heroAmt}</div>
          <div className="ws">{round.course.name} · {roundDate(round)} · {gameLabel(round)} · {played === round.holes.length ? `${played} holes` : `${played} of ${round.holes.length} holes`}</div>
          {meRow && meRow.id !== top.id && !allSquare && <div className="me-line">You: {fmt(meRow.amount, { sign: true })}</div>}
          {nice && <div className="me-line">You were just playing: {nice.score} ({nice.toPar})</div>}
        </div>
        )}

        {round.trip?.id && <TripRoundNote round={round} />}
        {notesEl}
        {saveRow}

        {!solo && <>
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
            <div key={t.from + t.to} className="talk-pay">
              <div className="pay-row">
                <span className="pf">{roundPlayerName(round, t.from)}</span><span className="pa"><Icon name="arrow-right" /></span><span className="pt">{roundPlayerName(round, t.to)}</span>
                <span className="pm">{money(t.amount)}</span>
              </div>
              {talk && <TalkBar ctx={talk} on={payTarget(t.from, t.to)} title={payTitle(t)} />}
            </div>
          ))}
          {tab.transfers.length > 0 && <p className="field-help" style={{ padding: '0 4px' }}>Only the side bets played for money. They’re on the Tab until marked paid; the points above decide the reward.</p>}
        </div>
        </>}
        {isMoney && <>
        <div className="sec-label">Who pays who</div>
        <div style={{ padding: '0 16px' }}>
          {res.big ? <p className="hint-card" style={{ margin: 0 }}><Icon name="handshake" fill /> {res.big.final ? `${round.trip.name} is settled once for the whole game, on its page.` : `${round.trip.name} is decided once every group is in. It’s settled once, on its page.`}</p>
            : res.transfers.length === 0 && <p className="hint-card" style={{ margin: 0 }}><Icon name="handshake" fill /> Nobody owes anybody. First round’s on whoever three-putted last.</p>}
          {res.transfers.map(t => (
            <div key={t.from + t.to} className="talk-pay">
              <div className="pay-row">
                <span className="pf">{roundPlayerName(round, t.from)}</span><span className="pa"><Icon name="arrow-right" /></span><span className="pt">{roundPlayerName(round, t.to)}</span>
                <span className="pm">{money(t.amount)}</span>
              </div>
              {talk && <TalkBar ctx={talk} on={payTarget(t.from, t.to)} title={payTitle(t)} />}
            </div>
          ))}
          {res.transfers.length > 0 && <p className="field-help" style={{ padding: '0 4px' }}>{round.trip?.format === 'big'
            ? `Fewest payments for this round alone. It’s part of ${round.trip.name}, so it’s settled once with the whole game, and it’s on the Tab until then.`
            : round.trip?.id
            ? `Fewest payments for this round alone. It’s on the trip, so it’s settled once with the trip’s other rounds, and it’s on the Tab until then.`
            : 'Fewest payments to square everyone up. They’re on the Tab until marked paid.'}</p>}
        </div>
        </>}

        {talk && <TalkSection ctx={talk} on="round" />}

        <HowWasIt round={round} />

        {res.detail.byGame && (
          <>
            <div className="sec-label">By game</div>
            <ByGameTable round={betRound} byGame={res.detail.byGame} total={res.balances} fmt={fmt} />
          </>
        )}
        {/* A reward round's side bets for money get their own table, in dollars, never added to the points */}
        {res.cash && (
          <>
            {!res.detail.byGame && <div className="sec-label">By game</div>}
            <p className="field-help pad">{res.detail.byGame ? 'Above in points. ' : ''}Side bets for money, in dollars:</p>
            <ByGameTable round={betRound} byGame={{ cash: { label: res.cash.label, balances: res.cash.balances } }} total={res.cash.balances} fmt={money} caption="Side bets for money" />
          </>
        )}

        <GameBreakdown round={betRound} res={res} />
        {/* Each side game's own breakdown, worked out on its own like the main game */}
        {Object.entries(res.detail.byGame || {}).filter(([key]) => key !== 'main' && key !== 'bets').map(([key, g]) => (
          <Fragment key={key}>
            <GameBreakdown round={gameView(round, key)} res={{ detail: g.detail }} label={g.label} />
            {/* A side game whose bet changed mid-round: what each stretch of holes was played for */}
            {betStretchLine(round, key) && <p className="field-help pad">{betStretchLine(round, key)}</p>}
          </Fragment>
        ))}

        <BetsBreakdown round={betRound} res={res}
          talk={talk ? r => <TalkBar ctx={talk} on={betTarget(r.id)} title={`${r.label} · ${betPeople(round, r.bet)}`} /> : null} />
        <RoundWhereFrom round={betRound} res={res} />
        {/* ...and for a reward round's side bets for money, what's between each pair in dollars */}
        {!isMoney && res.cash && <RoundWhereFrom round={betRound} res={tab} fmt={money} title="Where the money comes from" />}
        </>}
        {solo && <HowWasIt round={round} />}

        <div className="sec-label">Scorecard</div>
        <Scorecard round={round} />

        <div className="detail-actions">
          {round.status === 'done' && GAMES[round.game] && !solo && (
            <button className="full-btn" onClick={() => nav.push('newRound', { rematch: id })}><Icon name="arrow-counter-clockwise" /> Run it back</button>
          )}
          {round.status === 'done' && !round.localMe && !solo && round.shared?.host !== false && <SaveUsualButton round={round} />}
          {canEdit(round, keeperMe(round, state), !!round.shared?.host) && <button className="full-btn outline" onClick={edit}><Icon name="pencil-simple" /> Edit scores</button>}
          <button className="danger-link" onClick={del}><Icon name="trash" /> Delete round</button>
        </div>
      </div>
      {celebrate && (
        <div className="cta-wrap">
          {ownSettle && !casualMe && <button className="full-btn" onClick={() => setStage('settle')}><Icon name="receipt" /> Settle up</button>}
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
  // Nassau, Match play, and a team game played as a match
  if (matchScored(round) && res.detail.lines) {
    const LEGS = roundLegs(round);
    const sn = sideNames(round);
    const multi = Object.keys(LEGS).length > 1;
    return (
      <>
        <div className="sec-label">Bets{round.teams ? ` · ${sn[0]} v ${sn[1]}` : ''}</div>
        {res.detail.lines.map(l => {
          const s = l.status;
          const who = s.leader === null ? (s.left === 0 ? 'Halved' : 'All square') : matchLabel(s, sn[s.leader]);
          return (
            <div key={l.key} className="leg-row">
              <div className="leg-name">{l.bye ? 'Bye' : l.press ? 'Press' : LEGS[l.leg].label}</div>
              <div className={`leg-winner ${s.leader === null ? 'leg-tie' : ''}`}>{l.press ? `${multi ? `${LEGS[l.leg].label} ` : ''}from H${holeAtPos(round, l.start)} · ` : ''}{who}</div>
              <div className={`leg-amt ${l.value === 0 ? 'zero' : ''}`}>{money(Math.abs(l.value))}</div>
            </div>
          );
        })}
        {round.game === 'shamble' && <DrivesShortfall round={round} done={round.status === 'done'} />}
      </>
    );
  }
  // A team game played as stroke play (each leg to the lower team total) or per hole (holes won)
  if (isTeamGame(round.game) && res.detail.lines) {
    const sn = sideNames(round);
    return (
      <>
        <div className="sec-label">Bets · {sn[0]} v {sn[1]}</div>
        {res.detail.lines.map(l => {
          // The same words as the reveal (reveal.js), "Not played" for a leg with no holes in
          const who = !(l.status?.played ?? l.played) ? 'Not played' : teamLineText(l, sn);
          return (
            <div key={l.key} className="leg-row">
              <div className="leg-name">{l.label}</div>
              <div className={`leg-winner ${l.value === 0 ? 'leg-tie' : ''}`}>{who}</div>
              <div className={`leg-amt ${l.value === 0 ? 'zero' : ''}`}>{money(Math.abs(l.value))}</div>
            </div>
          );
        })}
        {round.game === 'shamble' && <DrivesShortfall round={round} done={round.status === 'done'} />}
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
                  {[0, 1].map(k => {
                    // ↺ a birdie flip, or Daytona (a house rule): no par or better, so the high number went first
                    const turned = r.flipped[k] || r.high?.[k];
                    return <td key={k} className={turned ? 'neg' : ''}>{r.numbers[k]}{turned ? ' ↺' : ''}</td>;
                  })}
                  <td className={r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : 'zero'}>{r.diff === 0 ? '·' : `${r.diff > 0 ? t[0].name : t[1].name} +${Math.abs(r.diff)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.some(r => r.flipped.some(Boolean) || r.high?.some(Boolean)) && <p className="field-help" style={{ padding: '0 20px' }}>{rows.some(r => r.high?.some(Boolean))
          ? (rows.some(r => r.flipped.some(Boolean)) ? '↺ high number first: flipped by the other team’s birdie, or no par or better (Daytona).' : '↺ high number first: no par or better (Daytona).')
          : '↺ number flipped by the other team’s birdie.'}</p>}
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
          // Auto presses (a house rule) are shown under their match, so the match's own amount is the rest
          const pressed = (m.presses || []).reduce((a, p) => a + p.value, 0);
          const own = m.net - pressed;
          return (
            <Fragment key={m.index}>
              <div className="leg-row">
                <div className="leg-name">{m.seg.label}</div>
                <div className={`leg-winner ${s.leader === null ? 'leg-tie' : ''}`}>{pair(m.sides[0])} v {pair(m.sides[1])} · {who}</div>
                <div className={`leg-amt ${own === 0 ? 'zero' : ''}`}>{money(Math.abs(own))}</div>
              </div>
              {(m.presses || []).map(p => (
                <div key={p.start} className="leg-row">
                  <div className="leg-name">Press</div>
                  <div className={`leg-winner ${p.status.leader === null ? 'leg-tie' : ''}`}>From H{holeAtPos(round, p.start)} · {p.status.leader === null ? (p.status.left === 0 ? 'Halved' : 'All square') : matchLabel(p.status, pair(m.sides[p.status.leader]))}</div>
                  <div className={`leg-amt ${p.value === 0 ? 'zero' : ''}`}>{money(Math.abs(p.value))}</div>
                </div>
              ))}
            </Fragment>
          );
        })}
      </>
    );
  }
  if (round.game === 'scramble' || round.game === 'stroke' || round.game === 'stableford' || round.game === 'quota') {
    const rows = res.detail.totals;
    const fmt = x => {
      // A short round is measured against the quota for the holes played
      if (round.game === 'quota') return `${pts(x.total)} · quota ${x.target ?? x.quota} · ${signed(x.vsQuota)}`;
      if (round.game === 'stableford') return pts(x.total);
      return `Net ${x.total} · ${x.toPar === 0 ? 'E' : signed(x.toPar)}`;
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
        {res.detail.pots && <>
          {/* Front, back and total, or low gross too (house rules): what each pot paid, and to whom */}
          <div className="sec-label">{res.detail.pots.some(p => p.key === 'gross') ? 'Pots' : 'Front, back and total'}</div>
          {res.detail.pots.map(p => {
            // What each winner took out of the pot (their stake back and the rest), so a pot shared
            // by everyone over quota lists them all, even one who only got their stake back plus a bit
            const stake = Number(round.settings[round.game]?.stake) || 0;
            const square = Object.values(p.deltas).every(v => !v);
            const won = square ? [] : Object.entries(p.deltas).map(([pid, v]) => [pid, Math.round((v + (p.totals[pid] == null ? 0 : stake)) * 100) / 100])
              .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            return (
              <div key={p.key} className="leg-row">
                <div className="leg-name">{p.key === 'total' ? (!res.detail.pots.some(x => x.key === 'front') ? 'Low net' : round.holes.length === 18 ? '18' : 'All') : p.label}</div>
                <div className={`leg-winner ${won.length ? '' : 'leg-tie'}`}>{won.length ? won.map(([pid, v]) => (won.length > 1 ? `${first(names[pid])} ${money(v)}` : first(names[pid]))).join(', ') : 'All square'}</div>
                <div className={`leg-amt ${won.length ? '' : 'zero'}`}>{money(won.reduce((a, [, v]) => a + v, 0))}</div>
              </div>
            );
          })}
        </>}
        {res.detail.teamQuota && <TeamQuota round={round} teams={res.detail.teamQuota} names={names} />}
        {res.detail.nextQuotas && <NextQuotas round={round} next={res.detail.nextQuotas} names={names} />}
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
            <div className={`leg-winner ${!l.pays ? 'leg-tie' : ''}`}>{!l.done ? (l.pays ? `${names[l.holder]} holds it` : 'Loose') : l.pays ? `${names[l.holder]} held it at the end` : 'Loose at the end, no payout'}{l.doubled && <div className="li-sub">Back nine doubles: {money(l.stake)} a player</div>}</div>
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
                  <PickChip key={pid} small radio on={end.winner === pid} onClick={() => pickPlayoff(kind, pid)}>{first(names[pid])}</PickChip>
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
  if ((round.game === 'ctp' || round.game === 'drive') && res.detail.pot) {
    // Closest to the pin and long drive: each pot hole, who won it and what it paid
    const t = res.detail.pot;
    const what = round.game === 'ctp' ? 'par 3' : 'long drive hole';
    const cents = v => money(Math.round(v * 100) / 100);
    return (
      <>
        <div className="sec-label">{label || (round.game === 'ctp' ? 'Closest to the pin' : 'Long drive')}</div>
        {t.holes.length === 0 && <p className="hint-card"><Icon name="flag" fill /> {round.game === 'ctp' ? 'No par 3s in this round' : 'No long drive holes in this round'}, so nobody pays.</p>}
        {t.holes.map(h => {
          const who = h.winner && h.winner !== 'none' ? first(names[h.winner]) : null;
          const state = !h.reached ? 'Not counted' : who || (t.unclaimed === 'split' ? 'Nobody, split across the rest' : 'Nobody, carried');
          return (
            <div key={h.no} className="leg-row">
              <div className="leg-name">Hole {h.no}</div>
              <div className={`leg-winner ${who ? '' : 'leg-tie'}`}>{state}</div>
              <div className="leg-amt">{who ? cents(h.paid) : '–'}</div>
            </div>
          );
        })}
        {t.holes.length > 0 && t.paidOut === 0 && <p className="field-help" style={{ padding: '0 20px' }}>Nobody won a {what}, so nobody pays.</p>}
        {t.paidOut > 0 && t.handedBack > 0 && <p className="field-help" style={{ padding: '0 20px' }}>{cents(t.handedBack)} still carried after the last {what} goes back to everyone.</p>}
        {round.players.length > t.inPot.length && <p className="field-help" style={{ padding: '0 20px' }}>Players who joined late or left early aren’t in the pot.</p>}
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
              {l.count > 0 && <div className="li-sub">{l.count} three-putt{l.count === 1 ? '' : 's'} · worth {money(l.value)}{l.split ? ', split among the rest' : ' a player'}</div>}
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
                  <td>{r.hammers.length || '·'}{r.conceded != null ? ' · folded' : ''}{r.birdie ? ' · birdie' : ''}</td>
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
  // Someone just playing gets no strokes: they're in no game (just-playing.js)
  const casual = p => isJustPlaying(round, p.id);
  const solo = cardOnly(round);
  const anyStrokes = hc && units.some(p => !casual(p) && out.some(h => popsFor(round, p, h) !== 0));
  // With half strokes each dot counts half, and the net total can end in ½
  const half = halfStrokesOn(round);
  // The dots are the main game's; a side game with its own % or half strokes gets its own key line
  const key = hc ? strokeKey(round) : { dots: '', lines: [] };
  // With onHole (during play), any cell in a hole's column jumps to that hole
  const colProps = no => (onHole ? { onClick: () => onHole(no), className: 'sc-tap' } : {});
  const netTotal = p => out.reduce((a, h) => { const n = holeComplete(round, h) ? netFor(round, p, h) : null; return n == null ? a : a + n; }, 0);
  // Best ball and Shamble: a row per team with its score on each hole, and the scores that made it underlined
  const tt = isTeamGame(round.game) && !oneBall(round.game) && round.teams?.length === 2 ? teamTable(bettingRound(round)) : null;
  const countedOn = (k, pid) => !!tt && tt.rows[k].counted.some(list => list.includes(pid));
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
            const showNet = anyStrokes && !casual(p) && getsStrokes(round, p);
            const par = toParOf(round, p, { withNet: showNet });
            return (
              <tr key={p.id}>
                <td className="sticky">
                  <span className="sc-name">{p.team ? p.name : p.name.split(' ')[0]}</span>
                  {casual(p) && !solo && <span className="sc-jp">Just playing</span>}
                  {par.played > 0 && (
                    <span className="sc-topar">
                      <span className={`sc-par ${toParTone(par.gross)}`} role="img" aria-label={showNet ? `Gross ${toParWords(par.gross)}` : toParWords(par.gross)}>{toParText(par.gross)}</span>
                      {showNet && <span className={`sc-par net ${toParTone(par.net)}`} role="img" aria-label={`Net ${toParWords(par.net)}`}>net {toParText(par.net)}</span>}
                    </span>
                  )}
                </td>
                {out.map((h, k) => {
                  const g = round.scores[h.no]?.[p.id];
                  // A player who left shows an en dash on the holes after
                  // (an alternate shot or Chapman team needs both partners there, see scorers)
                  const gone = g == null && !(p.team ? scorers(round, h).some(u => u.id === p.id) : playsHole(round, p.id, h));
                  const st = hc && !gone && !casual(p) ? popsFor(round, p, h) : 0;
                  const tap = colProps(h.no);
                  return (
                    <td key={h.no} className={`${h.no === current ? 'cur' : ''} ${tap.className || ''}`} onClick={tap.onClick}>
                      <span className="sc-cell">
                        {gone ? <span className="empty-dot">–</span> : g == null ? <span className="empty-dot">·</span> : <span className={`sc-mark ${cls(g, h.par)} ${countedOn(k, p.id) ? 'sc-counts' : ''}`}>{g}</span>}
                        {st > 0 && <span className="sc-strokes" role="img" aria-label={`Gets ${strokesWords(st, half)}`}>{Array.from({ length: st }, (_, i) => <i key={i} />)}</span>}
                        {st < 0 && <span className="sc-strokes give" role="img" aria-label={`Gives back ${strokesWords(-st, half)}`}>{'–'.repeat(-st)}</span>}
                      </span>
                    </td>
                  );
                })}
                <td className="tot">{sum.played ? sum.gross : '–'}</td>
                {anyStrokes && <td className="tot">{sum.played ? netText(netTotal(p)) : '–'}</td>}
              </tr>
            );
          })}
          {tt && round.teams.map((t, i) => {
            const played = tt.rows.filter(r => r.scores[i] != null);
            return (
              <tr key={t.id} className="sc-team-row">
                <td className="sticky">
                  <span className="sc-name">{t.name}</span>
                  <span className="sc-topar"><span className="sc-par">{tt.count === 2 ? 'best two' : 'best ball'}{hc ? ', net' : ''}</span></span>
                </td>
                {out.map((h, k) => {
                  const v = tt.rows[k].scores[i];
                  const tap = colProps(h.no);
                  return (
                    <td key={h.no} className={`${h.no === current ? 'cur' : ''} ${tap.className || ''}`} onClick={tap.onClick}>
                      <span className="sc-cell">{v == null ? <span className="empty-dot">·</span> : <span className="sc-mark">{netText(v)}</span>}</span>
                    </td>
                  );
                })}
                {/* The team scores are net with handicaps on, so with strokes given they add up in the Net column */}
                <td className="tot">{anyStrokes ? '' : played.length ? netText(played.reduce((a, r) => a + r.scores[i], 0)) : '–'}</td>
                {anyStrokes && <td className="tot">{played.length ? netText(played.reduce((a, r) => a + r.scores[i], 0)) : '–'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sc-legend">
        {/* Each mark stays on the same line as its words */}
        <span className="sc-key"><span className="sc-mark birdie">3</span> birdie <span className="sc-critter"><BuddyArt id="birdie" bg="mint" /></span></span>
        <span className="sc-key"><span className="sc-mark eagle">2</span> eagle <span className="sc-critter"><BuddyArt id="eagle" bg="teal" /></span></span>
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

/**
 * Team quota (a Quota house rule): each team's points against its quotas added up, best first. The
 * team furthest over took the pot.
 */
function TeamQuota({ round, teams, names }) {
  const first = id => (names[id] || '').split(' ')[0];
  const best = Math.max(...teams.map(t => t.over));
  const sorted = [...teams].sort((a, b) => b.over - a.over);
  const tenth = v => Math.round(v * 10) / 10;
  return (
    <>
      <div className="sec-label">Team quota</div>
      {sorted.map((t, i) => (
        <div key={t.id} className="leg-row">
          <div className="leg-name">{i + 1}</div>
          <div className={`leg-winner ${t.over === best ? '' : 'leg-tie'}`}>{t.players.map(first).join(' & ')}{t.over === best && round.status === 'done' ? <span className="li-sub"> · took the pot</span> : null}</div>
          <div className="leg-amt">{pts(t.points)} · quota {tenth(t.quota)} · {signed(tenth(t.over))}</div>
        </div>
      ))}
    </>
  );
}

/** "Quota moves after the round" (a Quota house rule): each player's quota for the next Quota round. */
function NextQuotas({ round, next, names }) {
  const rows = round.players.filter(p => next[p.id]);
  return (
    <div className="hr-extra">
      <div className="eyebrow">Quotas for next time</div>
      {rows.map(p => {
        const n = next[p.id];
        const d = n.next - n.quota;
        return (
          <div key={p.id} className="hr-extra-row">
            <span><b>{(names[p.id] || '').split(' ')[0]}</b> {n.over > 0 ? `beat ${n.quota} by ${n.over}` : n.over < 0 ? `missed ${n.quota} by ${-n.over}` : `made ${n.quota} on the nose`}</span>
            <span className={`hr-v ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>{n.next}{d ? ` (${d > 0 ? '+' : '−'}${Math.abs(d)})` : ''}</span>
          </div>
        );
      })}
      <p className="field-help">The next Quota round with this rule on starts each of you there.</p>
    </div>
  );
}
