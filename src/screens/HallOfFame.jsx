// A crew's hall of fame (hall-of-fame.js), opened from the crew's tab and from Season: the season's
// money list, its champions, and the crew's history (closed seasons' winners, the biggest single-round
// wins and the records). Display only, from the rounds the crew already has; points rounds read in
// points and reward rounds in the reward, apart from the money.
import { useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen } from '../components/ui.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { points } from '../lib/play-for.js';
import { crewsOf } from '../lib/crew-tabs.js';
import { crewHall, crewSeason } from '../lib/hall-of-fame.js';

const DASH = '–';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const day = t => {
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const signed = c => (c ? money(c / 100, { sign: true }) : '$0');
const tone = c => (c > 0 ? 'pos' : c < 0 ? 'neg' : '');

export default function HallOfFame({ crew: crewId }) {
  const nav = useNav();
  const state = useStore();
  const [now] = useState(() => Date.now());
  const crew = crewsOf(state).find(c => c.id === crewId);
  const season = useMemo(() => (crew ? crewSeason(state, crew.id, { now }) : null), [state, crew, now]);
  const hall = useMemo(() => (crew ? crewHall(state, crew.id, { now }) : null), [state, crew, now]);
  if (!crew) {
    return (
      <Screen>
        <Header title="Hall of fame" small onBack={nav.pop} />
        <div className="scroll"><Empty title="This crew is gone" text="Its rounds are still in History and on the Tab." /></div>
      </Screen>
    );
  }
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  const label = id => (id === me ? 'You' : nameOf(state, id));
  const first = id => (id === me ? 'You' : String(nameOf(state, id)).split(' ')[0]);
  const names = ids => {
    const n = ids.map(first);
    return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`;
  };
  const { records } = hall;
  const sinceLine = season.since ? `since the books closed on ${day(season.since)}` : 'this season';
  const rewardWord = season.rewards.names.length === 1 ? season.rewards.names[0].toLowerCase() : 'the reward';

  if (!hall.rounds && !hall.seasons.length) {
    return (
      <Screen>
        <Header title="Hall of fame" small onBack={nav.pop} />
        <div className="scroll"><Empty title="No rounds yet" text={`Play a round with ${crew.name} and its money list, champions and records start here.`} /></div>
      </Screen>
    );
  }

  return (
    <Screen className="hof">
      <Header title="Hall of fame" small onBack={nav.pop} />
      <div className="scroll">
        <div className="settle-lede">
          <div className="eyebrow">{crew.name}</div>
          <div className="d settle-count">{season.champion ? `${first(season.champion.id)} ${season.champion.id === me ? 'lead' : 'leads'} the season` : 'The season so far'}</div>
          <p>{season.rounds ? `${plural(season.rounds, 'round')} for money ${sinceLine}` : `No rounds for money ${sinceLine}`}</p>
        </div>

        {season.money.length > 0 && (
          <>
            <div className="sec-label">Money list</div>
            <ol className="block hof-list" aria-label={`${crew.name} money list`}>
              {season.money.map((r, i) => (
                <li key={r.id} className={`hof-row ${r.id === me ? 'me' : ''}`}>
                  <span className="hof-rank" aria-hidden="true">{i + 1}</span>
                  <Avatar id={r.id} name={nameOf(state, r.id)} size="sm" />
                  <span className="row-main">
                    <span className="hof-name">{label(r.id)}</span>
                    <span className="hof-sub">{plural(r.rounds, 'round')} · {plural(r.wins, 'win')}</span>
                  </span>
                  <span className={`hof-amt ${tone(r.cents)}`}>{signed(r.cents)}</span>
                </li>
              ))}
            </ol>
            <p className="field-help pad">What each person won or lost in the crew’s rounds this season, before anything was paid. It adds up to the crew’s tab.</p>
          </>
        )}

        <div className="sec-label">Champions</div>
        <div className="block kv-block">
          <Kv k="Season leader" v={season.champion ? `${first(season.champion.id)}, ${signed(season.champion.cents)}` : DASH} />
          <Kv k="Most wins" v={season.mostWins ? `${names(season.mostWins.ids)}, ${season.mostWins.wins}` : DASH} />
          {hall.seasons.map(s => (
            <Kv key={s.id} k={s.name} v={s.champion ? `${first(s.champion.id)}, ${signed(s.champion.cents)}` : DASH} />
          ))}
        </div>

        {season.points.length > 0 && (
          <>
            <div className="sec-label">Played for points</div>
            <ol className="block hof-list" aria-label="Points rounds">
              {season.points.map((r, i) => (
                <li key={r.id} className={`hof-row ${r.id === me ? 'me' : ''}`}>
                  <span className="hof-rank" aria-hidden="true">{i + 1}</span>
                  <Avatar id={r.id} name={nameOf(state, r.id)} size="sm" />
                  <span className="row-main">
                    <span className="hof-name">{label(r.id)}</span>
                    <span className="hof-sub">{plural(r.rounds, 'round')} · {plural(r.wins, 'win')}</span>
                  </span>
                  <span className={`hof-amt ${tone(r.points)}`}>{points(r.points, { sign: true })}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {season.rewards.rows.length > 0 && (
          <>
            <div className="sec-label">Played for {rewardWord}</div>
            <div className="block kv-block">
              {season.rewards.rows.map(r => (
                <Kv key={r.id} k={label(r.id)} v={`Won ${r.won} of ${r.rounds}`} />
              ))}
            </div>
          </>
        )}

        <div className="sec-label">Biggest wins</div>
        <div className="block kv-block">
          {hall.biggestWins.length
            ? hall.biggestWins.map(w => <Kv key={`${w.roundId}${w.id}`} k={`${first(w.id)} · ${w.course || day(w.at)}`} v={signed(w.cents)} sub={w.course ? day(w.at) : null} />)
            : <Kv k="Nobody yet" v={DASH} />}
        </div>

        <div className="sec-label">Records</div>
        <div className="block kv-block">
          <Kv k="Longest win streak" v={records.streak ? `${first(records.streak.id)}, ${records.streak.n} in a row` : DASH} />
          <Kv k="Most skins in a round" v={records.skins ? `${first(records.skins.id)}, ${records.skins.skins}` : DASH} sub={records.skins ? `${records.skins.course || 'A round'}, ${day(records.skins.at)}` : null} />
          <Kv k={records.low ? `Low ${records.low.holes}` : 'Low round'} v={records.low ? `${first(records.low.id)}, ${records.low.strokes}` : DASH} sub={records.low ? `${records.low.course || 'A round'}, ${day(records.low.at)}` : null} />
          <Kv k="Most rounds" v={records.regular ? `${first(records.regular.id)}, ${records.regular.n}` : DASH} />
        </div>
        <p className="field-help pad">Only you see this. It’s built from the crew’s rounds on this phone, back to the first one. Points rounds count in points and reward rounds in the reward, never in the money.</p>
        {season.rounds > 0 && (
          <button className="text-link stats-link" onClick={() => nav.push('closeBooks', { scope: `crew:${crew.id}` })}>
            <Icon name="book-bookmark" fill /> <span className="row-main">Close the books<span className="sl-sub">End this season and start the next</span></span> <Icon name="caret-right" />
          </button>
        )}
      </div>
    </Screen>
  );
}

const Kv = ({ k, v, sub }) => (
  <div className="kv-row"><span className="kv-k">{k}{sub && <span className="sl-sub">{sub}</span>}</span><span className="kv-v">{v}</span></div>
);
