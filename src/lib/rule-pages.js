// The public rule pages: "How to play Wolf" at /rules/wolf for every game and side game, an index
// at /rules, and the "Play this now" link back into setup (/?play=wolf). The build (vite.config.js
// rulePages) renders each game's sections from rules-content.jsx, the same text as the in-app rules
// sheet, and hands them to renderRulePage, which writes a plain page with its own title,
// description and link preview tags. Static pages, so search engines and the link previews in a
// group text read them without running the app. Pure, so the tests can check the pages and links.
import { GAMES, GAME_GROUPS, SIDE_GAMES } from './round.js';
import { escapeHtml } from './og.js';
import { APP_NAME, SITE_URL } from './app-name.js';
import { RULE_KEYS, playPath, ruleName, rulePath } from './rule-links.js';
import { CARRY_REF_SCRIPT } from './attribution.js';

export { RULE_KEYS, SIDE_ONLY, playFromSearch, playPath, ruleFile, ruleKeyOf, ruleName, rulePath, ruleSlug } from './rule-links.js';

const iconOf = key => GAMES[key]?.icon || SIDE_GAMES[key]?.icon || 'golf';
const groupOf = key => (GAMES[key] ? GAMES[key].group : 'Side games');
const sentence = s => { const t = String(s || '').trim(); return !t ? '' : /[.!?]$/.test(t) ? t : `${t}.`; };

/**
 * The short facts for a game: who it's for, the holes and a one-line pitch. `sub` is the rules
 * sheet's line ("4 players exactly · Rotating wolf"); a side-only game has no row in GAMES, so
 * its players and pitch come from there.
 */
export function ruleFacts(key, sub = '') {
  const parts = String(sub).split('·').map(s => s.trim()).filter(Boolean);
  const g = GAMES[key];
  if (g) {
    const holes = g.holes.length > 1 ? `${g.holes.slice(0, -1).join(', ')} or ${g.holes.at(-1)}` : String(g.holes[0]);
    return { players: g.players, holes: `${holes} holes`, pitch: sentence(g.blurb), group: g.group, side: false };
  }
  const pitch = parts.filter(p => !/players|side game/i.test(p)).join('. ');
  return { players: parts.find(p => /players/i.test(p)) || '2–8 players', holes: 'Any round', pitch: sentence(pitch || `${ruleName(key)}, a side game`), group: 'Side games', side: true };
}

/** The page's title, description and address, for its tags and the tests. `title`: the rules sheet's. */
export function rulePageMeta(key, { title, sub = '' } = {}, origin = SITE_URL) {
  const f = ruleFacts(key, sub);
  const heading = title || `How to play ${ruleName(key)}`;
  const tail = f.side
    ? `Add it to any round and ${APP_NAME} keeps track of the pot for you.`
    : 'The rules, the bets and how the money works, then play it free with your group.';
  return {
    heading,
    title: `${heading}: golf ${f.side ? 'side game' : 'betting game'} rules · ${APP_NAME}`,
    shareTitle: heading,
    description: `${f.pitch} ${f.players}. ${tail}`,
    url: `${origin}${rulePath(key)}`,
  };
}

// --------------------------- the page ---------------------------------------

/** The look, from the app's tokens in styles.css (light, and dark when the phone is). */
export const PAGE_CSS = `
:root { --canvas:#fffaf0; --surface:#f5f0e0; --card:#ffffff; --ink:#0a0a0a; --body:#3a3a3a; --mute:#6a6a6a; --line:#ebe6d6;
  --pink:#ff4d8b; --pink-text:#c92463; --icon:#1a3a3a; --tile:#f5f0e0; --on-ink:#ffffff; --focus:#6b4fd0;
  --display:"Bricolage Grotesque", Inter, system-ui, sans-serif; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root { --canvas:#121615; --surface:#202624; --card:#1a1f1e; --ink:#f5f0e4; --body:#d5d0c3; --mute:#a8a498; --line:#2c3331;
    --pink-text:#ff4d8b; --icon:#a4d4c5; --tile:#202624; --on-ink:#0a0a0a; --focus:#b8a4ed; color-scheme: dark; }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: var(--canvas); -webkit-text-size-adjust: 100%; }
body { background: var(--canvas); color: var(--body); font: 16px/1.6 Inter, system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; text-wrap: pretty; }
a { color: inherit; }
a:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; border-radius: 12px; }
h1, h2, h3 { font-family: var(--display); font-weight: 800; color: var(--ink); text-wrap: balance; }
.ph, .ph-bold, .ph-fill { line-height: 1; }
.wrap { max-width: 640px; margin: 0 auto; padding: 0 16px; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: max(16px, env(safe-area-inset-top)) 0 8px; }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-family: var(--display); font-weight: 800; font-size: 19px; letter-spacing: -.02em; color: var(--ink); }
.brand img { width: 34px; height: 34px; border-radius: 10px; display: block; }
.top-link { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-size: 14px; font-weight: 600; color: var(--ink); background: var(--surface); padding: 10px 14px; border-radius: 999px; min-height: 44px; }
.hero { padding: 32px 0 8px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--mute); }
.eyebrow i { font-size: 16px; color: var(--pink-text); }
.hero h1 { font-size: 44px; line-height: 1.02; letter-spacing: -.04em; margin: 12px 0 12px; }
.lede { font-size: 19px; line-height: 1.45; color: var(--body); }
.facts { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 24px 0 0; }
.facts li { background: var(--card); border-radius: 16px; padding: 12px 14px; box-shadow: 0 1px 0 var(--line); display: flex; flex-direction: column; gap: 2px; }
.facts span { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--mute); }
.facts strong { font-size: 16px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.cta { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 58px; margin-top: 24px; border-radius: 999px;
  background: var(--ink); color: var(--on-ink); text-decoration: none; font-family: var(--display); font-size: 18px; font-weight: 800; box-shadow: 0 5px 0 var(--pink); transition: transform .2s cubic-bezier(.3,1.5,.5,1); }
.cta i { font-size: 20px; }
.cta:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--pink); }
.cta-note { margin-top: 16px; font-size: 14px; color: var(--mute); text-align: center; }
.rules { margin-top: 40px; display: flex; flex-direction: column; gap: 12px; }
.rule { background: var(--card); border-radius: 24px; padding: 20px; box-shadow: 0 1px 0 var(--line); }
.rule h2 { font-size: 21px; letter-spacing: -.02em; line-height: 1.2; margin-bottom: 8px; }
.rule p + p, .rule p + ul, .rule p + ol, .rule ul + p, .rule ol + p { margin-top: 10px; }
.rule ul, .rule ol { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
.rule li::marker { color: var(--pink-text); font-weight: 700; }
.rule strong { color: var(--ink); }
.again { margin-top: 40px; background: var(--surface); border-radius: 28px; padding: 24px 20px; }
.again h2 { font-size: 26px; letter-spacing: -.03em; line-height: 1.1; }
.again p { margin-top: 8px; }
.again .cta { margin-top: 20px; }
.more { margin-top: 40px; }
.more h2, .group h2 { font-size: 12px; font-family: Inter, system-ui, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--mute); margin-bottom: 12px; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
.chips a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 16px; border-radius: 999px; background: var(--card); box-shadow: inset 0 0 0 1.5px var(--line); text-decoration: none; font-size: 15px; font-weight: 600; color: var(--ink); }
.chips i { font-size: 18px; color: var(--icon); }
.all-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; font-weight: 600; color: var(--pink-text); text-decoration: none; min-height: 44px; }
.groups { margin-top: 32px; display: flex; flex-direction: column; gap: 32px; }
.cards { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.card-link { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 20px; background: var(--card); box-shadow: 0 1px 0 var(--line); text-decoration: none; min-height: 72px; }
.tile { width: 44px; height: 44px; border-radius: 14px; background: var(--tile); display: grid; place-items: center; flex-shrink: 0; }
.tile i { font-size: 22px; color: var(--icon); }
.card-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.card-name { font-family: var(--display); font-size: 18px; font-weight: 800; color: var(--ink); letter-spacing: -.01em; }
.card-sub { font-size: 14px; color: var(--mute); line-height: 1.4; }
.nw { white-space: nowrap; }
.card-link > .ph-bold { color: var(--mute); font-size: 16px; }
.foot { margin: 48px 0 0; padding: 24px 0 max(32px, env(safe-area-inset-bottom)); border-top: 1px solid var(--line); font-size: 14px; color: var(--mute); display: flex; flex-direction: column; gap: 8px; }
.foot a { color: var(--ink); font-weight: 600; }
@media (min-width: 560px) { .hero h1 { font-size: 56px; } .cta { max-width: 360px; } .cta-note { text-align: left; } .again .cta { max-width: 360px; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

/** The <head> every page shares, with its own title, description and preview tags. */
export function pageHead({ title, shareTitle = title, description, url, imageAlt = shareTitle }) {
  const e = escapeHtml;
  return `<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#fffaf0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121615" media="(prefers-color-scheme: dark)">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${e(APP_NAME)}">
<meta property="og:title" content="${e(shareTitle)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(SITE_URL)}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(shareTitle)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(SITE_URL)}/og-image.png">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css">
<style>${PAGE_CSS}</style>
</head>`;
}

const topBar = right => `<header class="top"><a class="brand" href="/"><img src="/icon.svg" alt="" width="34" height="34"><span>${escapeHtml(APP_NAME)}</span></a>${right}</header>`;
// A creator's ?ref= code on a rule page rides along on its links into the app (attribution.js)
const footer = () => `<footer class="foot"><p>Friendly wagers only. ${escapeHtml(APP_NAME)} never holds or moves money: your group settles up between yourselves.</p><p><a href="/rules">Every game’s rules</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p></footer>`;
const icon = (name, kind = 'fill') => `<i class="ph-${kind} ph-${escapeHtml(name)}" aria-hidden="true"></i>`;

/**
 * One game's page. `sections`: [[heading, html]] from the rules sheet, rendered by the build.
 * `title` and `sub` are the rules sheet's own.
 */
export function renderRulePage({ key, title, sub = '', sections = [] }, origin = SITE_URL) {
  const e = escapeHtml;
  const meta = rulePageMeta(key, { title, sub }, origin);
  const f = ruleFacts(key, sub);
  const name = ruleName(key);
  const play = e(playPath(key));
  const others = RULE_KEYS.filter(k => k !== key && groupOf(k) === groupOf(key));
  const more = others.length ? others : RULE_KEYS.filter(k => k !== key).slice(0, 6);
  const groupName = f.side ? 'side games' : String(f.group).toLowerCase();
  const body = `<body>
<div class="wrap">
${topBar(`<a class="top-link" href="/rules">${icon('list-bullets', 'bold')} All games</a>`)}
<main>
<section class="hero">
<div class="eyebrow">${icon(iconOf(key))} ${e(f.side ? 'Side game' : f.group)}</div>
<h1>${e(meta.heading)}</h1>
<p class="lede">${e(f.pitch)}</p>
<ul class="facts"><li><span>Players</span><strong>${e(f.players)}</strong></li><li><span>Holes</span><strong>${e(f.holes)}</strong></li></ul>
<a class="cta" href="${play}">Play this now ${icon('arrow-right', 'bold')}</a>
<p class="cta-note">Free, right in your browser. Nothing to download. One person keeps score and everyone sees the money as it happens.</p>
</section>
<article class="rules" aria-label="${e(meta.heading)}">
${sections.map(([h, html]) => `<section class="rule"><h2>${e(h)}</h2>${html}</section>`).join('\n')}
</article>
<section class="again">
<h2>${e(f.side ? `Add ${name} to your next round` : `Ready to play ${name}?`)}</h2>
<p>${e(f.side ? 'Pick your main game, then add it under Side games. The pot is worked out hole by hole.' : 'Set it up in a minute: pick the course, add your group and choose the bet. The app does the math.')}</p>
<a class="cta" href="${play}">Play this now ${icon('arrow-right', 'bold')}</a>
</section>
<nav class="more" aria-label="More games">
<h2>More ${e(others.length ? groupName : 'games')}</h2>
<ul class="chips">${more.map(k => `<li><a href="${e(rulePath(k))}">${icon(iconOf(k))} ${e(ruleName(k))}</a></li>`).join('')}</ul>
<a class="all-link" href="/rules">See all ${RULE_KEYS.length} games ${icon('arrow-right', 'bold')}</a>
</nav>
</main>
${footer()}
</div>
${CARRY_REF_SCRIPT}
</body>`;
  return `<!DOCTYPE html>\n<html lang="en">\n${pageHead(meta)}\n${body}\n</html>\n`;
}

/** The title, description and address of the index page. */
export function rulesIndexMeta(origin = SITE_URL) {
  return {
    heading: 'How to play golf betting games',
    title: `How to play golf betting games: rules for ${RULE_KEYS.length} games · ${APP_NAME}`,
    shareTitle: 'How to play golf betting games',
    description: `Rules for Wolf, Nassau, Skins, Banker and ${RULE_KEYS.length - 4} more golf games, with how the bets and the money work. Pick one and play it free with your group.`,
    url: `${origin}/rules`,
  };
}

/** The index of every game, grouped the way setup groups them. `subs`: { key: the rules sheet's sub line }. */
export function renderRulesIndex(subs = {}, origin = SITE_URL) {
  const e = escapeHtml;
  const meta = rulesIndexMeta(origin);
  const groups = [...GAME_GROUPS, 'Side games']
    .map(g => [g, RULE_KEYS.filter(k => groupOf(k) === g)])
    .filter(([, keys]) => keys.length);
  const card = k => {
    const f = ruleFacts(k, subs[k]);
    return `<li><a class="card-link" href="${e(rulePath(k))}"><span class="tile">${icon(iconOf(k))}</span><span class="card-text"><span class="card-name">${e(ruleName(k))}</span><span class="card-sub">${e(f.pitch)} <span class="nw">${e(f.players)}.</span></span></span>${icon('caret-right', 'bold')}</a></li>`;
  };
  const body = `<body>
<div class="wrap">
${topBar(`<a class="top-link" href="/">${icon('golf', 'fill')} Open the app</a>`)}
<main>
<section class="hero">
<div class="eyebrow">${icon('book-open-text')} The rules</div>
<h1>${e(meta.heading)}</h1>
<p class="lede">Every game ${e(APP_NAME)} keeps score for, how it plays and how the money works. Pick one and play it with your group today.</p>
</section>
<div class="groups">
${groups.map(([g, keys]) => `<section class="group"><h2>${e(g)}</h2><ul class="cards">${keys.map(card).join('')}</ul></section>`).join('\n')}
</div>
<section class="again">
<h2>Not sure what to play?</h2>
<p>Skins works for any group size, Nassau is the classic for two to four, and Wolf is the best game for a foursome.</p>
<a class="cta" href="/">Start a round ${icon('arrow-right', 'bold')}</a>
</section>
</main>
${footer()}
</div>
${CARRY_REF_SCRIPT}
</body>`;
  return `<!DOCTYPE html>\n<html lang="en">\n${pageHead(meta)}\n${body}\n</html>\n`;
}

/** sitemap.xml for the app and every rule page. */
export function sitemapXml(origin = SITE_URL) {
  const urls = ['/', rulePath(null), ...RULE_KEYS.map(rulePath)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${escapeHtml(origin + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

/** robots.txt: everything is open, and the sitemap is here. */
export const robotsTxt = (origin = SITE_URL) => `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
