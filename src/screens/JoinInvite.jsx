// First run for someone who opened a join link: an invite card (who asked you, the game, the
// bets, the course and who's in), then pick your seat, then check your strokes, then you're in.
// Not on the list? Ask the scorekeeper for a seat and wait here for them to let you in.
// No organizer onboarding. They become "me" using their player from the shared round.
import { Spot } from '../components/Spot.jsx';
import { useEffect, useMemo, useState } from 'react';
import { BallIllo, Icon, Screen, Segmented } from '../components/ui.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { LinkBrand, LinkHowTo } from '../components/LinkBrand.jsx';
import { useGroupAvatars } from '../lib/useAvatars.js';
import { getState, update, uid } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { afterJoin, inviteBetLines, teamLine } from '../lib/join.js';
import { cancelSeatRequest, fetchShared, joinShared, requestSeat, watchSeatRequest } from '../lib/sync.js';
import { assemble, cleanRequestName } from '../lib/sync-model.js';
import { GAMES, addPlayerProblem, isJustPlaying } from '../lib/round.js';
import { JUST_PLAYING, JUST_PLAYING_HELP, JUST_PLAYING_TAG, addJustPlayingProblem, cardOnlyRound } from '../lib/just-playing.js';
import { addRound } from '../lib/rounds.js';
import { roundStakeLines } from '../lib/stakes.js';
import { firstName, gameLabel, strokesLabel } from '../lib/format.js';
import { payFields } from '../lib/pay.js';
import { noMoneyNote, onTab, playForLine } from '../lib/play-for.js';
import { money } from '../lib/golf.js';
import { bigInvite } from '../lib/big-view.js';
import { useAgeCheck } from '../components/AgeCheck.jsx';
import { needsAgeCheck } from '../lib/age.js';

// A seat request survives the page being closed, so reopening the link keeps waiting
const seatKey = code => `bb-seat:${code}`;
function loadSeat(code) { try { return JSON.parse(localStorage.getItem(seatKey(code))) || null; } catch { return null; } }
function saveSeat(code, v) { try { if (v) localStorage.setItem(seatKey(code), JSON.stringify(v)); else localStorage.removeItem(seatKey(code)); } catch { /* storage blocked */ } }


/** The invite card as a pushed screen, for someone already set up (a join link, or a typed code). */
export function JoinInviteScreen({ code }) {
  const nav = useNav();
  return <JoinInvite code={code} setUp onJoined={(id, done) => nav.reset('upnext', afterJoin(id, done))} onSkip={nav.pop} />;
}

/**
 * `setUp`: this phone already has its own player (it's past onboarding), so joining keeps who
 * "you" are and just adds the round, the way the old join sheet did.
 */
export default function JoinInvite({ code, onJoined, onSkip, setUp = false }) {
  const [found, setFound] = useState(null);
  const [err, setErr] = useState(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  // card → seat → confirm, or watch, or ask → waiting → (in: join) | no | gone
  const [step, setStep] = useState(() => (loadSeat(code) ? 'waiting' : 'card'));
  const [seat, setSeat] = useState(null);
  // Someone already set up asks for a seat under their own name (they can still change it)
  const [name, setName] = useState(() => loadSeat(code)?.name || (setUp ? (() => { const s = getState(); return s.players?.[s.me]?.name || ''; })() : ''));
  const [askErr, setAskErr] = useState(false);
  const [joinErr, setJoinErr] = useState(false);
  // Said they're under 18 when taking a seat in a money round (age.js): they can still watch
  const [minor, setMinor] = useState(false);
  const checkAge = useAgeCheck();
  // "Add me" just playing: on the card with no bet (just-playing.js). Null until picked: the default
  // is what the round can take
  const [casualPick, setCasualPick] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchShared(code)
      .then(r => { if (cancelled) return; if (r) { setFound(r); setErr(null); } else setErr('missing'); })
      .catch(() => { if (!cancelled) setErr('offline'); });
    return () => { cancelled = true; };
  }, [code, tries]);

  const round = useMemo(() => (found ? assemble(found.meta, found.holes) : null), [found]);

  const join = async (player, watcherName) => {
    setBusy(true); setJoinErr(false);
    try {
      if (setUp) {
        // Already have this round (picked a seat before): open it rather than join twice
        const have = Object.values(getState().rounds).find(r => r.shared?.code === code);
        if (have) { saveSeat(code, null); onJoined(have.id, have.status === 'done'); return; }
      } else update(s => {
        // Reuse the round's player id so this round's results are already "mine"
        const id = player?.id || uid('p_');
        s.players[id] = { id, name: player?.name || watcherName.trim(), index: player?.index ?? null, ...payFields(player), createdAt: Date.now() };
        s.me = id;
        s.onboarded = true;
      });
      const latest = (await fetchShared(code).catch(() => null)) || found;
      const id = await joinShared(code, latest, player?.id ?? null);
      saveSeat(code, null);
      onJoined(id, latest.meta.status === 'done');
    } catch {
      setBusy(false);
      setJoinErr(true);
    }
  };

  // A seat in a money round asks the one-time age question first. A finished round has no money
  // left to play, so seeing how it ended never asks
  const okToPlay = async () => {
    if (!round || round.status === 'done' || !needsAgeCheck(getState(), round)) return true;
    const answer = await checkAge();
    if (answer === 'under') setMinor(true);
    return answer === 'adult';
  };

  // "Just keep my own score": a card of your own on the same course, no game and nothing shared
  const ownCard = () => {
    const meta = found?.meta;
    if (!meta) return;
    const id = uid('r_');
    update(s => {
      let me = setUp ? s.players?.[s.me] : null;
      if (!me) {
        const pid = uid('p_');
        me = { id: pid, name: cleanRequestName(name) || 'Me', index: null, venmo: '', createdAt: Date.now() };
        s.players[pid] = me;
        s.me = pid;
        s.onboarded = true;
      }
      addRound(s, cardOnlyRound({ id, meta, me: { id: me.id, name: me.name, index: me.index ?? null } }));
    });
    saveSeat(code, null);
    onJoined(id, false);
  };

  // Waiting on the scorekeeper: watch the request, and once they let you in, take the seat
  const pending = step === 'waiting' ? loadSeat(code) : null;
  const pendingNo = pending?.no ?? null;
  useEffect(() => {
    if (pendingNo == null) return;
    let done = false;
    const stop = watchSeatRequest(code, pendingNo, async r => {
      if (done) return;
      if (r.status === 'no' || r.status === 'gone') { done = true; saveSeat(code, null); setStep(r.status); return; }
      if (r.status !== 'in' || !r.playerId) return;
      done = true;
      // Their phone sends the round with you in it first; give it a moment to land
      for (let i = 0; i < 20; i++) {
        try {
          const latest = await fetchShared(code);
          const me = latest?.meta.players?.find(p => p.id === r.playerId);
          if (me) { setFound(latest); join(me); return; }
        } catch { /* no signal yet */ }
        await new Promise(res => setTimeout(res, 1500));
      }
      done = false; // keep watching; the next check tries again
    });
    return () => { done = true; stop(); };
    // join is recreated each render; the request number is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, pendingNo]);

  const meta = found?.meta;
  // Everyone's avatar on the seats: the one their profile has, or the one the round carried (avatars.js)
  const faces = useGroupAvatars(meta?.players);
  const game = meta && GAMES[meta.game];
  // A group's round in a Big Game reads as the game, not its own $0 stroke play (big-view.js)
  const big = meta ? bigInvite(meta, money) : null;
  const host = typeof meta?.hostName === 'string' && meta.hostName.trim() ? firstName(meta.hostName) : null;
  // Seat requests go to whoever keeps score now, which may not be the organizer (see keeper.js)
  const keeperSeat = meta?.keeper?.id && Array.isArray(meta.players) ? meta.players.find(p => p?.id === meta.keeper.id) : null;
  const keeperFirst = typeof keeperSeat?.name === 'string' && keeperSeat.name.trim() ? firstName(keeperSeat.name) : host;
  const scorekeeper = keeperFirst || 'the scorekeeper';
  // Someone who opened the link with no app gets the app's name and "No download needed" on every step
  const brand = setUp ? null : <LinkBrand />;

  if (!meta && step !== 'waiting') {
    const missing = err === 'missing';
    return (
      <Screen className="onboard">
        {brand}
        <div className="scroll onboard-body">
          <BallIllo className="onboard-illo" face={!err} />
          <h1 className="onboard-title" style={{ fontSize: 34 }} aria-live="polite">{err ? (missing ? 'Round not found' : 'No signal') : 'Finding your round…'}</h1>
          <p className="onboard-text" aria-live="polite">
            {!err && <>Code {code}</>}
            {missing && <>We can’t find round {code}. It may have finished, or the link is old. Ask the scorekeeper for a fresh one.</>}
            {err === 'offline' && <>Couldn’t get the round. Check your signal and try again.</>}
          </p>
        </div>
        {err && (
          <div className="cta-wrap">
            {!missing && <button className="full-btn" onClick={() => { setErr(null); setTries(t => t + 1); }}>Try again <Icon name="arrow-clockwise" /></button>}
            <button className={`full-btn ${missing ? '' : 'outline'}`} onClick={onSkip}>{setUp ? 'Back to Up next' : 'Start my own round instead'}</button>
          </div>
        )}
      </Screen>
    );
  }

  if (step === 'own') {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body join-body">
          <Spot kind="card" size={120} className="join-spot" />
          <h1 className="onboard-title join-h">Just keep your own score</h1>
          <p className="onboard-text join-p">Your own card at {meta.course?.name || 'the course'}, {meta.holes.length} holes. No bets, just your score.</p>
          {!setUp && <>
            <label className="field-label" htmlFor="ji-own">Your name</label>
            <input id="ji-own" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sam" autoComplete="given-name" maxLength={24} />
          </>}
        </div>
        <div className="cta-wrap">
          <button className="full-btn" disabled={!setUp && !cleanRequestName(name)} onClick={ownCard}>Start my card <Icon name="arrow-right" /></button>
          <button className="full-btn outline" onClick={() => setStep('card')}>Back</button>
        </div>
      </Screen>
    );
  }

  if (step === 'watch') {
    return (
      <Screen className="onboard">
        {brand}
        <div className="scroll onboard-body join-body">
          <Spot kind="link" size={120} className="join-spot" />
          <h1 className="onboard-title join-h">Follow along</h1>
          <p className="onboard-text join-p">See every hole as it’s scored. Add your name so the group knows who’s watching.</p>
          <label className="field-label" htmlFor="ji-name">Your name</label>
          <input id="ji-name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Trevor" autoComplete="given-name" maxLength={24} />
        </div>
        <div className="cta-wrap">
          {joinErr && <p className="field-error" role="alert" style={{ textAlign: 'center' }}>Couldn’t join. Check your signal and try again.</p>}
          <button className="full-btn" disabled={!name.trim() || busy} onClick={() => join(null, name)}>{busy ? 'Joining…' : <>Start watching <Icon name="eye" /></>}</button>
          <button className="full-btn outline" onClick={() => setStep('card')}>Back</button>
        </div>
      </Screen>
    );
  }

  // Under 18 and this one's for money: follow along live instead, or ask for points
  if (minor && meta) {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <Spot kind="shades" size={140} className="join-spot" />
          <h1 className="onboard-title join-h">This one’s for money</h1>
          <p className="onboard-text">Money rounds are for 18 or older. Follow along live, or ask {scorekeeper} to play it for points.</p>
        </div>
        <div className="cta-wrap">
          <button className="full-btn" onClick={() => { setMinor(false); if (setUp) join(null); else setStep('watch'); }}>Watch instead <Icon name="eye" /></button>
          <button className="full-btn outline" onClick={() => { setMinor(false); setStep('card'); }}>Back</button>
        </div>
      </Screen>
    );
  }

  if (step === 'ask') {
    const betProblem = round ? addPlayerProblem(round) : null;
    const jpProblem = round ? addJustPlayingProblem(round) : null;
    // A game that can't take another betting player (set sides, or a full group) can still take someone just playing
    const casual = !jpProblem && (casualPick ?? !!betProblem);
    const problem = casual ? null : betProblem;
    const send = async () => {
      // Just playing has no money on it, so it never asks the age question
      if (!casual && !(await okToPlay())) return;
      setBusy(true); setAskErr(false);
      try {
        const clean = cleanRequestName(name);
        const no = await requestSeat(code, clean, { justPlaying: casual });
        saveSeat(code, { no, name: clean, ...(casual ? { justPlaying: true } : {}) });
        setStep('waiting');
      } catch { setAskErr(true); }
      setBusy(false);
    };
    return (
      <Screen className="onboard">
        {brand}
        <div className="scroll onboard-body join-body">
          <h1 className="onboard-title join-h">Not on the list?</h1>
          {problem ? (
            <>
              <p className="onboard-text join-p">{problem}</p>
              <p className="hint-card join-hint"><Icon name="info" fill /> You can still follow along live, or ask {scorekeeper} to start a new round with you in it.</p>
            </>
          ) : (
            <>
              <p className="onboard-text join-p">{casual
                ? <>Tell {scorekeeper} who you are. They get a note on their phone and put you on the card, with no bet.</>
                : <>Tell {scorekeeper} who you are. They get a note on their phone and give you a seat, and your money counts from the hole you start on.</>}</p>
              {!jpProblem && (
                <div className="join-how">
                  <div className="eyebrow" id="ji-how">How do you want to play?</div>
                  <Segmented label="How do you want to play?" className="press-mode-row" btn="pm-btn" value={casual ? 'casual' : 'bet'} onChange={v => setCasualPick(v === 'casual')}
                    options={[{ value: 'bet', label: 'In the games', disabled: !!betProblem }, { value: 'casual', label: JUST_PLAYING }]} />
                  <p className="field-help">{casual ? `${JUST_PLAYING_HELP}${betProblem ? ` ${betProblem}` : ''}` : 'Your money counts like everyone’s.'}</p>
                </div>
              )}
              <label className="field-label" htmlFor="ji-ask">Your name</label>
              <input id="ji-ask" className="name-input" value={name} onChange={e => { setName(e.target.value); setAskErr(false); }} placeholder="e.g. Sam" autoComplete="given-name" maxLength={24} />
              {askErr && (
                <p className="hint-card join-hint" role="alert"><Icon name="warning" fill /> Couldn’t send that. Ask {scorekeeper} to add you from the round menu (Add a player), then pick your name from the seats.</p>
              )}
            </>
          )}
        </div>
        <div className="cta-wrap">
          {problem
            ? <button className="full-btn" onClick={() => (setUp ? join(null) : setStep('watch'))}>Watch instead <Icon name="eye" /></button>
            : askErr
              ? <button className="full-btn" onClick={() => { setAskErr(false); setTries(t => t + 1); setStep('seat'); }}>They added me, check again <Icon name="arrow-clockwise" /></button>
              : <button className="full-btn" disabled={!cleanRequestName(name) || busy} onClick={send}>{busy ? 'Sending…' : <>Ask to join <Icon name="paper-plane-tilt" /></>}</button>}
          <button className="full-btn outline" onClick={() => setStep('seat')}>Back to the seats</button>
        </div>
      </Screen>
    );
  }

  if (step === 'waiting' || step === 'no' || step === 'gone') {
    const cancel = async () => {
      const s = loadSeat(code);
      saveSeat(code, null);
      setStep('seat');
      if (s) await cancelSeatRequest(code, s.no);
    };
    const title = step === 'waiting' ? (busy ? 'You’re in' : `Waiting on ${scorekeeper}`) : step === 'no' ? 'Not this time' : 'Round closed';
    return (
      <Screen className="onboard">
        {brand}
        <div className="scroll onboard-body">
          <BallIllo className="onboard-illo" face={step !== 'gone'} />
          <h1 className="onboard-title join-h" aria-live="polite">{title}</h1>
          <p className="onboard-text">
            {step === 'waiting' && (busy ? 'Taking you to your seat.' : <>Asked for a seat as {pending?.name || name}{pending?.justPlaying ? ', just playing' : ''}. Keep this open: you’ll go straight in when {scorekeeper} says yes.</>)}
            {step === 'no' && <>{keeperFirst || 'The scorekeeper'} didn’t add you to this one. You can still follow along live.</>}
            {step === 'gone' && <>{host || 'The scorekeeper'} stopped sharing this round.</>}
          </p>
        </div>
        <div className="cta-wrap">
          {step === 'waiting' && !busy && <button className="full-btn outline" onClick={cancel}>Cancel request</button>}
          {step === 'no' && meta && <button className="full-btn" onClick={() => (setUp ? join(null) : setStep('watch'))}>Watch instead <Icon name="eye" /></button>}
          {step !== 'waiting' && <button className="full-btn outline" onClick={onSkip}>{setUp ? 'Back to Up next' : 'Start my own round instead'}</button>}
        </div>
      </Screen>
    );
  }

  const handicaps = !!meta.useHandicaps;
  const teamOf = pid => (meta.teams || []).find(t => t.players?.includes(pid));
  const done = meta.status === 'done';

  if (step === 'confirm' && seat) {
    const team = teamOf(seat.id);
    const mates = team ? team.players.filter(x => x !== seat.id).map(x => firstName(meta.players.find(p => p.id === x)?.name)).filter(Boolean) : [];
    const from = meta.joined?.[seat.id];
    // A seat that's just playing: on the card, out of every bet
    const casualSeat = isJustPlaying(meta, seat.id);
    return (
      <Screen className="onboard">
        {brand}
        <div className="scroll onboard-body join-body">
          <div className="join-confirm">
            <Avatar base="join-avatar" model={faces.get(seat.id)} name={seat.name} size="lg" />
            <h1 className="onboard-title join-h">You’re {firstName(seat.name)}</h1>
            {casualSeat ? (
              <ul className="join-facts">
                <li><Icon name="smiley" fill /> {JUST_PLAYING}. {JUST_PLAYING_HELP}</li>
                {from != null && <li><Icon name="user-plus" fill /> On the card from hole {from}</li>}
                <li><Icon name={game?.icon || 'golf'} fill /> The group plays {game ? gameLabel(meta) : 'golf'}. You’re out of it.</li>
              </ul>
            ) : (
            <ul className="join-facts">
              {handicaps && !big && <li><Icon name="golf" fill /> {strokesLabel(seat.plays)}</li>}
              {big && bigInvite(meta, money, seat.id)?.strokes && <li><Icon name="golf" fill /> {bigInvite(meta, money, seat.id).strokes}</li>}
              {team && <li><Icon name="users-three" fill /> {teamLine(team.name, mates)}</li>}
              {from != null && <li><Icon name="user-plus" fill /> Starts on hole {from}. Your money counts from there</li>}
              {big ? <li><Icon name="users-four" fill /> {big.title} · {big.bets}</li>
                : <li><Icon name={game?.icon || 'golf'} fill /> {game ? gameLabel(meta) : 'Golf'} · {roundStakeLines(meta).map(l => l.line).join(' + ')}</li>}
              {/* Your own side bets, so nobody walks onto the tee not knowing they have one */}
              {inviteBetLines(meta, seat.id).map(l => <li key={l}><Icon name="hand-coins" fill /> Side bet: {l}</li>)}
            </ul>
            )}
          </div>
          {handicaps && !casualSeat && <p className="field-help">Strokes look wrong? Tell {scorekeeper} before you tee off.</p>}
        </div>
        <div className="cta-wrap">
          {joinErr && <p className="field-error" role="alert" style={{ textAlign: 'center' }}>Couldn’t join. Check your signal and try again.</p>}
          <button className="full-btn" disabled={busy} onClick={async () => { if (done || await okToPlay()) join(seat); }}>{busy ? 'Joining…' : done ? <>See the results <Icon name="arrow-right" /></> : <>Into the round <Icon name="arrow-right" /></>}</button>
          <button className="full-btn outline" disabled={busy} onClick={() => setStep('seat')}>That’s not me</button>
        </div>
      </Screen>
    );
  }

  if (step === 'seat') {
    return (
      <Screen className="onboard">
        {brand}
        <div className="scroll onboard-body join-body">
          <h1 className="onboard-title join-h">Pick your seat</h1>
          <p className="onboard-text join-p">Which one are you?</p>
          <div className="seat-grid">
            {meta.players.map(p => {
              const team = teamOf(p.id);
              const from = meta.joined?.[p.id];
              const casualSeat = isJustPlaying(meta, p.id);
              const facts = [casualSeat ? JUST_PLAYING_TAG : handicaps ? strokesLabel(p.plays) : null, team?.name, from != null ? `From hole ${from}` : null].filter(Boolean);
              return (
                <button key={p.id} className="seat-tile" aria-label={[`I’m ${p.name}`, ...facts].join(', ')} onClick={() => { setSeat(p); setStep('confirm'); }}>
                  <Avatar base="join-avatar" model={faces.get(p.id)} name={p.name} />
                  <span className="seat-name">{p.name}</span>
                  <span className="seat-sub">
                    {facts.join(' · ') || ' '}
                  </span>
                </button>
              );
            })}
            {!done && (
              <button className="seat-tile add" aria-label="Not on the list? Add me" onClick={() => setStep('ask')}>
                <span className="join-avatar add" aria-hidden="true"><Icon name="plus" /></span>
                <span className="seat-name">Not on the list?</span>
                <span className="seat-sub">Add me</span>
              </button>
            )}
          </div>
        </div>
        <div className="cta-wrap">
          <button className="full-btn outline" onClick={() => setStep('card')}>Back</button>
        </div>
      </Screen>
    );
  }

  // The invite card
  const names = meta.players.map(p => firstName(p.name));
  // The host's own seat, when they're playing, so their avatar is the one they picked: the seat on
  // the host phone (keeper-lock.js devs; none when the organizer isn't playing). A round shared
  // before phones were tracked falls back to the seat with the host's first name
  const hostSeat = meta.hostDev
    ? meta.players.find(p => meta.devs?.[p.id] === meta.hostDev)
    : host ? meta.players.find(p => firstName(p.name) === host) : null;
  return (
    <Screen className="onboard">
      {brand}
      <div className="scroll onboard-body join-body">
        <div className="invite-card">
          <div className="ic-from">
            {host ? <><Avatar base="join-avatar" model={faces.get(hostSeat?.id)} name={host} size="sm" /> <span><strong>{host}</strong> invited you</span></> : <span>You’re invited</span>}
          </div>
          <div className="ic-game"><Icon name={big ? 'users-four' : game?.icon || 'golf'} fill /> {big ? big.title : game ? gameLabel(meta) : 'Golf'}</div>
          <div className="ic-course">{meta.course?.name} · {meta.holes.length} holes</div>
          {playForLine(meta) && <div className="ic-playfor"><Icon name={meta.playFor?.kind === 'reward' ? 'gift' : 'trophy'} fill /> {playForLine(meta)}</div>}
          <dl className="ic-facts">
            {big ? <div><dt>The Big Game</dt><dd>{big.players} players in {big.groups} groups · {big.bets}</dd></div>
              : <div><dt>Bets</dt><dd>{roundStakeLines(meta).map(l => l.line).filter(Boolean).join(' + ') || '–'}</dd></div>}
            {inviteBetLines(meta).length > 0 && <div><dt>Side bets</dt><dd>{inviteBetLines(meta).join('; ')}</dd></div>}
            <div>
              <dt>Who’s in</dt>
              <dd>
                <span className="ic-stack">{meta.players.slice(0, 6).map(p => <Avatar key={p.id} base="join-avatar" model={faces.get(p.id)} name={p.name} size="sm" />)}</span>
                <span>{names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`}</span>
              </dd>
            </div>
          </dl>
          {done && <p className="ic-note">This round is finished. Pick your seat to see how it ended.</p>}
        </div>
        {!setUp && <LinkHowTo kind="join" money={onTab(meta)} />}
        <p className="field-help">{noMoneyNote(meta) || 'Friendly wagers only. Birdie Bank never holds or moves money. You settle up yourselves.'}</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => setStep('seat')}>Pick your seat <Icon name="arrow-right" /></button>
        <button className="full-btn outline" disabled={busy} onClick={() => (setUp ? join(null) : setStep('watch'))}>{busy ? 'Joining…' : 'I’m just watching'}</button>
        {/* Not up for a bet at all: a card of your own on the same course (just-playing.js) */}
        {!done && <button className="text-link own-card-link" onClick={() => setStep('own')}>Just keep my own score</button>}
        {setUp && <button className="sheet-cancel" style={{ width: '100%', margin: 0 }} onClick={onSkip}>Not now</button>}
        {setUp && joinErr && <p className="field-error" role="alert" style={{ textAlign: 'center' }}>Couldn’t join. Check your signal and try again.</p>}
      </div>
    </Screen>
  );
}
