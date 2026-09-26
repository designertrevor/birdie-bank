import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// Files the service worker should not save for offline use
const SKIP = /(^|\/)(sw\.js|prototype\.html)$|\.map$/;

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precache()],
})
