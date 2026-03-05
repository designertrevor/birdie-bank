/**
 * Banker game logic: rotating banker each hole, 1v1 vs banker.
 * Non-banker players set their own bet (min..max). Beat banker = +bet, lose = -bet, tie = push.
 * Keys: scores[holeNumber-playerId], bets[holeNumber-playerId] (no bet for banker).
 */

/**
 * Who is banker this hole (0-based player index). Rotates from hole 1; bankerStartIndex = who is banker on hole 1.
 */
export function getBankerIndexForHole(holeNumber, numPlayers, bankerStartIndex = 0) {
  if (numPlayers < 2) return 0
  return (holeNumber - 1 + bankerStartIndex) % numPlayers
}

/**
 * Payout for one hole. Returns { [playerId]: delta } in dollars.
 * Banker's delta is negative of sum of others (zero-sum).
 * If playerDoubled[hole-playerId] or bankerDoubledBack[hole], that hole's stakes are doubled.
 */
export function computeHolePayouts(holeNumber, players, scores, bets, stakeMin = 1, opts = {}) {
  const { bankerStartIndex = 0, playerDoubled = {}, bankerDoubledBack = {} } = opts
  const numPlayers = players.length
  if (numPlayers < 2) return {}

  const bankerIdx = getBankerIndexForHole(holeNumber, numPlayers, bankerStartIndex)
  const bankerId = players[bankerIdx].id
  const deltas = {}

  const bankerScore = scores[`${holeNumber}-${bankerId}`]
  if (bankerScore == null) return {}

  const holeBankerDoubled = bankerDoubledBack[holeNumber]
  let bankerDelta = 0
  for (let i = 0; i < numPlayers; i++) {
    if (i === bankerIdx) continue
    const pid = players[i].id
    const playerScore = scores[`${holeNumber}-${pid}`]
    if (playerScore == null) return {}
    let bet = bets[`${holeNumber}-${pid}`] ?? stakeMin
    const doubled = playerDoubled[`${holeNumber}-${pid}`] || holeBankerDoubled
    if (doubled) bet *= 2
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
export function computeRunningTotals(players, scores, bets, upToHole, stakeMin = 1, opts = {}) {
  const totals = {}
  players.forEach((p) => {
    totals[p.id] = 0
  })

  for (let h = 1; h <= upToHole; h++) {
    const payouts = computeHolePayouts(h, players, scores, bets, stakeMin, opts)
    if (Object.keys(payouts).length === 0) continue
    players.forEach((p) => {
      if (payouts[p.id] != null) totals[p.id] += payouts[p.id]
    })
  }
  return totals
}
