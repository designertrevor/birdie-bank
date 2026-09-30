import { Sheet } from './ui.jsx';

const RULES = {
  banker: {
    title: 'How to play Banker',
    sub: '3–8 players · A banker takes on everyone each hole',
    sections: [
      ['Overview', <p key="o">Each hole one player is the <strong>banker</strong>. Everyone else has their own bet against the banker. It’s a series of one-on-one matches, not a race for low score.</p>],
      ['Each hole', <ol key="e">
        <li>The banker is set by the rotation you chose: each hole in order, the lowest score on the last hole (a tie stays with the banker), each nine, one fixed banker, or picked each hole.</li>
        <li>Every other player sets a bet within the round’s min and max.</li>
        <li>Any player can <strong>double</strong> their bet (2×).</li>
        <li>If anyone doubles, the banker may <strong>double back</strong>, and every doubled bet becomes 4×.</li>
        <li>Enter gross scores. Handicap strokes are applied automatically.</li>
      </ol>],
      ['Who wins', <ul key="w">
        <li>Lower net score than the banker: you win your bet from the banker.</li>
        <li>Higher net score: you pay the banker your bet.</li>
        <li>Tie: a push by default. You can set ties to go to the banker instead.</li>
        <li>Birdies double (if your group turns it on): win with a birdie and that bet doubles, win with an eagle and it doubles again. Choose a real birdie or a net birdie after strokes.</li>
      </ul>],
      ['Picking up', <p key="p">Tap <strong>Picked up</strong> if a player doesn’t finish. They’re scored as a double bogey after strokes.</p>],
      ['Rotation', <ul key="r">
        <li><strong>Each hole</strong>: banker moves to the next player each hole.</li>
        <li><strong>Each 9</strong>: one banker per nine, in player order.</li>
        <li><strong>Fixed</strong>: the same banker all round.</li>
        <li><strong>Pick</strong>: the group picks each hole; defaults to last hole’s banker.</li>
      </ul>],
    ],
  },
  nassau: {
    title: 'How to play Nassau',
    sub: '2–4 players · Three bets in one round',
    sections: [
      ['Overview', <p key="o">Nassau is three separate match-play bets: the <strong>front 9</strong>, the <strong>back 9</strong> and the <strong>total 18</strong>. Playing nine? The bets are the <strong>first 4</strong>, the <strong>last 5</strong> and <strong>all 9</strong>.</p>],
      ['Match play', <p key="m">Each hole goes to the lower net score, or is halved on a tie. A leg is won by whoever wins more holes in it, not by total strokes.</p>],
      ['Pressing', <ul key="p">
        <li>When you’re 2 down on a bet (or whatever your group set), you can <strong>press</strong>.</li>
        <li>A press is a new bet, for the same amount as that leg, from the next hole to the end of the leg.</li>
        <li>The original bet keeps going. Presses add on top. A press that falls behind can be pressed again.</li>
        <li><strong>Auto</strong> press mode calls presses for you as soon as a player is eligible.</li>
      </ul>],
      ['Handicaps', <p key="h">The lower handicap plays off scratch; the other player gets the difference in strokes on the hardest holes.</p>],
      ['Ties', <p key="t">A leg that ends all square pays nothing.</p>],
      ['House rules', <ul key="hr">
        <li><strong>Press at the turn</strong>: whoever lost the front nine can press the back nine at the turn, however far down. It’s a new bet on the back for the back’s amount.</li>
        <li><strong>No press on the last hole</strong>: nobody can start a press on the 9th or the 18th. A one-hole bet is a coin flip.</li>
      </ul>],
    ],
  },
  skins: {
    title: 'How to play Skins',
    sub: '2–8 players · Every hole is worth a skin',
    sections: [
      ['Overview', <p key="o">Each hole is worth one skin. The player with the <strong>lowest net score, alone</strong>, wins it.</p>],
      ['Carryovers', <p key="c">If two or more players tie for low, nobody wins the skin. With carryovers on, it rolls onto the next hole, so the next skin can be worth 2, 3 or more.</p>],
      ['Paying out', <p key="p">Every other player pays the skin value to the winner for each skin won. Or play for a <strong>pot</strong>: everyone puts in the same amount and the pot is split by skins won.</p>],
      ['Net and gross', <p key="g">Play net skins, gross skins, or both at once: a net skin and a gross skin on every hole, each with its own carryovers.</p>],
      ['After the last hole', <p key="l">Skins still carried after the last hole go unclaimed by default. Or the players tied on the last hole <strong>split</strong> them, or play them off on a <strong>playoff</strong> hole.</p>],
      ['Joining late', <p key="j">A carry stays with the players who built it. Someone added partway plays for every skin from the hole they join, but not for skins already carrying when they got there: they don’t pay into those and can’t win them. If they win a hole outright, they take that hole’s skin and the older carry keeps rolling among the players who built it. In a pot game they sit the pot out.</p>],
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
        <li>Or go <strong>blind wolf</strong>: call lone before anyone tees off, your own shot included, for more still. It’s a house rule you can turn off.</li>
      </ul>],
      ['Scoring', <ul key="s">
        <li>Each side counts its best net score. Low side wins the hole; ties push.</li>
        <li>2 v 2: each loser pays each winner one point.</li>
        <li>Lone wolf: the points are multiplied (2× by default), paid by or to each of the three.</li>
        <li>Blind wolf: 3× by default (or 4×), paid by or to each of the three. At $2 a point a blind wolf who wins is up $18, and one who loses is down $18.</li>
      </ul>],
      ['House rules', <p key="hr"><strong>Ties carry</strong> (off unless you turn it on): a tied hole’s points ride on to the next hole that’s won. Two ties in a row and the next hole pays 3×. Ties still carried after the last hole go to nobody.</p>],
    ],
  },
  match: {
    title: 'How to play Match play',
    sub: '2–8 players · Any sides: 1 v 1, 2 v 2, 1 v 2, 1 v 3',
    sections: [
      ['Overview', <p key="o">Hole by hole: the side with the lower net score wins the hole, ties are halved. Whoever wins more holes wins the match. Total strokes never matter.</p>],
      ['Sides', <ul key="s">
        <li><strong>1 v 1</strong>: singles.</li>
        <li><strong>2 v 2</strong>: best ball (four-ball): each side counts its better net score on every hole.</li>
        <li><strong>1 v 2 or 1 v 3</strong>: one player against the best ball of the others.</li>
      </ul>],
      ['Money', <p key="m">Each player on the winning side wins the bet; each on the losing side pays it. With uneven sides the loner plays every opponent for the bet, so in 1 v 3 they win or lose three bets.</p>],
      ['Closing it out', <p key="c">A match ends as soon as one side leads by more holes than remain: 3&2 means 3 up with 2 to play. <strong>Dormie</strong> means the leader can’t lose. The remaining holes don’t count for this bet.</p>],
      ['Presses', <p key="p">Turn presses on and a side that falls behind by the set number of holes can start a fresh bet for the same amount over the remaining holes.</p>],
    ],
  },
  hammer: {
    title: 'How to play Hammer',
    sub: '2–4 players · 1 v 1 or 2 v 2 · Double or fold',
    sections: [
      ['Overview', <p key="o">Every hole is its own bet, won by the lower net score (the better ball with partners). Ties push.</p>],
      ['The hammer', <ul key="h">
        <li>At any point on a hole, a side can <strong>hammer</strong>: the hole is now worth double.</li>
        <li>The other side either <strong>plays on</strong> at double, or <strong>folds</strong> and pays what the hole was worth before the hammer.</li>
        <li>Nobody hammers twice in a row. Once you’re hammered, the hammer is yours to throw back.</li>
      </ul>],
      ['House rules', <ul key="r">
        <li><strong>Most hammers on a hole</strong>: 1, 2, 3 or no limit. Three hammers make a $5 hole worth $40.</li>
        <li><strong>Who throws first</strong>: either side, or only the side behind on the day (either side when it’s level).</li>
      </ul>],
      ['Money', <p key="m">Each player on the winning side wins the hole’s value; each on the losing side pays it.</p>],
    ],
  },
  vegas: {
    title: 'How to play Vegas',
    sub: '4 players · 2 v 2 · Numbers, not strokes',
    sections: [
      ['Overview', <p key="o">Partners’ net scores are put side by side to make a number: the lower score first. A 4 and a 5 make <strong>45</strong>; a 3 and a 6 make 36. A score of 10 or more goes first, so a 4 and a 10 make 104.</p>],
      ['Each hole', <p key="e">The team with the lower number wins the difference in points. 45 against 56 is 11 points. Every point is worth the amount you set, paid by each player on the losing team.</p>],
      ['Birdie flip', <p key="b">With the flip on, a natural birdie (or better) flips the other team’s number so the high score goes first: 45 becomes <strong>54</strong>. If both teams birdie, nothing flips.</p>],
      ['Birdies double', <p key="d">A house rule, off unless you turn it on: when one team alone makes a real birdie, the hole’s points double. A lone eagle triples them. With the flip that’s a big swing: 34 against a flipped 54 is 40 points.</p>],
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
        <li><strong>Per match</strong>: each player on the winning pair gets the bet from one player on the losing pair; a halved match pushes. A match cut short pays whoever is ahead on the holes played.</li>
        <li><strong>Per hole</strong>: the bet for every hole a team finishes ahead in that match.</li>
      </ul>],
      ['House rules', <p key="hr"><strong>Halved matches carry</strong> (per match, off unless you turn it on): a match that ends all square adds its bet to the next one, so that match is worth double. Halve the last match and nobody gets it.</p>],
    ],
  },
  scramble: {
    title: 'How to play Scramble',
    sub: '2–8 players · 2–4 teams · One ball per team',
    sections: [
      ['Overview', <p key="o">Everyone on a team tees off, the team picks the best ball, and everyone plays from there. Repeat until it’s holed. The team writes down one score.</p>],
      ['Scoring', <p key="s">Enter one score per team on each hole. Lowest net total for the round wins.</p>],
      ['Team handicaps', <p key="h">Each team plays off a blend of its members’ course handicaps, lowest first, using the WHS allowances: 35% and 15% for pairs, 30/20/10% for threes, 25/20/15/10% for fours. Strokes are then given off the low team on the hardest holes.</p>],
      ['Money', <p key="m">Everyone puts the same amount in the pot. The winning team’s players split it; tied teams share it.</p>],
      ['Minimum drives', <p key="d">A house rule, off unless you pick it: every player’s drive has to be used at least 2, 3 or 4 times. Tap whose drive the team took on each hole and the app keeps count, and warns you when the rest have to be someone’s.</p>],
    ],
  },
  stroke: {
    title: 'How to play Stroke play',
    sub: '2–8 players · Every stroke counts',
    sections: [
      ['Overview', <p key="o">The classic: add up every hole. Lowest net total wins.</p>],
      ['Money', <ul key="m">
        <li><strong>Winner takes the pot</strong>: everyone puts in and the low net total takes it all. Ties split it.</li>
        <li><strong>Per stroke</strong>: every pair of players settles the difference in their net totals, so each stroke wins the bet from every player you beat by it.</li>
      </ul>],
      ['Handicaps', <p key="h">Strokes come off the low player on the hardest holes. Picked-up holes count as a double bogey after strokes.</p>],
      ['Net double bogey max', <p key="c">A house rule, off unless you turn it on: no hole counts for more than a net double bogey, the same cap your handicap uses. Take a 9 on a par 4 and it counts as a 6 (or a 7 if you get a stroke there).</p>],
    ],
  },
  stableford: {
    title: 'How to play Stableford',
    sub: '2–8 players · Points, not strokes',
    sections: [
      ['Overview', <p key="o">Each hole earns points for your net score. A blow-up hole just scores zero, so you can’t be buried by one triple.</p>],
      ['Points', <ul key="p">
        <li><strong>Standard</strong>: double bogey or worse 0, bogey 1, par 2, birdie 3, eagle 4, albatross 5.</li>
        <li><strong>Modified</strong>: double bogey −3, bogey −1, par 0, birdie 2, eagle 5, albatross 8. Rewards aggression.</li>
      </ul>],
      ['Money', <p key="m">Highest points wins. By default each player puts in and the top total takes the pot. Or pay per point: every pair settles the difference, so each point wins the bet from every other player.</p>],
    ],
  },
  quota: {
    title: 'How to play Quota',
    sub: '2–8 players · Also called Chicago',
    sections: [
      ['Overview', <p key="o">Each player gets a <strong>quota</strong>: 36 minus their course handicap (18 minus it over nine holes). A 12 handicap needs 24 points.</p>],
      ['Points', <p key="p">Gross scores earn bogey 1, par 2, birdie 4, eagle 8. Double bogey or worse earns nothing.</p>],
      ['Winning', <p key="w">The player who finishes furthest above their quota (or least below it) wins. By default that takes the pot; or pay per point of difference between every pair.</p>],
      ['Short round', <p key="s">Stop early and each quota shrinks to the holes played: a quota of 30 is 15 after nine holes.</p>],
      ['No handicaps?', <p key="h">Turn handicaps off and everyone’s quota is 36, a straight points race.</p>],
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
      ['Win by 2 takes all 9', <p key="s">A house rule, off unless you turn it on: beat both of the others by two strokes or more and you take all nine points, 9-0-0.</p>],
      ['Money', <p key="m">Three points a hole is par, so 54 over 18 holes (27 over nine). Every point above or below that is worth the bet: finish on 60 at $1 a point and you’re up $6.</p>],
    ],
  },
  aces: {
    title: 'How to play Aces & Deuces',
    sub: '3–4 players · Also called Acey Deucey',
    sections: [
      ['Overview', <p key="o">Every hole has a hero and a goat. The outright low net (the <strong>ace</strong>) wins from everyone. The outright high net (the <strong>deuce</strong>) pays everyone.</p>],
      ['Ties', <p key="t">A tie for low means no ace; a tie for high means no deuce. Both can happen on the same hole.</p>],
      ['Ties carry', <p key="c">A house rule, off unless you turn it on: a tie for low adds that hole’s ace to the next outright low, and a tie for high adds its deuce to the next outright high. Still carried after the last hole, nobody gets it.</p>],
      ['Bets', <p key="s">Set the ace and deuce amounts separately. Aces are usually worth more.</p>],
    ],
  },
  bbb: {
    title: 'How to play Bingo Bango Bongo',
    sub: '2–8 players · Three points a hole',
    sections: [
      ['Overview', <p key="o">Three points on every hole, and none of them depend on your score, so anyone can win.</p>],
      ['The points', <ul key="p">
        <li><strong>Bingo</strong>: first ball on the green.</li>
        <li><strong>Bango</strong>: closest to the pin once everyone is on.</li>
        <li><strong>Bongo</strong>: first ball in the hole.</li>
      </ul>],
      ['Order matters', <p key="r">Play strictly by who’s away, or the points don’t mean much. Tap each point as it happens; leave it blank if nobody earned it.</p>],
      ['Money', <p key="m">Every pair of players settles the difference in their points at the value you set.</p>],
      ['Sweep doubles', <p key="s">A house rule, off unless you turn it on: take all three points on one hole and they count six.</p>],
    ],
  },
  dots: {
    title: 'How to play Dots',
    sub: '2–8 players · Junk, garbage, trash',
    sections: [
      ['Overview', <p key="o">Side bets for the little heroics. Every dot is paid to you by each of the other players.</p>],
      ['The dots', <ul key="d">
        <li><strong>Birdie</strong>: a natural birdie is a dot and an eagle is two. With <strong>Birdies count automatically</strong> on, they come straight from the scores.</li>
        <li><strong>Greenie</strong>: closest to the pin in one on a par 3, and par or better to keep it. One a hole.</li>
        <li><strong>Sandy</strong>: par or better after being in a bunker.</li>
        <li><strong>Barkie</strong>: par or better after hitting a tree.</li>
        <li><strong>Chip-in</strong>: holed from off the green.</li>
        <li><strong>Polie</strong>: holed a putt longer than the flagstick.</li>
        <li><strong>Arnie</strong>: par or better without ever being on the fairway, after Arnold Palmer. Par 4s and 5s.</li>
        <li><strong>Hogan</strong>: par or better after hitting the fairway and the green in regulation, after Ben Hogan. Par 4s and 5s.</li>
      </ul>],
      ['Setup', <p key="s">Pick which dots are in play when you set up the round (Arnie and Hogan start off). Tap them on each player as they happen.</p>],
    ],
  },
  rabbit: {
    title: 'How to play Rabbit',
    sub: '2–8 players · Catch it, then hold on',
    sections: [
      ['Overview', <p key="o">Win a hole outright (lowest net, alone) and you catch the <strong>rabbit</strong>. When someone else wins a hole outright they <strong>set it free</strong>, and the next outright winner catches it. You can’t steal it straight from the holder.</p>],
      ['Ties', <p key="t">A tied hole changes nothing: the holder keeps it, and a loose rabbit stays loose.</p>],
      ['House rules', <p key="h">Prefer the old way? Switch to <strong>Steal it</strong> so any outright winner takes it straight away, and turn on <strong>Ties set it loose</strong>.</p>],
      ['Paying out', <p key="p">Whoever holds the rabbit after hole 9 wins the bet from everyone, and again after hole 18. Over nine holes there’s one payout. A loose rabbit at the turn pays nobody. Stop early and whoever holds it then is paid.</p>],
    ],
  },
  birdies: {
    title: 'How to play the Birdie pot',
    sub: '2–8 players · A side game · Birdies split the pot',
    sections: [
      ['Overview', <p key="o">Everyone puts the same amount in the pot before the round. At the end, the pot is split among the players who made birdies.</p>],
      ['Shares', <ul key="s">
        <li>Every <strong>net birdie</strong> is one share of the pot.</li>
        <li>A <strong>net eagle</strong> or better is two shares, unless your group changes it.</li>
        <li>The pot is split by shares, so two birdies take twice as much as one.</li>
      </ul>],
      ['Paying out', <p key="p">The pot is split by shares. Four players at $5 make a $20 pot. Ann makes 2 birdies and Bo makes an eagle, so that’s 4 shares at $5 each: Ann and Bo each take $10 and are up $5, and the other two are down $5.</p>],
      ['No birdies', <p key="n">If nobody makes a birdie, everyone gets their money back and nobody pays.</p>],
      ['Scoring', <p key="c">Nothing to tap: birdies are counted from the scores after handicap strokes. A player who picks up on a hole can’t birdie it.</p>],
      ['Joining late', <p key="j">The pot is for the players who started. Anyone added partway, or who leaves early, sits it out.</p>],
      ['With Junk', <p key="k">When Junk counts birdies automatically, it counts <strong>natural</strong> birdies, before strokes, and the pot counts net birdies. So a natural birdie pays twice: a dot from each player and a share of the pot. A birdie that only comes from a stroke counts in the pot alone.</p>],
    ],
  },
  snake: {
    title: 'How to play Snake',
    sub: '2–8 players · Don’t three-putt',
    sections: [
      ['Overview', <p key="o">Three-putt and you take the <strong>snake</strong>. The next player to three-putt takes it off you. Whoever holds it at the end pays each other player.</p>],
      ['Same hole', <p key="s">Two three-putts on one hole? The last one to do it takes the snake. Tap them in the order they happened.</p>],
      ['The snake', <ul key="v">
        <li><strong>Same all round</strong>: the snake is worth the amount you set.</li>
        <li><strong>Grows</strong>: every three-putt adds the amount, so five three-putts make it five times as much.</li>
        <li><strong>Doubles</strong>: every three-putt doubles it, up to a cap. The cap is 4 doubles unless you change it, so a $5 snake goes $5, $10, $20, $40, $80 and then stays at $80. Three-putts after that still pass it on. Pick <strong>No cap</strong> to let it keep doubling.</li>
      </ul>],
      ['Each nine', <p key="n">Turn it on to settle the snake at the turn and start a fresh one on the back. Stop early and whoever holds it then pays.</p>],
    ],
  },
};

/** The rules sheet for `game`. `title` and `sub` replace the game's own, as for Junk as a side game. */
export function RulesSheet({ game, open, onClose, title, sub }) {
  const r = RULES[game];
  if (!r) return null;
  return (
    <Sheet open={open} onClose={onClose} title={title || r.title} className="rules-sheet">
      <div className="rules-content">
        <div className="rules-sub">{sub || r.sub}</div>
        {r.sections.map(([h, body]) => (
          <div key={h}><div className="rules-section">{h}</div><div className="rules-body">{body}</div></div>
        ))}
      </div>
      <div style={{ padding: '0 16px' }}><button className="full-btn" onClick={onClose}>Got it</button></div>
    </Sheet>
  );
}
