/**
 * Round state persistence to localStorage.
 * Key and shape are centralized so we can swap to a backend later without changing callers.
 */

const STORAGE_KEY = 'birdie-bank-round'

/** Rounds history */
const ROUNDS_KEY = 'birdie-bank-rounds'

/** Players directory (for Settings + Play step 2) */
const PLAYERS_KEY = 'birdie-bank-players'
const PLAYERS_NEXT_ID_KEY = 'birdie-bank-players-next-id'

/** Favorite courses (for Play step 1 + Settings) */
const COURSES_KEY = 'birdie-bank-courses'
const COURSES_NEXT_ID_KEY = 'birdie-bank-courses-next-id'

/** Default stakes (prefill Play step 3 + Settings) */
const DEFAULT_STAKES_KEY = 'birdie-bank-default-stakes'

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

/**
 * @typedef {{ id: string, createdAt: number, courseName: string, totalHoles: number, players: Array<{ name: string, hcp: number }>, selectedGames: string[], stakeVals: Record<string, number>, bankerTotals: Record<string, number>, settleTotals: Record<string, number> }} StoredFinishedRound
 */

/**
 * @returns {StoredFinishedRound[]}
 */
export function getRounds() {
  try {
    const raw = window.localStorage.getItem(ROUNDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (e) {
    console.warn('birdie-bank: could not load rounds', e)
    return []
  }
}

/**
 * @param {StoredFinishedRound} round
 */
export function saveFinishedRound(round) {
  try {
    const rounds = getRounds()
    const next = [round, ...rounds].slice(0, 100)
    window.localStorage.setItem(ROUNDS_KEY, JSON.stringify(next))
  } catch (e) {
    console.warn('birdie-bank: could not save finished round', e)
  }
}

/**
 * @param {string} id
 * @returns {StoredFinishedRound | null}
 */
export function getRoundById(id) {
  const rounds = getRounds()
  return rounds.find((r) => r.id === id) ?? null
}

/**
 * @typedef {{ id: number, name: string, hcp: number }} PlayerProfile
 * @returns {PlayerProfile[]}
 */
export function getPlayers() {
  try {
    const raw = window.localStorage.getItem(PLAYERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (e) {
    console.warn('birdie-bank: could not load players', e)
    return []
  }
}

/**
 * @param {PlayerProfile[]} players
 */
export function setPlayers(players) {
  try {
    window.localStorage.setItem(PLAYERS_KEY, JSON.stringify(players))
  } catch (e) {
    console.warn('birdie-bank: could not save players', e)
  }
}

/**
 * @param {string} name
 * @param {number} hcp
 * @returns {PlayerProfile}
 */
export function addPlayerProfile(name, hcp) {
  const idRaw = window.localStorage.getItem(PLAYERS_NEXT_ID_KEY)
  const nextId = Math.max(1, parseInt(idRaw || '1', 10) || 1)
  const prof = { id: nextId, name: (name || '').trim(), hcp: Number.isFinite(hcp) ? hcp : 18 }
  const next = [...getPlayers(), prof]
  setPlayers(next)
  window.localStorage.setItem(PLAYERS_NEXT_ID_KEY, String(nextId + 1))
  return prof
}

/**
 * @param {number} id
 * @param {{ name?: string, hcp?: number }} patch
 */
export function updatePlayerProfile(id, patch) {
  const next = getPlayers().map((p) =>
    p.id === id
      ? {
          ...p,
          ...(patch.name != null ? { name: String(patch.name).trim() } : null),
          ...(patch.hcp != null ? { hcp: parseInt(String(patch.hcp), 10) || 0 } : null),
        }
      : p
  )
  setPlayers(next)
}

/**
 * @param {number} id
 */
export function deletePlayerProfile(id) {
  setPlayers(getPlayers().filter((p) => p.id !== id))
}

/**
 * @typedef {{ id: number, name: string, starred: boolean, updatedAt: number }} Course
 * @returns {Course[]}
 */
export function getCourses() {
  try {
    const raw = window.localStorage.getItem(COURSES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (e) {
    console.warn('birdie-bank: could not load courses', e)
    return []
  }
}

/**
 * @param {Course[]} courses
 */
export function setCourses(courses) {
  try {
    window.localStorage.setItem(COURSES_KEY, JSON.stringify(courses))
  } catch (e) {
    console.warn('birdie-bank: could not save courses', e)
  }
}

/**
 * @param {string} name
 * @param {boolean} starred
 * @returns {Course}
 */
export function addCourse(name, starred = true) {
  const idRaw = window.localStorage.getItem(COURSES_NEXT_ID_KEY)
  const nextId = Math.max(1, parseInt(idRaw || '1', 10) || 1)
  const c = { id: nextId, name: (name || '').trim(), starred: !!starred, updatedAt: Date.now() }
  setCourses([...getCourses(), c])
  window.localStorage.setItem(COURSES_NEXT_ID_KEY, String(nextId + 1))
  return c
}

/**
 * @param {number} id
 * @param {{ name?: string, starred?: boolean }} patch
 */
export function updateCourse(id, patch) {
  const next = getCourses().map((c) =>
    c.id === id
      ? {
          ...c,
          ...(patch.name != null ? { name: String(patch.name).trim() } : null),
          ...(patch.starred != null ? { starred: !!patch.starred } : null),
          updatedAt: Date.now(),
        }
      : c
  )
  setCourses(next)
}

/**
 * @param {number} id
 */
export function deleteCourse(id) {
  setCourses(getCourses().filter((c) => c.id !== id))
}

/**
 * @returns {Record<string, number> | null}
 */
export function getDefaultStakes() {
  try {
    const raw = window.localStorage.getItem(DEFAULT_STAKES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (e) {
    console.warn('birdie-bank: could not load default stakes', e)
    return null
  }
}

/**
 * @param {Record<string, number>} stakeVals
 */
export function setDefaultStakes(stakeVals) {
  try {
    window.localStorage.setItem(DEFAULT_STAKES_KEY, JSON.stringify(stakeVals))
  } catch (e) {
    console.warn('birdie-bank: could not save default stakes', e)
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
