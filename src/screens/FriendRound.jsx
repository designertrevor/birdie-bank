// A friend's round from the Friends feed, read only: who's up, everyone's score so far, the
// scorecard, and (once you Watch) live updates, reactions and trash talk from the gallery. It never
// joins your rounds, History or the Tab. Money shows only for players who chose Show my money.
import { useMemo } from 'react';
import { Empty, Header, Icon, Screen, useUI } from '../components/ui.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { TalkSection } from '../components/Talk.jsx';
import { Scorecard } from './RoundDetail.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { friendRoundView, friendsLine, statusLine } from '../lib/friend-feed.js';
import { rowFor, stopWatching, useFeed, useLiveRound, watchRound } from '../lib/feed-sync.js';
import { followTalk } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';
import { toParText, toParTone, toParWords } from '../lib/to-par.js';

export default function FriendRound({ code }) {
  const nav = useNav();
  const { showToast } = useUI();
  const state = useStore();
  const feed = useFeed();
  const following = !!feed.follows[code];
  const base = feed.status === 'signed-out' ? null : rowFor(feed, code);
  // Followed live while it's on screen, the same way a watcher's phone follows it
  const live = useLiveRound(code, base);
  // Only while the feed still has it: someone changing who sees their rounds takes it off here too
  const row = base ? live.row || base : null;
  const view = useMemo(() => (row ? friendRoundView(row, { following }) : null), [row, following]);
  const ctx = view ? followTalk(code, view.round, state) : null;
  useTalkSync(following && view ? [ctx.key] : [], { live: true });

  if (!view) {
    return (
      <Screen>
        <Header title="Friend’s round" onBack={nav.pop} />
        <Empty title="Not in your feed any more" text="This round finished a while ago, sharing stopped, or someone in it changed who sees their rounds." />
      </Screen>
    );
  }
  const watch = () => { if (watchRound(code, row)) showToast('Watching. It stays at the top of your feed.'); };
  const stop = () => { stopWatching(code); showToast('Stopped watching', { label: 'Undo', run: () => watchRound(code, row) }); };
  const hidden = view.isMoney && view.players.some(p => p.amountText == null);
  const done = view.status === 'done';
  return (
    <Screen>
      <Header title={view.game} onBack={nav.pop} small />
      <div className="scroll">
        <div className="fr-hero">
          <div className={`eyebrow fr-eyebrow ${done ? 'done' : ''}`}>{!done && <span className="fr-dot" aria-hidden="true" />}{statusLine(view)}</div>
          <div className="fr-hero-title d">{view.course || view.title}</div>
          <div className="fr-hero-line" role="status">{view.line}</div>
          <div className="uc-sub">{friendsLine(view)}</div>
          {live.state === 'gone' && <p className="field-help">The scorekeeper stopped sharing this round, so these are the last scores.</p>}
          {live.state === 'offline' && <p className="field-help">No signal. These are the last scores this phone had.</p>}
        </div>

        {!done && (following
          ? (
            <div className="fr-watching">
              <span className="fr-watch-tag"><Icon name="eye" fill /> Watching</span>
              <button className="text-link fr-stop" onClick={stop}>Stop watching</button>
            </div>
          ) : (
            <div className="fr-watch-cta">
              <button className="full-btn" onClick={watch}><Icon name="eye" fill /> Watch this round</button>
              <p className="field-help">Follow every hole as it’s scored, read only, and cheer them on in the trash talk.</p>
            </div>
          ))}

        <div className="sec-label">{done ? 'How it finished' : 'Scores so far'}</div>
        <ul className="fr-board" role="list">
          {view.players.map(p => {
            const seat = view.round.players.find(x => x.id === p.id);
            return (
              <li key={p.id} className="fr-board-row">
                <span className="fr-place" aria-label={`Place ${p.place}`}>{p.place}</span>
                <Avatar id={p.id} name={p.name} seat={seat} size="sm" />
                <span className="fr-name">
                  <span className="fr-name-main">{p.name}{p.friend && <span className="fr-friend" aria-label=", a friend"><Icon name="user-check" fill /></span>}</span>
                  {p.team && <span className="fr-name-sub">{p.team}</span>}
                </span>
                <span className="fr-par">
                  {p.toPar == null
                    ? <span className="fr-par-v">–</span>
                    : <span className={`fr-par-v sc-par ${toParTone(p.toPar)}`} aria-label={toParWords(p.toPar)}>{toParText(p.toPar)}</span>}
                  <span className="fr-thru">{p.played ? (p.played >= view.holes ? 'F' : `thru ${p.played}`) : ''}</span>
                </span>
                {p.amountText != null && <span className={`fr-amt ${p.amount > 0 ? 'pos' : p.amount < 0 ? 'neg' : ''}`}>{p.amountText}</span>}
              </li>
            );
          })}
        </ul>
        {hidden && <p className="field-help pad">Amounts show only for players who turned on Show my money.</p>}

        <div className="sec-label">Scorecard</div>
        <Scorecard round={view.round} />

        {following && ctx.who
          ? <TalkSection ctx={ctx} on="round" title="Trash talk" />
          : <p className="field-help pad">{done ? 'You didn’t watch this one, so its trash talk is the players’.' : 'Watch to react and add to the trash talk.'}</p>}
        <p className="field-help pad fr-readonly"><Icon name="lock-simple" /> Watching is read only. It never goes on your Tab or in your History.</p>
      </div>
    </Screen>
  );
}
