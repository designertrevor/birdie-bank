// A round's trash talk in a few characters, for a row in a list (see lib/talk.js). Kept apart
// from Talk.jsx so the lists on Up next and History stay small.
import { Icon } from './ui.jsx';
import { talkCounts } from '../lib/talk-counts.js';

/** Comments and reactions on a thread: a chat bubble and a smiley, each with its count. */
export function TalkCount({ rows }) {
  const { comments, reactions } = talkCounts(rows || {});
  if (!comments && !reactions) return null;
  const label = [comments ? `${comments} comment${comments === 1 ? '' : 's'}` : null, reactions ? `${reactions} reaction${reactions === 1 ? '' : 's'}` : null].filter(Boolean).join(', ');
  return (
    <span className="talk-count" role="img" aria-label={label}>
      {comments > 0 && <span><Icon name="chat-circle" fill /> {comments}</span>}
      {reactions > 0 && <span><Icon name="smiley" fill /> {reactions}</span>}
    </span>
  );
}
