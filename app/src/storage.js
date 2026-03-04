/**
 * Round state persistence to localStorage.
 * Key and shape are centralized so we can swap to a backend later without changing callers.
 */

const STORAGE_KEY = 'birdie-bank-round'

/**
 * Shape of persisted round (subset of full context state we care to restore).
 * @typedef {{
 *   currentScreen: string,
 *   selectedGames: string[],
 *   players: Array<{ id: number, name: string, hcp: number }>,
 *   nextPlayerId: number,
 *   stakeVals: Record<string, number>,
 *   scores: Record<string, number>,
 *   bets: Record<string, number>,
 *   currentHole: number,
 *   wolfPartnerThisHole: string | number | null
 * }} StoredRound
 */

/**
 * @param {StoredRound} state
 */
export function saveRound(state) {
  try {
    const payload = {
      currentScreen: state.currentScreen,
      selectedGames: state.selectedGames,
      players: state.players,
      nextPlayerId: state.nextPlayerId,
      stakeVals: state.stakeVals,
      scores: state.scores,
      bets: state.bets,
      currentHole: state.currentHole,
      wolfPartnerThisHole: state.wolfPartnerThisHole,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.warn('birdie-bank: could not save round', e)
  }
}

/**
 * @returns {Partial<StoredRound> | null}
 */
export function loadRound() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (e) {
    console.warn('birdie-bank: could not load round', e)
    return null
  }
}

export function clearRound() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.warn('birdie-bank: could not clear round', e)
  }
}
