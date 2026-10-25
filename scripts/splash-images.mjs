// iPhone launch images for the home screen app: the splash index.html draws (the ball on its tee and
// the name), as one PNG per iPhone screen size, light and dark, in public/splash/. iOS shows the one
// that matches the phone the instant the icon is tapped, before the page has loaded, so a cold start
// goes straight from the icon to the splash. Android builds its own from the manifest, and the App
// Store app will use a native launch screen instead.
//
// Run it again whenever the splash changes (a new name or logo):
//   node scripts/splash-images.mjs [--font path/to/bricolage-800.woff2]
// It needs Playwright (npx playwright, or a global install) and rewrites the block of
// <link rel="apple-touch-startup-image"> tags in index.html between its two markers.
// --font uses a local Bricolage Grotesque 800 file instead of fetching it from Google Fonts.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
function playwright() {
  try { return require('playwright'); } catch { /* not in the project */ }
  const global = execSync('npm root -g').toString().trim();
  return require(join(global, 'playwright'));
}

// Every iPhone screen in CSS pixels and its pixel ratio, portrait (the app is portrait only), newest first
export const IPHONES = [
  [440, 956, 3], // 16 and 17 Pro Max
  [420, 912, 3], // Air
  [402, 874, 3], // 16 Pro, 17 and 17 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16, 16e
  [428, 926, 3], // 12 and 13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 12 and 13 Pro
  [375, 812, 3], // X, XS, 11 Pro, 12 and 13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6 to 8 Plus
  [375, 667, 2], // 6 to 8, SE (2nd and 3rd)
  [320, 568, 2], // SE (1st), 5s
];

const START = '<!-- splash-images -->';
const END = '<!-- /splash-images -->';

const fileOf = (w, h, d, theme) => `splash/${w}x${h}@${d}-${theme}.png`;
const mediaOf = (w, h, d, theme) => `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`;

async function main() {
  const fontArg = process.argv.indexOf('--font');
  const fontPath = fontArg > 0 ? resolve(process.argv[fontArg + 1]) : null;
  const indexPath = join(root, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  // The splash exactly as index.html has it: its styles and its markup
  const style = html.match(/<style>[\s\S]*?#splash[\s\S]*?<\/style>/)?.[0];
  const markup = html.match(/<div id="splash"[\s\S]*?<\/svg>\s*<div class="sp-name">[^<]*<\/div>\s*<\/div>/)?.[0];
  if (!style || !markup) throw new Error('Couldn’t find the splash in index.html');
  const font = fontPath
    ? `<style>@font-face { font-family: "Bricolage Grotesque"; font-weight: 800; src: url(data:font/woff2;base64,${readFileSync(fontPath).toString('base64')}) format("woff2"); }</style>`
    : '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&display=block" rel="stylesheet">';

  const { chromium } = playwright();
  const browser = await chromium.launch();
  mkdirSync(join(root, 'public', 'splash'), { recursive: true });
  const tags = [];
  for (const theme of ['light', 'dark']) {
    for (const [w, h, d] of IPHONES) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: d, colorScheme: theme });
      // No bob in a still image
      await page.setContent(`<!doctype html><html data-theme="${theme}"><head>${font}${style}<style>#splash svg { animation: none !important; }</style></head><body>${markup}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(root, 'public', fileOf(w, h, d, theme)) });
      await page.close();
      tags.push(`<link rel="apple-touch-startup-image" href="/${fileOf(w, h, d, theme)}" media="${mediaOf(w, h, d, theme)}">`);
    }
  }
  await browser.close();

  const block = `${START}\n${tags.join('\n')}\n${END}`;
  const next = html.includes(START)
    ? html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block)
    : html.replace('<link rel="apple-touch-icon"', `${block}\n<link rel="apple-touch-icon"`);
  writeFileSync(indexPath, next);
  console.log(`Wrote ${tags.length} launch images to public/splash and their tags to index.html`);
}

main().catch(e => { console.error(e); process.exit(1); });
