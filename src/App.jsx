import { RoundProvider, useRound } from './context/RoundContext'
import AddCrewScreen from './components/screens/AddCrewScreen'
import CrewDetailScreen from './components/screens/CrewDetailScreen'
import HistoryScreen from './components/screens/HistoryScreen'
import PlayCourseScreen from './components/screens/PlayCourseScreen'
import PlayPlayersScreen from './components/screens/PlayPlayersScreen'
import PlayGamesScreen from './components/screens/PlayGamesScreen'
import HoleScreen from './components/screens/HoleScreen'
import SettlementScreen from './components/screens/SettlementScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import PlayerEditScreen from './components/screens/PlayerEditScreen'
import CourseEditScreen from './components/screens/CourseEditScreen'
import BottomNav from './components/BottomNav'
import './App.css'

const SCREENS = {
  history: HistoryScreen,
  playCourse: PlayCourseScreen,
  playPlayers: PlayPlayersScreen,
  playGames: PlayGamesScreen,
  settings: SettingsScreen,
  addCrew: AddCrewScreen,
  crewDetail: CrewDetailScreen,
  playerEdit: PlayerEditScreen,
  courseEdit: CourseEditScreen,
  hole: HoleScreen,
  settle: SettlementScreen,
}

function getActiveTab(screen) {
  if (screen === 'settings' || screen === 'addCrew' || screen === 'crewDetail' || screen === 'playerEdit' || screen === 'courseEdit') {
    return 'settings'
  }
  if (String(screen || '').startsWith('play')) return 'play'
  return 'history'
}

function AppContent() {
  const { currentScreen, go, resetRound, setViewingRoundId } = useRound()
  const Screen = SCREENS[currentScreen] || HistoryScreen

  const hideNav = currentScreen === 'hole'
  const active = getActiveTab(currentScreen)

  return (
    <div className={`app-shell ${hideNav ? 'no-nav' : ''}`}>
      <div className="app-main">
        <Screen />
      </div>
      {!hideNav && (
        <BottomNav
          active={active}
          onNavigate={(tab) => {
            if (tab === 'history') {
              setViewingRoundId(null)
              go('history')
              return
            }
            if (tab === 'play') {
              setViewingRoundId(null)
              resetRound()
              go('playCourse')
              return
            }
            if (tab === 'settings') {
              setViewingRoundId(null)
              go('settings')
            }
          }}
        />
      )}
    </div>
  )
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
