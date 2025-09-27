import { useState, useRef, useEffect } from 'react'
import type { Message } from '../components/gaming-chat'

interface UseGamingChatProps {
  onClose?: () => void
  onSendMessage?: (message: string) => void
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
  const [activeToggle, setActiveToggle] = useState<'guides' | 'builds' | 'lore' | 'help' | null>(null)

  // Refs for scroll management
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Utility function for scrolling
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      // Ensure window stays on top when sending a message
      window.electronAPI?.windowInteraction()
      onSendMessage?.(message.trim())
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

  const handleToggleClick = (toggleName: 'guides' | 'builds' | 'lore' | 'help') => {
    // If the same toggle is clicked, deactivate it, otherwise set it as active
    setActiveToggle(activeToggle === toggleName ? null : toggleName)
  }

  return {
    // State
    message,
    messagesEndRef,
    messagesContainerRef,
    activeToggle,

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
