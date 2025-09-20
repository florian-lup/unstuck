import { useState } from 'react'
import { NavigationBar } from './components/navigation-bar'
import { TextChat, type Message } from './components/text-chat'
import { useKeyboardToggle } from './hooks/use-keyboard-toggle'
import { useClickThrough } from './hooks/use-click-through'
import { type Game } from './lib/games'
import './index.css'

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [isTextChatVisible, setIsTextChatVisible] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])

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

  const handleSendMessage = (messageContent: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString() + '-user',
      content: messageContent,
      role: 'user',
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    // Simulate assistant response (replace with actual AI integration later)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: Date.now().toString() + '-assistant',
        content: `I received your message: "${messageContent}". How can I help you with your game?`,
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
    }, 1000)
  }

  const handleTextChatClose = () => {
    setIsTextChatVisible(false)
    // Optionally clear messages when closing chat
    // setMessages([])
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
          messages={messages}
        />
      )}
    </>
  )
}

export default App
