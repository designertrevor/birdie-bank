// Shows the public roadmap the app builds from ROADMAP.md: each item's id, status, date and title.
//   node scripts/roadmap-public.mjs           everything that goes public
//   node scripts/roadmap-public.mjs planned   one status (planned, progress or shipped)
// An item's id is what a feedback row's roadmap_item points at (supabase/2026-10-07-roadmap.sql).
import { readFileSync } from 'node:fs';
import { publicRoadmap } from '../src/lib/roadmap-public.js';

const only = process.argv[2] || null;
const items = publicRoadmap(readFileSync(new URL('../ROADMAP.md', import.meta.url), 'utf8'));
for (const i of items) {
  if (only && i.status !== only) continue;
  console.log(`${i.status.padEnd(9)} ${(i.shipped || '').padEnd(11)} ${i.id}\n          ${i.area}: ${i.title}${i.blurb ? `. ${i.blurb}` : ''}`);
}
const by = s => items.filter(i => i.status === s).length;
console.log(`\n${items.length} items: ${by('planned')} planned, ${by('progress')} in progress, ${by('shipped')} shipped`);
