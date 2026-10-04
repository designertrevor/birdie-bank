// Everything from the last 30 days that Up next shows the first few of.
import { Empty, Header, Screen } from '../components/ui.jsx';
import { LatelyList } from '../components/LatelyList.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { LATELY_DAYS, latelyItems } from '../lib/lately.js';
import { recentTalkKeys, withTalk } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';

export default function Lately() {
  const nav = useNav();
  const state = useStore();
  useTalkSync(recentTalkKeys(state));
  const items = withTalk(latelyItems(state, Date.now(), { withLast: true }), state);
  return (
    <Screen>
      <Header title="Lately" onBack={nav.pop} />
      <div className="scroll">
        {items.length
          ? <>
              <p className="field-help pad" style={{ marginTop: 0 }}>The last {LATELY_DAYS} days with your group. Amounts show only when they’re yours.</p>
              <LatelyList items={items} />
            </>
          : <Empty title="Quiet lately" text="Settle-ups, challenges, answers for upcoming rounds, round recaps and trash talk show up here." />}
      </div>
    </Screen>
  );
}
