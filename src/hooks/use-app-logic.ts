import { useState } from 'react'
import { useKeyboardToggle } from './use-keyboard-toggle'
import { useClickThrough } from './use-click-through'
import { useAuth } from './use-auth'
import { type Game } from '../lib/games'
import { type Message } from '../components/text-chat'

export function useAppLogic() {
  // Authentication state
  const { user, signOut, isSecureStorage } = useAuth()
  
  // Core application state
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [isTextChatVisible, setIsTextChatVisible] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)

  // Navigation bar visibility toggle
  const { isVisible: isNavigationBarVisible } = useKeyboardToggle({
    key: 'Backslash',
    modifiers: { shift: true },
  })

  // Global click-through management
  useClickThrough({
    interactiveSelectors:
      isNavigationBarVisible || isTextChatVisible
        ? ['[data-interactive-area]']
        : [],
  })

  // Event handlers
  const handleSpeakClick = () => {
    // Handle speak functionality here
    // TODO: Implement actual speech recognition
  }

  const handleTextClick = () => {
    setIsTextChatVisible(!isTextChatVisible)
  }

  const handleSettingsClick = () => {
    setShowSettingsMenu(!showSettingsMenu)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      // Send message to main process to show auth window again
      if (window.ipcRenderer) {
        window.ipcRenderer.send('user-logout')
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game)
    // Handle game selection functionality here
    // TODO: Implement game-specific initialization
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

  return {
    // State
    selectedGame,
    isTextChatVisible,
    messages,
    isNavigationBarVisible,
    showSettingsMenu,
    user,
    isSecureStorage,
    
    // Actions
    handleSpeakClick,
    handleTextClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleDropdownOpenChange,
    handleLogout,
    setShowSettingsMenu,
  }
}
