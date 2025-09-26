/**
 * API Client for Gaming Search Functionality
 * Handles communication with the Unstuck backend API
 */

export interface GamingSearchRequest {
  query: string
  game: string
  version?: string
  conversation_id?: string
}

export interface GamingSearchResponse {
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
}

export interface ApiErrorResponse {
  error: string
  message: string
  request_id: string
}

export interface ConversationsResponse {
  conversations: {
    id: string
    title: string
    game_name: string
    game_version: string
    created_at: string
    updated_at: string
  }[]
  total: number
}

export class ApiClient {
  private readonly baseUrl = 'https://unstuck-backend-production-d9c1.up.railway.app/api/v1'
  private readonly endpoints = {
    gamingSearch: '/gaming/search',
    conversations: '/gaming/conversations'
  } as const

  /**
   * Send a gaming search request to the API
   */
  async searchGaming(
    request: GamingSearchRequest,
    accessToken: string
  ): Promise<GamingSearchResponse> {
    const url = `${this.baseUrl}${this.endpoints.gamingSearch}`
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = 'Unknown error occurred'
        let errorType = 'unknown_error'
        let requestId = ''

        try {
          const errorData = await response.json() as ApiErrorResponse
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
          throw new Error('Rate limit exceeded. Please wait a moment and try again.')
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(`${errorType}: ${errorMessage}${requestId ? ` (Request ID: ${requestId})` : ''}`)
        }
      }

      // Parse and validate the successful response
      try {
        const data = await response.json() as GamingSearchResponse
        
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
      if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
        throw new Error('Connection failed. Please check your internet connection and try again.')
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
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = 'Failed to fetch conversations'
        let errorType = 'fetch_error'
        let requestId = ''

        try {
          const errorData = await response.json() as ApiErrorResponse
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
          throw new Error('Rate limit exceeded. Please wait a moment and try again.')
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(`${errorType}: ${errorMessage}${requestId ? ` (Request ID: ${requestId})` : ''}`)
        }
      }

      // Parse and validate the successful response
      try {
        const data = await response.json() as ConversationsResponse
        
        // Basic validation of required fields
        if (!Array.isArray(data.conversations) || typeof data.total !== 'number') {
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
      if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
        throw new Error('Connection failed. Please check your internet connection and try again.')
      }
      
      // Re-throw other errors
      throw networkError
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
