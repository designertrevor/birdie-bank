import { Sheet } from './ui.jsx';

// The bets every team game shares (Best ball, Shamble, Alternate shot, Chapman): how they pay, match
// or stroke play, pressing, and what happens when someone leaves. `oneBall` for the games played with
// one ball a team, which need both partners.
function teamBets(oneBall = false) {
  return [
    ['The bets', <ul key="b">
      <li><strong>Nassau</strong> (the usual): three bets, the front 9, the back 9 and the total 18. Playing nine? The first 4, the last 5 and all 9.</li>
      <li><strong>One bet</strong>: one bet on the whole round.</li>
      <li><strong>Per hole</strong>: every hole your team wins pays the bet. A halved hole pays nothing.</li>
    </ul>],
    ['Match or stroke play', <ul key="s">
      <li><strong>Match play</strong>: the lower team score wins the hole, and the team that wins more holes wins the bet.</li>
      <li><strong>Stroke play</strong>: add up the team score on every hole. The lower total wins the bet; a tie pays nothing.</li>
    </ul>],
    ['Pressing', <p key="p">In match play a team that’s 2 down (or whatever your group set) can <strong>press</strong>: a new bet from the next hole to the end of that leg. Press at the turn and no press on the last hole work as in Nassau. Stroke play and per hole have no presses.</p>],
    ['Money', <p key="m">Each player on the winning team wins the bet from the other team, so in 2 v 2 at $5 it’s $5 each way. A bet that isn’t finished when the round stops pays whoever leads it on the holes played.</p>],
    ['Net or gross', <p key="g">With handicaps on, strokes come off the low {oneBall ? 'team' : 'player'} on the hardest holes. Turn handicaps off to play gross.</p>],
    ['If someone leaves', <p key="l">{oneBall ? 'The game needs both partners, so once one leaves, that team’s holes after don’t count and the bets stand as they are.' : 'Their partners carry on for the team. A team that can’t make enough scores for a hole doesn’t play it, and the bets stand as they are.'}</p>],
  ];
}

// Best ball and Shamble's per hole house rule (2026-10-05)
const lowTotalRule = ['Low ball and low total', <p key="lt">A house rule for per hole bets, off unless you turn it on: two points a hole. One goes to the team with the best score, the other to the lower team total, everyone’s net added up. Each point pays the bet; a tie, and nobody gets that one. A 3 and a 6 (9) win low ball against a 4 and a 4 (8), and lose low total.</p>];

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
      ['Par 3 presses triple', <p key="t">A house rule, off unless you turn it on: on a par 3 a double is a <strong>triple</strong> (3×), and the banker’s press back makes it 9×. A $5 bet tripled and pressed back is $45.</p>],
      ['Banker presses everyone', <p key="a">A house rule, off unless you turn it on: when the banker presses back, it’s on every bet on the hole, not only the ones that were pressed. Bets nobody pressed double, and pressed ones go to 4×.</p>],
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
        <li><strong>Both balls count</strong>: playing 2 v 2, partners add their two net scores on each hole instead of counting the better one. A 3 and a 6 (9) lose to two 4s (8). A side missing a partner plays best ball that hole.</li>
        <li><strong>The bye</strong>: a leg closed out with holes to play (3&2 on the front, say) makes those holes a new bet of their own, for half the leg’s bet or all of it. It gives the side that lost a way to win a little back.</li>
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
      ['House rules', <ul key="hr">
        <li><strong>Canadian skins</strong>: when the low net score is a birdie and it’s tied, a natural birdie (made without a stroke) beats a net one. Two natural birdies still tie. Net skins only.</li>
        <li><strong>Back nine doubles</strong>: per skin over 18 holes, a skin on holes 10 to 18 is worth twice the bet. A front-nine skin carried onto the back keeps its front value.</li>
        <li><strong>Validate skins</strong>: win a skin, then make net par or better on the next hole to keep it. Miss, and the skins you took go back into the carry and ride on that hole. The last hole’s skin needs no check, and neither does the last hole played in a round ended early.</li>
        <li><strong>Birdies win two skins</strong>: win a hole with a real birdie (no stroke needed) and its skin counts as two, worth twice the bet. Skins carried into it keep their value. In a pot it’s two shares.</li>
      </ul>],
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
        <li>Or go <strong>blind wolf</strong>: call lone before anyone tees off, your own shot included, for more still. It’s a house rule, off unless you turn it on.</li>
      </ul>],
      ['Scoring', <ul key="s">
        <li>Each side counts its best net score. Low side wins the hole; ties push.</li>
        <li>2 v 2: each loser pays each winner one point.</li>
        <li>Lone wolf: the points are multiplied (2× by default), paid by or to each of the three.</li>
        <li>Blind wolf: always more than a lone wolf, one or two more (lone 2× makes blind 3× or 4×), paid by or to each of the three. At $2 a point and blind 3×, a blind wolf who wins is up $18, and one who loses is down $18.</li>
      </ul>],
      ['House rules', <ul key="hr">
        <li><strong>Ties carry</strong> (off unless you turn it on): a tied hole’s points ride on to the next hole that’s won. Two ties in a row and the next hole pays 3×. Ties still carried after the last hole go to nobody.</li>
        <li><strong>Last place is wolf on 17 and 18</strong> (off unless you turn it on): whoever is furthest down in the wolf money after 16 is the wolf on the last two holes, to give them a way back. A tie for last keeps the usual turn if it’s one of them.</li>
        <li><strong>Birdies double</strong> (off unless you turn it on): a hole won with a real birdie on the winning side pays double. A lone wolf who birdies to win at $2 a point and 2× is up $24, not $12.</li>
      </ul>],
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
      ['Both balls count', <p key="b">A house rule for 2 v 2, off unless you turn it on: partners add their two net scores on each hole instead of counting the better one. A side missing a partner plays best ball that hole.</p>],
      ['The bye', <p key="y">A house rule, off unless you pick it: when the match is closed out early, the holes left are a new bet of their own, for half the match bet or all of it. Win 5&4 and the last four holes are the bye.</p>],
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
        <li><strong>Birdie hammer</strong>: win a hole with a real birdie or better and that’s one more hammer, so it pays double. A hole that was folded doesn’t count.</li>
        <li><strong>Halved holes carry</strong>: a halved hole’s value, hammers and all, rides on the next hole. Halve a $5 hole that was hammered once ($10) and the next hole starts at $15, so one hammer there makes it $30. Win or fold, the hole after is back to the bet.</li>
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
      ['Daytona', <p key="y">A house rule, off unless you turn it on: a team with no real par or better on the hole puts its high number first. A 5 and a 6 make <strong>65</strong>, not 56, so a bogey hole costs more.</p>],
      ['No double digits', <p key="9">A house rule, off unless you turn it on: no score counts for more than 9, so a 4 and an 11 make <strong>49</strong>, not 114. It keeps one blow-up hole from deciding the day.</p>],
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
      ['House rules', <ul key="hr">
        <li><strong>Halved matches carry</strong> (per match, off unless you turn it on): a match that ends all square adds its bet to the next one, so that match is worth double. Halve the last match and nobody gets it.</li>
        <li><strong>Both balls count</strong> (off unless you turn it on): partners add their two net scores on each hole instead of counting the better one.</li>
        <li><strong>Auto press at 2 down</strong> (per match, off unless you turn it on): a pair that falls 2 down in a match starts a new bet for the match’s amount over the holes left in it, and a press that falls 2 behind is pressed again. Come back to halve the match and the press still pays you.</li>
      </ul>],
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
      ['Second gets its money back', <p key="2">A house rule, off unless you turn it on: with three or more teams, the team alone in second takes back what it put in, and the winners split the rest. A tie for first or for second, and it’s winner takes all.</p>],
      ['Minimum drives', <p key="d">A house rule, off unless you pick it: every player’s drive has to be used at least 2, 3 or 4 times. Tap whose drive the team took on each hole and the app keeps count, and warns you when the rest have to be someone’s.</p>],
    ],
  },
  bestball: {
    title: 'How to play Best ball',
    sub: '4–8 players · 2 v 2 up to 4 v 4 · Also called four-ball',
    sections: [
      ['Overview', <p key="o">Two teams, everyone plays their own ball, and the team takes its <strong>best score</strong> on each hole. Teams of three or four can count the <strong>best two</strong> scores instead, added up.</p>],
      ['Teams', <p key="t">Two teams the same size: 2 v 2, 3 v 3 or 4 v 4. Enter every player’s score; the app picks the ones that count and tags them.</p>],
      ...teamBets(),
      lowTotalRule,
      ['Handicaps', <p key="h">The WHS allowance for best ball is 90% of each player’s handicap as a match and 85% as stroke play. With teams of three or four it’s 75% counting the best one and 85% counting the best two. Setup suggests the right one.</p>],
    ],
  },
  shamble: {
    title: 'How to play Shamble',
    sub: '4–8 players · 2 v 2 up to 4 v 4 · Best drive, then your own ball',
    sections: [
      ['Overview', <p key="o">Everyone tees off and the team picks the <strong>best drive</strong>. Everyone moves their ball to it and plays their own ball into the hole from there. The team’s best score counts (or the best two, with teams of three or four).</p>],
      ['Scoring', <p key="s">Enter every player’s score, as in best ball. The app picks the ones that count.</p>],
      ['Minimum drives', <p key="d">A house rule, off unless you pick it: every player’s drive has to be used at least 2, 3 or 4 times. Tap whose drive the team took on each hole and the app keeps count.</p>],
      ...teamBets(),
      lowTotalRule,
      ['Handicaps', <p key="h">The USGA’s guidance for a selected drive is 75% of each player’s handicap for teams of two and 65% for teams of four (70% for threes, in between). Setup suggests it.</p>],
    ],
  },
  altshot: {
    title: 'How to play Alternate shot',
    sub: '4 players · 2 v 2 · One ball a team · Also called foursomes',
    sections: [
      ['Overview', <p key="o">Partners play <strong>one ball</strong> and take turns hitting it until it’s holed. One partner tees off on the odd holes and the other on the even holes.</p>],
      ['Scoring', <p key="s">Enter one score per team on each hole.</p>],
      ['Team handicaps', <p key="h">Each team plays off half of its two players’ course handicaps added up, the WHS allowance for foursomes. Strokes then come off the low team on the hardest holes.</p>],
      ...teamBets(true),
    ],
  },
  chapman: {
    title: 'How to play Chapman',
    sub: '4 players · 2 v 2 · One ball a team · Also called Pinehurst',
    sections: [
      ['Overview', <p key="o">Both partners tee off, then each plays the <strong>other’s ball</strong> for the second shot. The team picks the better of the two and takes turns from there until it’s holed.</p>],
      ['Scoring', <p key="s">Enter one score per team on each hole.</p>],
      ['Team handicaps', <p key="h">Each team plays off 60% of the lower course handicap plus 40% of the higher, the WHS allowance for Chapman. Strokes then come off the low team on the hardest holes.</p>],
      ...teamBets(true),
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
      ['House rules', <ul key="hr">
        <li><strong>Net double bogey max</strong>: no hole counts for more than a net double bogey, the same cap your handicap uses. Take a 9 on a par 4 and it counts as a 6 (or a 7 if you get a stroke there).</li>
        <li><strong>Front, back and total</strong>: played for a pot over 18 holes, the front nine, the back nine and the 18 are a pot each, each at the amount you set. Low net on each nine takes that nine’s pot, and low net for the round takes the third. A nine still being played pays on the holes so far.</li>
        <li><strong>Low gross too</strong>: played for a pot, a second pot at the same amount goes to the lowest score before strokes, the way clubs pay low gross and low net. Ties split it.</li>
      </ul>],
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
        <li><strong>Big birdies</strong>: double bogey 0, bogey 1, par 2, birdie 4, eagle 8, albatross 16, the Chicago points. A birdie is worth two pars.</li>
      </ul>],
      ['Money', <p key="m">Highest points wins. By default each player puts in and the top total takes the pot. Or pay per point: every pair settles the difference, so each point wins the bet from every other player.</p>],
      ['House rules', <ul key="hr">
        <li><strong>Front, back and total</strong>: played for a pot over 18 holes, the front nine, the back nine and the 18 are a pot each, each at the amount you set. Most points on each nine takes that nine’s pot, and most for the round takes the third. A nine still being played pays on the holes so far.</li>
      </ul>],
    ],
  },
  quota: {
    title: 'How to play Quota',
    sub: '2–8 players · Also called Chicago',
    sections: [
      ['Overview', <p key="o">Each player gets a <strong>quota</strong>: 36 minus their course handicap (18 minus it over nine holes). A 12 handicap needs 24 points.</p>],
      ['Points', <ul key="p">
        <li><strong>Chicago</strong> (the usual): gross scores earn bogey 1, par 2, birdie 4, eagle 8. Double bogey or worse earns nothing.</li>
        <li><strong>Stableford</strong>: bogey 1, par 2, birdie 3, eagle 4, albatross 5. Gentler on a hot round.</li>
      </ul>],
      ['Winning', <p key="w">The player who finishes furthest above their quota (or least below it) wins. By default that takes the pot; or pay per point of difference between every pair.</p>],
      ['Short round', <p key="s">Stop early and each quota shrinks to the holes played: a quota of 30 is 15 after nine holes.</p>],
      ['No handicaps?', <p key="h">Turn handicaps off and everyone’s quota is 36, a straight points race.</p>],
      ['House rules', <ul key="hr">
        <li><strong>Double bogey costs a point</strong>: double bogey or worse is −1 instead of 0, so a blow-up hole hurts.</li>
        <li><strong>Front, back and total</strong>: played for a pot over 18 holes, the front nine, the back nine and the 18 are a pot each, each at the amount you set. Each nine is measured against half your quota, so a quota of 24 needs 12 on the front and 12 on the back, and the 18 against all of it. A nine still being played pays on the holes so far.</li>
        <li><strong>Everyone over quota shares</strong>: in a pot, everyone who beats their quota shares it by how far over they are. At +4 and +2, a $15 pot is $10 and $5. Nobody over, and the best finish takes it as usual.</li>
        <li><strong>Team quota</strong>: in a pot with four or more players, partners add up their points and their quotas. The team furthest over takes the pot and splits it; tied teams share it. Ann +2 and Bo level beat Cy +2 and Di −1. Pick the teams when you set up the round.</li>
        <li><strong>Quota moves after the round</strong>: the way leagues keep quotas honest. <strong>1 point</strong>: beat your quota and it goes up 1 next time, miss it and it comes down 1. <strong>Half</strong>: it moves half of what you beat it or missed it by, so +6 makes it 3 higher. The next Quota round with the rule on starts you there, and the results show everyone’s number for next time.</li>
      </ul>],
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
      ['Birdie wins 7', <p key="b">A house rule, off unless you turn it on: win a hole outright with a real birdie and it’s 7-1-1 instead of 5-3-1. Win by two as well, with that rule on, and it’s still 9-0-0.</p>],
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
      ['Bingo is the longest drive', <p key="d">A house rule, off unless you turn it on: the first point goes to the longest drive in the fairway instead of first on the green, so the long hitters have one to play for too.</p>],
      ['Bongo is low net', <p key="n">A house rule, off unless you turn it on: the third point goes to the outright lowest net score on the hole instead of first in, so handicaps count. A tie for low, and nobody gets it.</p>],
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
      ['Greenies carry', <p key="g">A house rule, off unless you turn it on: a par 3 where nobody gets the greenie adds one to the next par 3’s, so it’s worth two dots, then three. Still carried after the last par 3, nobody gets it.</p>],
      ['Penalty dots', <p key="x">A house rule, off unless you pick them: a <strong>three-putt</strong>, a ball in the <strong>water</strong> or one <strong>out of bounds</strong> costs you a dot, paid to each of the other players. Pick which ones count; tap them like any other dot.</p>],
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
      ['Three rabbits', <p key="3">A house rule over 18 holes, off unless you turn it on: a rabbit every six holes instead of each nine, paid after holes 6, 12 and 18. More chances for more winners.</p>],
      ['Back nine doubles', <p key="b">A house rule over 18 holes, off unless you turn it on: the rabbit held after 18 is worth twice the bet, so there’s more to play for on the back.</p>],
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
  ctp: {
    title: 'How to play Closest to the pin',
    sub: '2–8 players · A side game · A pot for the par 3s',
    sections: [
      ['Overview', <p key="o">Everyone puts the same amount in the pot before the round. The pot is shared out across the par 3s, and whoever hits it closest to the pin on each one takes that hole’s share.</p>],
      ['Who wins', <ul key="w">
        <li>Your tee shot has to finish <strong>on the green</strong> to count.</li>
        <li>On each par 3 the scorekeeper taps who was closest, or <strong>Nobody</strong> if nobody hit the green.</li>
      </ul>],
      ['Paying out', <p key="p">Four players at $5 make a $20 pot. With 4 par 3s each one is worth $5. Ann wins two and Bo wins two, so they each take $10 and are up $5, and the other two are down $5.</p>],
      ['Nobody on the green', <ul key="n">
        <li><strong>Carries</strong> (the usual way): the share rolls to the next par 3, so that one is worth two. Still carried after the last par 3, it goes back to everyone.</li>
        <li><strong>Split</strong>: the shares nobody won are split across the par 3s that were won.</li>
        <li>If nobody wins a par 3 all round, nobody pays.</li>
      </ul>],
      ['Stopping early', <p key="s">Only the par 3s played count. Stop after 9 and the pot is the front nine’s share. Added partway through? Go back to the par 3s already played and tap who was closest, and they count too.</p>],
      ['Joining late', <p key="j">The pot is for the players who started. Anyone added partway, or who leaves early, sits it out.</p>],
      ['With Junk', <p key="k">The pot pays for being closest, so Junk’s greenies are off while it’s on. Sandies, chip-ins and the rest still count in Junk.</p>],
    ],
  },
  drive: {
    title: 'How to play Long drive',
    sub: '2–8 players · A side game · A pot for the longest drives',
    sections: [
      ['Overview', <p key="o">Everyone puts the same amount in the pot before the round. Pick the long drive holes (every par 5 unless you choose), and the pot is shared out across them. The longest drive on each one takes that hole’s share.</p>],
      ['Who wins', <ul key="w">
        <li>Your drive has to finish <strong>in the fairway</strong> to count.</li>
        <li>On each long drive hole the scorekeeper taps who was longest, or <strong>Nobody</strong> if nobody found the fairway.</li>
      </ul>],
      ['Paying out', <p key="p">Four players at $5 make a $20 pot. With 2 long drive holes each one is worth $10. Ann wins both, so she takes $20 and is up $15, and the other three are down $5.</p>],
      ['Nobody in the fairway', <ul key="n">
        <li><strong>Carries</strong> (the usual way): the share rolls to the next long drive hole. Still carried after the last one, it goes back to everyone.</li>
        <li><strong>Split</strong>: the shares nobody won are split across the holes that were won.</li>
        <li>If nobody wins a long drive hole all round, nobody pays.</li>
      </ul>],
      ['Stopping early', <p key="s">Only the long drive holes played count. Added partway through? Go back to the long drive holes already played and tap who was longest, and they count too.</p>],
      ['Joining late', <p key="j">The pot is for the players who started. Anyone added partway, or who leaves early, sits it out.</p>],
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
      ['Four-putts count twice', <p key="f">A house rule for a snake that grows or doubles, off unless you turn it on: a four-putt takes the snake and counts as two three-putts. Tap the player, then tap 4-putt.</p>],
      ['Split the snake', <p key="p">A house rule, off unless you turn it on: whoever holds the snake at the end pays its value once, and everyone else shares it, like a pot. A $6 snake in a foursome costs the holder $6, and the other three get $2 each.</p>],
    ],
  },
};

/**
 * The rules sheet for `game`. `title` and `sub` replace the game's own, as for Junk as a side game.
 * `strokes` are this round's strokes lines (see strokesRulesLines), shown last under "Strokes this round".
 */
export function RulesSheet({ game, open, onClose, title, sub, strokes = [] }) {
  const r = RULES[game];
  if (!r) return null;
  return (
    <Sheet open={open} onClose={onClose} title={title || r.title} className="rules-sheet">
      <div className="rules-content">
        <div className="rules-sub">{sub || r.sub}</div>
        {r.sections.map(([h, body]) => (
          <div key={h}><div className="rules-section">{h}</div><div className="rules-body">{body}</div></div>
        ))}
        {strokes.length > 0 && (
          <div><div className="rules-section">Strokes this round</div><div className="rules-body">{strokes.map(l => <p key={l} className="strokes-line">{l}</p>)}</div></div>
        )}
      </div>
      <div style={{ padding: '0 16px' }}><button className="full-btn" onClick={onClose}>Got it</button></div>
    </Sheet>
  );
}
