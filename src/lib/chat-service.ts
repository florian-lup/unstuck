/**
 * Chat Service - Manages conversation state and API interactions
 * Handles conversation IDs, message history, and API calls
 */

import { apiClient, type GamingSearchRequest } from './api-client'
import { secureAuth } from './auth-client'
import type { Message } from '../components/text-chat'
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
      // Get access token - just check if we have one to send
      const tokens = secureAuth.getCurrentTokens()
      
      if (!tokens?.access_token) {
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
      const request: GamingSearchRequest = {
        query: message,
        game: selectedGame.gameName,
        ...(selectedGame.version && { version: selectedGame.version }),
        ...(this.conversationId && { conversation_id: this.conversationId }),
      }

      // Make API call
      const response = await apiClient.searchGaming(request, tokens.access_token)

      // Update conversation ID
      this.conversationId = response.conversation_id

      // Create assistant message
      const assistantMessage: Message = {
        id: response.id,
        content: response.content,
        role: 'assistant',
        timestamp: new Date(response.created * 1000), // Convert Unix timestamp to Date
      }

      return {
        userMessage,
        assistantMessage,
        conversationId: response.conversation_id,
      }
    } catch (error) {
      // Create error message for display
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      const userMessage: Message = {
        id: `${Date.now()}-user`,
        content: message,
        role: 'user',
        timestamp: new Date(),
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-error`,
        content: `Sorry, I encountered an error: ${errorMessage}`,
        role: 'assistant',
        timestamp: new Date(),
      }

      return {
        userMessage,
        assistantMessage,
        conversationId: this.conversationId ?? '',
      }
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
  hasToken(): boolean {
    const tokens = secureAuth.getCurrentTokens()
    return Boolean(tokens?.access_token)
  }
}

// Export singleton instance
export const chatService = new ChatService()
