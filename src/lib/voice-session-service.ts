/**
 * Voice Session Service
 * Handles getting ephemeral tokens from the backend for OpenAI Realtime API
 */

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

export class VoiceSessionService {
  private readonly baseUrl =
    'https://unstuck-backend-production-d9c1.up.railway.app/api/v1'
  private readonly endpoint = '/voice/session'
  private readonly timeout = 15000 // 15 seconds

  /**
   * Fetch with timeout support
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
   * Get a voice session with ephemeral token from the backend
   */
  async createVoiceSession(
    request: VoiceSessionRequest,
    accessToken: string
  ): Promise<VoiceSessionResponse> {
    const url = `${this.baseUrl}${this.endpoint}`

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
        this.timeout
      )

      // Handle non-200 responses
      if (!response.ok) {
        // Try to parse error response
        let errorData: VoiceSessionError | null = null
        try {
          errorData = (await response.json()) as VoiceSessionError
        } catch {
          // If JSON parsing fails, use status text
          throw new Error(`Request failed: ${response.statusText}`)
        }

        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (response.status === 403) {
          throw new Error(errorData.message || 'Access denied.')
        } else if (response.status === 429) {
          throw new Error(
            errorData.message ||
              'Rate limit exceeded. Please wait a moment and try again.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(errorData.message || 'Failed to create voice session')
        }
      }

      // Parse and validate the successful response
      try {
        const data = (await response.json()) as VoiceSessionResponse

        // Basic validation of required fields
        if (
          !data.client_secret ||
          !data.ephemeral_key_id ||
          !data.websocket_url ||
          !data.model
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
}

// Export singleton instance
export const voiceSessionService = new VoiceSessionService()

