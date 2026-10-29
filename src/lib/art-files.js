// Outside art. A drawing dropped into src/art/<kind>/<id>.svg (or .png, .webp) replaces the
// hand-drawn one of the same kind and id with no code change: Vite finds the files at build time.
// <id>.dark.svg beside it is shown in the dark theme. <id>.holes.svg beside it holds the pockets the
// background shows through (between legs, inside a handle), which the sticker border stays out of
// (ArtFile.jsx; scripts/art-gaps.mjs makes them). The kinds, ids and sizes are on the art
// sheet (open the app with ?art) and in src/art/README.md.
const FILES = import.meta.glob('../art/*/*.{svg,png,webp}', { eager: true, query: '?url', import: 'default' });

const byKey = {};
for (const [path, url] of Object.entries(FILES)) {
  const m = path.match(/\/art\/([a-z]+)\/([a-z0-9-]+)(\.dark|\.holes)?\.(svg|png|webp)$/);
  if (!m) continue;
  const key = `${m[1]}/${m[2]}`;
  byKey[key] = byKey[key] || {};
  byKey[key][m[3] ? m[3].slice(1) : 'light'] = url;
}

/** The outside file for one drawing ({ light, dark, holes }), or null to draw it by hand. */
export function artFile(kind, id) {
  const f = byKey[`${kind}/${id}`];
  if (!f || !(f.light || f.dark)) return null;
  return { light: f.light || f.dark, dark: f.dark || null, holes: f.holes || null };
}

/** Every outside file that has landed, by "kind/id", for the art sheet. */
export const ART_FILES = byKey;

/**
 * Scenes Trevor pulled from onboarding on 2026-10-07 (the hand-drawn tee and clubhouse read cheap).
 * Each draws nothing until its outside file lands in src/art/scenes, then shows that.
 */
export const PULLED_SCENES = new Set(['course', 'clubhouse', 'scorecard']);
