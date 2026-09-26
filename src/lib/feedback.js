// "Suggest something": sends feedback to the Supabase `feedback` table (see supabase/schema.sql).
// Sending never fails from the user's side: with no signal it waits in a queue on the phone
// and goes out when the phone is back online.
import { getState } from './store.js';
import { GAMES } from './round.js';
import { getSupabase } from './supabase.js';

const QUEUE = 'bb-feedback-queue';

export const FEEDBACK_KINDS = {
  game: { icon: 'cards', title: 'A new game', sub: 'A game your group plays that isn’t here' },
  course: { icon: 'map-trifold', title: 'A missing course', sub: 'Or a scorecard that’s wrong' },
  feature: { icon: 'lightbulb', title: 'A feature', sub: 'Something that would save you time' },
  bug: { icon: 'bug', title: 'Something’s broken', sub: 'Tell us what went wrong' },
};

/** Device and round details attached to every message, so bugs can be reproduced. */
export function feedbackContext() {
  const s = getState();
  const r = s.activeRoundId && s.rounds[s.activeRoundId];
  return {
    app: location.host,
    path: location.pathname,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`,
    installed: window.matchMedia?.('(display-mode: standalone)').matches || false,
    online: navigator.onLine,
    theme: s.settings.theme,
    counts: { players: Object.keys(s.players).length, rounds: Object.keys(s.rounds).length },
    round: r ? {
      id: r.id, game: r.game, gameName: GAMES[r.game]?.name, course: r.course?.name, courseId: r.course?.id,
      holes: r.holes.length, current: r.current, players: r.players.length, shared: r.shared?.code || null,
    } : null,
  };
}

/** Shrink a photo to a reasonable JPEG data URL (small enough to queue on the phone). */
export async function shrinkImage(file, max = 1400) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.82);
}

function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE)) || []; } catch { return []; } }
function writeQueue(q) { try { localStorage.setItem(QUEUE, JSON.stringify(q)); } catch { /* storage full */ } }

async function send(item) {
  const c = await getSupabase();
  if (!c) {
    // No server configured (npm run dev without keys): keep a local copy so the flow can be tested
    const sent = JSON.parse(localStorage.getItem('bb-feedback-local') || '[]');
    sent.push(item);
    localStorage.setItem('bb-feedback-local', JSON.stringify(sent));
    return;
  }
  let screenshot_path = null;
  if (item.image) {
    const blob = await (await fetch(item.image)).blob();
    const path = `${new Date().toISOString().slice(0, 10)}/${item.id}.jpg`;
    const up = await c.storage.from('feedback').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error && !/exists/i.test(up.error.message)) throw up.error;
    screenshot_path = path;
  }
  const { error } = await c.from('feedback').insert({
    id: item.id, kind: item.kind, body: item.body, details: item.details, context: item.context,
    contact: item.contact || null, screenshot_path,
  });
  if (error && error.code !== '23505') throw error; // 23505: already sent on an earlier try
}

let flushing = null;
/** Send anything waiting in the queue. Safe to call often. */
export function flushFeedback() {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const item of readQueue()) {
      try {
        await send(item);
        writeQueue(readQueue().filter(x => x.id !== item.id));
      } catch { break; }
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Queue a message and try to send it. Resolves to 'sent' or 'queued'. */
export async function submitFeedback({ kind, body, details = {}, contact = '', image = null }) {
  const item = { id: crypto.randomUUID(), kind, body: body.trim(), details, contact: contact.trim(), image, context: feedbackContext(), at: Date.now() };
  writeQueue([...readQueue(), item]);
  await flushFeedback();
  return readQueue().some(x => x.id === item.id) ? 'queued' : 'sent';
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushFeedback());
  if (readQueue().length) setTimeout(() => flushFeedback(), 3000);
}
