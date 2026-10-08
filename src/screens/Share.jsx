// Share a card into the group text: the recap of a round, a trip's standings, or the cup. Each is
// a story-sized image in the results image's style (share-cards-image.js) with the same Show
// amounts switch and buttons (ShareSheet.jsx), the words from share-cards.js.
// Opened with nav.push('share', { kind: 'recap' | 'trip' | 'cup', id }), or { kind: 'wrapped', year } for
// your year in review (wrapped.js), drawn by wrapped-image.js, or { kind: 'profile' } for your own
// profile card (profile-card.js), a square drawn by profile-card-image.js. Only ever yours: it takes no id.
// { kind: 'rivalry', id } is you against one friend (rivalry-card.js), a square drawn by rivalry-card-image.js.
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
import { rivalryCard, rivalryCardModel } from '../lib/rivalry-card.js';
import { renderRivalryCard } from '../lib/rivalry-card-image.js';
import { photoAllowed } from '../lib/avatars.js';
import { supabaseUrl } from '../lib/supabase.js';

const card = model => ({ model, alt: model.alt, text: cardText(model) });

/**
 * A buddy as a picture the canvas can draw: the avatar's SVG, drawn once on the page (hidden) and
 * read as a data link. Returns [src, grab]: put `grab` on the hidden span that holds the BuddyArt,
 * keyed on the buddy and backdrop so a new buddy reads again. A photo needs none of this.
 */
function useBuddySrc() {
  const [src, setSrc] = useState(null);
  const grab = useCallback(node => {
    const svg = node?.querySelector('svg');
    if (svg && typeof XMLSerializer !== 'undefined') setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`);
  }, []);
  return [src, grab];
}

/** What the canvas draws for an avatar model: an allowed photo, the buddy read from the page, or nothing (initials). */
const drawableSrc = (a, buddySrc) => (a.kind === 'photo' && photoAllowed(a.url, supabaseUrl) ? a.url : a.kind === 'buddy' ? buddySrc : null);

export default function ShareScreen({ kind, id, year }) {
  const nav = useNav();
  const state = useStore();
  const gone = (title, text) => (
    <Screen><Header title="Share" small onBack={nav.pop} /><div className="scroll"><Empty title={title} text={text} /></div></Screen>
  );

  if (kind === 'profile') return <ProfileShare state={state} onBack={nav.pop} />;
  if (kind === 'rivalry') return <RivalryShare state={state} id={id} onBack={nav.pop} gone={gone} />;

  if (kind === 'wrapped') return <WrappedShare state={state} year={year} onBack={nav.pop} gone={gone} />;
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
 * Your year in review. Your buddy (or an allowed photo) goes in the image's corner: a buddy is drawn
 * here once, hidden, and handed to the canvas as a picture, as on the profile card.
 */
function WrappedShare({ state, year, onBack, gone }) {
  const card = profileCard(state);
  const a = card.avatar;
  const [buddySrc, grab] = useBuddySrc();
  const y = yearInReview(state, year || new Date().getFullYear());
  if (!y.rounds) return gone(`No rounds in ${y.year} yet`, 'Finish a round and your year in review starts here.');
  const link = appLink();
  const avatarSrc = drawableSrc(a, buddySrc);
  // Only your own money is on it: Show amounts (off until you turn it on) is all that puts it there
  return (
    <Screen>
      <ShareView title="Your year in review" small onBack={onBack} what="Year in review" link={link}
        make={show => { const m = { ...wrappedCardModel(state, y, { showAmounts: show, link }), avatarSrc }; return { model: m, alt: m.alt, text: m.text }; }}
        render={renderWrapped} fileName={slugName('year-in-review', String(y.year))}
        money={!!y.money} people={[]} standIn={m => <WrappedStandIn model={m} />}
        onText="Your net and best day are on the image" offText="Rounds, courses, your low round and the moment of the year, no money" />
      {a.kind === 'buddy' && <span key={`${a.buddy}-${a.bg}`} ref={grab} hidden><BuddyArt id={a.buddy} bg={a.bg} /></span>}
    </Screen>
  );
}

/**
 * Your profile card. Your photo goes on the image when it's one the app may fetch; a buddy is drawn
 * here once, hidden, and handed to the canvas as a picture; initials need nothing.
 */
function ProfileShare({ state, onBack }) {
  const card = profileCard(state);
  const a = card.avatar;
  const [buddySrc, grab] = useBuddySrc();
  const avatarSrc = drawableSrc(a, buddySrc);
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

/**
 * You against one friend, from the face-to-face header on their screen. Both avatars go on the
 * image: a photo when it's one the app may fetch, a buddy drawn here once, hidden, and handed to
 * the canvas; initials need nothing. Their money follows the Tab's rule: with their profile Only
 * you, the switch holds the amounts off (amountsRule) and the model keeps them off too.
 */
function RivalryShare({ state, id, onBack, gone }) {
  const card = rivalryCard(state, id);
  const [youSrc, grabYou] = useBuddySrc();
  const [themSrc, grabThem] = useBuddySrc();
  if (!card.rounds) return gone('No rounds together yet', `Finish a round with ${card.them.name.split(' ')[0] || 'them'} and the rivalry starts here.`);
  const link = appLink();
  const you = card.you.avatar, them = card.them.avatar;
  return (
    <Screen>
      <ShareView title="Share the rivalry" small onBack={onBack} what="Rivalry" link={link} square
        make={show => { const m = rivalryCardModel(card, { showAmounts: show, link, youSrc: drawableSrc(you, youSrc), themSrc: drawableSrc(them, themSrc) }); return { model: m, alt: m.alt, text: m.text }; }}
        render={renderRivalryCard} fileName={slugName('rivalry', `${card.you.name.split(' ')[0] || 'you'} v ${card.them.name}`)}
        money={card.moneyRounds > 0} people={[{ id, name: card.them.name }]} standIn={m => <WrappedStandIn model={m} square />}
        onText="The money between you is on the image" offText="The record, the streak and your last round together, no money" />
      {you.kind === 'buddy' && <span key={`you-${you.buddy}-${you.bg}`} ref={grabYou} hidden><BuddyArt id={you.buddy} bg={you.bg} /></span>}
      {them.kind === 'buddy' && <span key={`them-${them.buddy}-${them.bg}`} ref={grabThem} hidden><BuddyArt id={them.buddy} bg={them.bg} /></span>}
    </Screen>
  );
}

/** The year in review (or a square card) while its image is being drawn: the same words, as tiles. */
function WrappedStandIn({ model, square = !model.headline }) {
  return (
    <div className={`share-card${square ? ' square' : ''}`}>
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
