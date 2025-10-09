/**
 * Chat Service - Manages conversation state and API interactions
 * Handles conversation IDs, message history, and API calls
 */

import type { Message } from '../components/gaming-chat'
import {
  apiClient,
  type GamingChatRequest,
  SubscriptionError,
} from './api-client'
import { secureAuth } from './auth-client'
import type { Game } from './games'

export interface ConversationState {
  conversationId?: string
  messages: Message[]
  isLoading: boolean
  error?: string
}

export class ChatService {
  private conversationId?: string
  private isLoading = false

  /**
   * Helper method to create error response messages
   */
  private createErrorResponse(
    error: unknown,
    userMessageContent: string
  ): {
    userMessage: Message
    assistantMessage: Message
    conversationId: string
  } {
    // Create error message for display
    let errorMessage = 'Unknown error occurred'

    // Check if it's a subscription error (no prefix needed, message is already formatted)
    if (error instanceof SubscriptionError) {
      errorMessage = error.message
    } else if (error instanceof Error) {
      errorMessage = `Sorry, I encountered an error: ${error.message}`
    } else {
      errorMessage = 'Sorry, I encountered an error: Unknown error occurred'
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      content: userMessageContent,
      role: 'user',
      timestamp: new Date(),
    }

    const assistantMessage: Message = {
      id: `${Date.now()}-error`,
      content: errorMessage,
      role: 'assistant',
      timestamp: new Date(),
    }

    return {
      userMessage,
      assistantMessage,
      conversationId: this.conversationId ?? '',
    }
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    message: string,
    selectedGame?: Game | null
  ): Promise<{
    userMessage: Message
    assistantMessage: Message
    conversationId: string
  }> {
    // Set loading state
    this.isLoading = true

    try {
      // Get access token - use smart token method to avoid rate limits
      const accessToken = await secureAuth.getValidAccessToken()

      if (!accessToken) {
        throw new Error('Please sign in to continue.')
      }

      // Create user message
      const userMessage: Message = {
        id: `${Date.now()}-user`,
        content: message,
        role: 'user',
        timestamp: new Date(),
      }

      // Check if a game is selected (required for API)
      if (!selectedGame) {
        throw new Error('Please select a game before sending a message.')
      }

      // Prepare API request
      const request: GamingChatRequest = {
        query: message,
        game: selectedGame.gameName,
        ...(selectedGame.version && { version: selectedGame.version }),
        ...(this.conversationId && { conversation_id: this.conversationId }),
      }

      // Make API call
      const response = await apiClient.GamingChatQuerie(request, accessToken)

      // Update conversation ID
      this.conversationId = response.conversation_id

      // Create assistant message
      const assistantMessage: Message = {
        id: response.id,
        content: response.content,
        role: 'assistant',
        timestamp: new Date(response.created * 1000), // Convert Unix timestamp to Date
        remainingRequests: response.request_limit_info.remaining_requests,
      }

      return {
        userMessage,
        assistantMessage,
        conversationId: response.conversation_id,
      }
    } catch (error) {
      return this.createErrorResponse(error, message)
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Start a new conversation
   */
  startNewConversation(): void {
    this.conversationId = undefined
  }

  /**
   * Get current conversation ID
   */
  getCurrentConversationId(): string | undefined {
    return this.conversationId
  }

  /**
   * Set conversation ID (useful for restoring conversations)
   */
  setConversationId(conversationId: string): void {
    this.conversationId = conversationId
  }

  /**
   * Check if currently loading
   */
  getIsLoading(): boolean {
    return this.isLoading
  }

  /**
   * Check if we have a token to send (basic client check)
   */
  async hasToken(): Promise<boolean> {
    try {
      const accessToken = await secureAuth.getValidAccessToken()
      return Boolean(accessToken)
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const chatService = new ChatService()
