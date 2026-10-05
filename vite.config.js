import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicRoadmap } from './src/lib/roadmap-public.js'

// Files the service worker should not save for offline use
const SKIP = /(^|\/)(sw\.js|prototype\.html)$|\.map$/;
// The JS the first screen (Up next) waits for: the entry and what it imports up front. Main was
// 481 kB before overnight 8 split the later parts of Up next out; a build over it says so.
const FIRST_SCREEN_BUDGET = 481_000;

/** After a build, say how much JS the first screen loads, and warn when it's over budget. */
function firstScreen() {
  return {
    name: 'bb-first-screen',
    apply: 'build',
    writeBundle({ dir }, bundle) {
      const entry = Object.values(bundle).find(c => c.type === 'chunk' && c.isEntry);
      if (!entry) return;
      const seen = new Set();
      const walk = name => {
        if (seen.has(name) || !bundle[name]) return;
        seen.add(name);
        bundle[name].imports?.forEach(walk);
      };
      walk(entry.fileName);
      const bytes = [...seen].reduce((a, n) => a + statSync(join(dir, n)).size, 0);
      const kb = (bytes / 1000).toFixed(2);
      if (bytes > FIRST_SCREEN_BUDGET) this.warn(`First screen JS is ${kb} kB, over its ${FIRST_SCREEN_BUDGET / 1000} kB budget. Load what isn't on Up next's first paint with import().`);
      else console.log(`First screen JS: ${kb} kB of ${FIRST_SCREEN_BUDGET / 1000} kB`);
    },
  };
}

/**
 * After a build, write the list of built files (and the font and icon stylesheets that
 * index.html loads) into dist/sw.js, so the service worker saves the whole app on install.
 * The version is a hash of the files, so each deploy gets a fresh cache.
 */
function precache() {
  return {
    name: 'bb-precache',
    apply: 'build',
    writeBundle({ dir }) {
      const files = [];
      const walk = d => readdirSync(d).forEach(f => {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(relative(dir, p).split('\\').join('/'));
      });
      walk(dir);
      const keep = files.filter(f => !SKIP.test(f)).sort();
      const hash = createHash('sha256');
      keep.forEach(f => hash.update(f).update(readFileSync(join(dir, f))));
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      const external = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)]
        .map(m => m[0].match(/href="(https:[^"]+)"/)?.[1]).filter(Boolean);
      const list = {
        version: hash.digest('hex').slice(0, 12),
        app: keep.map(f => (f === 'index.html' ? '/' : `/${f}`)),
        external,
      };
      const swPath = join(dir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8');
      const block = /\/\* bb-precache \*\/[\s\S]*?\/\* \/bb-precache \*\//;
      if (!block.test(sw)) throw new Error('sw.js is missing its bb-precache block');
      writeFileSync(swPath, sw.replace(block, JSON.stringify(list)));
    },
  };
}

/**
 * The public roadmap, made from ROADMAP.md as the app builds: `import items from 'virtual:roadmap'`
 * gives the short public list (see src/lib/roadmap-public.js), never the file itself, so Trevor's
 * notes stay out of the app. A change to ROADMAP.md reloads it in dev.
 */
function roadmapList() {
  const id = 'virtual:roadmap';
  const file = fileURLToPath(new URL('./ROADMAP.md', import.meta.url));
  return {
    name: 'bb-roadmap',
    resolveId(x) { return x === id ? `\0${id}` : null; },
    load(x) {
      if (x !== `\0${id}`) return null;
      this.addWatchFile(file);
      return `export default ${JSON.stringify(publicRoadmap(readFileSync(file, 'utf8')))};`;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), roadmapList(), precache(), firstScreen()],
})
