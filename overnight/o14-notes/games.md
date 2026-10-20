# Overnight 14: new games (roadmap area 5)

Branch `o14/games`. Field skins already shipped with the Big Game, so this run built the other two:
the **Calcutta** (a side game, this run's one money feature) and **Rolling quota**.

## What was built

### Calcutta (side game)
- A new side game, `calcutta`, that rides beside any main game except the one-ball games (Scramble,
  Alternate shot, Chapman: those take no side games at all, see question 1).
- Before the first tee every player goes up for auction, or every team in a team game (two or more
  teams with someone on a team of two or more: Best ball, Shamble, Vegas, 2 v 2 Nassau, Match play
  sides, Hammer sides, Team quota).
- **Auction sheet** (`src/components/AuctionSheet.jsx`, lazy loaded): one lot at a time, the winning
  bid as chips ($5, 10, 20, 25, 50, 100) or "Other" for the keypad (whole dollars, 1 to 999), the buyer
  as chips (a player can buy themselves, shown "(self)"), a buy-back switch when that house rule is on,
  Back / Next, and a list of every lot to jump around. A half-filled lot says "No buyer yet".
- **Pays on the main game's finish**: Stroke play by fewest net strokes, Stableford by most points,
  Quota by furthest over quota, every other game by money won in it. A team adds its players up.
- **Splits**: 70/30 with 4 or more sold, all to first with fewer. House rule "60/30/10" with 5 or more
  sold (fewer plays 70/30). Ties share the places they cover (two tied for first split 1st + 2nd).
- **Buy-backs** (house rule): a player someone else bought can buy back half for half the price, and
  takes half of what their lot wins. On a team lot the half is split between the team's players.
- Unsold lots are out of the pot. Nothing is paid until the first hole is in. A player added mid-round
  was never auctioned, so they're no lot and not in the pot. Someone who leaves stays in: bids stand.
- Rules page (`/rules/calcutta`, also found by "auction"), first-tee card rules, reveal line ("Dave
  owned Ann, who won"), the round's breakdown (place, lot, who paid what, prize), game art (a gavel on
  a ball), and a pre-tee hint on the scoring screen when fewer than two lots are sold.
- A rematch, a usual or a plan copies the Calcutta's house rules but never its bids: the sales live on
  the side game entry (`round.sideGames[i].auction.sales`), not in its settings.

### Rolling quota
- Decision: it **is** the existing "Quota moves after the round" rule (it already carried each
  player's quota round to round, per person across linked ids, saved on the new round). What was
  missing, now built:
  - The name: the setting is labelled **Rolling quota** (Off / 1 point / Half), the bet line says
    "rolling quota", the rules page and first-tee card say Rolling quota.
  - A **cap** for Half: "Most it moves in one round" 2 / 3 / No limit, 3 by default. Rounds saved
    before it have no cap, so their next quotas don't change.
  - Setup now says **"Your quota is 38, up 2 from last time."** and "The others: Dave 39 (up 3) · Sam
    34 (down 2)." (was "Quotas from last time: Ann 26 · Bo 31").
  - Pick it by name: `/?play=rolling-quota` opens setup on Quota with the rule on (Half), and
    `/rules/rolling-quota` finds the Quota page.

## How to see it

- Calcutta in setup: `/?play=calcutta` (adds it as a side game), or New round, any game, Bets step,
  "Add a side game", Calcutta. Then the Calcutta card: "Run the auction" (or the gavel button).
- Mid-round: round menu, Side games, the Calcutta card (fix a bid). Before the first hole is scored,
  the scoring screen shows "The Calcutta's auction is before the first tee. Run the auction".
- Results: the round page's Details tab, "Calcutta · $85 pot", and the by-game table.
- Rolling quota: `/?play=rolling-quota`, or Quota's Bets step, "Rolling quota". The "Your quota is..."
  line shows at setup once a finished Quota round with the rule on is on the phone.
- Checked in the browser at phone width, light and dark: auction sheet, setup card, round breakdown,
  rematch (bids dropped), and the rolling quota line.

## Where the money flows (for review)

All money is integer cents inside `calcuttaMoney` and comes out as whole-cent dollars.

1. `src/lib/calcutta.js` `calcuttaMoney()`: pot = sum of valid bids. Each buyer is charged their bids
   (`paidIn`; with a buy-back, half from the owner and half from the player). Prizes by place
   (`calcuttaSplits`), remainder cents to first; tied groups share the prizes of the places they cover,
   spare cents to the first auctioned. Each prize goes to the owner (or half and half with a
   buy-back, spare cent to the owner). `deltas = paidOut - paidIn`, exactly zero in cents.
2. `src/lib/round.js` `calcuttaTable()` builds the inputs: lots (`calcuttaEntriesOf`, never a player
   who joined partway), finishes (`calcuttaScores` on the main game's view), buyers (the Calcutta
   view's players), `started` (a hole in).
3. `src/lib/round.js` `gameResults()`, branch `if (round.game === 'calcutta')`: `addSpread(t.deltas)`
   adds the deltas to balances and spreads the pair debts (each loser pays each winner in proportion,
   like every other pot), `detail.calcutta = t`.
4. `src/lib/round.js` `roundResults()`: the Calcutta is one of `gameKeys(round)`, so its balances
   and pairs are summed with the main game's into the round's `balances`, `pairs` and
   `transfers` (`minimalTransfers`), and it gets its own line `byGame.calcutta` ("Calcutta").
   From there the settle-up, the Tab and the pair debts read it like any other game.
5. `gameView(full, 'calcutta')` carries `calcutta: { sales, main }`; the sales never enter
   `settings`, so `changeBets` and the Bets sheet can't touch them (the Bets sheet has no Calcutta tab).

Tests: `src/lib/calcutta.test.js` (19): splits, sale validation, zero-sum over 3 to 8 players with
random bids, finishes, ties and both house rules (4,800 cases), ties at first and second, odd-cent
ties, buying yourself, buy-back on and off, team lots and team buy-back, a player added mid-round,
someone leaving, side game choices, no bids moves nothing, bet lines, rule links. Plus
`src/lib/rolling-quota.test.js` (5). The existing random zero-sum sweeps now also draw the Calcutta
(with no bids). `npm test`: 2,427 pass. First screen JS 415.13 kB of 481 kB.

## Risks

- **Finish by money in money games**: in Nassau, Skins, Wolf and the like the Calcutta ranks by
  money won in the main game. That's what the group sees, but a pot game where most players lose the
  same amount ties them for second (Skins as a pot, a Banker round where three lose the same).
  Totals games use the totals, so Stroke, Stableford and Quota rank properly.
- **Live money**: like an unfinished Nassau bet, the Calcutta pays on the standings so far, so the
  money bar swings by big amounts mid-round as the lead changes. Nothing moves before the first hole.
- **Teams changed mid-round** (lineup): team lots are keyed `t0`, `t1`, so a changed lineup keeps the
  sale on the team slot, now with different players.
- **Wording changes on live rounds**: the Quota bet line and first-tee card now say "rolling quota",
  so a Quota round with the rule on, locked in and still being played when this ships, records one
  "changed" note on its first-tee card.
- Calcutta with points or a reward: bids read in points; it works but is odd. Not hidden.
- No moments for the Calcutta: the moments system is code, not data, so I left it out (kept tiny).

## Questions for Trevor

1. **Calcutta on a Scramble** (the classic Calcutta format, teams auctioned) needs side games on
   one-ball games, which are off for all side games today.
   - A. Leave it off for now
   - B. Allow only the Calcutta on Scramble, Alternate shot and Chapman (teams as lots) **(suggested)**
   - C. Make the Calcutta part of a Big Game across groups instead
2. **Top-three split**: when does 60/30/10 kick in?
   - A. 5 or more sold, 70/30 below that (built) **(suggested)**
   - B. 4 or more sold
   - C. Any size the group picks, with a typed split
3. **Rolling quota's cap** for Half (how far one round can move a quota):
   - A. 3 (built) **(suggested)**
   - B. 2
   - C. No limit by default, cap optional
4. **How money games rank the Calcutta**:
   - A. Money won in the main game (built) **(suggested)**
   - B. Net strokes for every game, whatever the main game pays on
   - C. Let the organizer pick "money" or "net score" per round
