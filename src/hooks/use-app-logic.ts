import { useState } from 'react'
import { useKeyboardToggle } from './use-keyboard-toggle'
import { useClickThrough } from './use-click-through'
import { type Game } from '../lib/games'
import { type Message } from '../components/text-chat'

export function useAppLogic() {
  // Core application state
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [isTextChatVisible, setIsTextChatVisible] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])

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
    // Handle settings functionality here
    // TODO: Implement settings modal/panel
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
    
    // Actions
    handleSpeakClick,
    handleTextClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleDropdownOpenChange,
  }
}
