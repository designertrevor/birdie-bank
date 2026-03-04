/**
 * Single source of truth for game config, stake steps, and default round data.
 * Used by RoundContext, GameSelectScreen, StakesScreen, and any future game logic.
 */
import { Landmark, CircleDollarSign, Trophy, Users } from 'lucide-react'

export const GAME_KEYS = ['banker', 'skins', 'nassau', 'wolf']

export const STAKE_STEPS = [1, 2, 3, 5, 10, 20]

export const GAME_CFG = {
  banker: {
    label: 'Banker',
    sub: 'Min per hole · max set by banker',
    icon: Landmark,
  },
  skins: {
    label: 'Skins',
    sub: 'Per skin · carries over on ties',
    icon: CircleDollarSign,
  },
  nassau: {
    label: 'Nassau',
    sub: 'Per match (front / back / total)',
    icon: Trophy,
  },
  wolf: {
    label: 'Wolf',
    sub: 'Base unit per hole',
    icon: Users,
  },
}

export const DEFAULT_PLAYERS = [
  { id: 1, name: 'You', hcp: 14 },
  { id: 2, name: 'Mike', hcp: 8 },
  { id: 3, name: 'Dave', hcp: 18 },
  { id: 4, name: 'Connor', hcp: 22 },
]

export const DEFAULT_STAKES = {
  banker: 2,
  skins: 3,
  nassau: 5,
  wolf: 2,
}
