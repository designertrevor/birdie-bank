// Overnight 9 consistency: wherever a person or an option is picked from a list or a sheet, it
// uses the one pattern in ui.jsx. PickRow for a row (the round mark: a plus, then the pink check),
// PickChip for a pill (ink fill and a check), PickMark for a row that needs its own layout. This
// reads every screen and component so a raw checkbox, a square check icon or a hand-rolled chip
// can't quietly come back.
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

// The trip screens' pickers were redone in the trip flow work and now use the shared pieces too
const TRIP_FLOW = new Set([]);

// Pills that switch a view rather than pick something: tabs, not picks, so no check
const VIEW_SWITCHES = new Set(['components/CrewTabs.jsx', 'components/AvatarPicker.jsx']);

const UI = 'components/ui.jsx';

/** Comments out, so a note in the code never counts. Their lines stay, so line numbers still point right. */
const blank = m => m.replace(/[^\n]/g, '');
const code = src => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, '');

const hits = (re, skip = () => false) => jsxFiles.filter(f => !skip(f)).flatMap(f =>
  code(read(f)).split('\n').map((line, i) => (re.test(line) ? `${f}:${i + 1}` : null)).filter(Boolean));

test('no raw browser checkboxes or radio inputs', () => {
  assert.deepEqual(hits(/type=["'](checkbox|radio)["']/), []);
});

test('no square check icons as a pick mark', () => {
  // An icon's name, as a string or inside an expression: name="square", name={on ? 'check-square' : 'square'}
  assert.deepEqual(hits(/name=(["']|\{[^}]*[?:]\s*['"])(check-square|square)['"]/, f => TRIP_FLOW.has(f)), []);
});

test('no check-circle and empty circle pair as a pick mark', () => {
  // Finale's Mark paid is a pay button's state, not a pick from a list
  assert.deepEqual(hits(/\?\s*'check-circle'\s*:\s*'circle'/, f => TRIP_FLOW.has(f) || f === 'components/Finale.jsx'), []);
});

test('the round pick mark is only drawn by PickMark', () => {
  assert.deepEqual(hits(/li-check/, f => f === UI), []);
});

test('a pill that toggles on is a PickChip', () => {
  // A hand-rolled pill with an on state: className={`pill-btn ... ${x ? 'on' : ''}`}
  assert.deepEqual(hits(/className=\{`pill-btn[^`]*\$\{[^}]*\?\s*'on'/, f => f === UI || TRIP_FLOW.has(f) || VIEW_SWITCHES.has(f)), []);
});

test('the shared pieces exist and carry their state for screen readers', () => {
  const ui = code(read(UI));
  for (const name of ['PickMark', 'PickRow', 'PickChip']) assert.match(ui, new RegExp(`export function ${name}\\(`));
  // A toggle says pressed, one of a set says checked
  assert.match(ui, /role: 'radio', 'aria-checked': !!on/);
  assert.match(ui, /'aria-pressed': !!on/);
  // The mark is decoration: the row or chip itself says picked
  assert.match(ui, /className=\{`li-check[^`]*`\} aria-hidden="true"/);
});

test('every screen that picks from a list uses the shared pieces', () => {
  const uses = f => /\bPick(Row|Chip|Mark)\b/.test(read(f));
  for (const f of [
    'screens/NewRound.jsx', 'screens/BigGameSetup.jsx', 'screens/Plan.jsx', 'screens/People.jsx', 'screens/Profile.jsx',
    'screens/Onboarding.jsx', 'screens/Play.jsx', 'screens/Trip.jsx', 'screens/History.jsx', 'screens/RoundDetail.jsx',
    'components/PairBets.jsx', 'components/SideGames.jsx', 'components/GameOptions.jsx', 'components/GamePanels.jsx',
    'components/Challenges.jsx', 'components/BigGame.jsx', 'components/AddPlayer.jsx', 'components/PlayFor.jsx',
    'components/TabCard.jsx', 'components/HomeCourseSheet.jsx', 'components/ScrambleDrives.jsx',
  ]) assert.ok(uses(f), `${f} picks from a list without the shared pieces`);
});

test('a list row that wears the round mark takes the pick tint once picked', () => {
  // The nearest list-item above a PickMark must be a .pick row, or it shows the pink check with no ring
  const bare = jsxFiles.filter(f => f !== UI).flatMap(f => {
    const lines = code(read(f)).split('\n');
    return lines.flatMap((line, i) => {
      if (!/<PickMark\b/.test(line)) return [];
      const above = lines.slice(Math.max(0, i - 12), i + 1).reverse().find(l => /className=[^>]*\blist-item\b/.test(l));
      return above && !/\blist-item pick\b/.test(above) ? [`${f}:${i + 1}`] : [];
    });
  });
  assert.deepEqual(bare, []);
});

test('the spacing pass never shifts other screens through a bare sibling rule', () => {
  // A toggle's settings card sits closer to it only on the Big Game's Games step; Settings and game
  // setup put unrelated cards after a toggle, and those keep the usual gap
  const css = readFileSync(new URL('styles.css', SRC), 'utf8');
  assert.doesNotMatch(css, /^\.toggle-row \+ \.block\b/m);
  assert.match(css, /^\.big-games > \.toggle-row \+ \.block \{/m);
  assert.match(read('screens/BigGameSetup.jsx'), /className="scroll big-games"/);
});
