import { useState, useEffect, useMemo, useCallback } from 'react'
import { type Conversation } from '../components/conversation-history'
import { type Message } from '../components/gaming-chat'
import { apiClient } from '../lib/api-client'
import { secureAuth } from '../lib/auth-client'
import { chatService } from '../lib/chat-service'
import { type Game } from '../lib/games'
import { conversationCache } from '../services/conversation-cache'
import { useAuth } from './use-auth'
import { useClickThrough } from './use-click-through'
import { useKeyboardToggle } from './use-keyboard-toggle'
import { useSubscription } from './use-subscription'
import { useVoiceChat } from './use-voice-chat'

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

  // Subscription state (persists throughout app lifecycle)
  const {
    isSubscribed,
    isLoading: subscriptionLoading,
    handleUpgrade,
    handleCancel,
  } = useSubscription()

  // Core application state
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [isGamingChatVisible, setIsGamingChatVisible] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null)

  // Voice chat hook
  const voiceChat = useVoiceChat({
    selectedGame,
    onError: (error) => {
      console.error('Voice chat error:', error)
      // Optionally show error to user
    },
  })

  // Keybind management
  const [customKeybind, setCustomKeybind] = useState<string>(() => {
    // Load keybind from localStorage or use default
    if (typeof window !== 'undefined') {
      return localStorage.getItem('navigation-keybind') ?? 'Shift+\\'
    }
    return 'Shift+\\'
  })

  // Chat keybind management
  const [chatKeybind, setChatKeybind] = useState<string>(() => {
    // Load chat keybind from localStorage or use default
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chat-keybind') ?? 'Shift+Z'
    }
    return 'Shift+Z'
  })

  // History keybind management
  const [historyKeybind, setHistoryKeybind] = useState<string>(() => {
    // Load history keybind from localStorage or use default
    if (typeof window !== 'undefined') {
      return localStorage.getItem('history-keybind') ?? 'Shift+X'
    }
    return 'Shift+X'
  })

  // Settings keybind management
  const [settingsKeybind, setSettingsKeybind] = useState<string>(() => {
    // Load settings keybind from localStorage or use default
    if (typeof window !== 'undefined') {
      return localStorage.getItem('settings-keybind') ?? 'Shift+C'
    }
    return 'Shift+C'
  })

  // New chat keybind management
  const [newChatKeybind, setNewChatKeybind] = useState<string>(() => {
    // Load new chat keybind from localStorage or use default
    if (typeof window !== 'undefined') {
      return localStorage.getItem('new-chat-keybind') ?? 'Ctrl+Z'
    }
    return 'Ctrl+Z'
  })

  // Transparency management (0-100, where 100 is fully opaque)
  const [transparency, setTransparency] = useState<number>(90)

  // Parse keybind for useKeyboardToggle (only for navigation bar)
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
          if (
            !isNaN(parsedTransparency) &&
            parsedTransparency >= 10 &&
            parsedTransparency <= 100
          ) {
            setTransparency(parsedTransparency)
          }
        }
      }
    }

    loadSavedTransparency()
  }, [])

  // Sync initial keybinds with Electron on app start
  useEffect(() => {
    const syncKeybinds = async () => {
      try {
        // Sync navigation shortcut if it's not the default
        if (customKeybind !== 'Shift+\\') {
          await window.electronAPI?.updateNavigationShortcut(customKeybind)
        }
        // Sync chat shortcut if it's not the default
        if (chatKeybind !== 'Shift+Z') {
          await window.electronAPI?.updateChatShortcut(chatKeybind)
        }
        // Sync history shortcut if it's not the default
        if (historyKeybind !== 'Shift+X') {
          await window.electronAPI?.updateHistoryShortcut(historyKeybind)
        }
        // Sync settings shortcut if it's not the default
        if (settingsKeybind !== 'Shift+C') {
          await window.electronAPI?.updateSettingsShortcut(settingsKeybind)
        }
        // Sync new chat shortcut if it's not the default
        if (newChatKeybind !== 'Ctrl+Z') {
          await window.electronAPI?.updateNewChatShortcut(newChatKeybind)
        }
      } catch (error) {
        console.error('Failed to sync initial global shortcuts:', error)
      }
    }
    void syncKeybinds()
  }, [
    customKeybind,
    chatKeybind,
    historyKeybind,
    settingsKeybind,
    newChatKeybind,
  ])

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
      '--overlay-accent-success',
      '--overlay-accent-error',
    ]

    // Store original CSS values on first run (when transparency is 100%)
    const originalValues: Record<string, string> = {}

    const storeOriginalValues = () => {
      const computedStyles = getComputedStyle(root)
      colorVars.forEach((cssVar) => {
        // Remove any existing inline styles to get CSS file values
        root.style.removeProperty(cssVar)
        // eslint-disable-next-line security/detect-object-injection
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
          const values = rgbaMatch[1].split(',').map((v) => v.trim())
          const [r, g, b, originalAlpha = '1'] = values
          const newAlpha = parseFloat(originalAlpha) * transparencyMultiplier

          return `rgba(${r}, ${g}, ${b}, ${newAlpha})`
        }

        // If not rgba format, return original
        return originalValue
      }

      // Apply transparency to all overlay colors using stored original values
      colorVars.forEach((cssVar) => {
        // eslint-disable-next-line security/detect-object-injection
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
      colorVars.forEach((cssVar) => {
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

  // Listen for chat toggle keyboard shortcut (from Electron global shortcut)
  useEffect(() => {
    const handleChatToggle = () => {
      setIsGamingChatVisible((prev) => {
        const newValue = !prev
        // Close other panels when opening chat
        if (newValue) {
          setShowSettingsMenu(false)
          setShowHistoryPanel(false)
          setShowInfoPanel(false)
        }
        return newValue
      })
    }

    // Listen for Electron global shortcut
    if (window.electronAPI?.onChatToggle) {
      window.electronAPI.onChatToggle(handleChatToggle)
    }

    // Cleanup function to remove event listeners
    return () => {
      if (window.electronAPI?.removeChatToggleListener) {
        window.electronAPI.removeChatToggleListener()
      }
    }
  }, [])

  // Listen for history toggle keyboard shortcut (from Electron global shortcut)
  useEffect(() => {
    const handleHistoryToggle = () => {
      setShowHistoryPanel((prev) => {
        const newValue = !prev
        // Close other panels when opening history
        if (newValue) {
          setIsGamingChatVisible(false)
          setShowSettingsMenu(false)
          setShowInfoPanel(false)
        }
        return newValue
      })
    }

    // Listen for Electron global shortcut
    if (window.electronAPI?.onHistoryToggle) {
      window.electronAPI.onHistoryToggle(handleHistoryToggle)
    }

    // Cleanup function to remove event listeners
    return () => {
      if (window.electronAPI?.removeHistoryToggleListener) {
        window.electronAPI.removeHistoryToggleListener()
      }
    }
  }, [])

  // Listen for settings toggle keyboard shortcut (from Electron global shortcut)
  useEffect(() => {
    const handleSettingsToggle = () => {
      setShowSettingsMenu((prev) => {
        const newValue = !prev
        // Close other panels when opening settings
        if (newValue) {
          setIsGamingChatVisible(false)
          setShowHistoryPanel(false)
          setShowInfoPanel(false)
        }
        return newValue
      })
    }

    // Listen for Electron global shortcut
    if (window.electronAPI?.onSettingsToggle) {
      window.electronAPI.onSettingsToggle(handleSettingsToggle)
    }

    // Cleanup function to remove event listeners
    return () => {
      if (window.electronAPI?.removeSettingsToggleListener) {
        window.electronAPI.removeSettingsToggleListener()
      }
    }
  }, [])

  // Handler functions (defined before they're used in effects)
  const handleStartNewConversation = useCallback(() => {
    chatService.startNewConversation()
    setMessages([])
    setCurrentConversationId(null)
    // Invalidate conversation list cache so fresh data is fetched when history is opened
    conversationCache.invalidateConversationList()
  }, [])

  // Listen for new chat keyboard shortcut (from Electron global shortcut)
  useEffect(() => {
    const handleNewChat = () => {
      handleStartNewConversation()
    }

    // Listen for Electron global shortcut
    if (window.electronAPI?.onNewChatTrigger) {
      window.electronAPI.onNewChatTrigger(handleNewChat)
    }

    // Cleanup function to remove event listeners
    return () => {
      if (window.electronAPI?.removeNewChatTriggerListener) {
        window.electronAPI.removeNewChatTriggerListener()
      }
    }
  }, [handleStartNewConversation])

  // Global click-through management
  useClickThrough({
    interactiveSelectors:
      isNavigationBarVisible ||
      isGamingChatVisible ||
      showSettingsMenu ||
      showHistoryPanel ||
      showInfoPanel
        ? ['[data-interactive-area]']
        : [],
  })

  // Event handlers
  const handleVoiceClick = async () => {
    // Toggle voice chat based on connection state
    if (voiceChat.isConnected || voiceChat.isConnecting) {
      // If already connected or connecting, stop it
      voiceChat.stopVoiceChat()
    } else {
      // Close other panels
      if (isGamingChatVisible) {
        setIsGamingChatVisible(false)
      }
      if (showSettingsMenu) {
        setShowSettingsMenu(false)
      }
      if (showHistoryPanel) {
        setShowHistoryPanel(false)
      }
      if (showInfoPanel) {
        setShowInfoPanel(false)
      }
      
      // Start voice chat connection
      try {
        await voiceChat.startVoiceChat()
      } catch (error) {
        console.error('Failed to start voice chat:', error)
      }
    }
  }

  const handleTextClick = () => {
    setIsGamingChatVisible(!isGamingChatVisible)
    // Close other panels when text chat opens
    if (!isGamingChatVisible) {
      // Stop voice chat if active
      if (voiceChat.isConnected || voiceChat.isConnecting) {
        voiceChat.stopVoiceChat()
      }
      if (showSettingsMenu) {
        setShowSettingsMenu(false)
      }
      if (showHistoryPanel) {
        setShowHistoryPanel(false)
      }
      if (showInfoPanel) {
        setShowInfoPanel(false)
      }
    }
  }

  const handleHistoryClick = () => {
    setShowHistoryPanel(!showHistoryPanel)
    // Close other panels when history opens
    if (!showHistoryPanel) {
      if (isGamingChatVisible) {
        setIsGamingChatVisible(false)
      }
      // Stop voice chat if active
      if (voiceChat.isConnected || voiceChat.isConnecting) {
        voiceChat.stopVoiceChat()
      }
      if (showSettingsMenu) {
        setShowSettingsMenu(false)
      }
      if (showInfoPanel) {
        setShowInfoPanel(false)
      }
    }
  }

  const handleSettingsClick = () => {
    setShowSettingsMenu(!showSettingsMenu)
    // Close other panels when settings opens
    if (!showSettingsMenu) {
      if (isGamingChatVisible) {
        setIsGamingChatVisible(false)
      }
      // Stop voice chat if active
      if (voiceChat.isConnected || voiceChat.isConnecting) {
        voiceChat.stopVoiceChat()
      }
      if (showHistoryPanel) {
        setShowHistoryPanel(false)
      }
      if (showInfoPanel) {
        setShowInfoPanel(false)
      }
    }
  }

  const handleInfoClick = () => {
    setShowInfoPanel(!showInfoPanel)
    // Close other panels when info opens
    if (!showInfoPanel) {
      if (isGamingChatVisible) {
        setIsGamingChatVisible(false)
      }
      // Stop voice chat if active
      if (voiceChat.isConnected || voiceChat.isConnecting) {
        voiceChat.stopVoiceChat()
      }
      if (showSettingsMenu) {
        setShowSettingsMenu(false)
      }
      if (showHistoryPanel) {
        setShowHistoryPanel(false)
      }
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

  const handleSendMessage = async (
    messageContent: string,
    _activeToggle?: 'guides' | 'builds' | 'lore' | 'fix' | null
  ) => {
    // Remember if we had a conversation ID before sending
    const hadConversation = !!currentConversationId

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
      // Send message through appropriate service based on active toggle
      // Let the backend handle JWT verification
      const { assistantMessage, conversationId } =
        await chatService.sendMessage(messageContent, selectedGame)

      // If this was a new conversation (we didn't have one before), update the ID and invalidate cache
      if (!hadConversation && conversationId) {
        setCurrentConversationId(conversationId)
        // Invalidate conversation list cache since a new conversation was created
        conversationCache.invalidateConversationList()
      }

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

  const handleGamingChatClose = () => {
    setIsGamingChatVisible(false)
    // Optionally clear messages when closing chat
    // setMessages([])
  }


  const handleConversationSelect = async (conversation: Conversation) => {
    try {
      setIsLoadingMessage(true)
      setMessages([]) // Clear current messages while loading

      // Check cache first
      const cachedHistory = conversationCache.getCachedConversationHistory(
        conversation.id
      )
      if (cachedHistory) {
        // Convert cached API messages to Message format expected by GamingChat
        const convertedMessages: Message[] = cachedHistory.messages.map(
          (msg, index) => ({
            id: `${conversation.id}-${index}`,
            content: msg.content,
            role: msg.role,
            timestamp: new Date(cachedHistory.updated_at * 1000), // Convert unix timestamp to Date
          })
        )

        // Update state
        setMessages(convertedMessages)
        setCurrentConversationId(conversation.id)

        // Set the conversation ID in chat service so new messages go to this conversation
        chatService.setConversationId(conversation.id)

        // Show text chat and close history panel
        setIsGamingChatVisible(true)
        setShowHistoryPanel(false)
        setIsLoadingMessage(false)
        return
      }

      const accessToken = await secureAuth.getValidAccessToken()
      if (!accessToken) {
        throw new Error('No authentication token available')
      }

      // Get conversation history from API
      const historyResponse = await apiClient.getConversationHistory(
        conversation.id,
        accessToken
      )

      // Cache the response
      conversationCache.setCachedConversationHistory(
        conversation.id,
        historyResponse
      )

      // Convert API messages to Message format expected by GamingChat
      const convertedMessages: Message[] = historyResponse.messages.map(
        (msg, index) => ({
          id: `${conversation.id}-${index}`,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(historyResponse.updated_at * 1000), // Convert unix timestamp to Date
        })
      )

      // Update state
      setMessages(convertedMessages)
      setCurrentConversationId(conversation.id)

      // Set the conversation ID in chat service so new messages go to this conversation
      chatService.setConversationId(conversation.id)

      // Show text chat and close history panel
      setIsGamingChatVisible(true)
      setShowHistoryPanel(false)
    } catch (error) {
      console.error('Error loading conversation history:', error)

      // Show error message
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        content:
          error instanceof Error
            ? `Failed to load conversation: ${error.message}`
            : 'Failed to load conversation',
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages([errorMessage])
    } finally {
      setIsLoadingMessage(false)
    }
  }

  const handleDropdownOpenChange = (open: boolean) => {
    if (open) {
      // Close all panels when dropdown opens
      if (isGamingChatVisible) {
        setIsGamingChatVisible(false)
      }
      // Stop voice chat if active
      if (voiceChat.isConnected || voiceChat.isConnecting) {
        voiceChat.stopVoiceChat()
      }
      if (showSettingsMenu) {
        setShowSettingsMenu(false)
      }
      if (showHistoryPanel) {
        setShowHistoryPanel(false)
      }
      if (showInfoPanel) {
        setShowInfoPanel(false)
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

  const handleChatKeybindChange = async (newKeybind: string) => {
    setChatKeybind(newKeybind)
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('chat-keybind', newKeybind)
    }
    // Update Electron global shortcut
    try {
      await window.electronAPI?.updateChatShortcut(newKeybind)
    } catch (error) {
      console.error('Failed to update chat global shortcut:', error)
    }
  }

  const handleHistoryKeybindChange = async (newKeybind: string) => {
    setHistoryKeybind(newKeybind)
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('history-keybind', newKeybind)
    }
    // Update Electron global shortcut
    try {
      await window.electronAPI?.updateHistoryShortcut(newKeybind)
    } catch (error) {
      console.error('Failed to update history global shortcut:', error)
    }
  }

  const handleSettingsKeybindChange = async (newKeybind: string) => {
    setSettingsKeybind(newKeybind)
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('settings-keybind', newKeybind)
    }
    // Update Electron global shortcut
    try {
      await window.electronAPI?.updateSettingsShortcut(newKeybind)
    } catch (error) {
      console.error('Failed to update settings global shortcut:', error)
    }
  }

  const handleNewChatKeybindChange = async (newKeybind: string) => {
    setNewChatKeybind(newKeybind)
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('new-chat-keybind', newKeybind)
    }
    // Update Electron global shortcut
    try {
      await window.electronAPI?.updateNewChatShortcut(newKeybind)
    } catch (error) {
      console.error('Failed to update new chat global shortcut:', error)
    }
  }

  return {
    // State
    selectedGame,
    isGamingChatVisible,
    messages,
    isNavigationBarVisible,
    showSettingsMenu,
    showHistoryPanel,
    showInfoPanel,
    user,
    customKeybind,
    chatKeybind,
    historyKeybind,
    settingsKeybind,
    newChatKeybind,
    transparency,
    isLoadingMessage,
    currentConversationId,
    isSubscribed,
    subscriptionLoading,
    voiceChatState: {
      isConnected: voiceChat.isConnected,
      isConnecting: voiceChat.isConnecting,
    },

    // Actions
    handleVoiceClick,
    handleTextClick,
    handleHistoryClick,
    handleSettingsClick,
    handleInfoClick,
    handleGameSelect,
    handleSendMessage,
    handleGamingChatClose,
    handleStartNewConversation,
    handleConversationSelect,
    handleDropdownOpenChange,
    handleLogout,
    handleKeybindChange,
    handleChatKeybindChange,
    handleHistoryKeybindChange,
    handleSettingsKeybindChange,
    handleNewChatKeybindChange,
    handleTransparencyChange,
    handleUpgrade,
    handleCancel,
    setShowSettingsMenu,
    setShowHistoryPanel,
    setShowInfoPanel,
  }
}
