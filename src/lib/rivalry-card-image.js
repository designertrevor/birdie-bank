// The rivalry card image: a 1080 by 1080 square PNG for the group text, in the results image's
// colours and fonts (shareImage.js) with the profile card's avatar circles and the year in review's
// tiles, so the cards look like a set. It draws the model from rivalry-card.js: the two of you face
// to face with the record between you, who leads, the streak, two tiles and, with amounts on, the
// money. Needs a DOM.
import { BODY, C, DISPLAY, clip, fit, loadImage, spaced } from './shareImage.js';
import { drawPng, drawTile } from './wrapped-image.js';
import { CARD_SIZE, drawAvatar } from './profile-card-image.js';

function draw(ctx, m, pics) {
  const W = CARD_SIZE, H = CARD_SIZE, PAD = 80, inner = W - PAD * 2, mid = W / 2;
  const footerY = H - 56;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.pink;
  ctx.beginPath(); ctx.arc(W - 30, 30, 190, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(W - 200, 196, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(164,212,197,.10)';
  ctx.beginPath(); ctx.arc(-40, H - 120, 200, 0, Math.PI * 2); ctx.fill();

  // The eyebrow and the title, clear of the pink corner
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const titleW = inner - 240;
  ctx.fillStyle = C.mint;
  ctx.font = `800 32px ${DISPLAY}`;
  spaced(ctx, m.eyebrow.toUpperCase(), PAD, 130, 5);
  ctx.fillStyle = C.ink;
  fit(ctx, m.title, 800, DISPLAY, 68, 36, titleW);
  ctx.fillText(clip(ctx, m.title, titleW), PAD, 206);
  if (m.meta) {
    ctx.fillStyle = C.soft;
    ctx.font = `600 28px ${BODY}`;
    ctx.fillText(clip(ctx, m.meta, titleW), PAD, 250);
  }

  // Face to face, like a fight card: you, the record, them
  const r = 104, cy = 400, leftX = 290, rightX = W - 290;
  drawAvatar(ctx, m.you.avatar, pics.you, leftX, cy, r);
  drawAvatar(ctx, m.them.avatar, pics.them, rightX, cy, r);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink;
  const score = `${m.score.won}–${m.score.lost}`;
  fit(ctx, score, 800, DISPLAY, 120, 60, 260);
  ctx.fillText(score, mid, cy + 42);
  if (m.score.even) {
    ctx.fillStyle = C.soft;
    ctx.font = `600 26px ${BODY}`;
    ctx.fillText(`${m.score.even} even`, mid, cy + 92);
  }
  ctx.fillStyle = C.ink;
  ctx.font = `700 36px ${BODY}`;
  ctx.fillText(clip(ctx, m.you.name, 280), leftX, cy + r + 56);
  ctx.fillText(clip(ctx, m.them.name, 280), rightX, cy + r + 56);

  // Who leads, and the streak under it
  ctx.fillStyle = C.mint;
  fit(ctx, m.headline, 800, DISPLAY, 56, 36, inner);
  ctx.fillText(clip(ctx, m.headline, inner), mid, 650);
  if (m.sub) {
    ctx.fillStyle = C.soft;
    ctx.font = `600 32px ${BODY}`;
    ctx.fillText(clip(ctx, m.sub, inner), mid, 700);
  }
  ctx.textAlign = 'left';

  // Two tiles: rounds together, and the last one
  const gap = 20, half = (inner - gap) / 2, tileH = 130;
  let y = 744;
  m.tiles.slice(0, 2).forEach((t, i) => drawTile(ctx, t, PAD + i * (half + gap), y, half, tileH, { size: 64, label: 26 }));
  y += tileH;

  // The money (amounts on), as far as there's room
  for (const s of m.sections) {
    if (y + 100 > footerY - 20) break;
    y += 46;
    ctx.fillStyle = C.mint;
    ctx.font = `700 24px ${BODY}`;
    spaced(ctx, s.label.toUpperCase(), PAD, y, 3);
    y += 44;
    ctx.fillStyle = C.ink;
    ctx.font = `600 34px ${BODY}`;
    ctx.fillText(clip(ctx, s.lines[0], inner), PAD, y);
  }

  // The link bottom left, the app's name small in the other corner
  ctx.fillStyle = C.soft;
  ctx.font = `600 26px ${BODY}`;
  const brandW = ctx.measureText(m.brand).width;
  ctx.textAlign = 'right';
  ctx.fillText(m.brand, W - PAD, footerY);
  ctx.textAlign = 'left';
  if (m.footer) ctx.fillText(clip(ctx, m.footer, inner - brandW - 40), PAD, footerY);
}

/** Draw a rivalry card model (rivalry-card.js) and return it as a square PNG blob. */
export async function renderRivalryCard(model) {
  const [you, them] = await Promise.all([loadImage(model.you.avatar?.src), loadImage(model.them.avatar?.src)]);
  try { return await drawPng(CARD_SIZE, CARD_SIZE, ctx => draw(ctx, model, { you, them })); }
  catch (e) {
    // A picture that made the canvas unreadable: the card again, with initials
    if (!you && !them) throw e;
    return drawPng(CARD_SIZE, CARD_SIZE, ctx => draw(ctx, model, { you: null, them: null }));
  }
}
