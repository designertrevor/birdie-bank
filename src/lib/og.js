// Link previews for the app's links: turns a shared round's meta (?join=), a plan's (?plan=), a
// challenge's (?challenge=) or a captain's draft link (?draft=) into preview text and swaps it into
// index.html's Open Graph tags. Pure, so api/join.js and the tests can both use it.
import { GAMES, SIDE_GAMES } from './round.js';
import { APP_NAME } from './app-name.js';
import { roundStakeLines } from './stakes.js';
import { gameLabel } from './format.js';
import { countsMoney, playForLine } from './play-for.js';

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
  const game = GAMES[meta.game] ? gameLabel(meta) : null;
  const course = typeof meta.course?.name === 'string' ? meta.course.name.trim() : '';
  if (!game && !course) return null;
  const what = game || 'a round';
  const where = course ? ` at ${course}` : '';
  const done = meta.status === 'done';
  const host = first(meta.hostName);
  const title = done ? `${game ? `${game} results` : 'Round results'}${where}` : `Join ${game ? `the ${game}` : 'the round'}${where}`;

  const who = nameList((Array.isArray(meta.players) ? meta.players : []).map(p => first(p?.name)));
  let stakes = '';
  try { stakes = meta.game && meta.settings ? roundStakeLines(meta).map(l => l.line).filter(Boolean).join(' + ') : ''; } catch { stakes = ''; }
  const facts = [who, stakes, meta.holesCount ? `${meta.holesCount} holes` : '', playForLine(meta) || ''].filter(Boolean).join(' · ');
  // A points or reward round has no money to follow
  const isMoney = countsMoney(meta);
  const tail = done
    ? (isMoney ? `See who won and who pays who on ${APP_NAME}.` : `See who won on ${APP_NAME}.`)
    : `Tap to follow ${isMoney ? 'the money' : 'the scores'} live for ${what}. No download needed.`;
  // Who sent it, so a link from a friend reads as an invite from them
  const lead = host && !done ? `${host} invited you. ` : '';
  return { title, description: `${lead}${facts ? `${facts}. ${tail}` : tail}` };
}

/** Swap preview text into the Open Graph, Twitter and title tags of the built index.html. */
export function injectMeta(html, { title, description, url }) {
  const t = escapeHtml(title), d = escapeHtml(description), u = escapeHtml(url);
  // Replace with functions, so a "$2 a skin" in the text isn't read as a capture group
  const set = (h, attr, key, value) => h.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), (_, a, b) => a + value + b);
  let out = html;
  out = set(out, 'property', 'og:title', t);
  out = set(out, 'property', 'og:description', d);
  out = set(out, 'property', 'og:url', u);
  out = set(out, 'property', 'og:image:alt', t);
  out = set(out, 'name', 'twitter:title', t);
  out = set(out, 'name', 'twitter:description', d);
  out = set(out, 'name', 'description', d);
  out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`);
  return out;
}

// --------------------------- plans, challenges and drafts -------------------

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Sat, Oct 11" from "2026-10-11". Always the date, never "tomorrow": a preview is drawn once on
 * the server (in its own time zone) and kept by the messaging app for days.
 */
export function previewDay(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const day = new Date(Date.UTC(y, m - 1, d));
  if (day.getUTCMonth() !== m - 1) return '';
  return `${DAYS[day.getUTCDay()]}, ${MONTHS[m - 1]} ${d}`;
}

/** "8:10 AM" from "08:10". */
export function previewTime(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m || Number(m[1]) > 23) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const gameName = key => GAMES[key]?.name || SIDE_GAMES[key]?.label || null;
const text = v => (typeof v === 'string' ? v.trim() : '');

/**
 * Preview for a plan link: who's asking, the day and tee time, the course and the game. `who` is
 * the ?p= of one person's own link, so theirs reads "Dave, you in for golf Sat, Oct 11?". No
 * amounts and nobody's answers: a link can land in any thread. Null when there's nothing to go on.
 */
export function planPreview(meta, who = null) {
  if (!meta || typeof meta !== 'object') return null;
  const day = previewDay(meta.date);
  const time = previewTime(meta.teeTime);
  const course = text(meta.course?.name);
  if (!day && !course) return null;
  const host = first(meta.hostName);
  const person = who && Array.isArray(meta.people) ? meta.people.find(p => p && p.id === who) : null;
  const name = person ? first(person.name) : '';
  const when = [day, time && `at ${time}`].filter(Boolean).join(' ');
  const game = gameName(meta.game);
  if (meta.status === 'off') {
    return { title: when ? `Golf on ${when} is off` : 'This round is off', description: `${host || 'The organizer'} called off the round${course ? ` at ${course}` : ''}. Keep an eye out for the next one.` };
  }
  const title = name
    ? `${name}, you in for golf${when ? ` ${when}` : ''}?`
    : `Golf${when ? ` ${when}` : ''}${course ? ` at ${course}` : ''}`;
  const facts = [
    host ? `${host} invited you` : 'You’re invited',
    name && course ? `${course}` : '',
    game ? `Thinking ${game}${playForLine(meta) ? `, ${playForLine(meta).toLowerCase()}` : ''}` : '',
  ].filter(Boolean).join(' · ');
  return { title, description: `${facts}. Tap to say if you’re in and vote on the game and the bet. No download needed.` };
}

/**
 * Preview for a challenge link: who challenged who, the kind and the holes, and the day when it's
 * for a planned round. Never the amount (the same rule as a challenge shown to the group), since
 * a link can be forwarded anywhere.
 */
export function challengePreview(meta) {
  if (!meta || typeof meta !== 'object' || !meta.from || !meta.to) return null;
  const a = first(meta.from.name), b = first(meta.to.name);
  if (!a || !b) return null;
  const setter = meta.setBy ? first(meta.setBy.name) : '';
  const title = setter ? `${setter} set up ${a} v ${b}` : `${a} challenged ${b}`;
  const kind = { match: 'A match', hole: 'A bet on every hole', ctp: 'Closest to the pin on the par 3s' }[meta.kind]
    || (meta.kind === 'custom' && text(meta.label) ? `A side bet: ${text(meta.label).slice(0, 40)}` : 'A side bet');
  const holes = { front: 'on the front 9', back: 'on the back 9' }[meta.holes] || '';
  const day = previewDay(meta.plan?.date);
  const when = day ? `on ${day}` : 'next time they play';
  return { title, description: `${kind}${holes ? ` ${holes}` : ''}, ${when}. Tap to accept, pass or name your own amount. No download needed.` };
}

/** Preview for a captain's draft link: nothing to look up, the link says what it is. */
export function draftPreview() {
  return { title: 'Your captain’s draft is ready', description: 'Take turns picking the teams for the trip. Tap to make your picks. No download needed.' };
}
