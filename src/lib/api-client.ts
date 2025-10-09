/**
 * API Client for Gaming Search Functionality
 * Handles communication with the Unstuck backend API
 */

export interface GamingChatRequest {
  query: string
  game: string
  version?: string
  conversation_id?: string
}

export interface GamingChatResponse {
  id: string
  conversation_id: string
  model: string
  created: number
  content: string
  search_results: {
    title: string
    url: string
    date: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finish_reason: string
  request_limit_info: {
    remaining_requests: number
  }
}

export interface ApiErrorResponse {
  error: string
  message: string
  request_id: string
  // Some endpoints return nested error details
  detail?: {
    error: string
    message: string
    feature?: string
    current_tier?: string
    upgrade_required?: boolean
  }
}

// Custom error class for subscription-related errors
// These errors have pre-formatted messages from the backend
export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubscriptionError'
  }
}

export interface ConversationsResponse {
  conversations: {
    id: string
    title: string
    game_name: string
    game_version: string
    conversation_type: string
    created_at: string
    updated_at: string
  }[]
  total: number
}

export interface ConversationHistoryResponse {
  conversation_id: string
  messages: {
    role: 'user' | 'assistant'
    content: string
  }[]
  created_at: number
  updated_at: number
}

export interface CreateCheckoutSessionResponse {
  checkout_url: string
  session_id: string
}

export interface SubscriptionStatusResponse {
  subscription_tier: string
  subscription_status: string | null
  stripe_customer_id: string | null
}

export interface CancelSubscriptionResponse {
  success: boolean
  message: string
}

export interface VoiceSessionRequest {
  game: string | null
}

export interface VoiceSessionResponse {
  client_secret: string
  ephemeral_key_id: string
  model: string
  expires_at: number
  websocket_url: string
  connection_instructions: {
    url: string
    auth_header: string
    protocol: string
    expires_in_seconds: string
    note: string
  }
}

export interface VoiceSessionError {
  error: string
  message: string
  request_id: string
}

export class ApiClient {
  private readonly baseUrl =
    'https://unstuck-backend-production-d9c1.up.railway.app/api/v1'
  private readonly endpoints = {
    gamingSearch: '/gaming/chat',
    conversations: '/gaming/conversations',
    subscriptionCheckout: '/subscription/create-checkout-session',
    subscriptionStatus: '/subscription/status',
    subscriptionCancel: '/subscription/cancel',
    voiceSession: '/voice/session',
  } as const

  // Timeout configurations (in milliseconds)
  private readonly timeouts = {
    aiRequests: 120000, // 2 minutes for AI-powered requests (chat)
    stripeRequests: 300000, // 5 minutes for Stripe operations (checkout, subscription)
    standardRequests: 30000, // 30 seconds for standard API requests
    quickRequests: 15000, // 15 seconds for quick operations
  } as const

  /**
   * Fetch with timeout support
   * @param url - The URL to fetch
   * @param options - Fetch options
   * @param timeoutMs - Timeout in milliseconds
   * @returns Response promise
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      return response
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          'Request timed out. Please check your internet connection and try again.'
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Send a gaming search request to the API
   */
  async GamingChatQuerie(
    request: GamingChatRequest,
    accessToken: string
  ): Promise<GamingChatResponse> {
    const url = `${this.baseUrl}${this.endpoints.gamingSearch}`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
        this.timeouts.aiRequests
      )

      // Handle non-200 responses
      if (!response.ok) {
        // Try to parse error response
        let errorData: ApiErrorResponse | null = null
        try {
          errorData = (await response.json()) as ApiErrorResponse
        } catch {
          // If JSON parsing fails, use status text
          throw new Error(`Request failed: ${response.statusText}`)
        }

        // Extract message from either flat or nested structure
        const message = errorData.detail?.message ?? errorData.message

        // Check if it's a subscription error - if so, throw as SubscriptionError
        const errorCode = errorData.detail?.error ?? errorData.error
        if (
          errorCode === 'feature_access_denied' ||
          errorCode === 'request_limit_exceeded' ||
          errorCode === 'monthly_request_limit_exceeded'
        ) {
          throw new SubscriptionError(message)
        }

        // For other errors, throw as regular Error
        throw new Error(message)
      }

      // Parse and validate the successful response
      try {
        const data = (await response.json()) as GamingChatResponse

        // Basic validation of required fields
        if (!data.id || !data.conversation_id || !data.content) {
          throw new Error('Invalid response format from server')
        }

        return data
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to parse server response')
      }
    } catch (networkError) {
      // Check if it's a fetch error (network issues)
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }

      // Re-throw other errors
      throw networkError
    }
  }

  /**
   * Fetch user's conversations from the API
   */
  async getConversations(accessToken: string): Promise<ConversationsResponse> {
    const url = `${this.baseUrl}${this.endpoints.conversations}`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
        this.timeouts.standardRequests
      )

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = 'Failed to fetch conversations'
        let errorType = 'fetch_error'
        let requestId = ''

        try {
          const errorData = (await response.json()) as ApiErrorResponse
          errorMessage = errorData.message || errorMessage
          errorType = errorData.error || errorType
          requestId = errorData.request_id || ''
        } catch {
          // If we can't parse the error response, use status text
          errorMessage = response.statusText || `HTTP ${response.status}`
        }

        // Create a more descriptive error based on status code
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your permissions.')
        } else if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(
            `${errorType}: ${errorMessage}${requestId ? ` (Request ID: ${requestId})` : ''}`
          )
        }
      }

      // Parse and validate the successful response
      try {
        const data = (await response.json()) as ConversationsResponse

        // Basic validation of required fields
        if (
          !Array.isArray(data.conversations) ||
          typeof data.total !== 'number'
        ) {
          throw new Error('Invalid response format from server')
        }

        return data
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to parse server response')
      }
    } catch (networkError) {
      // Check if it's a fetch error (network issues)
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }

      // Re-throw other errors
      throw networkError
    }
  }

  /**
   * Get conversation history including all messages
   */
  async getConversationHistory(
    conversationId: string,
    accessToken: string
  ): Promise<ConversationHistoryResponse> {
    const url = `${this.baseUrl}/gaming/conversations/${conversationId}/history`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
        this.timeouts.standardRequests
      )

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = 'Failed to fetch conversation history'
        let errorType = 'fetch_error'
        let requestId = ''

        try {
          const errorData = (await response.json()) as ApiErrorResponse
          errorMessage = errorData.message || errorMessage
          errorType = errorData.error || errorType
          requestId = errorData.request_id || ''
        } catch {
          // If we can't parse the error response, use status text
          errorMessage = response.statusText || `HTTP ${response.status}`
        }

        // Create a more descriptive error based on status code
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your permissions.')
        } else if (response.status === 404) {
          throw new Error('Conversation not found.')
        } else if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(
            `${errorType}: ${errorMessage}${requestId ? ` (Request ID: ${requestId})` : ''}`
          )
        }
      }

      // Parse and validate the successful response
      try {
        const data = (await response.json()) as ConversationHistoryResponse

        // Basic validation of required fields
        if (!data.conversation_id || !Array.isArray(data.messages)) {
          throw new Error('Invalid response format from server')
        }

        return data
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('Failed to parse server response')
      }
    } catch (networkError) {
      // Check if it's a fetch error (network issues)
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }

      // Re-throw other errors
      throw networkError
    }
  }

  /**
   * Delete a conversation permanently (⚠️ IRREVERSIBLE!)
   */
  async deleteConversation(
    conversationId: string,
    accessToken: string
  ): Promise<void> {
    const url = `${this.baseUrl}/gaming/conversations/${conversationId}`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
        this.timeouts.quickRequests
      )

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = 'Failed to delete conversation'
        let errorType = 'delete_error'
        let requestId = ''

        try {
          const errorData = (await response.json()) as ApiErrorResponse
          errorMessage = errorData.message || errorMessage
          errorType = errorData.error || errorType
          requestId = errorData.request_id || ''
        } catch {
          // If we can't parse the error response, use status text
          errorMessage = response.statusText || `HTTP ${response.status}`
        }

        // Create a more descriptive error based on status code
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error(
            'Access denied. You do not have permission to delete this conversation.'
          )
        } else if (response.status === 404) {
          throw new Error('Conversation not found or has already been deleted.')
        } else if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(
            `${errorType}: ${errorMessage}${requestId ? ` (Request ID: ${requestId})` : ''}`
          )
        }
      }

      // Success - no response body expected for DELETE
    } catch (networkError) {
      // Check if it's a fetch error (network issues)
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }

      // Re-throw other errors
      throw networkError
    }
  }

  /**
   * Create a Stripe checkout session for subscription upgrade
   */
  async createCheckoutSession(
    accessToken: string
  ): Promise<CreateCheckoutSessionResponse> {
    const url = `${this.baseUrl}${this.endpoints.subscriptionCheckout}`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        this.timeouts.stripeRequests
      )

      if (!response.ok) {
        let errorMessage = 'Failed to create checkout session'
        let errorType = 'checkout_error'

        try {
          const errorData = (await response.json()) as ApiErrorResponse
          errorMessage = errorData.message || errorMessage
          errorType = errorData.error || errorType
        } catch {
          errorMessage = response.statusText || `HTTP ${response.status}`
        }

        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your permissions.')
        } else if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(`${errorType}: ${errorMessage}`)
        }
      }

      const data = (await response.json()) as CreateCheckoutSessionResponse

      if (!data.checkout_url || !data.session_id) {
        throw new Error('Invalid checkout session response from server')
      }

      return data
    } catch (networkError) {
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }
      throw networkError
    }
  }

  /**
   * Get the current user's subscription status
   */
  async getSubscriptionStatus(
    accessToken: string
  ): Promise<SubscriptionStatusResponse> {
    const url = `${this.baseUrl}${this.endpoints.subscriptionStatus}`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
        this.timeouts.quickRequests
      )

      if (!response.ok) {
        let errorMessage = 'Failed to fetch subscription status'
        let errorType = 'status_error'

        try {
          const errorData = (await response.json()) as ApiErrorResponse
          errorMessage = errorData.message || errorMessage
          errorType = errorData.error || errorType
        } catch {
          errorMessage = response.statusText || `HTTP ${response.status}`
        }

        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your permissions.')
        } else if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(`${errorType}: ${errorMessage}`)
        }
      }

      const data = (await response.json()) as SubscriptionStatusResponse

      // Validate that required fields exist (subscription_status and stripe_customer_id can be null)
      if (
        !data.subscription_tier ||
        typeof data.subscription_tier !== 'string'
      ) {
        throw new Error('Invalid subscription status response from server')
      }

      return data
    } catch (networkError) {
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }
      throw networkError
    }
  }

  /**
   * Cancel the user's subscription
   */
  async cancelSubscription(
    accessToken: string
  ): Promise<CancelSubscriptionResponse> {
    const url = `${this.baseUrl}${this.endpoints.subscriptionCancel}`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        this.timeouts.stripeRequests
      )

      if (!response.ok) {
        let errorMessage = 'Failed to cancel subscription'
        let errorType = 'cancel_error'

        try {
          const errorData = (await response.json()) as ApiErrorResponse
          errorMessage = errorData.message || errorMessage
          errorType = errorData.error || errorType
        } catch {
          errorMessage = response.statusText || `HTTP ${response.status}`
        }

        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your permissions.')
        } else if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(`${errorType}: ${errorMessage}`)
        }
      }

      const data = (await response.json()) as CancelSubscriptionResponse

      if (typeof data.success !== 'boolean') {
        throw new Error('Invalid cancellation response from server')
      }

      return data
    } catch (networkError) {
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }
      throw networkError
    }
  }

  /**
   * Create a voice session with ephemeral token
   */
  async createVoiceSession(
    request: VoiceSessionRequest,
    accessToken: string
  ): Promise<VoiceSessionResponse> {
    const url = `${this.baseUrl}${this.endpoints.voiceSession}`

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
        this.timeouts.quickRequests
      )

      if (!response.ok) {
        let errorMessage = 'Failed to create voice session'
        let errorType = 'voice_session_error'

        try {
          const errorData = (await response.json()) as VoiceSessionError
          errorMessage = errorData.message || errorMessage
          errorType = errorData.error || errorType
        } catch {
          errorMessage = response.statusText || `HTTP ${response.status}`
        }

        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error(errorMessage || 'Access denied.')
        } else if (response.status === 429) {
          throw new Error(
            errorMessage ||
              'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(`${errorType}: ${errorMessage}`)
        }
      }

      const data = (await response.json()) as VoiceSessionResponse

      if (
        !data.client_secret ||
        !data.ephemeral_key_id ||
        !data.websocket_url ||
        !data.model
      ) {
        throw new Error('Invalid voice session response from server')
      }

      return data
    } catch (networkError) {
      if (
        networkError instanceof TypeError &&
        networkError.message.includes('fetch')
      ) {
        throw new Error(
          'Connection failed. Please check your internet connection and try again.'
        )
      }
      throw networkError
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
