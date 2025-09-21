import { useState, useRef, useEffect } from 'react'
import type { Message } from '../components/text-chat'

interface UseTextChatProps {
  onClose?: () => void
  onSendMessage?: (message: string) => void
  messages?: Message[]
}

export function useTextChat({
  onClose,
  onSendMessage,
  messages = []
}: UseTextChatProps) {
  // Local state for message input
  const [message, setMessage] = useState('')
  
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

  return {
    // State
    message,
    messagesEndRef,
    messagesContainerRef,
    
    // Actions
    handleSubmit,
    handleClose,
    handleKeyDown,
    handleMessageChange,
    
    // Computed
    hasMessages: messages.length > 0,
    canSubmit: message.trim().length > 0,
  }
}
