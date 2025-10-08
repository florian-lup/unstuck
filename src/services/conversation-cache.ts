import { Conversation } from '../components/conversation-history'
import {
  ConversationHistoryResponse,
  ConversationsResponse,
} from '../lib/api-client'

export interface CachedConversationList {
  data: ConversationsResponse
  timestamp: number
}

export interface CachedConversationHistory {
  data: ConversationHistoryResponse
  timestamp: number
}

export class ConversationCacheService {
  private conversationListCache: CachedConversationList | null = null
  private conversationHistoryCache = new Map<
    string,
    CachedConversationHistory
  >()

  // Cache expiry time in milliseconds (1 hour) - only applies to conversation history, not conversation list
  private readonly CACHE_EXPIRY_MS = 60 * 60 * 1000

  /**
   * Get cached conversation list if valid, otherwise return null
   * Note: Conversation list cache does not auto-expire.
   * It only refreshes on:
   * - App startup (no cache exists)
   * - Chat creation (explicit invalidation)
   * - Manual invalidation
   */
  getCachedConversationList(): ConversationsResponse | null {
    if (!this.conversationListCache) {
      return null
    }

    // Return cached data without checking expiry
    // The cache will only be invalidated explicitly
    return this.conversationListCache.data
  }

  /**
   * Cache the conversation list
   */
  setCachedConversationList(data: ConversationsResponse): void {
    this.conversationListCache = {
      data,
      timestamp: Date.now(),
    }
  }

  /**
   * Get cached conversation history if valid, otherwise return null
   */
  getCachedConversationHistory(
    conversationId: string
  ): ConversationHistoryResponse | null {
    const cached = this.conversationHistoryCache.get(conversationId)
    if (!cached) {
      return null
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_EXPIRY_MS) {
      this.conversationHistoryCache.delete(conversationId)
      return null
    }

    return cached.data
  }

  /**
   * Cache conversation history
   */
  setCachedConversationHistory(
    conversationId: string,
    data: ConversationHistoryResponse
  ): void {
    this.conversationHistoryCache.set(conversationId, {
      data,
      timestamp: Date.now(),
    })
  }

  /**
   * Invalidate conversation list cache (call when new conversation is created)
   */
  invalidateConversationList(): void {
    this.conversationListCache = null
  }

  /**
   * Invalidate specific conversation history cache
   */
  invalidateConversationHistory(conversationId: string): void {
    this.conversationHistoryCache.delete(conversationId)
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    this.conversationListCache = null
    this.conversationHistoryCache.clear()
  }

  /**
   * Remove a conversation from cache when it's deleted
   */
  removeConversation(conversationId: string): void {
    // Remove from history cache
    this.conversationHistoryCache.delete(conversationId)

    // Update conversation list cache if it exists
    if (this.conversationListCache) {
      const updatedConversations =
        this.conversationListCache.data.conversations.filter(
          (conv) => conv.id !== conversationId
        )

      this.conversationListCache = {
        data: {
          conversations: updatedConversations,
          total: Math.max(0, this.conversationListCache.data.total - 1),
        },
        timestamp: this.conversationListCache.timestamp,
      }
    }
  }

  /**
   * Add a new conversation to the cache (when created)
   */
  addConversationToCache(conversation: Conversation): void {
    if (this.conversationListCache) {
      // Add to the beginning of the list (most recent first)
      const updatedConversations = [
        conversation,
        ...this.conversationListCache.data.conversations,
      ]

      this.conversationListCache = {
        data: {
          conversations: updatedConversations,
          total: this.conversationListCache.data.total + 1,
        },
        timestamp: this.conversationListCache.timestamp,
      }
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    conversationListCached: boolean
    conversationHistoryCacheSize: number
    conversationListAge?: number
  } {
    return {
      conversationListCached: !!this.conversationListCache,
      conversationHistoryCacheSize: this.conversationHistoryCache.size,
      conversationListAge: this.conversationListCache
        ? Date.now() - this.conversationListCache.timestamp
        : undefined,
    }
  }
}

// Create a singleton instance
export const conversationCache = new ConversationCacheService()
