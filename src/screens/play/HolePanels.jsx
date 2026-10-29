// The main game's panel over the score rows (Play.jsx): the banker's bets, what a skin is worth, the
// wolf's pick, and the shared panels from GamePanels.jsx for the other games. Plus the banker's two
// sheets: who's banker on this hole, and one player's bet on the keypad.
import { useState } from 'react';
import { Icon, Numpad, PickChip, PickRow, Sheet } from '../../components/ui.jsx';
import {
  HammerPanel, MatchPanel, MoneyPanel, PointsPanel, RabbitPanel, ScramblePanel, SixesPanel, SnakePanel, TeamPanel, TotalsPanel, VegasPanel,
} from '../../components/GamePanels.jsx';
import { DrivesShortfall } from '../../components/ScrambleDrives.jsx';
import {
  bankerPress, bankerPressAll, betPresets, blindMultiplierOf, isTeamGame, matchScored, playersOn, posOf, settingsAt, skinsKinds, skinsTable, wolfCarryBefore,
} from '../../lib/round.js';
import { DRIVE_GAMES } from '../../lib/scramble-drives.js';
import { money } from '../../lib/golf.js';
import { padUnit, unitFmt } from '../../lib/play-for.js';
import { buzz } from '../../lib/delight.js';
import { onTheLine } from '../../lib/play-screen.js';

/**
 * The main game's panel for the hole on screen. `main` is the main game's own round (no one who's
 * only in the side games); `onBankerPick`, `onBet` and `onSkinsBet` open the sheets that change them.
 */
export function HolePanels({ main, game, hole, editable, banker, setBanker, phase, setPhase, wolf, setWolf, draft, touched, marks, setMarks, results, onBankerPick, onBet, onSkinsBet }) {
  return (
    <>
      {game === 'banker' && (
        <BankerPanel round={main} readOnly={!editable} banker={banker} setBanker={setBanker} phase={phase} setPhase={setPhase}
          onPick={onBankerPick} onBet={onBet} draft={draft} hole={hole} />
      )}
      {matchScored(main) && <MatchPanel round={main} hole={hole} readOnly={!editable} />}
      {isTeamGame(game) && !matchScored(main) && <TeamPanel round={main} hole={hole} />}
      {game === 'skins' && <SkinsPanel round={main} hole={hole} onChange={editable ? onSkinsBet : null} />}
      {game === 'wolf' && <WolfPanel round={main} hole={hole} wolf={wolf} setWolf={editable ? setWolf : null} />}
      {game === 'vegas' && <VegasPanel round={main} hole={hole} draft={draft} touched={touched} />}
      {game === 'sixes' && <SixesPanel round={main} hole={hole} />}
      {(game === 'stroke' || game === 'stableford' || game === 'quota') && <TotalsPanel round={main} />}
      {(game === 'nines' || game === 'bbb' || game === 'dots') && <PointsPanel round={main} />}
      {game === 'scramble' && <ScramblePanel round={main} />}
      {DRIVE_GAMES.includes(game) && <DrivesShortfall round={main} />}
      {game === 'aces' && <MoneyPanel round={main} results={results} icon="spade" label="Aces & deuces so far" />}
      {game === 'rabbit' && <RabbitPanel round={main} hole={hole} />}
      {game === 'snake' && <SnakePanel round={main} hole={hole} marks={marks} />}
      {game === 'hammer' && phase === 'scores' && <HammerPanel round={main} hole={hole} marks={marks} setMarks={setMarks} readOnly={!editable} />}
    </>
  );
}

/** The banker's sheets: who banks this hole (`picking`), and the keypad for one player's bet (`betPad`, their id). */
export function BankerSheets({ round, main, hole, banker, setBanker, picking, setPicking, betPad, setBetPad }) {
  return (
    <>
      <Sheet open={picking} onClose={() => setPicking(false)} title={`Banker · Hole ${hole.no}`}>
        <div className="pick-list sheet-picks" role="radiogroup" aria-label={`Banker on hole ${hole.no}`}>
        {playersOn(main, hole).map(p => (
          <PickRow key={p.id} radio on={banker.banker === p.id} title={p.name} sub={p.plays ? `Gets ${p.plays} stroke${p.plays > 1 ? 's' : ''}` : 'No strokes'}
            onClick={() => {
              const bets = {};
              const def = round.settings.banker.defaultBet;
              for (const q of playersOn(main, hole)) if (q.id !== p.id) bets[q.id] = banker.bets[q.id] ?? def;
              setBanker({ ...banker, banker: p.id, bets, doubled: {}, doubleBack: false });
              setPicking(false);
            }} />
        ))}
        </div>
      </Sheet>
      <Numpad open={!!betPad} title={`${round.players.find(p => p.id === betPad)?.name}’s bet`} {...padUnit(round)}
        initial={betPad ? banker.bets[betPad] : ''} min={round.settings.banker.min} max={round.settings.banker.max}
        quick={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
        onClose={() => setBetPad(null)} onDone={v => { setBanker({ ...banker, bets: { ...banker.bets, [betPad]: v } }); setBetPad(null); }} />
    </>
  );
}

// --------------------------- Banker ---------------------------------------

function BankerPanel({ round, banker, setBanker, phase, setPhase, onPick, onBet, hole, readOnly = false }) {
  const money = unitFmt(round); // points in a points or reward round
  const b = round.players.find(p => p.id === banker.banker);
  const others = playersOn(round, hole).filter(p => p.id !== banker.banker);
  // A press doubles a bet, or triples it on a par 3 with that house rule on
  const f = bankerPress(round, hole);
  // "Banker presses everyone" (house rule): the press back takes in every bet. It opens once someone has
  // pressed the banker on the hole ('after'); a round saved by the 2026-10-05 build ('any') needs nobody first
  const rule = bankerPressAll(round, hole);
  const pressed = others.some(p => banker.doubled[p.id]);
  const anyDoubled = pressed || rule === 'any';
  const all = !!rule && anyDoubled;
  const canPick = round.settings.banker.rotation === 'choice' || true;
  return (
    <>
      <div className="banker-bar">
        <div className="bb-who"><div className="bl">Banker this hole</div><div className="bn"><Icon name="bank" fill /> <span className="bn-name">{b?.name}</span></div></div>
        <div className="bb-line" aria-live="polite"><div className="bl">On the line</div><div className="bn">{money(onTheLine(banker, f, all))}</div></div>
        {readOnly ? null : phase === 'bets'
          ? canPick && <button className="change-btn" onClick={onPick} aria-label="Change the banker">Change</button>
          : <button className="change-btn" onClick={() => setPhase('bets')}><Icon name="coins" /> Bets</button>}
      </div>
      {phase === 'bets' && (
        <div className="scroll">
          <div style={{ padding: '6px 20px 8px' }}><div className="eyebrow">Step 1 of 2: Bets &amp; doubles</div></div>
          {others.map(p => (
            <div key={p.id} className="pcard">
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 10px' }}>
                <div style={{ flex: 1 }}><div className="pname">{p.name}</div><div className="ps">{p.plays ? `Gets ${p.plays} stroke${p.plays > 1 ? 's' : ''} on the round` : 'No strokes'}</div></div>
                {/* The chips below say the bet; the big amount only shows once a press changes it */}
                {banker.doubled[p.id] && <div className="bet-now" aria-hidden="true">{money((banker.bets[p.id] || 0) * (banker.doubleBack ? f * f : f))}</div>}
              </div>
              <BetChips name={p.name} value={banker.bets[p.id] || 0} fmt={money} presets={betPresets(round.settings.banker.min, round.settings.banker.max, round.settings.banker.defaultBet)}
                onPick={v => setBanker({ ...banker, bets: { ...banker.bets, [p.id]: v } })} onMore={() => onBet(p.id)} />
              <div style={{ padding: '0 16px 16px', display: 'flex' }}>
                <button className={`dbl-btn ${banker.doubled[p.id] ? 'on' : ''}`} style={{ flex: 1, height: 52, fontSize: 17 }} aria-pressed={!!banker.doubled[p.id]}
                  onClick={() => {
                    const doubled = { ...banker.doubled, [p.id]: !banker.doubled[p.id] };
                    const still = rule === 'any' || others.some(o => doubled[o.id]);
                    setBanker({ ...banker, doubled, doubleBack: still ? banker.doubleBack : false });
                  }}>
                  <Icon name="lightning" fill /> {banker.doubled[p.id] ? `${f === 3 ? 'Tripled' : 'Doubled'} · ${money(banker.bets[p.id] * (banker.doubleBack ? f * f : f))}` : all && banker.doubleBack ? `${f === 3 ? 'Triple' : 'Double'} it (pressed back · ${money(banker.bets[p.id] * f)})` : f === 3 ? 'Triple it' : 'Double it'}
                </button>
              </div>
            </div>
          ))}
          <div className="block" style={{ background: 'var(--surface)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{b?.name} can {f === 3 ? 'triple' : 'double'} back{rule ? ', on every bet' : ''}</div>
            <button className={`dbl-btn ${banker.doubleBack ? 'on' : ''}`} style={{ width: '100%', height: 52, fontSize: 17 }} disabled={!anyDoubled} aria-pressed={banker.doubleBack}
              onClick={() => setBanker({ ...banker, doubleBack: !banker.doubleBack })}>
              <Icon name="lightning" fill /> {all
                ? (banker.doubleBack ? `${f === 3 ? 'Tripled' : 'Doubled'} back · every bet ${f}×, pressed ones ${f * f}×` : `${f === 3 ? 'Triple' : 'Double'} back every bet`)
                : anyDoubled ? (banker.doubleBack ? `${f === 3 ? 'Tripled' : 'Doubled'} back · ${f * f}×` : `${f === 3 ? 'Triple' : 'Double'} back to ${f * f}×`) : `Unlocks when someone ${f === 3 ? 'triples' : 'doubles'}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Four common amounts at a tap, then Other for the keypad (which has $1 to $10 at a tap too). */
function BetChips({ name, value, presets, onPick, onMore, fmt = money }) {
  const other = !presets.includes(value);
  return (
    <div className="bet-chips" role="radiogroup" aria-label={`${name}’s bet`}>
      {presets.map(v => (
        <button key={v} role="radio" aria-checked={value === v} className={`bet-chip ${value === v ? 'on' : ''}`} onClick={() => { onPick(v); buzz(8); }}>{fmt(v)}</button>
      ))}
      <button className={`bet-chip more ${other ? 'on' : ''}`} onClick={onMore} aria-label={other ? `${name}’s bet, ${fmt(value)}. Other amount` : 'Other amount'}>
        {other ? fmt(value) : 'Other'}
      </button>
    </div>
  );
}

// --------------------------- Skins ----------------------------------------

function SkinsPanel({ round, hole, onChange }) {
  const money = unitFmt(round); // points in a points or reward round
  const kinds = skinsKinds(round);
  const cfg = round.settings.skins;
  const pot = cfg.payout === 'pot';
  const counts = Object.fromEntries(round.players.map(p => [p.id, 0]));
  // What this hole is worth, per kind: skins, plus the money when each skin has a price
  const worth = kinds.map(kind => {
    const t = skinsTable(round, kind);
    t.rows.filter(r => r.winner).forEach(r => { counts[r.winner] += r.skins; });
    const row = t.rows.find(r => r.hole.no === hole.no);
    const n = row?.pot ?? 1;
    const skins = `${n} skin${n > 1 ? 's' : ''}`;
    const tag = kinds.length > 1 ? `${kind === 'net' ? 'Net' : 'Gross'} ` : '';
    return pot ? `${tag}${skins}` : `${tag}${skins} · ${money(row?.purse ?? t.value * (round.players.length - 1))}`;
  });
  // Folded to one slim line (Layout Lab A): what the hole is worth and the price of a skin to change it,
  // with the skins each player has won so far quiet under it
  return (
    <div className="worth-strip">
      <div className="ws-main">
        <span className="ws-text"><span className="ws-l">Worth</span> {worth.join(' · ')}</span>
        {onChange && <button className="ws-change" onClick={onChange}>{pot ? `${money(cfg.stake ?? cfg.value)} each in` : `${money(cfg.value)} a skin`}</button>}
      </div>
      <div className="ws-counts">Skins won: {round.players.map(p => `${p.name.split(' ')[0]} ${Math.round(counts[p.id] * 10) / 10}`).join(' · ')}</div>
    </div>
  );
}

// --------------------------- Wolf -----------------------------------------

function WolfPanel({ round, hole, wolf, setWolf }) {
  const w = round.players.find(p => p.id === wolf.wolf);
  const others = playersOn(round, hole).filter(p => p.id !== wolf.wolf);
  // The bets in force on this hole, so a mid-round change counts from the hole it starts on
  const cfg = settingsAt(round, posOf(round, hole)).wolf;
  const mult = cfg.loneMultiplier;
  const blindMult = blindMultiplierOf(cfg);
  // Ties carry: tied holes since the last one won ride on this hole
  const carried = wolfCarryBefore(round, hole);
  // Blind wolf is honor system. It's offered whenever the rule is on for this hole (a round from before
  // it has no blind key, so no button), including on a saved hole, so a mis-tap can be fixed. A hole
  // saved blind keeps its button even if the rule was turned off later, and so does this pick while
  // it's being edited (tapping a partner by mistake never loses the way back).
  const blind = !!wolf.blind && wolf.partner === null;
  const offerBlind = blind || !!round.wolf?.[hole.no]?.blind || !!cfg.blind;
  // Picking a partner or plain lone wolf clears blind; the saved record only carries blind when it's on
  const pick = (partner, isBlind = false) => {
    const { blind: _was, ...rest } = wolf;
    setWolf(isBlind ? { ...rest, partner: null, blind: true } : { ...rest, partner });
    setOpen(false);
  };
  // Once the wolf has picked, the panel folds to one line of who's with whom (Change opens it again),
  // so the four score rows get the screen back. It opens while nothing's picked
  const [open, setOpen] = useState(false);
  const first = p => (p?.name || '').split(' ')[0];
  if (setWolf && wolf.partner !== undefined && !open) {
    const partner = others.find(p => p.id === wolf.partner);
    const rest = others.filter(p => p.id !== wolf.partner).map(first).join(', ');
    const side = partner ? `${first(w)} + ${first(partner)}` : `${first(w)} ${blind ? `blind wolf, ${blindMult}×` : `alone, ${mult}×`}`;
    return (
      <div className="wolf-panel folded">
        <div className="wp-line">
          <Icon name="paw-print" fill />
          <span className="wp-sides"><strong>{side}</strong> <span className="wp-v">v</span> {rest}</span>
          <button type="button" className="change-btn" onClick={() => setOpen(true)} aria-label="Change the wolf’s pick">Change</button>
        </div>
        {carried > 0 && <p className="wolf-note">{carried === 1 ? 'A tied hole is' : `${carried} tied holes are`} riding on this one: it pays {carried + 1}×.</p>}
      </div>
    );
  }
  return (
    <div className="wolf-panel">
      <div className="bl" style={{ marginBottom: setWolf ? 8 : 0 }}><Icon name="paw-print" fill /> <strong>{w?.name}</strong> is the wolf.{' '}
        {setWolf ? 'Pick a partner after the tee shots, or go it alone.'
          : wolf.partner === undefined ? 'No partner picked yet.' : blind ? 'Blind wolf.' : wolf.partner === null ? 'Lone wolf.' : `Partner: ${round.players.find(p => p.id === wolf.partner)?.name || '?'}.`}
      </div>
      {setWolf && <div className="chip-row" style={{ padding: 0 }}>
        {others.map(p => (
          <PickChip key={p.id} on={wolf.partner === p.id} onClick={() => pick(p.id)}>{p.name}</PickChip>
        ))}
        <PickChip className="lone" icon="paw-print" on={wolf.partner === null && !blind} onClick={() => pick(null)}>Lone wolf {mult}×</PickChip>
        {offerBlind && <PickChip className="lone" icon="eye-slash" on={blind} onClick={() => pick(null, true)}>Blind wolf {blindMult}×</PickChip>}
      </div>}
      {setWolf && offerBlind && <p className="wolf-note">Blind wolf: call it before anyone tees off.</p>}
      {carried > 0 && <p className="wolf-note">{carried === 1 ? 'A tied hole is' : `${carried} tied holes are`} riding on this one: it pays {carried + 1}×.</p>}
      {cfg.lastWolf && round.holes.length === 18 && posOf(round, hole) >= 17 && <p className="wolf-note">Last place is the wolf on the last two holes, to catch up.</p>}
    </div>
  );
}

