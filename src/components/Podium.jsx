// The winner's moment: their Ball buddy in a crown, and the top three on a podium. Used by the round
// results and the season's hall of fame, so a win looks the same everywhere.
import { AvatarArt } from './Avatar.jsx';
import { placeLabel } from '../lib/format.js';
import { lighten } from '../lib/game-theme.js';
import { OCHRE } from '../lib/art-palette.js';
import { artFile } from '../lib/art-files.js';
import { ArtImage } from './ArtFile.jsx';
import './podium.css';
import { stickerUnits } from '../lib/sticker.js';

// The winner's crown: the round 4 crown alone, in gold (src/art/spots/goldcrown.svg). On the page the
// file is shown, so a redrawn file lands with no code change; its paths are also kept here, since
// the results image (ResultsArt.jsx) is an SVG read into a canvas, which can't load a file.
const CROWN_PATHS = [
  ['#e8b94a', 'M875.3 419.5L877.5 420.5L880.8 423.8L883.0 425.3L893.0 434.5L893.5 434.5L895.8 437.0L896.3 437.0L900.8 441.8L907.8 431.3L913.5 421.3L915.0 420.5L916.8 421.3L917.8 426.8L918.8 448.0L920.8 470.3L920.8 473.3L920.3 474.5L918.8 475.3L901.0 475.8L853.5 479.0L831.8 481.0L829.8 480.5L829.0 479.0L829.0 477.0L831.5 460.3L832.8 440.0L833.0 428.3L833.5 427.0L835.0 426.3L836.5 426.8L852.5 442.8L853.0 442.8L868.0 427.3L868.0 426.8L870.3 424.8L873.3 420.8Z'],
  ['#0a0a0a', 'M919.1 410.4C921.8 426 921.5 458.2 921.5 474.4C921.2 475.2 921.3 475.2 921.5 476.1C921.2 477 921.4 477.4 920.4 477.8C891.9 488.6 859.3 488.6 829.7 482.6C828.4 482.3 828.2 482 827.5 480.9C828.1 480.5 829 479.9 829.7 479.9C844.5 478.6 859.4 477.5 874.2 476.6C889.2 475.7 904.8 474.1 919.8 474C919.2 465.7 918.4 457.4 917.8 449C917.1 439.3 917 429.3 915.8 419.7C911.1 427.7 906.2 435.7 901.1 443.5C894.8 437 882.4 426.5 875.3 420.3C868.6 428.6 860.3 436.7 852.8 444.4C846.2 438.1 841.3 432.8 834.2 426.3C834.1 434.1 833 465.7 830.8 471.1C828.8 462.4 830.1 427.6 830.8 418.2C839 422 848.6 429.3 857.2 434C863.6 426.2 869.6 421.1 875.3 414.4C882 418.7 890.8 428 896.8 433.9C901.7 428.5 913.7 414.6 919.1 410.4Z'],
  ['#ff4d8b', 'M879.9 434.9C880.6 434.7 893 449.8 892.9 452C892.6 456.2 883.4 466.6 880.9 469.6C876.9 466 869.3 456.2 867 451.3C870.8 446.2 873.7 441.4 876.9 435.9C877.2 435.2 877.8 435.3 878.5 435.1L879.9 434.9Z'],
  ['#0a0a0a', 'M879.9 434.9C880.6 434.7 893 449.8 892.9 452C892.6 456.2 883.4 466.6 880.9 469.6C876.9 466 869.3 456.2 867 451.3C870.8 446.2 873.7 441.4 876.9 435.9C877.2 435.2 877.8 435.3 878.5 435.1C878.3 436.4 871.8 449.2 870.7 451.4C873.8 456.6 876.1 460.5 879.9 465.3L880.6 464.6C883.8 461 887.6 455.3 890.5 451.3C886.9 446.1 881.3 440.6 879.9 434.9Z'],
];
// eslint-disable-next-line react-refresh/only-export-components
export const CROWN_BOX = { x: 818, y: 402, w: 112, h: 92 };
const CROWN_FILE = artFile('spots', 'goldcrown');

/** The crown's shapes, in the drawing's own units (CROWN_BOX), to place inside a bigger SVG. */
export function CrownShape() {
  return <g>{CROWN_PATHS.map(([fill, d], i) => <path key={i} fill={fill} d={d} />)}</g>;
}

// Room round the crown in its box for the sticker border (the drawing's own box has 5 units under it)
const CROWN_PAD = 10;

/**
 * A crown, drawn to sit on top of an avatar circle: a die-cut sticker like every drawing, so its ink
 * outline holds on a dark card. `px` is about how wide it shows, for the border's width (the reveal's
 * row crown is 25px, a crowned face's 40 to 60px).
 */
export function Crown({ className = 'crown-art', px = /rv-row-crown/.test(className) ? 25 : 44 }) {
  const b = CROWN_BOX, p = CROWN_PAD;
  const box = [b.x - p, b.y - p, b.w + p * 2, b.h + p * 2];
  return (
    <svg className={className} viewBox={box.join(' ')} aria-hidden="true" focusable="false">
      {CROWN_FILE ? <ArtImage file={CROWN_FILE} x={b.x} y={b.y} w={b.w} h={b.h} sticker={stickerUnits(box[2], px)} /> : <CrownShape />}
    </svg>
  );
}

/** Someone's avatar with the crown on. `size` is the circle's width in px. */
export function CrownedFace({ model, size = 96 }) {
  if (!model) return null;
  return (
    <span className="crowned" style={{ '--face': `${size}px` }}>
      <Crown />
      <AvatarArt model={model} />
    </span>
  );
}

/**
 * The top three on steps (second, first, third from left), each with their buddy, name and amount.
 * `standings` is sorted best first; `faces` maps id to an avatar model; `fmt` formats an amount.
 */
export function Podium({ standings, faces, fmt, tint = OCHRE, amounts = true }) {
  // `rank` is the place with ties shared (two level on top are both 1st), so tied players stand on steps of the same height
  const rankOf = p => 1 + standings.filter(q => q.amount > p.amount).length;
  const top = standings.slice(0, 3).map((p, i) => ({ ...p, label: placeLabel(standings, i), i, rank: Math.min(3, rankOf(p)), more: [] }));
  // Anyone level with the last step's player shares that step (a tie for 3rd puts both on it), side by
  // side as on the team podium, so nobody tied into the top three is left off
  if (top.length === 3) top[2].more = standings.slice(3).filter(p => rankOf(p) === rankOf(top[2]));
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
  // Everyone level with first wears the crown, as on the reveal: a tie for top crowns them all
  const crowned = p => p.i === 0 || (top[0].amount > 0 && p.amount === top[0].amount);
  // The steps: first place in the full gold, second and third in paler washes of it (butter, cream), the
  // same podium on every screen so gold always means the winner (`tint` is there for a one-off)
  const steps = tint ? { '--pod-1': tint, '--pod-2': lighten(tint, 0.38), '--pod-3': lighten(tint, 0.6), '--pod-tint': tint } : undefined;
  const face = (p, size) => faces.get(p.id) && (crowned(p) ? <CrownedFace key={p.id} model={faces.get(p.id)} size={size} /> : <AvatarArt key={p.id} model={faces.get(p.id)} />);
  return (
    <div className={`podium ${tint ? 'themed' : ''}`.trim()} style={steps} role="list" aria-label="Top three">
      {order.map(p => {
        const all = [p, ...p.more];
        return (
          <div key={p.id} className={`pod pod-${p.rank}`} role="listitem">
            <span className={`pod-face ${all.length > 1 ? 'pod-faces' : ''}`.trim()}>{all.map(q => face(q, 64))}</span>
            <span className={`pod-name ${all.length > 1 ? 'shared' : ''}`.trim()}>{all.map(q => q.name.split(' ')[0]).join(' & ')}</span>
            {amounts && <span className={`pod-amt ${p.amount > 0 ? 'pos' : p.amount < 0 ? 'neg' : ''}`}>{fmt(p.amount, { sign: true })}{all.length > 1 ? ' each' : ''}</span>}
            <span className="pod-step d"><span className="sr-only">Place </span>{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Two sides on two steps, for a 2 v 2 (or any two-team) result: each team's buddies side by side
 * over its name, the winners on the taller step in the crown. Level sides share the height (and a T1).
 * `teams` is [{ id, name, players: [ids], amount }], `amount` being each player's.
 */
export function TeamPodium({ teams, faces, fmt, tint = OCHRE, amounts = true }) {
  const best = Math.max(...teams.map(t => t.amount));
  const level = teams.every(t => t.amount === best);
  const rank = t => (t.amount === best ? 1 : 2);
  const steps = tint ? { '--pod-1': tint, '--pod-2': lighten(tint, 0.38), '--pod-3': lighten(tint, 0.6), '--pod-tint': tint } : undefined;
  return (
    <div className={`podium team-podium ${tint ? 'themed' : ''}`.trim()} style={steps} role="list" aria-label="The two sides">
      {teams.map(t => {
        const won = rank(t) === 1 && !level;
        return (
          <div key={t.id} className={`pod pod-${rank(t)}`} role="listitem">
            <span className="pod-face pod-faces">
              {t.players.map(pid => faces.get(pid) && (won ? <CrownedFace key={pid} model={faces.get(pid)} size={52} /> : <AvatarArt key={pid} model={faces.get(pid)} />))}
            </span>
            <span className="pod-name">{t.name}</span>
            {amounts && <span className={`pod-amt ${t.amount > 0 ? 'pos' : t.amount < 0 ? 'neg' : ''}`}>{fmt(t.amount, { sign: true })}{t.players.length > 1 ? ' each' : ''}</span>}
            <span className="pod-step d"><span className="sr-only">Place </span>{level ? 'T1' : rank(t) === 1 ? '1' : '2'}</span>
          </div>
        );
      })}
    </div>
  );
}
