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

  // Transparency management (0-100, where 100 is fully opaque)
  const [transparency, setTransparency] = useState<number>(90)

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

  // Load saved transparency from localStorage on mount
  useEffect(() => {
    const loadSavedTransparency = () => {
      if (typeof window !== 'undefined') {
        const savedTransparency = localStorage.getItem('overlay-transparency')
        if (savedTransparency) {
          const parsedTransparency = parseInt(savedTransparency, 10)
          if (!isNaN(parsedTransparency) && parsedTransparency >= 10 && parsedTransparency <= 100) {
            setTransparency(parsedTransparency)
          }
        }
      }
    }
    
    loadSavedTransparency()
  }, [])

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

  // Apply transparency changes to CSS custom properties
  useEffect(() => {
    const root = document.documentElement
    const colorVars = [
      '--overlay-bg-primary',
      '--overlay-bg-secondary', 
      '--overlay-bg-hover',
      '--overlay-text-primary',
      '--overlay-text-secondary',
      '--overlay-text-muted',
      '--overlay-border-primary',
      '--overlay-border-accent',
      '--overlay-accent-primary',
      '--overlay-accent-secondary',
      '--overlay-accent-successs'
    ]

    // Store original CSS values on first run (when transparency is 100%)
    const originalValues: Record<string, string> = {}
    
    const storeOriginalValues = () => {
      const computedStyles = getComputedStyle(root)
      colorVars.forEach(cssVar => {
        // Remove any existing inline styles to get CSS file values
        root.style.removeProperty(cssVar)
        originalValues[cssVar] = computedStyles.getPropertyValue(cssVar).trim()
      })
    }
    
    const applyTransparency = () => {
      const transparencyMultiplier = transparency / 100
      
      // Helper function to parse rgba and apply transparency
      const applyTransparencyToColor = (originalValue: string) => {
        // Parse rgba(r, g, b, a) format
        const rgbaRegex = /rgba?\(([^)]+)\)/
        const rgbaMatch = rgbaRegex.exec(originalValue)
        if (rgbaMatch) {
          const values = rgbaMatch[1].split(',').map(v => v.trim())
          const [r, g, b, originalAlpha = '1'] = values
          const newAlpha = parseFloat(originalAlpha) * transparencyMultiplier
          
          return `rgba(${r}, ${g}, ${b}, ${newAlpha})`
        }
        
        // If not rgba format, return original
        return originalValue
      }
      
      // Apply transparency to all overlay colors using stored original values
      colorVars.forEach(cssVar => {
        const originalValue = originalValues[cssVar]
        if (originalValue) {
          const newValue = applyTransparencyToColor(originalValue)
          root.style.setProperty(cssVar, newValue)
        }
      })
    }
    
    // Store original values then apply transparency
    storeOriginalValues()
    applyTransparency()
    
    // Cleanup function to reset to original CSS values
    return () => {
      colorVars.forEach(cssVar => {
        root.style.removeProperty(cssVar)
      })
    }
  }, [transparency])

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

  const handleTransparencyChange = (newTransparency: number) => {
    setTransparency(newTransparency)
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('overlay-transparency', newTransparency.toString())
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
    transparency,
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
    handleTransparencyChange,
    setShowSettingsMenu,
  }
}
