// Fails when an em dash (U+2014) appears anywhere in the app. See CLAUDE.md.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['index.html', 'README.md', 'CLAUDE.md', 'ROADMAP.md', 'src', 'public', 'supabase', 'scripts'];
const EXT = /\.(js|jsx|mjs|ts|tsx|css|html|md|json|sql|webmanifest)$/;
const EM = String.fromCharCode(0x2014);

function* walk(p) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) { for (const n of readdirSync(p)) yield* walk(join(p, n)); }
  else if (EXT.test(p)) yield p;
}

let hits = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes(EM)) { hits++; console.error(`${file}:${i + 1}: em dash: ${line.trim()}`); }
    });
  }
}
if (hits) { console.error(`\n${hits} em dash${hits === 1 ? '' : 'es'} found. Use a comma, period or colon instead (see CLAUDE.md).`); process.exit(1); }
console.log('No em dashes found.');
