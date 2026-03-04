/**
 * Minimum-transactions settlement: given net position per player (positive = owed money),
 * returns a list of transfers that settle up with fewest payments.
 * Greedy: repeatedly pair largest debtor with largest creditor and transfer min of the two.
 */

/**
 * @param {Array<{ id: number, name: string }>} players
 * @param {Record<number, number>} netByPlayerId - net position in dollars (positive = winner)
 * @returns {Array<{ fromId: number, toId: number, amount: number }>}
 */
export function computeMinTransfers(players, netByPlayerId) {
  const ids = players.map((p) => p.id)
  const balances = {}
  ids.forEach((id) => {
    balances[id] = netByPlayerId[id] ?? 0
  })

  const transfers = []
  while (true) {
    let maxCreditor = null
    let maxDebtor = null
    let maxCredit = -Infinity
    let maxDebt = Infinity
    ids.forEach((id) => {
      const b = balances[id]
      if (b > maxCredit) {
        maxCredit = b
        maxCreditor = id
      }
      if (b < maxDebt) {
        maxDebt = b
        maxDebtor = id
      }
    })
    if (maxCreditor == null || maxDebtor == null || maxCredit <= 0 || maxDebt >= 0) break
    const amount = Math.min(maxCredit, Math.abs(maxDebt))
    if (amount <= 0) break
    transfers.push({ fromId: maxDebtor, toId: maxCreditor, amount })
    balances[maxCreditor] -= amount
    balances[maxDebtor] += amount
  }
  return transfers
}
