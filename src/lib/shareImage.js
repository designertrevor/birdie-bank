// The results image: a story-sized PNG of the round (course, game, winner, standings, the bets)
// drawn on a canvas in the app's fonts. shareCardModel is pure and tested; the drawing needs a DOM.
import { GAMES } from './round.js';
import { money } from './golf.js';
import { roundDate } from './format.js';
import { revealSteps } from './reveal.js';

export const IMAGE_W = 1080;
export const IMAGE_H = 1920;

const first = n => (n || '').split(' ')[0];

/**
 * Everything the card says, as plain strings. With showAmounts off, no dollar figure appears
 * anywhere: the winner, the order and the bets still read, the money does not.
 */
export function shareCardModel(round, res, { showAmounts = true } = {}) {
  const top = res.standings[0];
  const square = res.standings.every(p => p.amount === 0);
  const leaders = res.standings.filter(p => p.amount === top.amount);
  let headline, sub;
  if (square) { headline = 'All square'; sub = 'Nobody owes anybody'; }
  else if (leaders.length > 1) { headline = leaders.map(p => first(p.name)).join(' & '); sub = showAmounts ? `${money(top.amount, { sign: true })} each` : 'tie for top'; }
  else { headline = first(top.name); sub = showAmounts ? money(top.amount, { sign: true }) : 'takes it'; }

  // Ranks share a place on equal money
  let place = 0;
  const standings = res.standings.map((p, i) => {
    if (i === 0 || p.amount !== res.standings[i - 1].amount) place = i + 1;
    return { id: p.id, place, name: p.name, amount: showAmounts ? money(p.amount, { sign: true }) : null, sign: Math.sign(p.amount) };
  });

  const { title, steps } = revealSteps(round, res);
  const bets = steps.map(s => {
    let value = s.value || null;
    if (!value && s.amount != null) value = showAmounts ? money(s.amount) : null;
    if (!value && s.tie) value = '–';
    return { label: s.label, text: s.text, value };
  });

  return {
    brand: 'Birdie Bank',
    course: round.course?.name || '',
    meta: `${roundDate(round)} · ${GAMES[round.game]?.name || ''}`,
    headline, sub, big: showAmounts && !square,
    standings,
    betsTitle: title,
    bets,
    footer: 'Settled with Birdie Bank',
  };
}

/** A file name for the image: birdie-bank-pebble-beach-2026-09-26.png */
export function shareImageName(round) {
  const d = new Date(round.finishedAt || round.createdAt || 0);
  const pad = n => String(n).padStart(2, '0');
  const slug = (round.course?.name || 'round').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'round';
  return `birdie-bank-${slug}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.png`;
}

// ---------------------------------------------------------------------------
// Drawing (browser only)
// ---------------------------------------------------------------------------

const C = {
  bg: '#1a3a3a', ink: '#ffffff', soft: 'rgba(255,255,255,.72)', faint: 'rgba(255,255,255,.14)',
  mint: '#a4d4c5', pink: '#ff4d8b', ochre: '#e8b94a', peach: '#ffb084', onPastel: '#0a0a0a',
};
const DISPLAY = '"Bricolage Grotesque", Inter, system-ui, sans-serif';
const BODY = 'Inter, system-ui, sans-serif';

/** Make sure the web fonts are in before drawing, or the canvas falls back to system fonts. */
async function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const want = [`800 100px ${DISPLAY}`, `500 100px ${DISPLAY}`, `600 40px ${BODY}`, `700 40px ${BODY}`];
  const timeout = new Promise(r => setTimeout(r, 2500));
  try { await Promise.race([Promise.all(want.map(f => document.fonts.load(f))).then(() => document.fonts.ready), timeout]); }
  catch { /* draw with whatever is available */ }
}

/** Largest size (down to `min`) at which text fits in `maxW`. */
function fit(ctx, text, weight, family, max, min, maxW) {
  let size = max;
  for (; size > min; size -= 4) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return size;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

/** Trim text with an ellipsis so it fits `maxW` in the current font. */
function clip(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Letter-spaced text (canvas letterSpacing is not everywhere yet). */
function spaced(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
}

function draw(ctx, m) {
  const W = IMAGE_W, H = IMAGE_H, PAD = 96, inner = W - PAD * 2;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // A couple of soft shapes for colour, kept to the corners
  ctx.fillStyle = C.pink;
  ctx.beginPath(); ctx.arc(W - 40, 70, 250, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(W - 250, 250, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(164,212,197,.10)';
  ctx.beginPath(); ctx.arc(W + 60, H + 40, 240, 0, Math.PI * 2); ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Wordmark and where
  ctx.fillStyle = C.mint;
  ctx.font = `800 40px ${DISPLAY}`;
  spaced(ctx, m.brand.toUpperCase(), PAD, 170, 6);
  ctx.fillStyle = C.ink;
  fit(ctx, m.course, 700, BODY, 52, 34, inner - 260);
  ctx.fillText(clip(ctx, m.course, inner - 260), PAD, 262);
  ctx.fillStyle = C.soft;
  ctx.font = `600 38px ${BODY}`;
  ctx.fillText(clip(ctx, m.meta, inner - 200), PAD, 318);

  // The headline: who won, and how much
  let y = 540;
  ctx.fillStyle = C.ink;
  fit(ctx, m.headline, 800, DISPLAY, 200, 96, inner);
  ctx.fillText(clip(ctx, m.headline, inner), PAD - 6, y);
  y += m.big ? 170 : 96;
  ctx.fillStyle = m.big ? C.mint : C.soft;
  if (m.big) fit(ctx, m.sub, 800, DISPLAY, 170, 80, inner);
  else ctx.font = `500 64px ${DISPLAY}`;
  ctx.fillText(clip(ctx, m.sub, inner), PAD - 4, y);
  y += 90;

  // Standings
  const footerY = H - 110;
  const n = m.standings.length;
  const rowH = n > 6 ? 84 : 100;
  const betsRoom = footerY - 70 - (y + n * rowH) - 100;
  const betRowH = 78;
  const bets = m.bets.slice(0, Math.max(0, Math.min(5, Math.floor(betsRoom / betRowH))));
  for (const [i, p] of m.standings.entries()) {
    const top = y + i * rowH;
    ctx.fillStyle = C.faint;
    ctx.fillRect(PAD, top, inner, 2);
    const cy = top + rowH / 2 + 1;
    ctx.fillStyle = p.place === 1 && p.sign > 0 ? C.ochre : C.faint;
    ctx.beginPath(); ctx.arc(PAD + 30, cy, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.place === 1 && p.sign > 0 ? C.onPastel : C.ink;
    ctx.font = `700 30px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(p.place), PAD + 30, cy + 11);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = `600 ${n > 6 ? 40 : 46}px ${BODY}`;
    let amtW = 0;
    if (p.amount) {
      ctx.save();
      ctx.font = `800 ${n > 6 ? 46 : 54}px ${DISPLAY}`;
      amtW = ctx.measureText(p.amount).width;
      ctx.fillStyle = p.sign > 0 ? C.mint : p.sign < 0 ? C.peach : C.soft;
      ctx.textAlign = 'right';
      ctx.fillText(p.amount, PAD + inner, cy + 18);
      ctx.restore();
    }
    ctx.fillText(clip(ctx, p.name, inner - 90 - amtW - 24), PAD + 84, cy + 16);
  }
  y += n * rowH;
  ctx.fillStyle = C.faint;
  ctx.fillRect(PAD, y, inner, 2);

  // The bets, when there is room
  if (bets.length) {
    y += 100;
    ctx.fillStyle = C.mint;
    ctx.font = `700 28px ${BODY}`;
    spaced(ctx, m.betsTitle.toUpperCase(), PAD, y, 3);
    y += 20;
    for (const b of bets) {
      const cy = y + betRowH / 2;
      let valW = 0;
      if (b.value) {
        ctx.font = `800 40px ${DISPLAY}`;
        valW = ctx.measureText(b.value).width;
        ctx.fillStyle = b.value === '–' ? C.soft : C.ink;
        ctx.textAlign = 'right';
        ctx.fillText(b.value, PAD + inner, cy + 14);
        ctx.textAlign = 'left';
      }
      const room = inner - valW - 32;
      ctx.fillStyle = C.soft;
      ctx.font = `600 32px ${BODY}`;
      const label = clip(ctx, b.label, room * 0.5);
      ctx.fillText(label, PAD, cy + 12);
      const lw = ctx.measureText(label).width + 20;
      if (b.text) {
        ctx.fillStyle = C.ink;
        ctx.font = `700 32px ${BODY}`;
        ctx.fillText(clip(ctx, b.text, room - lw), PAD + lw, cy + 12);
      }
      y += betRowH;
    }
  }

  // Footer
  ctx.fillStyle = C.soft;
  ctx.font = `600 30px ${BODY}`;
  ctx.fillText(m.footer, PAD, footerY);
}

/** Draw the results card and return it as a PNG blob. */
export async function renderShareImage(round, res, opts = {}) {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  draw(ctx, shareCardModel(round, res, opts));
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}
