import { useState } from 'react'
import { NavigationBar } from './components/navigation-bar'
import { TextChat } from './components/text-chat'
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
  const [isTextChatVisible, setIsTextChatVisible] = useState(false)

  const { isVisible: isNavigationBarVisible } = useKeyboardToggle({
    key: 'Backslash',
    modifiers: { shift: true },
  })

  // Global click-through management - when navbar or text chat is visible
  useClickThrough({
    interactiveSelectors:
      isNavigationBarVisible || isTextChatVisible
        ? [
            '[data-interactive-area]', // navbar, text chat, dropdowns, and any other interactive areas
          ]
        : [],
  })

  const handleSpeakClick = () => {
    // Handle speak functionality here
  }

  const handleTextClick = () => {
    setIsTextChatVisible(!isTextChatVisible)
  }

  const handleSettingsClick = () => {
    // Handle settings functionality here
  }

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game)
    // Handle game selection functionality here
  }

  const handleSendMessage = (_message: string) => {
    // Handle message sending functionality here
    // You can integrate with your chat backend/AI here
  }

  const handleTextChatClose = () => {
    setIsTextChatVisible(false)
  }

  const handleDropdownOpenChange = (open: boolean) => {
    if (open && isTextChatVisible) {
      setIsTextChatVisible(false)
    }
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
          onDropdownOpenChange={handleDropdownOpenChange}
        />
      )}
      {isNavigationBarVisible && isTextChatVisible && (
        <TextChat
          onClose={handleTextChatClose}
          onSendMessage={handleSendMessage}
        />
      )}
    </>
  )
}

export default App
