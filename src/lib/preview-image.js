// The preview image: a story-sized PNG of a planned round for the group text, drawn on a canvas in
// the same colours and fonts as the results image (shareImage.js). Everything it says comes from
// previewCardModel (preview.js), which is pure and tested; the drawing needs a DOM.
import { BODY, C, DISPLAY, IMAGE_H, IMAGE_W, clip, fit, fontsReady, spaced } from './shareImage.js';
import { previewCardModel } from './preview.js';

/** Words broken into lines that fit `maxW` in the current font, at most `max` lines (the last one trimmed). */
function wrap(ctx, text, maxW, max = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = clip(ctx, `${kept[max - 1]} ${lines.slice(max).join(' ')}`, maxW);
  return kept;
}

function draw(ctx, m) {
  const W = IMAGE_W, H = IMAGE_H, PAD = 96, inner = W - PAD * 2;
  const footerY = H - 110;
  let y = 510;
  const room = need => y + need <= footerY - 60;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // The pink corner carries the countdown; the ochre dot sits under it, as on the results card
  ctx.fillStyle = C.pink;
  ctx.beginPath(); ctx.arc(W - 40, 70, 250, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(W - 280, 300, 50, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(164,212,197,.10)';
  ctx.beginPath(); ctx.arc(W + 60, H + 40, 240, 0, Math.PI * 2); ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillStyle = C.onPastel;
  if (m.countUnit) {
    ctx.font = `800 132px ${DISPLAY}`;
    ctx.fillText(m.countBig, W - 150, 150);
    ctx.font = `800 30px ${DISPLAY}`;
    ctx.fillText(m.countUnit.toUpperCase(), W - 150, 196);
  } else if (m.countBig) {
    ctx.font = `800 58px ${DISPLAY}`;
    ctx.fillText(m.countBig.toUpperCase(), W - 150, 150);
  }
  ctx.textAlign = 'left';

  // What and where
  ctx.fillStyle = C.mint;
  ctx.font = `800 40px ${DISPLAY}`;
  spaced(ctx, m.eyebrow.toUpperCase(), PAD, 170, 6);
  ctx.fillStyle = C.ink;
  fit(ctx, m.course, 700, BODY, 52, 34, inner - 300);
  ctx.fillText(clip(ctx, m.course, inner - 300), PAD, 262);
  ctx.fillStyle = C.soft;
  ctx.font = `600 38px ${BODY}`;
  ctx.fillText(clip(ctx, m.meta, inner - 260), PAD, 318);

  // The game, then the bets and side games
  ctx.fillStyle = C.ink;
  fit(ctx, m.headline, 800, DISPLAY, 170, 90, inner);
  ctx.fillText(clip(ctx, m.headline, inner), PAD - 6, y);
  y += 84;
  if (m.sub) {
    ctx.fillStyle = C.mint;
    fit(ctx, m.sub, 700, BODY, 48, 32, inner);
    ctx.fillText(clip(ctx, m.sub, inner), PAD, y);
    y += 66;
  }
  if (m.playFor) {
    ctx.fillStyle = C.ochre;
    ctx.font = `700 42px ${BODY}`;
    ctx.fillText(clip(ctx, m.playFor, inner), PAD, y);
    y += 62;
  }

  const section = label => {
    y += 56;
    ctx.fillStyle = C.faint;
    ctx.fillRect(PAD, y - 50, inner, 2);
    ctx.fillStyle = C.mint;
    ctx.font = `700 28px ${BODY}`;
    spaced(ctx, label.toUpperCase(), PAD, y, 3);
    y += 58;
  };
  const lines = (text, font, color, lineH, max) => {
    ctx.font = font;
    ctx.fillStyle = color;
    for (const l of wrap(ctx, text, inner, max)) {
      if (!room(lineH)) return false;
      ctx.fillText(l, PAD, y);
      y += lineH;
    }
    return true;
  };

  // Who's in
  section('Who’s in');
  lines(m.inLine, `700 44px ${BODY}`, C.ink, 58, 3);
  if (m.maybeLine) lines(m.maybeLine, `600 36px ${BODY}`, C.soft, 50, 2);

  // Two-player side bets and agreed challenges: "Dave v Mike, $20 match"
  if (m.pairBets?.length && room(160)) {
    section('Side bets');
    for (const l of m.pairBets.slice(0, 3)) if (!lines(l, `600 36px ${BODY}`, C.ink, 50, 1)) break;
    if (m.pairBets.length > 3 && room(50)) lines(`and ${m.pairBets.length - 3} more`, `600 30px ${BODY}`, C.soft, 44, 1);
  }

  // Strokes: who gets them and on which holes
  if ((m.strokes.length || m.strokesNote) && room(200)) {
    section('Strokes');
    // A row each: the name and how many on the left, the holes beside them
    const holesX = PAD + 300, holesW = inner - 300;
    for (const s of m.strokes) {
      ctx.font = `600 32px ${BODY}`;
      const holes = wrap(ctx, s.holes === 'every hole' || s.holes.startsWith('every hole,') ? s.holes.charAt(0).toUpperCase() + s.holes.slice(1) : `Holes ${s.holes}`, holesW, 2);
      const rowH = Math.max(52, holes.length * 42) + 14;
      if (!room(rowH)) break;
      ctx.font = `700 40px ${BODY}`;
      ctx.fillStyle = C.ink;
      ctx.fillText(clip(ctx, s.name, 190), PAD, y);
      ctx.font = `800 40px ${DISPLAY}`;
      ctx.fillStyle = C.ochre;
      ctx.textAlign = 'right';
      ctx.fillText(`${s.count}`, holesX - 30, y);
      ctx.textAlign = 'left';
      ctx.font = `600 32px ${BODY}`;
      ctx.fillStyle = C.soft;
      holes.forEach((l, i) => ctx.fillText(l, holesX, y - 2 + i * 42));
      y += rowH;
    }
    if (m.strokesNote && room(50)) lines(m.strokesNote.charAt(0).toUpperCase() + m.strokesNote.slice(1), `600 32px ${BODY}`, C.soft, 44, 2);
  }

  // Head to head
  if (m.records.length && room(200)) {
    section('Head to head');
    for (const r of m.records.slice(0, 5)) {
      if (!room(50)) break;
      if (!lines(r, `600 34px ${BODY}`, C.ink, 46, 2)) break;
      y += 8;
    }
  }

  // Footer
  ctx.fillStyle = C.soft;
  ctx.font = `600 30px ${BODY}`;
  ctx.fillText(clip(ctx, m.footer, inner), PAD, footerY);
}

/** Draw the preview card for a plan's preview (planPreview) and return it as a PNG blob. */
export function renderPreviewImage(preview, opts = {}) {
  return renderPreviewCard(previewCardModel(preview, opts));
}

/** Draw a ready card model (previewCardModel) and return it as a PNG blob. */
export async function renderPreviewCard(model) {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  draw(ctx, model);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}
