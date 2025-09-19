import { NavigationBar } from './components/NavigationBar'
import { useKeyboardToggle } from './hooks/use-keyboard-toggle'
import './index.css'

interface Game {
  id: string
  name: string
  icon?: React.ReactNode
}

function App() {
  const { isVisible: isNavigationBarVisible } = useKeyboardToggle({
    key: 'Backslash',
    modifiers: { shift: true }
  })

  const handleSpeakClick = () => {
    // Handle speak functionality here
  }

  const handleTextClick = () => {
    // Handle text functionality here
  }

  const handleSettingsClick = () => {
    // Handle settings functionality here
  }

  const handleGameSelect = (game: Game) => {
    console.log('Selected game:', game)
    // Handle game selection functionality here
  }

  return (
    <>
      {isNavigationBarVisible && (
        <NavigationBar
          onSpeakClick={handleSpeakClick}
          onTextClick={handleTextClick}
          onSettingsClick={handleSettingsClick}
          onGameSelect={handleGameSelect}
        />
      )}
    </>
  )
}

export default App
