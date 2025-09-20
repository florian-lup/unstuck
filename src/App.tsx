import { useState } from 'react'
import { NavigationBar } from './components/navigation-bar'
import { useKeyboardToggle } from './hooks/use-keyboard-toggle'
import { useClickThrough } from './hooks/use-click-through'
import './index.css'

interface Game {
  id: string
  name: string
  icon?: React.ReactNode
}

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  
  const { isVisible: isNavigationBarVisible } = useKeyboardToggle({
    key: 'Backslash',
    modifiers: { shift: true },
  })

  // Global click-through management - only when navbar is visible
  useClickThrough({
    interactiveSelectors: isNavigationBarVisible
      ? [
          '[data-interactive-area]', // navbar, dropdowns, and any other interactive areas
        ]
      : [],
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
    setSelectedGame(game)
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
          selectedGame={selectedGame}
        />
      )}
    </>
  )
}

export default App
