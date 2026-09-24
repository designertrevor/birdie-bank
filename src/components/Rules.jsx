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
  match: {
    title: 'How to play Match play',
    sub: '2–8 players · Any sides: 1 v 1, 2 v 2, 1 v 2, 1 v 3',
    sections: [
      ['Overview', <p key="o">Hole by hole: the side with the lower net score wins the hole, ties are halved. Whoever wins more holes wins the match. Total strokes never matter.</p>],
      ['Sides', <ul key="s">
        <li><strong>1 v 1</strong> — singles.</li>
        <li><strong>2 v 2</strong> — best ball (four-ball): each side counts its better net score on every hole.</li>
        <li><strong>1 v 2 or 1 v 3</strong> — one player against the best ball of the others.</li>
      </ul>],
      ['Money', <p key="m">Each player on the winning side wins the stake; each on the losing side pays it. With uneven sides the loner plays every opponent for the stake, so in 1 v 3 they win or lose three stakes.</p>],
      ['Closing it out', <p key="c">A match ends as soon as one side leads by more holes than remain — 3&2 means 3 up with 2 to play. <strong>Dormie</strong> means the leader can’t lose. The remaining holes still count for other games you might be tracking, but not for this bet.</p>],
      ['Presses', <p key="p">Turn presses on and a side that falls behind by the threshold can start a fresh bet for the same stake over the remaining holes.</p>],
    ],
  },
  vegas: {
    title: 'How to play Vegas',
    sub: '4 players · 2 v 2 · Numbers, not strokes',
    sections: [
      ['Overview', <p key="o">Partners’ net scores are put side by side to make a number: the lower score first. A 4 and a 5 make <strong>45</strong>; a 3 and a 6 make 36. A score of 10 or more goes first — a 4 and a 10 make 104.</p>],
      ['Each hole', <p key="e">The team with the lower number wins the difference in points. 45 against 56 is 11 points. Every point is worth the amount you set, paid by each player on the losing team.</p>],
      ['Birdie flip', <p key="b">With the flip on, a natural birdie (or better) flips the other team’s number so the high score goes first: 45 becomes <strong>54</strong>. If both teams birdie, nothing flips.</p>],
      ['Handicaps', <p key="h">Strokes come off the low player, so net scores make the numbers. Turn handicaps off to play gross.</p>],
    ],
  },
  sixes: {
    title: 'How to play Sixes',
    sub: '4 players · Also called Hollywood or round robin',
    sections: [
      ['Overview', <p key="o">Three two-on-two matches in one round. Partners rotate every six holes so everyone partners everyone once: holes 1–6, 7–12 and 13–18 (three holes each over nine).</p>],
      ['Pairings', <p key="p">The playing order sets the rotation: 1 & 2 v 3 & 4, then 1 & 3 v 2 & 4, then 1 & 4 v 2 & 3.</p>],
      ['Each match', <p key="m">Best ball match play: each side counts its better net score on every hole. Win more holes than the other side to win the match.</p>],
      ['Money', <ul key="$">
        <li><strong>Win the match</strong> — each winner collects the stake from their opponent; a halved match pushes.</li>
        <li><strong>Per hole up</strong> — the stake for every hole a team finishes ahead in that match.</li>
      </ul>],
    ],
  },
  scramble: {
    title: 'How to play Scramble',
    sub: '2–8 players · 2–4 teams · One ball per team',
    sections: [
      ['Overview', <p key="o">Everyone on a team tees off, the team picks the best ball, and everyone plays from there. Repeat until it’s holed. The team writes down one score.</p>],
      ['Scoring', <p key="s">Enter one score per team on each hole. Lowest net total for the round wins.</p>],
      ['Team handicaps', <p key="h">Each team plays off a blend of its members’ course handicaps, lowest first: 35% and 15% for pairs, 20/15/10% for threes, 25/20/15/10% for fours. Strokes are then given off the low team on the hardest holes.</p>],
      ['Money', <p key="m">Everyone antes. The winning team’s players split the pot; tied teams share it.</p>],
    ],
  },
  stroke: {
    title: 'How to play Stroke play',
    sub: '2–8 players · Every stroke counts',
    sections: [
      ['Overview', <p key="o">The classic: add up every hole. Lowest net total wins.</p>],
      ['Money', <ul key="m">
        <li><strong>Winner takes pot</strong> — everyone antes and the low total takes it all. Ties split the pot.</li>
        <li><strong>Per stroke</strong> — every pair of players settles the difference in their net totals.</li>
      </ul>],
      ['Handicaps', <p key="h">Strokes come off the low player on the hardest holes. Picked-up holes count as net double bogey.</p>],
    ],
  },
  stableford: {
    title: 'How to play Stableford',
    sub: '2–8 players · Points, not strokes',
    sections: [
      ['Overview', <p key="o">Each hole earns points for your net score. A blow-up hole just scores zero — you can’t be buried by one triple.</p>],
      ['Points', <ul key="p">
        <li><strong>Standard</strong> — double bogey or worse 0, bogey 1, par 2, birdie 3, eagle 4, albatross 5.</li>
        <li><strong>Modified</strong> — double bogey −3, bogey −1, par 0, birdie 2, eagle 5, albatross 8. Rewards aggression.</li>
      </ul>],
      ['Money', <p key="m">Highest points wins. Pay per point of difference between every pair, or ante up and the top total takes the pot.</p>],
    ],
  },
  quota: {
    title: 'How to play Quota',
    sub: '2–8 players · Also called Chicago',
    sections: [
      ['Overview', <p key="o">Each player gets a <strong>quota</strong>: 36 minus their course handicap (18 minus it over nine holes). A 12 handicap needs 24 points.</p>],
      ['Points', <p key="p">Gross scores earn bogey 1, par 2, birdie 4, eagle 8. Double bogey or worse earns nothing.</p>],
      ['Winning', <p key="w">The player who finishes furthest above their quota (or least below it) wins. Pay per point of difference, or play for a pot.</p>],
      ['No handicaps?', <p key="h">Turn handicaps off and everyone’s quota is 36 — a straight points race.</p>],
    ],
  },
  nines: {
    title: 'How to play Nines',
    sub: '3 players exactly · 5-3-1',
    sections: [
      ['Overview', <p key="o">Nine points on every hole. Low net score gets 5, middle gets 3, high gets 1.</p>],
      ['Ties', <ul key="t">
        <li>Two tie for low: 4-4-1.</li>
        <li>Two tie for high: 5-2-2.</li>
        <li>All three tie: 3-3-3.</li>
      </ul>],
      ['Money', <p key="m">Three points a hole is par. At the end each player settles their points above or below the average at the value you set.</p>],
    ],
  },
  aces: {
    title: 'How to play Aces & Deuces',
    sub: '3–4 players · Also called Acey Deucey',
    sections: [
      ['Overview', <p key="o">Every hole has a hero and a goat. The outright low net (the <strong>ace</strong>) wins from everyone. The outright high net (the <strong>deuce</strong>) pays everyone.</p>],
      ['Ties', <p key="t">A tie for low means no ace; a tie for high means no deuce. Both can happen on the same hole.</p>],
      ['Stakes', <p key="s">Set the ace and deuce amounts separately. Aces are usually worth more.</p>],
    ],
  },
  bbb: {
    title: 'How to play Bingo Bango Bongo',
    sub: '2–8 players · Three points a hole',
    sections: [
      ['Overview', <p key="o">Three points on every hole, and none of them depend on your score — so anyone can win.</p>],
      ['The points', <ul key="p">
        <li><strong>Bingo</strong> — first ball on the green.</li>
        <li><strong>Bango</strong> — closest to the pin once everyone is on.</li>
        <li><strong>Bongo</strong> — first ball in the hole.</li>
      </ul>],
      ['Order matters', <p key="r">Play strictly by who’s away, or the points don’t mean much. Tap each point as it happens; leave it blank if nobody earned it.</p>],
      ['Money', <p key="m">Every pair of players settles the difference in their points at the value you set.</p>],
    ],
  },
  dots: {
    title: 'How to play Dots',
    sub: '2–8 players · Junk, garbage, trash',
    sections: [
      ['Overview', <p key="o">Side bets for the little heroics. Every dot is paid to you by each of the other players.</p>],
      ['The dots', <ul key="d">
        <li><strong>Birdie</strong> — a natural birdie is a dot; an eagle is two. Counted from the scores automatically.</li>
        <li><strong>Greenie</strong> — on the green in one on a par 3.</li>
        <li><strong>Sandy</strong> — par or better after being in a bunker.</li>
        <li><strong>Barkie</strong> — par or better after hitting a tree.</li>
        <li><strong>Chip-in</strong> — holed from off the green.</li>
        <li><strong>Polie</strong> — holed a putt longer than the flagstick.</li>
        <li><strong>Arnie</strong> — a par without touching the fairway.</li>
      </ul>],
      ['Setup', <p key="s">Pick which dots are in play when you set up the round. Tap them on each player as they happen.</p>],
    ],
  },
  rabbit: {
    title: 'How to play Rabbit',
    sub: '2–8 players · Catch it, then hold on',
    sections: [
      ['Overview', <p key="o">Win a hole outright (lowest net, alone) and you catch the <strong>rabbit</strong>. Someone else wins a hole outright and they take it from you.</p>],
      ['Ties', <p key="t">By default a tied hole sets the rabbit loose — nobody has it until the next outright win. Turn that off and the holder keeps it through ties.</p>],
      ['Paying out', <p key="p">Whoever holds the rabbit after hole 9 wins the stake from everyone, and again after hole 18. Over nine holes there’s one payout. A loose rabbit at the turn pays nobody.</p>],
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
