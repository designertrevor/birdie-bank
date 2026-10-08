// The profile card image: a 1080 by 1080 square PNG for the group chat, in the results image's
// colours and fonts (shareImage.js) with the year in review's tiles (wrapped-image.js), so the
// cards look like a set. It draws the model from profile-card.js: your avatar and name, six tiles
// and, with amounts on, the money. Needs a DOM.
import { BODY, C, DISPLAY, clip, fit, loadImage, spaced } from './shareImage.js';
import { drawPng, drawTile } from './wrapped-image.js';

export const CARD_SIZE = 1080;


/**
 * One person's avatar as a ringed circle: their picture (`pic`, a photo or a buddy) covering it, or
 * their initials on their colour. Shared with the rivalry card (rivalry-card-image.js), where
 * `a.mirror` flips a buddy so the two face each other.
 */
export function drawAvatar(ctx, a, pic, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = a.bg;
  ctx.fill();
  ctx.clip();
  if (pic) {
    // Cover the circle, cropping the long side
    const s = Math.max((2 * r) / pic.width, (2 * r) / pic.height);
    const w = pic.width * s, h = pic.height * s;
    if (a.mirror) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(pic, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = a.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fit(ctx, a.text, 800, DISPLAY, Math.round(r * 0.9), 40, r * 1.5);
    ctx.fillText(a.text, cx, cy + 4);
  }
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.ink;
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.stroke();
}

function draw(ctx, m, pic) {
  const W = CARD_SIZE, H = CARD_SIZE, PAD = 80, inner = W - PAD * 2;
  const footerY = H - 64;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.pink;
  ctx.beginPath(); ctx.arc(W - 30, 30, 190, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(W - 200, 196, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(164,212,197,.10)';
  ctx.beginPath(); ctx.arc(-40, H - 120, 200, 0, Math.PI * 2); ctx.fill();

  // You: the avatar, then the eyebrow, your name and the season beside it
  const r = 92, cx = PAD + r, cy = 92 + r;
  drawAvatar(ctx, m.avatar, pic, cx, cy, r);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // The name stops short of the ochre dot (it starts at W - 240)
  const x0 = PAD + r * 2 + 40, nameW = W - x0 - 256;
  ctx.fillStyle = C.mint;
  ctx.font = `800 32px ${DISPLAY}`;
  spaced(ctx, m.eyebrow.toUpperCase(), x0, 142, 5);
  ctx.fillStyle = C.ink;
  fit(ctx, m.title, 800, DISPLAY, 68, 36, nameW);
  ctx.fillText(clip(ctx, m.title, nameW), x0, 218);
  ctx.fillStyle = C.soft;
  ctx.font = `600 30px ${BODY}`;
  ctx.fillText(clip(ctx, m.meta, nameW), x0, 266);

  // The tiles, two to a row
  const gap = 20, half = (inner - gap) / 2, tileH = 140;
  let y = 330;
  m.tiles.forEach((t, i) => {
    drawTile(ctx, t, PAD + (i % 2) * (half + gap), y, half, tileH, { size: 72, label: 28 });
    if (i % 2) y += tileH + gap;
  });
  if (m.tiles.length % 2) y += tileH + gap;

  // The money (amounts on), then the guide's note, as far as there's room
  y += 26;
  for (const s of m.sections) {
    if (y + 90 > footerY - 20) break;
    y += 30;
    ctx.fillStyle = C.mint;
    ctx.font = `700 26px ${BODY}`;
    spaced(ctx, s.label.toUpperCase(), PAD, y, 3);
    y += 46;
    ctx.fillStyle = C.ink;
    ctx.font = `600 36px ${BODY}`;
    ctx.fillText(clip(ctx, s.lines[0], inner), PAD, y);
    y += 14;
  }
  if (m.note && y + 40 < footerY - 20) {
    ctx.fillStyle = C.soft;
    ctx.font = `500 26px ${BODY}`;
    ctx.fillText(clip(ctx, m.note, inner), PAD, y + 36);
  }

  ctx.fillStyle = C.soft;
  ctx.font = `600 28px ${BODY}`;
  ctx.fillText(clip(ctx, m.footer, inner), PAD, footerY);
}

/** Draw a profile card model (profile-card.js) and return it as a square PNG blob. */
export async function renderProfileCard(model) {
  const pic = await loadImage(model.avatar?.src);
  try { return await drawPng(CARD_SIZE, CARD_SIZE, ctx => draw(ctx, model, pic)); }
  catch (e) {
    // A picture that made the canvas unreadable: the card again, with your initials
    if (!pic) throw e;
    return drawPng(CARD_SIZE, CARD_SIZE, ctx => draw(ctx, model, null));
  }
}
