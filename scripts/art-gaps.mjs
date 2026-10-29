// Gap check for the scenes and spots: where the background shows through a drawing, and where it shouldn't.
// Headless Chrome (playwright-core, the installed Google Chrome) draws each SVG onto a canvas and reads its pixels.
//
//   node scripts/art-gaps.mjs map  --out <dir> [files...]   a labelled map per drawing on magenta: every cream
//        shape tinted its own colour with its path index (c12 = the 12th <path>), every pocket the background
//        shows through that is shut in by the drawing marked in green (h1, h2...), plus <name>.json listing both
//   node scripts/art-gaps.mjs shots --out <dir> --tag before [files...]   <name>-before-light.png on the cream
//        page, <name>-before-dark.png on the dark canvas with a 3px white sticker line, <name>-before-magenta.png big
//
//   node scripts/art-gaps.mjs crop <file> --box x0,y0,x1,y1 --out <png>   a close look on magenta with a grid
//        labelled in the file's own viewBox units, for picking the points below
//   node scripts/art-gaps.mjs cut <file> --at x,y[;x,y] [--walls x0,y0,x1,y1[;...]] [--any]   makes a pocket
//        transparent: from each point, every pixel of the same colour up to the ink (and the walls, lines that shut
//        an open line) becomes a clip-path hole on the shapes of that colour (--any: on every shape but the ink).
//        The hole runs a few pixels under the ink around it, so no cream rim is left; the ink stays whole
//        (--ink: also cut an ink shape hidden under the pocket, by the pocket's own outline, so the lines stay whole)
//   node scripts/art-gaps.mjs drop <file> --paths 12,40   deletes whole shapes by their number on the map
//   node scripts/art-gaps.mjs fill <file> --at x,y --color #fbf7ec [--walls ...]   fills a see-through pocket:
//        a new shape at the bottom of the drawing, the pocket's shape run under the ink around it
//        (--inkwall <width>, on cut or fill, also inks the walls, where the shape would end on a bare edge)
//   node scripts/art-gaps.mjs hole <file> --at x,y [--walls ...]   marks a see-through pocket as a hole in the sticker:
//        its shape (run under the ink round it) goes into <name>.holes.svg beside the drawing, and the app keeps the
//        white border out of it (ArtFile.jsx), so the background shows there however narrow it is. A cut adds its
//        pocket there too.
//   node scripts/art-gaps.mjs holes [files...]   rebuilds every .holes.svg from the drawing: its viewBox, the pockets
//        its cuts made (the <name>-gapN clip paths) and the holes marked by hand
//
// Files default to every src/art/scenes and src/art/spots SVG.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const mode = args[0];
const flag = (k, d = null) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.resolve(ROOT, flag('out', 'overnight/n3-shots/gaps'));
const TAG = flag('tag', 'before');
const named = (['cut', 'fill', 'crop', 'drop', 'hole'].includes(mode) ? [] : args.slice(1)).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));
const files = named.length ? named.map(f => path.resolve(ROOT, f)) : ['scenes', 'spots'].flatMap(k =>
  fs.readdirSync(path.join(ROOT, 'src/art', k)).filter(f => f.endsWith('.svg') && !/\.(holes|dark)\.svg$/.test(f)).map(f => path.join(ROOT, 'src/art', k, f)));
if (mode === 'map' || mode === 'shots') fs.mkdirSync(OUT, { recursive: true });

// Everything below runs in the page: draw, read pixels, flood fill, label
const PAGE = async ({ svg, mode, big }) => {
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const aspect = vb[2] / vb[3];
  const draw = async (text, w, h) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  };
  const size = (long) => aspect >= 1 ? [long, Math.round(long / aspect)] : [Math.round(long * aspect), long];
  const onBg = (art, bg, line) => {
    const pad = line ? line + 2 : 0;
    const c = document.createElement('canvas'); c.width = art.width + pad * 2; c.height = art.height + pad * 2;
    const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    if (line) {
      // A white sticker line: the drawing's shape in white, stamped round a circle of the line's radius
      const w = document.createElement('canvas'); w.width = art.width; w.height = art.height;
      const wg = w.getContext('2d'); wg.drawImage(art, 0, 0); wg.globalCompositeOperation = 'source-in';
      wg.fillStyle = '#ffffff'; wg.fillRect(0, 0, w.width, w.height);
      for (let a = 0; a < 32; a++) for (const r of [line, line * 0.5]) g.drawImage(w, pad + Math.cos(a * Math.PI / 16) * r, pad + Math.sin(a * Math.PI / 16) * r);
    }
    g.drawImage(art, pad, pad);
    return c.toDataURL('image/png');
  };
  if (mode === 'shots') {
    const [w, h] = size(560); const art = await draw(svg, w, h);
    const [bw, bh] = size(big); const artBig = await draw(svg, bw, bh);
    return { light: onBg(art, '#f8f2e4', 0), dark: onBg(art, '#121514', 3), magenta: onBg(artBig, '#ff00ff', 0) };
  }
  // map: which <path> paints each pixel (each path filled with its own index as a colour, no smoothing)
  const [w, h] = size(big);
  let i = 0;
  const idSvg = svg.replace(/<svg /, '<svg shape-rendering="crispEdges" ').replace(/<path([^>]*?)fill="#[0-9a-fA-F]{6}"/g, (m, pre) => {
    i++; return `<path${pre}fill="#${i.toString(16).padStart(6, '0')}"`;
  });
  const fills = [...svg.matchAll(/<path[^>]*?fill="(#[0-9a-fA-F]{6})"/g)].map(m => m[1].toLowerCase());
  const art = await draw(svg, w, h);
  const ids = (await draw(idSvg, w, h)).getContext('2d').getImageData(0, 0, w, h).data;
  const px = art.getContext('2d').getImageData(0, 0, w, h).data;
  const N = w * h;
  const owner = new Int32Array(N);
  for (let p = 0; p < N; p++) owner[p] = ids[p * 4 + 3] > 127 ? (ids[p * 4] << 16 | ids[p * 4 + 1] << 8 | ids[p * 4 + 2]) : 0;
  const clear = (p) => px[p * 4 + 3] < 128;
  // The outside: every clear pixel reachable from the edge
  const outside = new Uint8Array(N); const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop(); if (outside[p] || !clear(p)) continue; outside[p] = 1;
    const x = p % w; if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (p >= w) stack.push(p - w); if (p < N - w) stack.push(p + w);
  }
  // Pockets: clear pixels the drawing shuts in
  const seen = new Uint8Array(N); const holes = [];
  for (let s = 0; s < N; s++) {
    if (seen[s] || outside[s] || !clear(s)) continue;
    let n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0; const st = [s]; const pts = [];
    while (st.length) {
      const p = st.pop(); if (seen[p] || outside[p] || !clear(p)) continue; seen[p] = 1; n++;
      const x = p % w, y = (p - x) / w; sx += x; sy += y; pts.push(p);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1); if (p >= w) st.push(p - w); if (p < N - w) st.push(p + w);
    }
    if (n >= 12) holes.push({ n, cx: sx / n, cy: sy / n, box: [x0, y0, x1, y1], pts });
  }
  // Cream shapes: the pixels each cream path is the top of
  const cream = {};
  for (let p = 0; p < N; p++) {
    const o = owner[p]; if (!o || fills[o - 1] !== '#fbf7ec') continue;
    const c = cream[o] || (cream[o] = { n: 0, sx: 0, sy: 0, edge: 0 }); c.n++; c.sx += p % w; c.sy += Math.floor(p / w);
  }
  // How much of each cream shape's rim touches the outside (a pocket under a shape touches none)
  for (let p = 0; p < N; p++) {
    const o = owner[p]; if (!cream[o]) continue;
    const x = p % w; if ((x > 0 && outside[p - 1]) || (x < w - 1 && outside[p + 1]) || (p >= w && outside[p - w]) || (p < N - w && outside[p + w])) cream[o].edge++;
  }
  // Paint the map: everything but the cream greyed back, each cream shape in its own strong colour, labelled
  // on every separate piece of it, so one shape that shows in two places is easy to spot
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#ff00ff'; g.fillRect(0, 0, w, h); g.drawImage(art, 0, 0);
  const im = g.getImageData(0, 0, w, h); const d = im.data;
  const PAL = [[230, 25, 75], [60, 180, 75], [0, 130, 200], [245, 130, 48], [70, 240, 240], [255, 150, 150], [210, 245, 60], [0, 128, 128], [170, 110, 40], [128, 0, 0], [0, 0, 128], [128, 128, 0], [255, 225, 25]];
  for (let p = 0; p < N; p++) {
    const o = owner[p];
    if (cream[o]) { const q = PAL[o % PAL.length]; d[p * 4] = q[0]; d[p * 4 + 1] = q[1]; d[p * 4 + 2] = q[2]; }
    else if (o && fills[o - 1] !== '#0a0a0a') { for (let ch = 0; ch < 3; ch++) d[p * 4 + ch] = Math.round(d[p * 4 + ch] * 0.35 + 200 * 0.65); }
  }
  for (const ho of holes) for (const p of ho.pts) { d[p * 4] = 0; d[p * 4 + 1] = 255; d[p * 4 + 2] = 0; d[p * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  const fs = Math.max(13, Math.round(w / 90)); g.font = `bold ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = (t, x, y, col) => { g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y); };
  const toVb = (x, y) => [+(vb[0] + x / w * vb[2]).toFixed(1), +(vb[1] + y / h * vb[3]).toFixed(1)];
  const pieceSeen = new Uint8Array(N);
  for (let s0 = 0; s0 < N; s0++) {
    const o = owner[s0]; if (!cream[o] || pieceSeen[s0]) continue;
    const st = [s0]; const pts = []; while (st.length) { const p = st.pop(); if (pieceSeen[p] || owner[p] !== o) continue; pieceSeen[p] = 1; pts.push(p);
      const x = p % w; if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1); if (p >= w) st.push(p - w); if (p < N - w) st.push(p + w); }
    if (pts.length < 30) continue;
    let sx = 0, sy = 0; for (const p of pts) { sx += p % w; sy += Math.floor(p / w); } sx /= pts.length; sy /= pts.length;
    let best = pts[0], bd = Infinity; for (const p of pts) { const dd = (p % w - sx) ** 2 + (Math.floor(p / w) - sy) ** 2; if (dd < bd) { bd = dd; best = p; } }
    label('c' + o, best % w, Math.floor(best / w), '#000');
  }
  const creamOut = Object.entries(cream).filter(([, v]) => v.n >= 40).map(([k, v]) => ({ path: +k, px: v.n, rimOutside: v.edge, at: toVb(v.sx / v.n, v.sy / v.n) }));
  const holesOut = holes.map((ho, j) => {
    label('h' + (j + 1), ho.cx, ho.cy, '#060');
    return { hole: j + 1, px: ho.n, at: toVb(ho.cx, ho.cy), box: [...toVb(ho.box[0], ho.box[1]), ...toVb(ho.box[2], ho.box[3])] };
  });
  // Where the drawing sits in its box (for centring): the bounding box of every painted pixel
  let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
  for (let p = 0; p < N; p++) if (!clear(p)) { const x = p % w, y = (p - x) / w; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const offset = [+(((bx0 + bx1) / 2 - w / 2) / w * 100).toFixed(1), +(((by0 + by1) / 2 - h / 2) / h * 100).toFixed(1)];
  return { png: c.toDataURL('image/png'), size: [w, h], cream: creamOut, holes: holesOut, inkBox: [...toVb(bx0, by0), ...toVb(bx1, by1)], offsetPct: offset };
};

// cut, fill and crop: find the pocket from its points and trace it as a shape in viewBox units
const EDIT = async ({ svg, op, seeds, walls, any, box, long }) => {
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const aspect = vb[2] / vb[3];
  const [w, h] = aspect >= 1 ? [long, Math.round(long / aspect)] : [Math.round(long * aspect), long];
  const k = w / vb[2];
  const draw = async (text) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  };
  if (op === 'crop') {
    const art = await draw(svg);
    const [x0, y0, x1, y1] = box; const sx = (x0 - vb[0]) * k, sy = (y0 - vb[1]) * k, sw = (x1 - x0) * k, sh = (y1 - y0) * k;
    const z = Math.min(1400 / sw, 1000 / sh, 4);
    const c = document.createElement('canvas'); c.width = Math.round(sw * z); c.height = Math.round(sh * z);
    const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(art, sx, sy, sw, sh, 0, 0, c.width, c.height);
    // A grid every round step in viewBox units, labelled
    const span = Math.max(x1 - x0, y1 - y0); const step = [5, 10, 20, 25, 50, 100].find(s => span / s <= 16) || 200;
    g.font = '12px sans-serif'; g.lineWidth = 1;
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const px = (x - x0) * k * z; g.strokeStyle = 'rgba(0,160,255,.55)'; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, c.height); g.stroke(); g.fillStyle = '#004'; g.fillText(x, px + 2, 12); }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const py = (y - y0) * k * z; g.strokeStyle = 'rgba(0,160,255,.55)'; g.beginPath(); g.moveTo(0, py); g.lineTo(c.width, py); g.stroke(); g.fillStyle = '#004'; g.fillText(y, 2, py - 2); }
    return { png: c.toDataURL('image/png') };
  }
  let i = 0;
  const idSvg = svg.replace(/<svg /, '<svg shape-rendering="crispEdges" ').replace(/<path([^>]*?)fill="#[0-9a-fA-F]{6}"/g, (m, pre) => {
    i++; return `<path${pre}fill="#${i.toString(16).padStart(6, '0')}"`;
  });
  const fills = [...svg.matchAll(/<path[^>]*?fill="(#[0-9a-fA-F]{6})"/g)].map(m => m[1].toLowerCase());
  const ids = (await draw(idSvg)).getContext('2d').getImageData(0, 0, w, h).data;
  const N = w * h;
  const owner = new Int32Array(N);
  for (let p = 0; p < N; p++) owner[p] = ids[p * 4 + 3] > 127 ? (ids[p * 4] << 16 | ids[p * 4 + 1] << 8 | ids[p * 4 + 2]) : 0;
  const colour = (p) => owner[p] ? fills[owner[p] - 1] : null;
  const isInk = (p) => colour(p) === '#0a0a0a';
  // Walls: short lines that shut a pocket where the artist's line stops short
  const wall = new Uint8Array(N);
  for (const [ax, ay, bx, by] of walls) {
    const x0 = (ax - vb[0]) * k, y0 = (ay - vb[1]) * k, x1 = (bx - vb[0]) * k, y1 = (by - vb[1]) * k;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1;
    for (let t = 0; t <= n; t++) { const x = Math.round(x0 + (x1 - x0) * t / n), y = Math.round(y0 + (y1 - y0) * t / n);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) wall[yy * w + xx] = 1; } }
  }
  // A fill and a hole both start in a see-through pocket
  const seeThrough = op === 'fill' || op === 'hole';
  const region = new Uint8Array(N); let count = 0; const used = new Set();
  for (const [sx, sy] of seeds) {
    const s0 = Math.round((sy - vb[1]) * k) * w + Math.round((sx - vb[0]) * k);
    const want = seeThrough ? null : colour(s0);
    if (op === 'cut' && (!want || want === '#0a0a0a')) return { error: `point ${sx},${sy} is on ${want || 'nothing'}` };
    if (seeThrough && owner[s0]) return { error: `point ${sx},${sy} is on ${colour(s0)}, not a see-through pocket` };
    const ok = seeThrough ? (p) => !owner[p] : (p) => colour(p) === want;
    const st = [s0];
    while (st.length) {
      const p = st.pop(); if (region[p] || wall[p] || !ok(p)) continue; region[p] = 1; count++;
      if (owner[p]) used.add(colour(p));
      const x = p % w; if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1); if (p >= w) st.push(p - w); if (p < N - w) st.push(p + w);
      if (x === 0 || x === w - 1 || p < w || p >= N - w) if (seeThrough) return { error: 'the pocket runs out to the edge: it is outside, not a pocket' };
    }
  }
  const core = region.slice();
  // Run the pocket under the surrounding ink (never into another colour), so no rim is left either way
  const grow = Math.max(2, Math.round(k * 2.2));
  let edge = []; for (let p = 0; p < N; p++) if (region[p]) edge.push(p);
  for (let r = 0; r < grow; r++) {
    const next = [];
    for (const p of edge) { const x = p % w; for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (q < 0 || q >= N || region[q] || !isInk(q)) continue; region[q] = 1; next.push(q); } }
    edge = next;
  }
  // A cut that only takes the pocket's own colour can also run a pixel or two under the neighbouring colours
  // (they sit on top there), which takes the faint seam of cream left along their edge
  // A fill sits under everything, so it can also run two pixels under whatever is round it: no hairline seam
  if (op === 'fill') {
    let ring = []; for (let p = 0; p < N; p++) if (region[p]) ring.push(p);
    for (let r = 0; r < 2; r++) {
      const next = [];
      for (const p of ring) { const x = p % w; for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= N || region[q] || wall[q] || !owner[q]) continue; region[q] = 1; next.push(q); } }
      ring = next;
    }
  }
  if (op === 'cut' && !any) {
    const want = colour(Math.round((seeds[0][1] - vb[1]) * k) * w + Math.round((seeds[0][0] - vb[0]) * k));
    let ring = []; for (let p = 0; p < N; p++) if (region[p]) ring.push(p);
    for (let r = 0; r < 2; r++) {
      const next = [];
      for (const p of ring) { const x = p % w; for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= N || region[q] || wall[q] || !owner[q] || colour(q) === want) continue; region[q] = 1; next.push(q); if (!isInk(q)) core[q] = 1; } }
      ring = next;
    }
  }
  // Trace the pixel outline into loops, then thin each loop's staircase out
  const trace = (region) => {
  const key = (x, y) => y * (w + 1) + x; const out = new Map();
  const add = (ax, ay, bx, by) => { const a = key(ax, ay); (out.get(a) || out.set(a, []).get(a)).push(key(bx, by)); };
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && region[y * w + x];
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!region[y * w + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (!at(x, y - 1)) add(x, y, x + 1, y); if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1); if (!at(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  for (const [start] of out) {
    while (out.get(start)?.length) {
      const loop = []; let v = start;
      do { const nx = out.get(v); const u = nx.pop(); if (!nx.length) out.delete(v); loop.push([v % (w + 1), Math.floor(v / (w + 1))]); v = u; } while (v !== start && out.get(v));
      if (loop.length > 3) loops.push(loop);
    }
  }
  const rdp = (pts, eps) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]]; let best = 0, bi = 0;
    for (let j = 1; j < pts.length - 1; j++) {
      const [px, py] = pts[j]; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1;
      const d = Math.abs(dy * px - dx * py + b[0] * a[1] - b[1] * a[0]) / L; if (d > best) { best = d; bi = j; }
    }
    return best > eps ? [...rdp(pts.slice(0, bi + 1), eps).slice(0, -1), ...rdp(pts.slice(bi), eps)] : [a, b];
  };
  const toVb = ([x, y]) => `${+(vb[0] + x / k).toFixed(1)} ${+(vb[1] + y / k).toFixed(1)}`;
  const d = loops.map(l => { const half = Math.floor(l.length / 2); const s = [...rdp(l.slice(0, half + 1), 0.9).slice(0, -1), ...rdp([...l.slice(half), l[0]], 0.9).slice(0, -1)];
    return 'M' + s.map(toVb).join('L') + 'Z'; }).join('');
  return { d, bbox: [vb[0] + x0 / k, vb[1] + y0 / k, vb[0] + (x1 + 1) / k, vb[1] + (y1 + 1) / k] };
  };
  // The pocket run under the ink, and the pocket alone (for --ink: an ink shape hidden under the cream loses only
  // what the cream covered, so the lines round the pocket keep their full width)
  const grown = trace(region); const bare = trace(core);
  return { d: grown.d, core: bare.d, count, used: [...used], bbox: grown.bbox };
};

// The bounding box of a path's points in the root's units (the scenes' paths carry a scale)
const pathBox = (tag) => {
  const d = tag.match(/ d="([^"]+)"/)[1]; const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const sc = +(tag.match(/scale\(([\d.]+)\)/)?.[1] || 1);
  const xs = nums.filter((_, j) => j % 2 === 0).map(v => v * sc), ys = nums.filter((_, j) => j % 2 === 1).map(v => v * sc);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
if (mode === 'drop') {
  // drop <file> --paths 12,40: delete whole shapes by their index on the map (1 = the first <path> with a fill)
  const file = path.resolve(ROOT, args[1]); const drop = new Set(String(flag('paths')).split(',').map(Number));
  let i = 0; let svg = fs.readFileSync(file, 'utf8');
  svg = svg.replace(/(<g clip-path="[^"]*">)?<path [^>]*fill="#[0-9a-fA-F]{6}"[^>]*\/>(<\/g>)?/g, (tag) => (drop.has(++i) ? '' : tag));
  fs.writeFileSync(file, svg); console.log(path.basename(file), 'dropped', [...drop].join(','));
  await browser.close(); process.exit(0);
}
// The holes file beside a drawing: its pockets as black shapes on nothing, in the drawing's own viewBox
const holesPath = (file) => file.replace(/\.svg$/, '.holes.svg');
const writeHoles = (file, svg, marked) => {
  const vb = svg.match(/viewBox="([^"]+)"/)[1];
  const name = path.basename(file, '.svg');
  const cuts = [...svg.matchAll(new RegExp(`<clipPath id="${name}-gap\\d+"[^>]*><path[^>]* d="M[^MZ]*Z([^"]*)"`, 'g'))].map(m => m[1]);
  if (!cuts.length && !marked.length) { if (fs.existsSync(holesPath(file))) fs.unlinkSync(holesPath(file)); return 0; }
  const body = [...cuts.map(d => `<path data-src="cut" d="${d}"/>`), ...marked.map(d => `<path data-src="hole" d="${d}"/>`)].join('');
  fs.writeFileSync(holesPath(file), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><g fill="#000">${body}</g></svg>`);
  return cuts.length + marked.length;
};
const markedHoles = (file) => fs.existsSync(holesPath(file)) ? [...fs.readFileSync(holesPath(file), 'utf8').matchAll(/data-src="hole" d="([^"]+)"/g)].map(m => m[1]) : [];
if (mode === 'holes') {
  const all = named.length ? files : ['scenes', 'spots', 'games', 'icons', 'critters'].flatMap(k =>
    fs.readdirSync(path.join(ROOT, 'src/art', k)).filter(f => f.endsWith('.svg') && !/\.(holes|dark)\.svg$/.test(f)).map(f => path.join(ROOT, 'src/art', k, f)));
  for (const f of all) { const n = writeHoles(f, fs.readFileSync(f, 'utf8'), markedHoles(f)); if (n) console.log(path.basename(f), n, 'holes'); }
  await browser.close(); process.exit(0);
}
if (['cut', 'fill', 'crop', 'hole'].includes(mode)) {
  const file = path.resolve(ROOT, args[1]); const name = path.basename(file, '.svg');
  let svg = fs.readFileSync(file, 'utf8');
  const pairs = (v) => (v ? String(v).split(';').filter(Boolean).map(t => t.split(',').map(Number)) : []);
  const long = file.includes('/scenes/') ? 3584 : 2200;
  const r = await page.evaluate(EDIT, { svg, op: mode, seeds: pairs(flag('at')), walls: pairs(flag('walls')), any: args.includes('--any'),
    box: flag('box') ? flag('box').split(',').map(Number) : null, long });
  if (r.error) { console.error(name, r.error); process.exit(1); }
  if (mode === 'crop') { save(path.resolve(ROOT, flag('out')), r.png); await browser.close(); process.exit(0); }
  if (mode === 'hole') {
    const n = writeHoles(file, svg, [...markedHoles(file), r.d]);
    console.log(name, 'hole', r.count, 'px;', n, 'holes in', path.basename(holesPath(file)));
    await browser.close(); process.exit(0);
  }
  if (mode === 'fill') {
    // At the bottom of the drawing, so the ink and every shape already there stay on top
    const color = flag('color', '#fbf7ec');
    svg = svg.replace(/(<svg[^>]*>(?:<defs>.*?<\/defs>)?)/s, `$1<path fill="${color}" d="${r.d}"/>`);
    console.log(name, 'filled', r.count, 'px', color);
  } else {
    const n = (svg.match(new RegExp(`id="${name}-gap\\d+"`, 'g')) || []).length + 1;
    const id = `${name}-gap${n}`;
    const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const frame = `M${vb[0] - 10} ${vb[1] - 10}H${vb[0] + vb[2] + 10}V${vb[1] + vb[3] + 10}H${vb[0] - 10}Z`;
    const clip = `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="${frame}${r.d}"/></clipPath>`;
    svg = svg.includes('<defs>') ? svg.replace('</defs>', clip + '</defs>') : svg.replace(/(<svg[^>]*>)/, `$1<defs>${clip}</defs>`);
    // Every shape of the pocket's colour (or every shape but the ink) that reaches into the pocket loses it
    const ink = args.includes('--ink');
    if (ink) svg = svg.replace('</defs>', `<clipPath id="${id}i" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="${frame}${r.core}"/></clipPath></defs>`);
    let hit = 0;
    svg = svg.replace(/<path [^>]*fill="(#[0-9a-fA-F]{6})"[^>]*\/>/g, (tag, fill) => {
      const f = fill.toLowerCase();
      if (!overlap(pathBox(tag), r.bbox)) return tag;
      if (f === '#0a0a0a') { if (!ink) return tag; hit++; return `<g clip-path="url(#${id}i)">${tag}</g>`; }
      if (!(args.includes('--any') ? true : r.used.includes(f))) return tag;
      hit++; return `<g clip-path="url(#${id})">${tag}</g>`;
    });
    console.log(name, id, 'cut', r.count, 'px from', hit, 'shapes', r.used.join(' '));
  }
  // --inkwall <width>: draw the walls as ink too, where a fill or a cut would otherwise end on a bare edge
  if (flag('inkwall')) {
    const t = Number(flag('inkwall')) / 2;
    for (const [ax, ay, bx, by] of pairs(flag('walls'))) {
      const a = Math.atan2(by - ay, bx - ax); const pts = [];
      for (let j = 0; j <= 8; j++) { const q = a + Math.PI / 2 + Math.PI * j / 8; pts.push([bx + Math.cos(q - Math.PI) * t, by + Math.sin(q - Math.PI) * t]); }
      for (let j = 0; j <= 8; j++) { const q = a + Math.PI / 2 + Math.PI * j / 8; pts.push([ax + Math.cos(q) * t, ay + Math.sin(q) * t]); }
      svg = svg.replace('</svg>', `<path fill="#0a0a0a" d="M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z"/></svg>`);
    }
  }
  fs.writeFileSync(file, svg);
  // A cut's pocket is a hole in the sticker too
  if (mode === 'cut') writeHoles(file, svg, markedHoles(file));
  await browser.close(); process.exit(0);
}
for (const file of files) {
  const name = path.basename(file, '.svg');
  const svg = fs.readFileSync(file, 'utf8');
  const big = Number(flag('big')) || (file.includes('/scenes/') ? 1792 : 1100);
  const r = await page.evaluate(PAGE, { svg, mode: mode === 'shots' ? 'shots' : 'map', big });
  if (mode === 'shots') {
    save(path.join(OUT, `${name}-${TAG}-light.png`), r.light);
    save(path.join(OUT, `${name}-${TAG}-dark.png`), r.dark);
    save(path.join(OUT, `${name}-${TAG}-magenta.png`), r.magenta);
    console.log(name, 'shots');
  } else {
    save(path.join(OUT, `${name}-map.png`), r.png);
    const { png: _png, ...rest } = r;
    fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(rest, null, 1));
    console.log(name, `holes ${r.holes.length}`, `cream ${r.cream.length}`, `offset% ${r.offsetPct.join(',')}`);
  }
}
await browser.close();
