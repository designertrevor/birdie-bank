// The recap, trip standings and cup images: story-sized PNGs in the results image's colours, fonts
// and layout (shareImage.js), so every card in the group thread looks like one set. They all draw
// from one card model (share-cards.js): an eyebrow, a title and meta line, a big headline, an
// optional pair of team scores, ranked rows and a few short sections. The drawing needs a DOM.
import { BODY, C, DISPLAY, IMAGE_H, IMAGE_W, clip, fit, fontsReady, spaced } from './shareImage.js';

// The cup's team colours, as the app's cup dots show them on a dark background (styles.css --cup-a, --cup-b)
const TEAM = ['#7fb0ff', '#ff8a7a'];

function draw(ctx, m) {
  const W = IMAGE_W, H = IMAGE_H, PAD = 96, inner = W - PAD * 2;
  const footerY = H - 110;
  const room = (y, need) => y + need <= footerY - 60;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // The same soft corner shapes as the results card
  ctx.fillStyle = C.pink;
  ctx.beginPath(); ctx.arc(W - 40, 70, 250, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(W - 250, 250, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(164,212,197,.10)';
  ctx.beginPath(); ctx.arc(W + 60, H + 40, 240, 0, Math.PI * 2); ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // What and where
  ctx.fillStyle = C.mint;
  ctx.font = `800 40px ${DISPLAY}`;
  spaced(ctx, m.eyebrow.toUpperCase(), PAD, 170, 6);
  ctx.fillStyle = C.ink;
  fit(ctx, m.title, 700, BODY, 52, 34, inner - 260);
  ctx.fillText(clip(ctx, m.title, inner - 260), PAD, 262);
  ctx.fillStyle = C.soft;
  ctx.font = `600 38px ${BODY}`;
  ctx.fillText(clip(ctx, m.meta, inner - 200), PAD, 318);

  let y = 440;
  // Two teams side by side, the leader's points in its colour
  if (m.teams?.length === 2) {
    const half = (inner - 32) / 2;
    m.teams.forEach((t, i) => {
      const x = PAD + i * (half + 32);
      ctx.fillStyle = t.won || t.lead ? 'rgba(255,255,255,.10)' : C.faint;
      ctx.fillRect(x, y, half, 230);
      ctx.fillStyle = TEAM[i];
      ctx.beginPath(); ctx.arc(x + 48, y + 62, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.font = `700 40px ${BODY}`;
      ctx.fillText(clip(ctx, t.name, half - 100), x + 80, y + 76);
      ctx.fillStyle = t.won || t.lead ? C.mint : C.ink;
      fit(ctx, t.points, 800, DISPLAY, 130, 80, half - 64);
      ctx.fillText(t.points, x + 32, y + 200);
    });
    y += 230 + 120;
  } else {
    y = 540;
  }

  // The headline, and the amount under it when it's shown
  ctx.fillStyle = C.ink;
  fit(ctx, m.headline, 800, DISPLAY, m.teams ? 96 : 170, m.teams ? 56 : 84, inner);
  ctx.fillText(clip(ctx, m.headline, inner), PAD - 6, y);
  if (m.sub) {
    y += m.big ? 150 : 84;
    ctx.fillStyle = m.big ? C.mint : C.soft;
    if (m.big) fit(ctx, m.sub, 800, DISPLAY, 150, 72, inner);
    else ctx.font = `500 56px ${DISPLAY}`;
    ctx.fillText(clip(ctx, m.sub, inner), PAD - 4, y);
  }
  y += 80;
  if (m.accent) {
    ctx.fillStyle = C.ochre;
    fit(ctx, m.accent, 700, BODY, 46, 30, inner);
    ctx.fillText(clip(ctx, m.accent, inner), PAD, y);
    y += 72;
  }

  // The ranked rows, as many as fit with room left for the sections
  const lineCount = m.sections.reduce((a, s) => a + Math.min(s.lines.length, 3) + 1, 0);
  const rowH = m.rows.length > 6 ? 84 : 96;
  const fitRows = Math.max(0, Math.floor((footerY - 60 - y - Math.min(lineCount, 6) * 56) / rowH));
  const rows = m.rows.slice(0, Math.min(m.rows.length, fitRows));
  for (const [i, p] of rows.entries()) {
    const top = y + i * rowH;
    ctx.fillStyle = C.faint;
    ctx.fillRect(PAD, top, inner, 2);
    const cy = top + rowH / 2 + 1;
    const gold = p.place === 1 && (p.sign > 0 || (p.sign === 0 && p.team != null));
    ctx.fillStyle = gold ? C.ochre : C.faint;
    ctx.beginPath(); ctx.arc(PAD + 30, cy, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = gold ? C.onPastel : C.ink;
    ctx.font = `700 30px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(p.place), PAD + 30, cy + 11);
    ctx.textAlign = 'left';
    let nameX = PAD + 84;
    if (p.team != null) {
      ctx.fillStyle = TEAM[p.team] || C.soft;
      ctx.beginPath(); ctx.arc(nameX + 10, cy, 10, 0, Math.PI * 2); ctx.fill();
      nameX += 36;
    }
    let valW = 0;
    if (p.value) {
      ctx.save();
      ctx.font = `800 ${rows.length > 6 ? 44 : 50}px ${DISPLAY}`;
      valW = ctx.measureText(p.value).width;
      ctx.fillStyle = p.sign > 0 ? C.mint : p.sign < 0 ? C.peach : C.ink;
      ctx.textAlign = 'right';
      ctx.fillText(p.value, PAD + inner, cy + 17);
      ctx.restore();
    }
    ctx.fillStyle = C.ink;
    ctx.font = `600 ${rows.length > 6 ? 40 : 44}px ${BODY}`;
    const nameW = inner - (nameX - PAD) - valW - 24;
    ctx.fillText(clip(ctx, p.name, p.sub ? nameW * 0.7 : nameW), nameX, cy + 15);
    if (p.sub) {
      const w = ctx.measureText(clip(ctx, p.name, nameW * 0.7)).width;
      ctx.fillStyle = C.soft;
      ctx.font = `600 30px ${BODY}`;
      ctx.fillText(clip(ctx, p.sub, Math.max(0, nameW - w - 20)), nameX + w + 20, cy + 15);
    }
  }
  if (rows.length) {
    y += rows.length * rowH;
    ctx.fillStyle = C.faint;
    ctx.fillRect(PAD, y, inner, 2);
  }

  // The sections: a label and a few short lines each
  for (const s of m.sections) {
    if (!room(y, 140)) break;
    y += 84;
    ctx.fillStyle = C.mint;
    ctx.font = `700 28px ${BODY}`;
    spaced(ctx, s.label.toUpperCase(), PAD, y, 3);
    y += 12;
    for (const line of s.lines.slice(0, 3)) {
      if (!room(y, 56)) break;
      y += 56;
      ctx.fillStyle = C.ink;
      ctx.font = `600 34px ${BODY}`;
      ctx.fillText(clip(ctx, line, inner), PAD, y);
    }
  }

  // Footer: the short link back
  ctx.fillStyle = C.soft;
  ctx.font = `600 30px ${BODY}`;
  ctx.fillText(clip(ctx, m.footer, inner), PAD, footerY);
}

/** Draw a card model (share-cards.js) and return it as a PNG blob. */
export async function renderCard(model) {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  draw(ctx, model);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}
