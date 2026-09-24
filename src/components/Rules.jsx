import { Sheet } from './ui.jsx';

const RULES = {
  banker: {
    title: 'How to play Banker',
    sub: '3–8 players · A banker takes on everyone each hole',
    sections: [
      ['Overview', <p key="o">Each hole one player is the <strong>banker</strong>. Everyone else has their own bet against the banker — it’s a series of one-on-one matches, not a race for low score.</p>],
      ['Each hole', <ol key="e">
        <li>The banker is set by the rotation you chose (or picked each hole).</li>
        <li>Every other player sets a bet within the round’s min and max.</li>
        <li>Any player can <strong>double</strong> their bet (2×).</li>
        <li>If anyone doubles, the banker may <strong>double back</strong> — every doubled bet becomes 4×.</li>
        <li>Enter gross scores. Handicap strokes are applied automatically.</li>
      </ol>],
      ['Who wins', <ul key="w">
        <li>Lower net score than the banker: you win your bet from the banker.</li>
        <li>Higher net score: you pay the banker your bet.</li>
        <li>Tie: a push by default. You can set ties to go to the banker instead.</li>
      </ul>],
      ['Picking up', <p key="p">Tap <strong>Picked up</strong> if a player doesn’t finish. They’re scored as a net double bogey.</p>],
      ['Rotation', <ul key="r">
        <li><strong>Every hole</strong> — banker moves to the next player each hole.</li>
        <li><strong>Every 9</strong> — one banker per nine, in player order.</li>
        <li><strong>Fixed</strong> — the same banker all round.</li>
        <li><strong>Choose each hole</strong> — the group picks; defaults to last hole’s banker.</li>
      </ul>],
    ],
  },
  nassau: {
    title: 'How to play Nassau',
    sub: '2 players · Three bets in one round',
    sections: [
      ['Overview', <p key="o">Nassau is three separate match-play bets: the <strong>front 9</strong>, the <strong>back 9</strong> and the <strong>total 18</strong>. Playing nine? The bets are the <strong>first 4</strong>, the <strong>last 5</strong> and <strong>all 9</strong>.</p>],
      ['Match play', <p key="m">Each hole goes to the lower net score, or is halved on a tie. A leg is won by whoever wins more holes in it — not by total strokes.</p>],
      ['Pressing', <ul key="p">
        <li>When you’re down on a leg by the press threshold (2 holes by default) you can <strong>press</strong>.</li>
        <li>A press is a new bet, for the same amount as that leg, from the next hole to the end of the leg.</li>
        <li>The original bet keeps going — presses add on top. A press that falls behind can be pressed again.</li>
        <li><strong>Auto</strong> press mode calls presses for you as soon as a player is eligible.</li>
      </ul>],
      ['Handicaps', <p key="h">The lower handicap plays off scratch; the other player gets the difference in strokes on the hardest holes.</p>],
      ['Ties', <p key="t">A leg that ends all square pays nothing.</p>],
    ],
  },
  skins: {
    title: 'How to play Skins',
    sub: '2–8 players · Every hole is worth a skin',
    sections: [
      ['Overview', <p key="o">Each hole is worth one skin. The player with the <strong>lowest net score, alone</strong>, wins it.</p>],
      ['Carryovers', <p key="c">If two or more players tie for low, nobody wins the skin. With carryovers on, it rolls onto the next hole — so the next skin can be worth 2, 3 or more.</p>],
      ['Paying out', <p key="p">Every other player pays the skin value to the winner for each skin won. Skins still carried over after the last hole go unclaimed.</p>],
    ],
  },
  wolf: {
    title: 'How to play Wolf',
    sub: '4 players exactly · Rotating wolf',
    sections: [
      ['Overview', <p key="o">The <strong>wolf</strong> rotates every hole in playing order. The wolf decides whether to take a partner or go it alone.</p>],
      ['Picking', <ul key="p">
        <li>Watch the tee shots, then pick one partner: it’s 2 v 2.</li>
        <li>Or go <strong>lone wolf</strong>: 1 v 3 for a bigger payout.</li>
      </ul>],
      ['Scoring', <ul key="s">
        <li>Each side counts its best net score. Low side wins the hole; ties push.</li>
        <li>2 v 2: each loser pays each winner one point.</li>
        <li>Lone wolf: the points are multiplied (2× by default), paid by or to each of the three.</li>
      </ul>],
    ],
  },
};

export function RulesSheet({ game, open, onClose }) {
  const r = RULES[game];
  if (!r) return null;
  return (
    <Sheet open={open} onClose={onClose} title={r.title} className="rules-sheet">
      <div className="rules-content">
        <div className="rules-sub">{r.sub}</div>
        {r.sections.map(([h, body]) => (
          <div key={h}><div className="rules-section">{h}</div><div className="rules-body">{body}</div></div>
        ))}
      </div>
      <div style={{ padding: '0 16px' }}><button className="full-btn" onClick={onClose}>Got it</button></div>
    </Sheet>
  );
}
