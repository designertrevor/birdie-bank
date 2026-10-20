// Roadmap progress, plain and weighted by size. Each checklist line is weighted 1, 2 or 3 by which
// third of line lengths it falls in (measured on the file given), the method the overnight 12 report
// used. Usage: node scripts/roadmap-weighted.mjs [ROADMAP.md] [reference.md]. With a reference (say main's
// copy), the weights come from its lines in the same order, so notes added on a branch don't move them.
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'ROADMAP.md';
const lines = readFileSync(file, 'utf8').split('\n').filter((l) => /^- \[( |x)\]/.test(l));
const ref = process.argv[3] ? readFileSync(process.argv[3], 'utf8').split('\n').filter((l) => /^- \[( |x)\]/.test(l)) : lines;
if (ref.length !== lines.length) throw new Error('reference has a different number of lines');
const sorted = ref.map((l) => l.length).sort((a, b) => a - b);
const cut1 = sorted[Math.floor(sorted.length / 3)];
const cut2 = sorted[Math.floor((2 * sorted.length) / 3)];
const weight = (i) => (ref[i].length < cut1 ? 1 : ref[i].length < cut2 ? 2 : 3);
let done = 0, total = 0, wDone = 0, wTotal = 0;
lines.forEach((l, i) => {
  const w = weight(i);
  total += 1;
  wTotal += w;
  if (l.startsWith('- [x]')) { done += 1; wDone += w; }
});
const pct = (a, b) => ((100 * a) / b).toFixed(1);
console.log(`${done} of ${total} (${pct(done, total)}%), weighted ${pct(wDone, wTotal)}%`);
