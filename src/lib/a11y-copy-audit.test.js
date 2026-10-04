// Overnight 8 polish and accessibility sweep: a read of every screen and component's source for the
// rules the sweep fixed, so a new screen can't quietly bring one back. Buttons and named marks have
// a name a screen reader can say, labels point at their field, the photo picker is a real button,
// colors come from the tokens, and the copy keeps the house style (curly apostrophes, "next time"
// rather than a week, no app name in the offline lines).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const SRC = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, SRC), 'utf8');
const jsxFiles = [
  ...readdirSync(new URL('screens/', SRC)).filter(f => f.endsWith('.jsx')).map(f => `screens/${f}`),
  ...readdirSync(new URL('components/', SRC)).filter(f => f.endsWith('.jsx')).map(f => `components/${f}`),
  'App.jsx', 'nav.jsx',
];
const libFiles = readdirSync(new URL('lib/', SRC)).filter(f => f.endsWith('.js') && !f.includes('.test.') && !f.includes('.fixtures.')).map(f => `lib/${f}`);

/** Comments out, so a note in the code never counts as copy. URLs in strings ("https://") stay. */
function code(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** Each JSX opening tag of `name` in `src`, with its attributes and (for a paired tag) what's inside. */
function tags(src, name) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf(`<${name}`, i)) !== -1) {
    const next = src[i + name.length + 1];
    if (!/[\s>/]/.test(next)) { i += 1; continue; }
    // The end of the opening tag: the first > outside braces and quotes
    let depth = 0, q = null, end = -1;
    for (let j = i + 1; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === q && src[j - 1] !== '\\') q = null; continue; }
      if (c === '"' || (depth > 0 && (c === "'" || c === '`'))) { q = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) { end = j; break; }
    }
    if (end < 0) break;
    const attrs = src.slice(i, end);
    const selfClosing = attrs.endsWith('/');
    const close = selfClosing ? end : src.indexOf(`</${name}>`, end);
    out.push({ attrs, body: selfClosing ? '' : src.slice(end + 1, close), line: src.slice(0, i).split('\n').length });
    i = end;
  }
  return out;
}

const where = (file, t) => `${file}:${t.line}`;

test('every button has a name: an icon-only button carries an aria-label', () => {
  const bad = [];
  for (const f of jsxFiles) {
    for (const t of tags(code(read(f)), 'button')) {
      if (/aria-label(ledby)?=/.test(t.attrs)) continue;
      const rest = t.body.replace(/<(Icon|Avatar|AvatarArt|BuddyArt)\b[^>]*\/>/g, '').replace(/\{\s*\}/g, '').trim();
      if (!rest) bad.push(where(f, t));
    }
  }
  assert.deepEqual(bad, []);
});

test('a name on a plain span, div, li or p comes with a role, or a screen reader may skip it', () => {
  const bad = [];
  for (const f of jsxFiles) {
    const src = code(read(f));
    for (const name of ['span', 'div', 'li', 'p']) {
      for (const t of tags(src, name)) if (/\baria-label=/.test(t.attrs) && !/\brole=/.test(t.attrs)) bad.push(`${where(f, t)} <${name}>`);
    }
  }
  assert.deepEqual(bad, []);
});

test('every label points at its field, or wraps it', () => {
  const bad = [];
  for (const f of jsxFiles) {
    for (const t of tags(code(read(f)), 'label')) {
      if (/htmlFor=/.test(t.attrs) || /<(input|select|textarea)\b/.test(t.body)) continue;
      bad.push(where(f, t));
    }
  }
  assert.deepEqual(bad, []);
});

test('the photo picker is a real button everywhere (FileButton), never a label over a hidden input', () => {
  const bad = jsxFiles.filter(f => f !== 'components/ui.jsx' && /type="file"/.test(code(read(f))));
  assert.deepEqual(bad, []);
  const ui = read('components/ui.jsx');
  assert.match(ui, /export function FileButton/);
  for (const f of ['components/AvatarPicker.jsx', 'components/RequestCourse.jsx', 'screens/Suggest.jsx']) assert.match(read(f), /<FileButton\b/, f);
});

test('colors in a style come from the tokens: no hex or rgba literal outside the drawings', () => {
  // The ball and buddy drawings paint with their own fixed colors in both themes
  const drawings = new Set(['components/BuddyArt.jsx', 'components/ui.jsx']);
  const bad = [];
  for (const f of jsxFiles) {
    if (drawings.has(f)) continue;
    const src = code(read(f));
    const re = /style=\{\{([^}]*)\}\}/g;
    let m;
    while ((m = re.exec(src))) if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(m[1])) bad.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
  }
  assert.deepEqual(bad, []);
});

test('swatches are named by color, never read out as a color code', () => {
  const bad = [];
  for (const f of jsxFiles) {
    const src = code(read(f));
    if (/aria-label=\{col\}|aria-label=\{[a-z.]*hex\}/.test(src)) bad.push(f);
  }
  assert.deepEqual(bad, []);
  assert.match(read('screens/Settings.jsx'), /TEE_COLOR_NAMES\[col\]/);
});

test('copy never says this week or next week: next time, or the day', () => {
  const bad = [];
  for (const f of [...jsxFiles, ...libFiles]) {
    code(read(f)).split('\n').forEach((l, i) => { if (/\b(this|next|last) week\b/i.test(l)) bad.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(bad, []);
});

test('copy uses curly apostrophes: no straight one in a word, in strings or JSX text', () => {
  const bad = [];
  for (const f of [...jsxFiles, ...libFiles]) {
    code(read(f)).split('\n').forEach((l, i) => {
      // An escaped one in a single-quoted string, or one inside a double-quoted string, a template or JSX text
      if (/[A-Za-z]\\'[a-z]/.test(l) || /"[^"]*[A-Za-z]'[a-z][^"]*"/.test(l) || /`[^`]*[A-Za-z]'[a-z][^`]*`/.test(l) || />[^<{}]*[A-Za-z]'[a-z][^<{}]*</.test(l)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('offline and loading lines never lean on the app name, and they are announced when they change', () => {
  for (const f of ['screens/JoinInvite.jsx', 'screens/Plan.jsx', 'screens/Challenge.jsx']) {
    const src = read(f);
    assert.doesNotMatch(src, /reach Birdie Bank/, f);
    // The "Finding…" headline turns into "No signal" or "not found": a live region says so
    assert.match(src, /className="onboard-title"[^>]*aria-live="polite"/, f);
  }
});

test('the toast is keyed, so the same words twice in a row are read out twice', () => {
  assert.match(read('components/ui.jsx'), /<span key=\{toast\.key\}>\{toast\.msg\}<\/span>/);
});

test('the money bar, as a button, says everyone’s total (its label replaces what’s inside it)', () => {
  const play = read('screens/Play.jsx');
  assert.match(play, /'aria-label': `\$\{word\} so far, \$\{thru\.toLowerCase\(\)\}: \$\{said\}\. Show by game`/);
});

test('a gone plan, trip, challenge, round or preview says where to go and has a way back', () => {
  for (const f of ['screens/Plan.jsx', 'screens/Trip.jsx', 'screens/Challenge.jsx', 'screens/RoundDetail.jsx', 'screens/Preview.jsx']) {
    for (const t of tags(read(f), 'Empty')) {
      assert.match(t.attrs, /\btext=/, where(f, t));
      assert.match(t.attrs, /\baction=/, where(f, t));
    }
  }
});

test('the money screen is the Tab and the home tab is Up next, capitalized as names in the copy', () => {
  const bad = [];
  for (const f of [...jsxFiles, ...libFiles]) {
    code(read(f)).split('\n').forEach((l, i) => {
      // Onboarding's "Whoever keeps the tab" is anyone's tab, before the app has one
      if (/keeps the tab/.test(l)) return;
      const words = /\b(the|your|on|off|to) tab\b|\bup next\b|\bUp Next\b/.test(l) && /['"`>]/.test(l);
      // "Ledger" is the screen's file and component name, never a word in the copy
      const ledger = /['"`][^'"`]*\bLedger\b(?!\.jsx)[^'"`]*['"`]|(?<!=)>[^<{]*\bLedger\b(?!\.jsx)/.test(l);
      if (words || ledger) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('one voice for the payments: who pays who, never who pays whom', () => {
  const bad = [];
  for (const f of [...jsxFiles, ...libFiles]) code(read(f)).split('\n').forEach((l, i) => { if (/pays whom/.test(l)) bad.push(`${f}:${i + 1}`); });
  assert.deepEqual(bad, []);
});
