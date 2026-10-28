// The overhaul look (look-new.css): writes src/look-new.gen.css, the mechanical half of the new look,
// from the older screens' rules in styles.css (and the other shared stylesheets). Ported from the
// serif experiment's scripts/refined-css.mjs, retargeted to <html data-look="new">.
//   - Rules that set the display face: headlines stay in it (Fraunces in the new look) at the display
//     weight, money at the money weight, while names, list titles, buttons and chips move to the body
//     face (Figtree) at 600.
//   - Big heavy headlines set in the body face (24px and up at 800) move to the display face too.
//   - Every other 800 in the body face comes down to 700, which is Figtree's heavy.
//   - Play stays readable in the sun: inside the scoring screen (and its sheets) all of it is the
//     body face at 800 with tabular numbers, except the hole title.
//   - Corners come down a step: cards to --r-card, pill buttons to --r-btn, pill tags to --r-chip.
// Hand-tuned rules live in src/look-new.css. src/lib/look-new-gen.test.js fails when this file is
// out of date with styles.css, so a merge that changes styles.css says to rerun it.
// Run: node scripts/look-new-css.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = ':root[data-look="new"]';
const SOURCES = ['src/styles.css', 'src/components/finale.css', 'src/screens/digest.css'];
export const OUT = 'src/look-new.gen.css';

// Names, list titles, buttons, chips, tags, inputs and avatar initials: the body face in this look
const SANS = /^\.(li-name|pname|lr-name|gn|rc-course|seat-name|tp-name|lb-name|exp-name|trip-pay-name|ob-tile-name|full-btn|rsvp-btn|dbl-btn|amt-btn|np-btn|holes-btn|pm-btn|sheet-cancel|np-quick-btn|nassau-bet-btn|nassau-bet-lbl|bet-chip|tp-chip|avatar|avatar-btn|join-avatar|hc-chip|hole-opt|toast|name-input|code-input|bn|range-label|pv-names|rules-section|co-title|order-num|sc-brand|np-hole|lh-num|fs-num|pw-step-title|ec)\b|set-name|ob-review-me/;
// Money and counts: the display face at the money weight, lining tabular figures
const MONEY = /(amt|-a\b|\.sa\b|\.mv\b|\.wa\b|\.dc\b|money|big|-val\b|-v\b|net\b|tot\b|total|pts|score|count|-num\b|-n\b|\.sr\b|\.st-|\.pm\b|\.et\b|-value\b|tp-value|ob-amt|rv-val|hw-val|fr-par-v|wrapped-tile b)/;
// Never Play's hole title
const PLAY_KEEP = /^\.play-(course|title)\b/;
// Radii: cards and panels come down to the card radius, smaller ones a step
const RADIUS = { 14: '12px', 16: '12px', 18: 'var(--r-card)', 20: 'var(--r-card)', 22: 'var(--r-card)', 24: 'var(--r-card)', 28: '18px', 30: '18px', 32: '18px' };
// Pills that are buttons get the button radius, the rest of the pills (tags, chips) the chip radius;
// toggles, progress tracks, dots and calendar days stay round
const PILL_KEEP = /^\.(tog|yp-trial-bar|play-track|cal-cell|np-hole|live-pill|par-pick button)\b/;
const PILL_BTN = /(btn|cancel|search-box|holes-toggle|press-mode-row|as-seg$|toast-act|pw-save|recap-btn|settle-btn)/;

// Every class Play's screens and the components they import use, so the sun rules reach only those
function playClasses() {
  const seen = new Set(), files = [], cls = new Set();
  const add = f => { if (!seen.has(f) && fs.existsSync(f)) { seen.add(f); files.push(f); } };
  add(path.join(ROOT, 'src/screens/Play.jsx'));
  for (const f of fs.readdirSync(path.join(ROOT, 'src/screens/play'))) if (f.endsWith('.jsx') || f.endsWith('.js')) add(path.join(ROOT, 'src/screens/play', f));
  for (let i = 0; i < files.length; i++) {
    const text = fs.readFileSync(files[i], 'utf8');
    for (const m of text.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
      const to = path.resolve(path.dirname(files[i]), m[1]);
      if (to.includes(`${path.sep}components${path.sep}`) || to.includes(`${path.sep}play${path.sep}`)) add(/\.(jsx?|mjs)$/.test(to) ? to : to + '.jsx');
    }
    for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) for (const c of (m[1] || m[2] || m[3]).split(/[^a-z0-9-]+/i)) if (c) cls.add(c);
    // Class names built in expressions: any 'quoted-word' that looks like a class
    for (const m of text.matchAll(/'([a-z][a-z0-9-]+)'/g)) cls.add(m[1]);
  }
  return cls;
}

export function generate() {
  const play = playClasses();
  const inPlay = s => (s.match(/\.([a-z][a-z0-9-]*)/gi) || []).some(c => play.has(c.slice(1)));
  const serif = new Set(), money = new Set(), sans = new Set(), heavy = new Set(), sun = new Set(), pillBtn = new Set(), pillChip = new Set(), radius = {};
  for (const file of SOURCES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      const sels = m[1].split(',').map(s => s.trim()).filter(s => s && !s.startsWith('@') && !/^(from|to)$/.test(s) && !/%$/.test(s) && !s.includes('::') && !s.startsWith(':root') && s !== 'html' && s !== 'body' && s !== '*');
      if (!sels.length) continue;
      const body = m[2];
      const display = /font-family:\s*var\(--display\)/.test(body);
      const weight = +(body.match(/font-weight:\s*(\d+)/) || [])[1] || 0;
      const size = parseFloat((body.match(/font-size:\s*([\d.]+)px/) || [])[1] || 0);
      const bodyHead = !display && !/font-family/.test(body) && weight >= 800 && size >= 24;
      for (const s of sels) {
        if (display || bodyHead) {
          if (display && SANS.test(s)) sans.add(s);
          else (MONEY.test(s) ? money : serif).add(s);
        } else if (weight >= 800) heavy.add(s);
        if ((display || bodyHead || weight >= 800) && inPlay(s) && !PLAY_KEEP.test(s)) sun.add(s);
      }
      const r = body.match(/border-radius:\s*(\d+)px\s*(;|$)/);
      if (r && r[1] === '999') for (const s of sels) { if (!PILL_KEEP.test(s)) (PILL_BTN.test(s) ? pillBtn : pillChip).add(s); }
      else if (r && RADIUS[r[1]]) for (const s of sels) (radius[RADIUS[r[1]]] ||= new Set()).add(s);
    }
  }
  // A selector is in one family only: the body-face list wins over a money or headline match
  for (const s of sans) { serif.delete(s); money.delete(s); }
  const wrap = (set, pre = '') => [...set].map(s => `${P} ${pre}${s}`).join(',\n');
  let out = `/* Generated by scripts/look-new-css.mjs from styles.css. Don't edit by hand: rerun it. */\n`;
  out += `${wrap(serif)} {\n  font-family: var(--display); font-weight: var(--display-weight); letter-spacing: -.01em;\n}\n`;
  out += `${wrap(money)} {\n  font-family: var(--display); font-weight: var(--money-weight); letter-spacing: -.01em; font-variant-numeric: lining-nums tabular-nums;\n}\n`;
  out += `${wrap(sans)} {\n  font-family: var(--body-font); font-weight: 600; letter-spacing: -.005em;\n}\n`;
  out += `${wrap(heavy)} {\n  font-weight: 700;\n}\n`;
  out += `/* Play in the sun: heavy body face, tabular numbers */\n${wrap(sun, '.screen.play ')} {\n  font-family: var(--body-font); font-weight: 800; letter-spacing: -.01em; font-variant-numeric: tabular-nums;\n}\n`;
  for (const [r, set] of Object.entries(radius)) out += `${wrap(set)} { border-radius: ${r}; }\n`;
  out += `${wrap(pillBtn)} { border-radius: var(--r-btn); }\n`;
  out += `${wrap(pillChip)} { border-radius: var(--r-chip); }\n`;
  return { css: out, counts: { serif: serif.size, money: money.size, sans: sans.size, heavy: heavy.size, sun: sun.size, pills: pillBtn.size + pillChip.size, radius: Object.values(radius).reduce((n, s) => n + s.size, 0) } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { css, counts } = generate();
  fs.writeFileSync(path.join(ROOT, OUT), css);
  console.log(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
}
