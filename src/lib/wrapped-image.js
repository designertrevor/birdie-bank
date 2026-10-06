// The year in review image: a 1080 by 1920 PNG for Stories in the results image's colours, fonts
// and corner shapes (shareImage.js), so it sits with the other cards. It draws the model from
// wrapped.js: a title, the big round count, a grid of stat tiles and a few short sections. Needs a DOM.
import { BODY, C, DISPLAY, IMAGE_H, IMAGE_W, clip, fit, fontsReady, spaced } from './shareImage.js';

/**
 * One stat tile: a soft rounded box, the value big and the label under it. Shared with the profile
 * card (profile-card-image.js). `size` is the value's largest font size, `label` the label's.
 */
export function drawTile(ctx, t, x, y, w, h, { size = 88, label = 30 } = {}) {
  ctx.fillStyle = C.faint;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 28); else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.fillStyle = C.ink;
  fit(ctx, t.value, 800, DISPLAY, size, Math.round(size / 2), w - 64);
  ctx.fillText(clip(ctx, t.value, w - 64), x + 32, y + h - 72);
  ctx.fillStyle = C.soft;
  ctx.font = `600 ${label}px ${BODY}`;
  ctx.fillText(clip(ctx, t.label, w - 64), x + 32, y + h - 28);
}

/** Draw on a fresh canvas of `w` by `h` and hand back the PNG, once the fonts are in. */
export async function drawPng(w, h, paint) {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  await paint(ctx);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}

function draw(ctx, m) {
  const W = IMAGE_W, H = IMAGE_H, PAD = 96, inner = W - PAD * 2;
  const footerY = H - 110;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.pink;
  ctx.beginPath(); ctx.arc(W - 40, 70, 250, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(W - 250, 250, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(164,212,197,.10)';
  ctx.beginPath(); ctx.arc(-60, H - 260, 260, 0, Math.PI * 2); ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = C.mint;
  ctx.font = `800 40px ${DISPLAY}`;
  spaced(ctx, m.eyebrow.toUpperCase(), PAD, 170, 6);
  ctx.fillStyle = C.ink;
  fit(ctx, m.title, 700, BODY, 52, 34, inner - 260);
  ctx.fillText(clip(ctx, m.title, inner - 260), PAD, 262);
  ctx.fillStyle = C.soft;
  ctx.font = `600 38px ${BODY}`;
  ctx.fillText(clip(ctx, m.meta, inner - 200), PAD, 318);

  // The headline: how many rounds, and the holes under it
  let y = 560;
  ctx.fillStyle = C.ink;
  fit(ctx, m.headline, 800, DISPLAY, 180, 90, inner);
  ctx.fillText(clip(ctx, m.headline, inner), PAD - 6, y);
  y += 84;
  ctx.fillStyle = C.mint;
  ctx.font = `500 56px ${DISPLAY}`;
  ctx.fillText(clip(ctx, m.sub, inner), PAD - 4, y);
  y += 70;

  // The tiles, two to a row
  const gap = 24, half = (inner - gap) / 2, tileH = 170;
  let col = 0;
  for (const t of m.tiles) {
    drawTile(ctx, t, PAD + col * (half + gap), y, half, tileH);
    if (col === 1) { col = 0; y += tileH + gap; } else col = 1;
  }
  if (col) y += tileH + gap;

  // The sections: a label and a line or two each, as far as there's room
  // A wider gap above each label after the first, so a section's last line doesn't run into the next
  m.sections.forEach((s, i) => {
    if (y + 140 > footerY - 40) return;
    y += i ? 72 : 56;
    ctx.fillStyle = C.mint;
    ctx.font = `700 28px ${BODY}`;
    spaced(ctx, s.label.toUpperCase(), PAD, y, 3);
    y += 8;
    for (const line of s.lines.slice(0, 2)) {
      if (y + 54 > footerY - 70) break;
      y += 54;
      ctx.fillStyle = C.ink;
      ctx.font = `600 36px ${BODY}`;
      ctx.fillText(clip(ctx, line, inner), PAD, y);
    }
  });

  ctx.fillStyle = C.soft;
  ctx.font = `600 30px ${BODY}`;
  ctx.fillText(clip(ctx, m.footer, inner), PAD, footerY);
}

/** Draw a year in review model (wrapped.js) and return it as a PNG blob. */
export function renderWrapped(model) {
  return drawPng(IMAGE_W, IMAGE_H, ctx => draw(ctx, model));
}
