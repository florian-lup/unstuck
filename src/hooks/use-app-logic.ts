import { useState, useEffect, useMemo } from 'react'
import { useKeyboardToggle } from './use-keyboard-toggle'
import { useClickThrough } from './use-click-through'
import { useAuth } from './use-auth'
import { type Game } from '../lib/games'
import { type Message } from '../components/text-chat'

// Helper function to convert keybind string to useKeyboardToggle format
function parseKeybind(keybind: string) {
  const parts = keybind.split('+')
  const modifiers: any = {}
  let key = ''

  for (const part of parts) {
    const lowerPart = part.toLowerCase()
    if (lowerPart === 'shift') {
      modifiers.shift = true
    } else if (lowerPart === 'ctrl' || lowerPart === 'control') {
      modifiers.ctrl = true
    } else if (lowerPart === 'alt') {
      modifiers.alt = true
    } else if (lowerPart === 'meta' || lowerPart === 'cmd') {
      modifiers.meta = true
    } else {
      // Convert special keys to the format expected by useKeyboardToggle
      if (part === '\\') {
        key = 'Backslash'
      } else if (part === ' ') {
        key = 'Space'
      } else if (part.length === 1) {
        key = `Key${part.toUpperCase()}`
      } else {
        key = part
      }
    }
  }

  return { key, modifiers }
}

export function useAppLogic() {
  // Authentication state
  const { user, signOut } = useAuth()
  
  // Core application state
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [isTextChatVisible, setIsTextChatVisible] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)

  // Keybind management
  const [customKeybind, setCustomKeybind] = useState<string>(() => {
    // Load keybind from localStorage or use default
    if (typeof window !== 'undefined') {
      return localStorage.getItem('navigation-keybind') || 'Shift+\\'
    }
    return 'Shift+\\'
  })

  // Parse keybind for useKeyboardToggle
  const parsedKeybind = useMemo(() => parseKeybind(customKeybind), [customKeybind])

  // Navigation bar visibility toggle with dynamic keybind
  const { isVisible: isNavigationBarVisible } = useKeyboardToggle({
    key: parsedKeybind.key,
    modifiers: parsedKeybind.modifiers,
  })

  // Sync initial keybind with Electron on app start
  useEffect(() => {
    const syncKeybind = async () => {
      if (customKeybind !== 'Shift+\\') {
        try {
          await window.electronAPI?.updateNavigationShortcut(customKeybind)
        } catch (error) {
          console.error('Failed to sync initial global shortcut:', error)
        }
      }
    }
    syncKeybind()
  }, []) // Only run once on mount

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
    // Close settings menu when text chat opens
    if (!isTextChatVisible && showSettingsMenu) {
      setShowSettingsMenu(false)
    }
  }

  const handleSettingsClick = () => {
    setShowSettingsMenu(!showSettingsMenu)
    // Close text chat when settings opens
    if (!showSettingsMenu && isTextChatVisible) {
      setIsTextChatVisible(false)
    }
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
    if (open) {
      // Close text chat when dropdown opens
      if (isTextChatVisible) {
        setIsTextChatVisible(false)
      }
      // Close settings menu when dropdown opens
      if (showSettingsMenu) {
        setShowSettingsMenu(false)
      }
    }
  }

  const handleKeybindChange = async (newKeybind: string) => {
    setCustomKeybind(newKeybind)
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('navigation-keybind', newKeybind)
    }
    // Update Electron global shortcut
    try {
      await window.electronAPI?.updateNavigationShortcut(newKeybind)
    } catch (error) {
      console.error('Failed to update global shortcut:', error)
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
    customKeybind,
    
    // Actions
    handleSpeakClick,
    handleTextClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleDropdownOpenChange,
    handleLogout,
    handleKeybindChange,
    setShowSettingsMenu,
  }
}
