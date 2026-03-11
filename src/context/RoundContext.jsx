/* eslint-disable react-refresh/only-export-components -- useRound is the public API for RoundContext */
import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react'
import { computeRunningTotals as bankerRunningTotals } from '../logic/banker'
import { STAKE_STEPS, GAME_KEYS, DEFAULT_PLAYERS, DEFAULT_STAKES } from '../constants'
import { loadRound, saveRound, clearRound, getDefaultStakes, getPlayers, setPlayers } from '../storage'

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

const RoundContext = createContext(null)

function hasInProgressRound(state) {
  if (!state) return false
  if (state.currentScreen === 'hole') return true
  if (typeof state.currentHole === 'number' && state.currentHole > 1) return true
  const scoresCount = state.scores && typeof state.scores === 'object' ? Object.keys(state.scores).length : 0
  return scoresCount > 0
}

function roundReducer(state, action) {
  switch (action.type) {
    case 'GO':
      return { ...state, currentScreen: action.screen }
    case 'START_ADD_CREW':
      return {
        ...state,
        currentScreen: 'addCrew',
        players: [],
        nextPlayerId: 1,
      }
    case 'SET_SELECTED_CREW':
      return { ...state, selectedCrewId: action.crewId }
    case 'SET_VIEWING_ROUND':
      return { ...state, viewingRoundId: action.roundId }
    case 'SET_NAV_RETURN_TO':
      return { ...state, navReturnTo: action.screen }
    case 'SET_EDIT_PLAYER':
      return { ...state, editPlayerId: action.id }
    case 'SET_EDIT_COURSE':
      return { ...state, editCourseId: action.id }
    case 'TOGGLE_GAME': {
      const set = new Set(state.selectedGames)
      if (set.has(action.game)) set.delete(action.game)
      else set.add(action.game)
      return { ...state, selectedGames: Array.from(set) }
    }
    case 'ADD_PLAYER':
      return {
        ...state,
        players: [...state.players, { id: state.nextPlayerId, name: '', hcp: 18 }],
        nextPlayerId: state.nextPlayerId + 1,
      }
    case 'ADD_PLAYER_WITH_PROFILE':
      return {
        ...state,
        players: [
          ...state.players,
          {
            id: state.nextPlayerId,
            name: action.name ?? '',
            hcp: action.hcp ?? 18,
          },
        ],
        nextPlayerId: state.nextPlayerId + 1,
      }
    case 'REMOVE_PLAYER':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
      }
    case 'SET_PLAYER_NAME':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p
        ),
      }
    case 'SET_PLAYER_HCP':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.id ? { ...p, hcp: action.hcp } : p
        ),
      }
    case 'SET_STAKE':
      return {
        ...state,
        stakeVals: { ...state.stakeVals, [action.game]: action.value },
      }
    case 'SET_SCORE': {
      const key = `${state.currentHole}-${action.playerId}`
      return {
        ...state,
        scores: { ...state.scores, [key]: action.score },
      }
    }
    case 'SET_BET': {
      const key = `${state.currentHole}-${action.playerId}`
      return {
        ...state,
        bets: { ...state.bets, [key]: action.bet },
      }
    }
    case 'SET_CURRENT_HOLE':
      return { ...state, currentHole: action.hole }
    case 'SET_BANKER_START_INDEX':
      return { ...state, bankerStartIndex: action.index }
    case 'TOGGLE_PLAYER_DOUBLED': {
      const key = `${state.currentHole}-${action.playerId}`
      const next = { ...state.playerDoubled, [key]: !state.playerDoubled[key] }
      return { ...state, playerDoubled: next }
    }
    case 'TOGGLE_BANKER_DOUBLED_BACK': {
      const h = state.currentHole
      const next = { ...state.bankerDoubledBack, [h]: !state.bankerDoubledBack[h] }
      return { ...state, bankerDoubledBack: next }
    }
    case 'SET_WOLF_PARTNER':
      return { ...state, wolfPartnerThisHole: action.partner }
    case 'SET_COURSE': {
      const totalHoles = action.totalHoles ?? state.totalHoles
      const courseName = action.courseName ?? state.courseName
      const currentHole = totalHoles === 9 && state.currentHole > 9 ? 9 : state.currentHole
      return { ...state, courseName, totalHoles, currentHole }
    }
    case 'LOAD_CREW': {
      const players = (action.players || []).map((p, i) => ({
        id: state.nextPlayerId + i,
        name: p.name ?? '',
        hcp: p.hcp ?? 18,
      }))
      return {
        ...state,
        players: players.length ? players : state.players,
        nextPlayerId: state.nextPlayerId + (players.length || 0),
      }
    }
    case 'RESET_ROUND':
      return {
        ...initialState,
        currentScreen: state.currentScreen,
        ...(action.overrides || null),
      }
    default:
      return state
  }
}

const initialState = {
  currentScreen: 'history',
  selectedGames: ['banker'],
  players: DEFAULT_PLAYERS,
  nextPlayerId: 5,
  stakeVals: DEFAULT_STAKES,
  scores: {},
  bets: {},
  currentHole: 1,
  courseName: '',
  totalHoles: 18,
  bankerStartIndex: 0,
  playerDoubled: {},
  bankerDoubledBack: {},
  wolfPartnerThisHole: null,
  selectedCrewId: null,
  viewingRoundId: null,
  navReturnTo: null,
  editPlayerId: null,
  editCourseId: null,
}

function getInitialState() {
  try {
    const stored = loadRound()
    if (!stored) {
      const stakeDefaults = getDefaultStakes()
      const savedPlayers = getPlayers()
      const players =
        Array.isArray(savedPlayers) && savedPlayers.length >= 2 ? savedPlayers : initialState.players
      const maxId = (players || []).reduce((m, p) => Math.max(m, p?.id ?? 0), 0)
      return {
        ...initialState,
        players,
        nextPlayerId: Math.max(initialState.nextPlayerId, maxId + 1),
        stakeVals:
          stakeDefaults && typeof stakeDefaults === 'object'
            ? { ...initialState.stakeVals, ...stakeDefaults }
            : initialState.stakeVals,
      }
    }
    return {
      ...initialState,
      ...stored,
      players:
        Array.isArray(stored.players) && stored.players.length >= 2
          ? stored.players
          : initialState.players,
      selectedGames: Array.isArray(stored.selectedGames)
        ? stored.selectedGames
        : initialState.selectedGames,
      stakeVals:
        stored.stakeVals && typeof stored.stakeVals === 'object'
          ? { ...initialState.stakeVals, ...stored.stakeVals }
          : initialState.stakeVals,
      bankerStartIndex:
        typeof stored.bankerStartIndex === 'number' ? stored.bankerStartIndex : initialState.bankerStartIndex,
      courseName: typeof stored.courseName === 'string' ? stored.courseName : initialState.courseName,
      totalHoles: stored.totalHoles === 9 || stored.totalHoles === 18 ? stored.totalHoles : initialState.totalHoles,
      playerDoubled: stored.playerDoubled && typeof stored.playerDoubled === 'object' ? stored.playerDoubled : initialState.playerDoubled,
      bankerDoubledBack: stored.bankerDoubledBack && typeof stored.bankerDoubledBack === 'object' ? stored.bankerDoubledBack : initialState.bankerDoubledBack,
    }
  } catch (e) {
    console.warn('birdie-bank: getInitialState failed, using defaults', e)
    return { ...initialState }
  }
}

export function RoundProvider({ children }) {
  const [state, dispatch] = useReducer(roundReducer, undefined, getInitialState)

  const saveTimeoutRef = useRef(null)
  useEffect(() => {
    const players = getPlayers()
    if (!Array.isArray(players) || players.length === 0) {
      setPlayers(DEFAULT_PLAYERS)
    }
  }, [])
  useEffect(() => {
    saveTimeoutRef.current = setTimeout(() => {
      saveRound(state)
    }, 300)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [state])

  const go = useCallback((screen) => {
    dispatch({ type: 'GO', screen })
    window.scrollTo(0, 0)
  }, [])

  const resumeIfInProgress = useCallback(() => {
    if (hasInProgressRound(state)) {
      dispatch({ type: 'GO', screen: 'hole' })
      window.scrollTo(0, 0)
      return true
    }
    return false
  }, [state])

  const resetRound = useCallback(() => {
    const stakeDefaults = getDefaultStakes()
    const savedPlayers = getPlayers()
    const players =
      Array.isArray(savedPlayers) && savedPlayers.length >= 2 ? savedPlayers : initialState.players
    const maxId = players.reduce((m, p) => Math.max(m, p?.id ?? 0), 0)

    dispatch({
      type: 'RESET_ROUND',
      overrides: {
        players,
        nextPlayerId: Math.max(initialState.nextPlayerId, maxId + 1),
        stakeVals:
          stakeDefaults && typeof stakeDefaults === 'object'
            ? { ...initialState.stakeVals, ...stakeDefaults }
            : initialState.stakeVals,
        viewingRoundId: null,
        navReturnTo: null,
        editPlayerId: null,
        editCourseId: null,
        selectedCrewId: null,
      },
    })
    clearRound()
    window.scrollTo(0, 0)
  }, [])

  const startAddCrew = useCallback(() => {
    clearRound()
    dispatch({ type: 'START_ADD_CREW' })
    window.scrollTo(0, 0)
  }, [])

  const toggleGame = useCallback((game) => {
    dispatch({ type: 'TOGGLE_GAME', game })
  }, [])

  const addPlayer = useCallback(() => {
    dispatch({ type: 'ADD_PLAYER' })
  }, [])

  const addPlayerWithProfile = useCallback((name, hcp) => {
    dispatch({ type: 'ADD_PLAYER_WITH_PROFILE', name, hcp })
  }, [])

  const removePlayer = useCallback((id) => {
    dispatch({ type: 'REMOVE_PLAYER', id })
  }, [])

  const setPlayerName = useCallback((id, name) => {
    dispatch({ type: 'SET_PLAYER_NAME', id, name })
  }, [])

  const setPlayerHcp = useCallback((id, hcp) => {
    dispatch({ type: 'SET_PLAYER_HCP', id, hcp: parseInt(hcp, 10) || 0 })
  }, [])

  const setStake = useCallback(
    (game, direction) => {
      const current = state.stakeVals[game] ?? 1
      const i = STAKE_STEPS.indexOf(current)
      const next = Math.max(0, Math.min(STAKE_STEPS.length - 1, i + direction))
      dispatch({ type: 'SET_STAKE', game, value: STAKE_STEPS[next] })
    },
    [state.stakeVals]
  )

  const getScore = useCallback(
    (playerId) => {
      const key = `${state.currentHole}-${playerId}`
      return state.scores[key] ?? 4
    },
    [state.currentHole, state.scores]
  )

  const setScore = useCallback(
    (playerId, delta) => {
      const key = `${state.currentHole}-${playerId}`
      const current = state.scores[key] ?? 4
      const next = Math.max(1, Math.min(9, current + delta))
      dispatch({ type: 'SET_SCORE', playerId, score: next })
    },
    [state.currentHole, state.scores]
  )

  const getBet = useCallback(
    (playerId) => {
      const key = `${state.currentHole}-${playerId}`
      return state.bets[key] ?? state.stakeVals.banker ?? 2
    },
    [state.currentHole, state.bets, state.stakeVals.banker]
  )

  const setBet = useCallback(
    (playerId, delta) => {
      const min = state.stakeVals.banker ?? 1
      const max = min * 4
      const key = `${state.currentHole}-${playerId}`
      const current = state.bets[key] ?? min
      const next = Math.max(min, Math.min(max, current + delta))
      dispatch({ type: 'SET_BET', playerId, bet: next })
    },
    [state.currentHole, state.bets, state.stakeVals.banker]
  )

  const setCurrentHole = useCallback((hole) => {
    dispatch({ type: 'SET_CURRENT_HOLE', hole })
  }, [])

  const setWolfPartner = useCallback((partner) => {
    dispatch({ type: 'SET_WOLF_PARTNER', partner })
  }, [])

  const setCourse = useCallback((courseName, totalHoles) => {
    dispatch({ type: 'SET_COURSE', courseName, totalHoles })
  }, [])

  const loadCrew = useCallback((players) => {
    dispatch({ type: 'LOAD_CREW', players })
  }, [])

  const setSelectedCrewId = useCallback((crewId) => {
    dispatch({ type: 'SET_SELECTED_CREW', crewId })
  }, [])

  const setViewingRoundId = useCallback((roundId) => {
    dispatch({ type: 'SET_VIEWING_ROUND', roundId })
  }, [])

  const setNavReturnTo = useCallback((screen) => {
    dispatch({ type: 'SET_NAV_RETURN_TO', screen })
  }, [])

  const setEditPlayerId = useCallback((id) => {
    dispatch({ type: 'SET_EDIT_PLAYER', id })
  }, [])

  const setEditCourseId = useCallback((id) => {
    dispatch({ type: 'SET_EDIT_COURSE', id })
  }, [])

  const getBankerRunningTotals = useCallback(
    (upToHole = state.currentHole) => {
      if (!state.selectedGames.includes('banker') || state.players.length < 2) {
        return {}
      }
      const stakeMin = state.stakeVals.banker ?? 1
      return bankerRunningTotals(
        state.players,
        state.scores,
        state.bets,
        upToHole,
        stakeMin,
        {
          bankerStartIndex: state.bankerStartIndex,
          playerDoubled: state.playerDoubled,
          bankerDoubledBack: state.bankerDoubledBack,
        }
      )
    },
    [
      state.selectedGames,
      state.players,
      state.scores,
      state.bets,
      state.currentHole,
      state.stakeVals.banker,
      state.bankerStartIndex,
      state.playerDoubled,
      state.bankerDoubledBack,
    ]
  )

  const setBankerStartIndex = useCallback((index) => {
    dispatch({ type: 'SET_BANKER_START_INDEX', index })
  }, [])

  const togglePlayerDoubled = useCallback((playerId) => {
    dispatch({ type: 'TOGGLE_PLAYER_DOUBLED', playerId })
  }, [])

  const toggleBankerDoubledBack = useCallback(() => {
    dispatch({ type: 'TOGGLE_BANKER_DOUBLED_BACK' })
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      go,
      resumeIfInProgress,
      resetRound,
      startAddCrew,
      toggleGame,
      addPlayer,
      addPlayerWithProfile,
      removePlayer,
      setPlayerName,
      setPlayerHcp,
      stakeSteps: STAKE_STEPS,
      setStake,
      getScore,
      setScore,
      getBet,
      setBet,
      setCurrentHole,
      setBankerStartIndex,
      togglePlayerDoubled,
      toggleBankerDoubledBack,
      setWolfPartner,
      setCourse,
      loadCrew,
      setSelectedCrewId,
      setViewingRoundId,
      setNavReturnTo,
      setEditPlayerId,
      setEditCourseId,
      getBankerRunningTotals,
      initial,
      GAME_KEYS,
    }),
    [
      state,
      go,
      resumeIfInProgress,
      resetRound,
      startAddCrew,
      toggleGame,
      addPlayer,
      addPlayerWithProfile,
      removePlayer,
      setPlayerName,
      setPlayerHcp,
      setStake,
      getScore,
      setScore,
      getBet,
      setBet,
      setCurrentHole,
      setBankerStartIndex,
      togglePlayerDoubled,
      toggleBankerDoubledBack,
      setWolfPartner,
      setCourse,
      loadCrew,
      setSelectedCrewId,
      setViewingRoundId,
      setNavReturnTo,
      setEditPlayerId,
      setEditCourseId,
      getBankerRunningTotals,
    ]
  )

  return <RoundContext.Provider value={value}>{children}</RoundContext.Provider>
}

export function useRound() {
  const ctx = useContext(RoundContext)
  if (!ctx) throw new Error('useRound must be used within RoundProvider')
  return ctx
}
