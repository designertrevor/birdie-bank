// How much trash talk a round or plan has, for the small counts on lists (see talk.js). No other
// imports, so the lists on Up next and History stay small.

const live = r => r && !r.deleted;

/** How much talk a thread has: { comments, reactions } (each person's emoji counts once). */
export function talkCounts(rows = {}, on = null) {
  const list = Object.values(rows || {}).filter(x => live(x) && (on == null || x.on === on));
  return { comments: list.filter(x => x.kind === 'comment').length, reactions: list.filter(x => x.kind === 'reaction').length };
}

/** "3 comments", "1 comment · 4 reactions", or null when it's quiet. */
export function countsLine({ comments = 0, reactions = 0 } = {}) {
  const parts = [];
  if (comments) parts.push(`${comments} comment${comments === 1 ? '' : 's'}`);
  if (reactions) parts.push(`${reactions} reaction${reactions === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : null;
}

/** How much talk a round has, for a small count on its row. */
export function roundTalkCounts(state, round) {
  return talkCounts(state?.talk?.[`round:${round.id}`] || {});
}
