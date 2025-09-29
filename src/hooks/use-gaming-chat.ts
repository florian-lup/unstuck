import { useState, useRef, useLayoutEffect } from 'react'
import type { Message } from '../components/gaming-chat'

interface UseGamingChatProps {
  onClose?: () => void
  onSendMessage?: (
    message: string,
    activeToggle?: 'guides' | 'builds' | 'lore' | 'fix' | null
  ) => void
  onStartNewConversation?: () => void
  messages?: Message[]
  isLoading?: boolean
}

export function useGamingChat({
  onClose,
  onSendMessage,
  onStartNewConversation,
  messages = [],
  isLoading = false,
}: UseGamingChatProps) {
  // Local state for message input
  const [message, setMessage] = useState('')

  // Local state for toggle buttons (only one can be active at a time)
  const [activeToggle, setActiveToggle] = useState<
    'guides' | 'builds' | 'lore' | 'fix' | null
  >(null)

  // Refs for scroll management
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Track if this is the first render and previous message count
  const isFirstRenderRef = useRef(true)
  const previousMessageCountRef = useRef(0)

  // Utility functions for scrolling
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'instant' 
    })
  }

  // Handle scroll behavior for initial load vs new messages
  useLayoutEffect(() => {
    if (messages.length > 0) {
      const currentMessageCount = messages.length
      const previousMessageCount = previousMessageCountRef.current
      
      if (isFirstRenderRef.current) {
        // First render with existing messages - scroll instantly to bottom
        scrollToBottom(false)
        isFirstRenderRef.current = false
      } else if (currentMessageCount > previousMessageCount) {
        // New messages added - scroll smoothly to bottom
        scrollToBottom(true)
      }
      
      // Update the previous message count
      previousMessageCountRef.current = currentMessageCount
    }
  }, [messages])

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      // Ensure window stays on top when sending a message
      window.electronAPI?.windowInteraction()
      onSendMessage?.(message.trim(), activeToggle)
      setMessage('') // Clear input after sending
    }
  }

  const handleClose = () => {
    // Ensure window stays on top when closing chat
    window.electronAPI?.windowInteraction()
    onClose?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value)
  }

  const handleNewConversation = () => {
    // Ensure window stays on top when starting new conversation
    window.electronAPI?.windowInteraction()
    onStartNewConversation?.()
  }

  const handleToggleClick = (
    toggleName: 'guides' | 'builds' | 'lore' | 'fix'
  ) => {
    // If the same toggle is clicked, deactivate it, otherwise set it as active
    setActiveToggle(activeToggle === toggleName ? null : toggleName)
  }

  return {
    // State
    message,
    activeToggle,
    messagesEndRef,
    messagesContainerRef,

    // Actions
    handleSubmit,
    handleClose,
    handleKeyDown,
    handleMessageChange,
    handleNewConversation,
    handleToggleClick,

    // Computed
    hasMessages: messages.length > 0,
    canSubmit: message.trim().length > 0 && !isLoading,
  }
}
