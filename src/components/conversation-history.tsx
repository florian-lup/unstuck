import { AlertCircle, Loader, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { apiClient, ConversationsResponse } from '../lib/api-client'
import { secureAuth } from '../lib/auth-client'
import { conversationCache } from '../services/conversation-cache'
import { InteractiveArea } from './interactive-area'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export interface Conversation {
  id: string
  title: string
  game_name: string
  game_version: string
  conversation_type: string
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
        const accessToken = await secureAuth.getValidAccessToken()
        if (!accessToken) {
          throw new Error('No authentication token available')
        }

        const response: ConversationsResponse =
          await apiClient.getConversations(accessToken)

        // Cache the response
        conversationCache.setCachedConversationList(response)

        setConversations(response.conversations)
        setTotal(response.total)
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch conversations'
        setError(errorMessage)
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

  const handleDeleteClick = async (
    e: React.MouseEvent,
    conversationId: string
  ) => {
    e.stopPropagation() // Prevent conversation selection

    try {
      setDeletingId(conversationId)
      setError(null) // Clear any existing errors

      const accessToken = await secureAuth.getValidAccessToken()
      if (!accessToken) {
        throw new Error('No authentication token available')
      }

      await apiClient.deleteConversation(conversationId, accessToken)

      // Remove conversation from cache
      conversationCache.removeConversation(conversationId)

      // Remove conversation from local state
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      )
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete conversation'
      setError(errorMessage)
    } finally {
      setDeletingId(null)
    }
  }

  const handleRetry = () => {
    const refetch = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const accessToken = await secureAuth.getValidAccessToken()
        if (!accessToken) {
          throw new Error('No authentication token available')
        }

        const response: ConversationsResponse =
          await apiClient.getConversations(accessToken)

        // Cache the response
        conversationCache.setCachedConversationList(response)

        setConversations(response.conversations)
        setTotal(response.total)
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch conversations'
        setError(errorMessage)
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
              <span className="text-sm text-overlay-text-muted">
                Loading conversations...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="w-5 h-5 text-overlay-accent-error mb-2" />
              <p className="text-sm text-overlay-accent-error text-center mb-3 max-w-xs">
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
          {!isLoading &&
            !error &&
            conversations.length === 0 &&
            hasInitialized && (
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
                      deletingId === conversation.id
                        ? 'opacity-50 pointer-events-none'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-overlay-text-primary truncate group-hover:text-overlay-accent-primary transition-colors">
                          {conversation.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-overlay-text-secondary">
                            {conversation.game_name}
                            {conversation.game_version &&
                              ` v${conversation.game_version}`}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs text-overlay-text-secondary"
                          >
                            {conversation.conversation_type}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-overlay-text-muted whitespace-nowrap flex items-center">
                          {new Date(
                            conversation.created_at
                          ).toLocaleDateString()}
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
                            className="flex items-center justify-center w-5 h-5 hover:bg-overlay-accent-error/20 hover:text-overlay-accent-error rounded text-overlay-text-muted"
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
