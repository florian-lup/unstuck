import { useState, useEffect } from 'react'
import { AlertCircle, Loader, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { InteractiveArea } from './interactive-area'
import { apiClient, ConversationsResponse } from '../lib/api-client'
import { secureAuth } from '../lib/auth-client'
import { conversationCache } from '../services/conversation-cache'

export interface Conversation {
  id: string
  title: string
  game_name: string
  game_version: string
  created_at: string
  updated_at: string
}

interface ConversationHistoryProps {
  isOpen: boolean
  onClose: () => void
  onConversationSelect?: (conversation: Conversation) => void
}

export function ConversationHistory({
  isOpen,
  onClose,
  onConversationSelect,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Format date for display
  const formatDate = (dateInput: string) => {
    try {
      let date: Date
      
      // Handle different timestamp formats
      // Check if it's a unix timestamp (all digits)
      if (/^\d+$/.test(dateInput)) {
        const timestamp = parseInt(dateInput, 10)
        // Unix timestamps can be in seconds or milliseconds
        // If less than a reasonable year 2000 timestamp in ms, assume it's seconds
        date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)
      } else {
        // Assume it's an ISO string or other parseable format
        date = new Date(dateInput)
      }
      
      const now = new Date()
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date'
      }
      
      const diffInMs = now.getTime() - date.getTime()
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
      const diffInDays = Math.floor(diffInHours / 24)

      // Show more granular time for recent conversations
      if (diffInMinutes < 1) {
        return 'Just now'
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`
      } else if (diffInDays < 7) {
        return `${diffInDays}d ago`
      } else {
        return date.toLocaleDateString()
      }
    } catch (error) {
      console.error('Error in formatDate:', error)
      return 'Unknown'
    }
  }

  // Fetch conversations when panel opens
  useEffect(() => {
    const fetchConversations = async () => {
      if (!isOpen) {
        // Reset initialization state when panel is closed
        setHasInitialized(false)
        return
      }

      // Check cache first
      const cachedData = conversationCache.getCachedConversationList()
      if (cachedData) {
        setConversations(cachedData.conversations)
        setTotal(cachedData.total)
        setError(null)
        setHasInitialized(true)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const tokens = secureAuth.getCurrentTokens()
        if (!tokens?.access_token) {
          throw new Error('No authentication token available')
        }

        const response: ConversationsResponse = await apiClient.getConversations(tokens.access_token)
        
        // Cache the response
        conversationCache.setCachedConversationList(response)
        
        setConversations(response.conversations)
        setTotal(response.total)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversations'
        setError(errorMessage)
        console.error('Error fetching conversations:', err)
      } finally {
        setIsLoading(false)
        setHasInitialized(true)
      }
    }

    void fetchConversations()
  }, [isOpen])

  const handleConversationClick = (conversation: Conversation) => {
    onConversationSelect?.(conversation)
    onClose()
  }

  const handleDeleteClick = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation() // Prevent conversation selection
    
    try {
      setDeletingId(conversationId)
      setError(null) // Clear any existing errors

      const tokens = secureAuth.getCurrentTokens()
      if (!tokens?.access_token) {
        throw new Error('No authentication token available')
      }

      await apiClient.deleteConversation(conversationId, tokens.access_token)

      // Remove conversation from cache
      conversationCache.removeConversation(conversationId)

      // Remove conversation from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
      setTotal(prev => Math.max(0, prev - 1))

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation'
      setError(errorMessage)
      console.error('Error deleting conversation:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleRetry = () => {
    const refetch = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const tokens = secureAuth.getCurrentTokens()
        if (!tokens?.access_token) {
          throw new Error('No authentication token available')
        }

        const response: ConversationsResponse = await apiClient.getConversations(tokens.access_token)
        
        // Cache the response
        conversationCache.setCachedConversationList(response)
        
        setConversations(response.conversations)
        setTotal(response.total)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversations'
        setError(errorMessage)
        console.error('Error fetching conversations:', err)
      } finally {
        setIsLoading(false)
        setHasInitialized(true)
      }
    }

    void refetch()
  }

  if (!isOpen) return null

  return (
    <InteractiveArea className="w-full">
      <div className="w-full bg-overlay-bg-primary border border-overlay-border-primary rounded-3xl p-4 mt-2 max-h-120 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-overlay-text-primary">
            Conversation History
          </h3>
          <div className="text-xs text-overlay-text-secondary">
            {total > 0 ? `${total} conversation${total === 1 ? '' : 's'}` : ''}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overlay-scrollbar pr-2">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-5 h-5 text-overlay-accent-primary animate-spin mr-2" />
              <span className="text-sm text-overlay-text-muted">Loading conversations...</span>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="w-5 h-5 text-destructive mb-2" />
              <p className="text-sm text-destructive text-center mb-3 max-w-xs">
                {error}
              </p>
              <Button
                onClick={handleRetry}
                variant="gaming"
                size="sm"
                className="px-3 py-1 text-xs h-auto border border-overlay-border-primary hover:border-overlay-accent-primary"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && conversations.length === 0 && hasInitialized && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-overlay-text-muted text-center">
                No conversations yet
              </p>
              <p className="text-xs text-overlay-text-muted text-center mt-1">
                Start a conversation by asking a question!
              </p>
            </div>
          )}

          {/* Conversations List */}
          {!isLoading && !error && conversations.length > 0 && (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="relative">
                  <div
                    onClick={() => {
                      handleConversationClick(conversation)
                    }}
                    className={`p-3 rounded-2xl bg-overlay-bg-secondary border border-transparent hover:border-overlay-accent-primary cursor-pointer transition-all duration-200 group ${
                      deletingId === conversation.id ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-overlay-text-primary truncate group-hover:text-overlay-accent-primary transition-colors">
                          {conversation.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs text-overlay-text-muted">
                            {conversation.game_name}
                            {conversation.game_version && ` v${conversation.game_version}`}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-overlay-text-muted whitespace-nowrap flex items-center">
                          {formatDate(conversation.updated_at)}
                        </div>
                        {/* Delete Button */}
                        {deletingId === conversation.id ? (
                          <div className="flex items-center justify-center w-5 h-5">
                            <Loader className="w-4 h-4 text-overlay-text-muted animate-spin" />
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              void handleDeleteClick(e, conversation.id)
                            }}
                            className="flex items-center justify-center w-5 h-5 hover:bg-destructive/20 hover:text-destructive rounded transition-all duration-200 text-overlay-text-muted"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Close button footer - only show if there are conversations or error */}
        {(conversations.length > 0 || error) && (
          <>
            <div className="border-b border-overlay-border-primary my-3"></div>
            <div className="flex justify-end">
              <Button
                onClick={onClose}
                variant="gaming"
                size="sm"
                className="px-3 py-1 text-xs h-auto border border-overlay-border-primary hover:border-overlay-accent-primary"
              >
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </InteractiveArea>
  )
}
