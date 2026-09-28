// Words for fixing a hole or a tee during a round (the engine is fixHole and fixTee in round.js):
// who gains or loses a stroke, how the money recounts, and the note sent to Birdie Bank.
import { fixedCourse, roundResults, strokeChanges } from './round.js';
import { money } from './golf.js';

const first = name => String(name || '').split(' ')[0];

/** "9", "3 and 9", "3, 7 and 9". */
function numberList(nos) {
  return nos.length < 2 ? nos.join('') : `${nos.slice(0, -1).join(', ')} and ${nos.at(-1)}`;
}

/** "here", "on 9", "here and on 9". */
function place(nos, holeNo) {
  const here = nos.includes(holeNo);
  const rest = nos.filter(n => n !== holeNo);
  return [here ? 'here' : '', rest.length ? `on ${numberList(rest)}` : ''].filter(Boolean).join(' and ');
}

/**
 * One plain sentence per player whose strokes move, e.g. "Dave gets a stroke here now, not on 9."
 * `holeNo` is the hole being fixed ("here"). An empty list means nobody's strokes change.
 */
export function strokeChangeLines(changes, holeNo) {
  const byUnit = new Map();
  for (const c of changes) {
    if (!byUnit.has(c.id)) byUnit.set(c.id, { name: c.name, list: [] });
    byUnit.get(c.id).list.push(c);
  }
  const out = [];
  for (const { name, list } of byUnit.values()) {
    const n = first(name);
    const gained = list.filter(c => c.to > c.from).map(c => c.holeNo);
    const lost = list.filter(c => c.to < c.from).map(c => c.holeNo);
    if (list.some(c => c.from < 0 || c.to < 0)) out.push(`${n}’s strokes change ${place(list.map(c => c.holeNo), holeNo)}.`);
    else if (gained.length && lost.length) out.push(`${n} gets a stroke ${place(gained, holeNo)} now, not ${place(lost, holeNo)}.`);
    else if (gained.length) out.push(`${n} gets a stroke ${place(gained, holeNo)} now.`);
    else out.push(`${n} doesn’t get a stroke ${place(lost, holeNo)} now.`);
  }
  return out;
}

/** The "What this changes" lines for going from `before` to `after`, fixing `holeNo`. */
export function strokeImpact(before, after, holeNo) {
  const lines = strokeChangeLines(strokeChanges(before, after), holeNo);
  return lines.length ? lines : ['No one’s strokes change.'];
}

/** Money by player that moves between the two versions: [{ id, name, delta }], biggest first. */
export function moneyChanges(before, after) {
  const a = roundResults(before).balances;
  const b = roundResults(after).balances;
  return after.players
    .map(p => ({ id: p.id, name: p.name, delta: Math.round(((b[p.id] || 0) - (a[p.id] || 0)) * 100) / 100 }))
    .filter(x => x.delta !== 0)
    .sort((x, y) => y.delta - x.delta);
}

/** "Money recounts: Dave +$10, Trevor −$5", or null when nothing moves. */
export function moneyLine(before, after) {
  const ch = moneyChanges(before, after);
  if (!ch.length) return null;
  return `Money recounts: ${ch.map(c => `${first(c.name)} ${money(c.delta, { sign: true })}`).join(', ')}`;
}

/** The tees the round's players are on: "White", "White and Blue". */
export function teesInUse(round) {
  const names = [...new Set(round.players.map(p => p.tee).filter(Boolean))];
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Where a course came from, for the feedback note. */
export function courseSource(course) {
  if (!course) return 'not on this phone';
  if (course.source === 'golfcourseapi') return course.edited ? 'course database, edited' : 'course database';
  if (course.custom) return 'added by the user';
  return 'built in';
}

/** A hole fix as a feedback message (kind 'course'). */
export function holeFixFeedback(round, course, hole, before, after) {
  const tee = teesInUse(round);
  const parts = [];
  if (before.par !== after.par) parts.push(`par ${before.par} to ${after.par}`);
  if (before.hdcp !== after.hdcp) parts.push(`stroke index ${before.hdcp ?? 'none'} to ${after.hdcp}`);
  return {
    kind: 'course',
    body: `Hole ${hole.no} at ${round.course.name}${tee ? ` (${tee})` : ''}: ${parts.join(', ')}`,
    details: {
      fix: 'hole', courseId: round.course.id, courseName: round.course.name, source: courseSource(course), apiId: course?.apiId ?? null,
      tee, hole: hole.no, courseIdx: hole.courseIdx, old: before, new: after,
    },
    roundId: round.id,
  };
}

/** A tee fix as a feedback message (kind 'course'). */
export function teeFixFeedback(round, course, teeName, before, after) {
  const parts = [];
  if (before.rating !== after.rating) parts.push(`rating ${before.rating ?? 'none'} to ${after.rating}`);
  if (before.slope !== after.slope) parts.push(`slope ${before.slope ?? 'none'} to ${after.slope}`);
  return {
    kind: 'course',
    body: `${teeName} tees at ${round.course.name}: ${parts.join(', ')}`,
    details: {
      fix: 'tee', courseId: round.course.id, courseName: round.course.name, source: courseSource(course), apiId: course?.apiId ?? null,
      tee: teeName, old: before, new: after,
    },
    roundId: round.id,
  };
}

/** "Strokes: Dave 8 → 9, Al 3 → 2" for players whose strokes off the low move, or null. */
export function playsLine(before, after) {
  const ch = after.players
    .map((p, i) => ({ name: first(p.name), from: before.players[i]?.plays ?? 0, to: p.plays ?? 0 }))
    .filter(c => c.from !== c.to);
  return ch.length ? `Strokes: ${ch.map(c => `${c.name} ${c.from} → ${c.to}`).join(', ')}` : null;
}

/** The tees a round's players are on, as this phone's (fixed) course has them. */
export function roundTees(round, course) {
  const names = [...new Set(round.players.map(p => p.tee).filter(Boolean))];
  const fixed = course ? fixedCourse(course, round) : null;
  return names.map(name => ({ name, tee: fixed?.tees?.find(t => t.name === name) || null }));
}

/** "White · 69.8 / 124" for the round menu (just the tee names when there's more than one, or no course here). */
export function courseTeeLabel(round, course) {
  const tees = roundTees(round, course);
  if (tees.length === 1 && tees[0].tee?.rating != null && tees[0].tee?.slope != null) return `${tees[0].name} · ${tees[0].tee.rating} / ${tees[0].tee.slope}`;
  return tees.map(t => t.name).join(', ');
}

/**
 * Whether a hole's unsaved score for `id` (kept across a remount) wins over the saved score or par.
 * A score you changed always does. One you confirmed at par also does once the hole's par has been
 * fixed, so a 4 you meant stays a 4 (untouched scores still start from the new par). Otherwise the
 * saved score, which may have come from another phone, wins.
 */
export function keepsDraft(kept, id, saved, par) {
  if (!kept?.dirty || !kept.base) return false;
  if (kept.draft[id] !== kept.base[id]) return true;
  return !!kept.touched?.[id] && saved?.[id] == null && kept.base[id] !== par;
}
