import { RoundProvider, useRound } from './context/RoundContext'
import HomeScreen from './components/screens/HomeScreen'
import GameSelectScreen from './components/screens/GameSelectScreen'
import PlayersScreen from './components/screens/PlayersScreen'
import StakesScreen from './components/screens/StakesScreen'
import HoleScreen from './components/screens/HoleScreen'
import SettlementScreen from './components/screens/SettlementScreen'
import HistoryScreen from './components/screens/HistoryScreen'
import './App.css'

const SCREENS = {
  home: HomeScreen,
  games: GameSelectScreen,
  players: PlayersScreen,
  stakes: StakesScreen,
  hole: HoleScreen,
  settle: SettlementScreen,
  history: HistoryScreen,
}

function AppContent() {
  const { currentScreen } = useRound()
  const Screen = SCREENS[currentScreen] || HomeScreen
  return <Screen />
}

function App() {
  return (
    <RoundProvider>
      <div className="phone">
        <AppContent />
      </div>
    </RoundProvider>
  )
}

export default App
