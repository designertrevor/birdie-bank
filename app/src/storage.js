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
      courseName: state.courseName,
      totalHoles: state.totalHoles,
      playerDoubled: state.playerDoubled,
      bankerDoubledBack: state.bankerDoubledBack,
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

/** Crews: saved player groups */
const CREWS_KEY = 'birdie-bank-crews'

/**
 * @typedef {{ id: string, name: string, players: Array<{ name: string, hcp: number }>, updatedAt: number }} Crew
 * @returns {Crew[]}
 */
export function getCrews() {
  try {
    const raw = window.localStorage.getItem(CREWS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (e) {
    console.warn('birdie-bank: could not load crews', e)
    return []
  }
}

/**
 * @param {Crew} crew
 */
export function saveCrew(crew) {
  try {
    const crews = getCrews()
    const existing = crews.findIndex((c) => c.id === crew.id)
    const updated = { ...crew, updatedAt: Date.now() }
    const next = existing >= 0
      ? crews.map((c, i) => (i === existing ? updated : c))
      : [...crews, updated]
    window.localStorage.setItem(CREWS_KEY, JSON.stringify(next))
  } catch (e) {
    console.warn('birdie-bank: could not save crew', e)
  }
}

/**
 * @param {string} name
 * @param {Array<{ name: string, hcp: number }>} players
 * @returns {Crew}
 */
export function addCrew(name, players) {
  const crew = {
    id: String(Date.now()),
    name: name.trim() || 'Unnamed crew',
    players: players.map((p) => ({ name: p.name || '', hcp: p.hcp ?? 18 })),
    updatedAt: Date.now(),
  }
  saveCrew(crew)
  return crew
}

/**
 * @param {string} id
 */
export function deleteCrew(id) {
  try {
    const crews = getCrews().filter((c) => c.id !== id)
    window.localStorage.setItem(CREWS_KEY, JSON.stringify(crews))
  } catch (e) {
    console.warn('birdie-bank: could not delete crew', e)
  }
}

/** Unique past players from all crews (name + last seen hcp). Dedupe by lowercased name. */
export function getPastPlayers() {
  const crews = getCrews()
  const byName = new Map()
  for (const crew of crews) {
    for (const p of crew.players || []) {
      const n = (p.name || '').trim()
      if (!n) continue
      const key = n.toLowerCase()
      if (!byName.has(key)) byName.set(key, { name: n, hcp: p.hcp ?? 18 })
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}
