// Link previews for join links: turns a shared round's meta into preview text and swaps it
// into index.html's Open Graph tags. Pure, so api/join.js and the tests can both use it.
import { GAMES } from './round.js';
import { stakeSummary } from './stakes.js';

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const first = name => String(name || '').trim().split(/\s+/)[0];

function nameList(names) {
  const n = names.filter(Boolean);
  if (n.length <= 1) return n[0] || '';
  if (n.length <= 4) return `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`;
  return `${n.slice(0, 3).join(', ')} and ${n.length - 3} more`;
}

/** Preview title and description for a shared round, or null when there's nothing to go on. */
export function joinPreview(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const game = GAMES[meta.game]?.name || null;
  const course = typeof meta.course?.name === 'string' ? meta.course.name.trim() : '';
  if (!game && !course) return null;
  const what = game || 'a round';
  const where = course ? ` at ${course}` : '';
  const done = meta.status === 'done';
  const title = done ? `${game ? `${game} results` : 'Round results'}${where}` : `Join ${game ? `the ${game}` : 'the round'}${where}`;

  const who = nameList((Array.isArray(meta.players) ? meta.players : []).map(p => first(p?.name)));
  let stakes = '';
  try { stakes = meta.game && meta.settings ? stakeSummary(meta.game, meta.settings) : ''; } catch { stakes = ''; }
  const facts = [who, stakes, meta.holesCount ? `${meta.holesCount} holes` : ''].filter(Boolean).join(' · ');
  const tail = done ? 'See who won and who pays who on Birdie Bank.' : `Tap to follow the money live and enter scores for ${what}. No download needed.`;
  return { title, description: facts ? `${facts}. ${tail}` : tail };
}

/** Swap preview text into the Open Graph, Twitter and title tags of the built index.html. */
export function injectMeta(html, { title, description, url }) {
  const t = escapeHtml(title), d = escapeHtml(description), u = escapeHtml(url);
  const set = (h, attr, key, value) => h.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), `$1${value}$2`);
  let out = html;
  out = set(out, 'property', 'og:title', t);
  out = set(out, 'property', 'og:description', d);
  out = set(out, 'property', 'og:url', u);
  out = set(out, 'property', 'og:image:alt', t);
  out = set(out, 'name', 'twitter:title', t);
  out = set(out, 'name', 'twitter:description', d);
  out = set(out, 'name', 'description', d);
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  return out;
}
