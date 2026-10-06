// Share a card into the group text: the recap of a round, a trip's standings, or the cup. Each is
// a story-sized image in the results image's style (share-cards-image.js) with the same Show
// amounts switch and buttons (ShareSheet.jsx), the words from share-cards.js.
// Opened with nav.push('share', { kind: 'recap' | 'trip' | 'cup', id }), or { kind: 'wrapped', year } for
// your year in review (wrapped.js), drawn by wrapped-image.js, or { kind: 'profile' } for your own
// profile card (profile-card.js), a square drawn by profile-card-image.js. Only ever yours: it takes no id.
import { useCallback, useState } from 'react';
import { Empty, Header, Screen } from '../components/ui.jsx';
import { BuddyArt } from '../components/BuddyArt.jsx';
import { ShareView } from '../components/ShareSheet.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { nameOf } from '../lib/ledger.js';
import { countsMoney } from '../lib/play-for.js';
import { bettors } from '../lib/round.js';
import { tripStatus } from '../lib/trips.js';
import { appLink, shareRoundLink, slugName } from '../lib/share.js';
import { cardText, cupCardModel, cupPeople, recapCardModel, tripCardModel } from '../lib/share-cards.js';
import { renderCard } from '../lib/share-cards-image.js';
import { wrappedCardModel, yearInReview } from '../lib/wrapped.js';
import { renderWrapped } from '../lib/wrapped-image.js';
import { profileCard, profileCardModel } from '../lib/profile-card.js';
import { renderProfileCard } from '../lib/profile-card-image.js';
import { photoAllowed } from '../lib/avatars.js';
import { supabaseUrl } from '../lib/supabase.js';

const card = model => ({ model, alt: model.alt, text: cardText(model) });

export default function ShareScreen({ kind, id, year }) {
  const nav = useNav();
  const state = useStore();
  const gone = (title, text) => (
    <Screen><Header title="Share" small onBack={nav.pop} /><div className="scroll"><Empty title={title} text={text} /></div></Screen>
  );

  if (kind === 'profile') return <ProfileShare state={state} onBack={nav.pop} />;

  if (kind === 'wrapped') {
    const y = yearInReview(state, year || new Date().getFullYear());
    if (!y.rounds) return gone(`No rounds in ${y.year} yet`, 'Finish a round and your year in review starts here.');
    const link = appLink();
    // Only your own money is on it: Show amounts (off until you turn it on) is all that puts it there
    return (
      <Screen>
        <ShareView title="Your year in review" small onBack={nav.pop} what="Year in review" link={link}
          make={show => { const m = wrappedCardModel(state, y, { showAmounts: show, link }); return { model: m, alt: m.alt, text: m.text }; }}
          render={renderWrapped} fileName={slugName('year-in-review', String(y.year))}
          money={!!y.money} people={[]} standIn={m => <WrappedStandIn model={m} />}
          onText="Your net and best day are on the image" offText="Rounds, courses, your low round and the moment of the year, no money" />
      </Screen>
    );
  }

  if (kind === 'recap') {
    const round = state.rounds?.[id];
    if (!round || round.status !== 'done') return gone('This round is gone', 'It was taken off this phone.');
    // No live link when someone keeps their money private: watching the round would show it
    const link = shareRoundLink(state, round, { money: countsMoney(round) });
    return (
      <Screen>
        <ShareView title="Share the recap" small onBack={nav.pop} what="Recap" link={link}
          make={show => card(recapCardModel(state, round, { showAmounts: show, link }))} render={renderCard}
          fileName={slugName('recap', round.course?.name, round.finishedAt || round.createdAt)}
          money={countsMoney(round)} people={bettors(round)}
          onText="Everyone’s money from the round is on the image" offText="Who took it, the order and the moments, no money" />
      </Screen>
    );
  }

  const st = tripStatus(state, id);
  if (!st) return gone('This trip is gone', 'Its rounds and their money are still in History and on the Tab.');
  const link = appLink();
  if (kind === 'cup' && st.cup) {
    return (
      <Screen>
        <ShareView title="Share the cup" small onBack={nav.pop} what="Cup score" link={link}
          make={show => card(cupCardModel(state, st.trip, st.cup, { showAmounts: show, link }))} render={renderCard}
          fileName={slugName('cup', st.trip.name)} money={st.cup.def.stake > 0} people={cupPeople(state, st.cup)}
          onText="What’s on the cup is on the image" offText="The score and the leaderboard, no money" />
      </Screen>
    );
  }
  // Money standings hide their dollars until the switch is on; points standings always show
  const people = st.standings.map(p => ({ id: p.id, name: nameOf(state, p.id) }));
  return (
    <Screen>
      <ShareView title="Share the standings" small onBack={nav.pop} what="Standings" link={link}
        make={show => card(tripCardModel(state, st, { showAmounts: show, link }))} render={renderCard}
        fileName={slugName('trip', st.trip.name)} money={st.standings.length > 0} people={people}
        onText="Everyone’s money on the trip is on the image" offText="The order and the cup, no money" />
    </Screen>
  );
}

/**
 * Your profile card. Your photo goes on the image when it's one the app may fetch; a buddy is drawn
 * here once, hidden, and handed to the canvas as a picture; initials need nothing.
 */
function ProfileShare({ state, onBack }) {
  const card = profileCard(state);
  const [buddySrc, setBuddySrc] = useState(null);
  const a = card.avatar;
  // The buddy as the avatar draws it, read once it's on the page (keyed below, so a new buddy reads again)
  const grab = useCallback(node => {
    const svg = node?.querySelector('svg');
    if (svg && typeof XMLSerializer !== 'undefined') setBuddySrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`);
  }, []);
  const avatarSrc = a.kind === 'photo' && photoAllowed(a.url, supabaseUrl) ? a.url : a.kind === 'buddy' ? buddySrc : null;
  const link = appLink();
  const hasMoney = !!(card.season.money || card.nemesis);
  return (
    <Screen>
      <ShareView title="Share my card" small onBack={onBack} what="Card" link={link} square
        make={show => { const m = profileCardModel(card, { showAmounts: show, link, avatarSrc }); return { model: m, alt: m.alt, text: m.text }; }}
        render={renderProfileCard} fileName={slugName('player-card', card.name || 'me')}
        money={hasMoney} people={[]} standIn={m => <WrappedStandIn model={m} />}
        onText="Your season’s money and what your nemesis took are on the image" offText="Handicap, record, favorite game and nemesis, no money">
        <p className="field-help pad">Only your own card. Your nemesis goes by first name, and not at all if their profile is Only you.</p>
      </ShareView>
      {a.kind === 'buddy' && <span key={`${a.buddy}-${a.bg}`} ref={grab} hidden><BuddyArt id={a.buddy} bg={a.bg} /></span>}
    </Screen>
  );
}

/** The year in review (or the profile card) while its image is being drawn: the same words, as tiles. */
function WrappedStandIn({ model }) {
  return (
    <div className={`share-card${model.headline ? '' : ' square'}`}>
      <div className="sc-brand">{model.eyebrow}</div>
      <div className="sc-meta">{model.title}</div>
      {model.headline && <div className="sc-big d wrapped-big">{model.headline}<br />{model.sub}</div>}
      <div className="wrapped-tiles">
        {model.tiles.map(t => <div key={t.label} className="wrapped-tile"><b>{t.value}</b><span>{t.label}</span></div>)}
      </div>
      {model.sections.map(s => <div key={s.label} className="sc-meta">{s.label}: {s.lines.join('; ')}</div>)}
    </div>
  );
}
