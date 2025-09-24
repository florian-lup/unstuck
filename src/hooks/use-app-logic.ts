import { useState, useEffect, useMemo } from 'react'
import { useKeyboardToggle } from './use-keyboard-toggle'
import { useClickThrough } from './use-click-through'
import { useAuth } from './use-auth'
import { type Game } from '../lib/games'
import { type Message } from '../components/text-chat'
import { chatService } from '../lib/chat-service'

// Helper function to convert keybind string to useKeyboardToggle format
function parseKeybind(keybind: string) {
  const parts = keybind.split('+')
  const modifiers: {
    shift?: boolean
    ctrl?: boolean
    alt?: boolean
    meta?: boolean
  } = {}
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
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)

  // Keybind management
  const [customKeybind, setCustomKeybind] = useState<string>(() => {
    // Load keybind from localStorage or use default
    if (typeof window !== 'undefined') {
      return localStorage.getItem('navigation-keybind') ?? 'Shift+\\'
    }
    return 'Shift+\\'
  })

  // Parse keybind for useKeyboardToggle
  const parsedKeybind = useMemo(
    () => parseKeybind(customKeybind),
    [customKeybind]
  )

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
    void syncKeybind()
  }, [customKeybind])

  // Listen for settings menu open event from system tray
  useEffect(() => {
    const handleOpenSettingsMenu = () => {
      setShowSettingsMenu(true)
    }

    // Set up listener
    window.electronAPI?.onOpenSettingsMenu(handleOpenSettingsMenu)

    // Cleanup listener on unmount
    return () => {
      window.electronAPI?.removeOpenSettingsMenuListener()
    }
  }, [])

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
      window.ipcRenderer.send('user-logout')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game)
    // Handle game selection functionality here
    // TODO: Implement game-specific initialization
  }

  const handleSendMessage = async (messageContent: string) => {
    // Immediately add user message to show it right away
    const userMessage: Message = {
      id: `${Date.now()}-user`,
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    
    // Set loading state
    setIsLoadingMessage(true)

    try {
      // Send message through chat service
      // Let the backend handle JWT verification  
      const { assistantMessage } = await chatService.sendMessage(messageContent)

      // Add assistant message to state
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      // Handle errors (including auth errors from backend)
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        content: error instanceof Error ? error.message : 'Unknown error',
        role: 'assistant',
        timestamp: new Date(),
      }
      
      setMessages((prev) => [...prev, errorMessage])
      console.error('Error sending message:', error)
    } finally {
      setIsLoadingMessage(false)
    }
  }

  const handleTextChatClose = () => {
    setIsTextChatVisible(false)
    // Optionally clear messages when closing chat
    // setMessages([])
  }

  const handleStartNewConversation = () => {
    chatService.startNewConversation()
    setMessages([])
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
    isLoadingMessage,

    // Actions
    handleSpeakClick,
    handleTextClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleStartNewConversation,
    handleDropdownOpenChange,
    handleLogout,
    handleKeybindChange,
    setShowSettingsMenu,
  }
}
