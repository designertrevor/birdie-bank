// Share a card into the group text: the recap of a round, a trip's standings, or the cup. Each is
// a story-sized image in the results image's style (share-cards-image.js) with the same Show
// amounts switch and buttons (ShareSheet.jsx), the words from share-cards.js.
// Opened with nav.push('share', { kind: 'recap' | 'trip' | 'cup', id }).
import { Empty, Header, Screen } from '../components/ui.jsx';
import { ShareView } from '../components/ShareSheet.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { nameOf } from '../lib/ledger.js';
import { countsMoney } from '../lib/play-for.js';
import { tripStatus } from '../lib/trips.js';
import { appLink, roundLink, slugName } from '../lib/share.js';
import { cardText, cupCardModel, recapCardModel, tripCardModel } from '../lib/share-cards.js';
import { renderCard } from '../lib/share-cards-image.js';

const card = model => ({ model, alt: model.alt, text: cardText(model) });

export default function ShareScreen({ kind, id }) {
  const nav = useNav();
  const state = useStore();
  const gone = (title, text) => (
    <Screen><Header title="Share" small onBack={nav.pop} /><div className="scroll"><Empty title={title} text={text} /></div></Screen>
  );

  if (kind === 'recap') {
    const round = state.rounds?.[id];
    if (!round || round.status !== 'done') return gone('This round is gone', 'It was taken off this phone.');
    const link = roundLink(round);
    return (
      <Screen>
        <ShareView title="Share the recap" small onBack={nav.pop} what="Recap" link={link}
          make={show => card(recapCardModel(state, round, { showAmounts: show, link }))} render={renderCard}
          fileName={slugName('recap', round.course?.name, round.finishedAt || round.createdAt)}
          money={countsMoney(round)} people={round.players}
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
          fileName={slugName('cup', st.trip.name)} money={st.cup.def.stake > 0}
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
