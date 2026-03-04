/**
 * Banker game logic: rotating banker each hole, 1v1 vs banker.
 * Non-banker players set their own bet (min..max). Beat banker = +bet, lose = -bet, tie = push.
 * Keys: scores[holeNumber-playerId], bets[holeNumber-playerId] (no bet for banker).
 */

/**
 * Who is banker this hole (0-based player index). Rotates: H1 → 0, H2 → 1, …
 */
export function getBankerIndexForHole(holeNumber, numPlayers) {
  if (numPlayers < 2) return 0
  return (holeNumber - 1) % numPlayers
}

/**
 * Payout for one hole. Returns { [playerId]: delta } in dollars.
 * Banker's delta is negative of sum of others (zero-sum).
 */
export function computeHolePayouts(holeNumber, players, scores, bets, stakeMin = 1) {
  const numPlayers = players.length
  if (numPlayers < 2) return {}

  const bankerIdx = getBankerIndexForHole(holeNumber, numPlayers)
  const bankerId = players[bankerIdx].id
  const deltas = {}

  const bankerScore = scores[`${holeNumber}-${bankerId}`]
  if (bankerScore == null) return {}

  let bankerDelta = 0
  for (let i = 0; i < numPlayers; i++) {
    if (i === bankerIdx) continue
    const pid = players[i].id
    const playerScore = scores[`${holeNumber}-${pid}`]
    if (playerScore == null) return {}
    const bet = bets[`${holeNumber}-${pid}`] ?? stakeMin
    if (playerScore < bankerScore) {
      deltas[pid] = bet
      bankerDelta -= bet
    } else if (playerScore > bankerScore) {
      deltas[pid] = -bet
      bankerDelta += bet
    } else {
      deltas[pid] = 0
    }
  }
  deltas[bankerId] = bankerDelta
  return deltas
}

/**
 * Running totals for Banker from hole 1 up to and including upToHole.
 * Only includes holes where every player has a score (and non-bankers have a bet).
 */
export function computeRunningTotals(players, scores, bets, upToHole, stakeMin = 1) {
  const totals = {}
  players.forEach((p) => {
    totals[p.id] = 0
  })

  for (let h = 1; h <= upToHole; h++) {
    const payouts = computeHolePayouts(h, players, scores, bets, stakeMin)
    if (Object.keys(payouts).length === 0) continue
    players.forEach((p) => {
      if (payouts[p.id] != null) totals[p.id] += payouts[p.id]
    })
  }
  return totals
}
