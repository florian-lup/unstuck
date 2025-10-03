/**
 * Token Management Service
 * Handles token refresh, validation, and rate limiting
 */
import { Auth0Config } from '../../config/auth.config'

export interface Auth0Tokens {
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_at: number
  token_type: string
  scope?: string
}

export class TokenManager {
  private config: Auth0Config
  private domain: string
  private clientId: string
  private audience?: string
  private refreshAttempts = new Map<
    string,
    { count: number; lastAttempt: number }
  >()

  constructor(
    config: Auth0Config,
    domain: string,
    clientId: string,
    audience?: string
  ) {
    this.config = config
    this.domain = domain
    this.clientId = clientId
    this.audience = audience
  }

  // Configurable constants
  private get REFRESH_RATE_LIMIT() {
    return this.config.rateLimiting.maxRefreshAttempts
  }
  private get REFRESH_RATE_WINDOW() {
    return this.config.rateLimiting.refreshWindowMinutes * 60000
  }
  private get MIN_TOKEN_VALIDITY_BUFFER() {
    return this.config.tokenManagement.minValidityBufferMinutes * 60000
  }
  private get REFRESH_TIMEOUT_SECONDS() {
    return this.config.tokenManagement.refreshTimeoutSeconds
  }
  private get USER_AGENT() {
    return this.config.appInfo.userAgent
  }

  /**
   * Check if tokens are expired (with security buffer)
   */
  isTokenExpired(tokens: Auth0Tokens): boolean {
    return tokens.expires_at < Date.now() + this.MIN_TOKEN_VALIDITY_BUFFER
  }

  /**
   * Refresh access tokens using refresh token
   */
  async refreshTokens(currentTokens: Auth0Tokens): Promise<Auth0Tokens> {
    // 1. Basic validation
    if (!currentTokens.refresh_token) {
      throw new Error('No refresh token available')
    }

    // 2. Token expiry validation with buffer
    const now = Date.now()
    const tokenExpiry = currentTokens.expires_at

    // Don't refresh if token is still valid with sufficient buffer
    if (tokenExpiry && tokenExpiry > now + this.MIN_TOKEN_VALIDITY_BUFFER) {
      throw new Error('Token refresh not needed - token still valid')
    }

    // Don't refresh if token is already expired for too long (potential replay attack)
    if (tokenExpiry && tokenExpiry < now - this.REFRESH_RATE_WINDOW) {
      throw new Error('Token expired too long ago - re-authentication required')
    }

    // 3. Rate limiting validation
    const refreshKey = currentTokens.refresh_token
    this.validateRefreshRateLimit(refreshKey)

    // 4. Domain validation (ensure we're still talking to the right Auth0 tenant)
    if (this.config.security.validateDomainOnRefresh) {
      if (
        !this.domain ||
        (!this.domain.includes('.auth0.com') &&
          !this.domain.includes('.us.auth0.com') &&
          !this.domain.includes('auth.unstuck.gg'))
      ) {
        throw new Error('Invalid Auth0 domain for token refresh')
      }
    }

    const tokenEndpoint = `${this.domain}/oauth/token`

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: currentTokens.refresh_token,
    })

    if (this.audience) {
      body.append('audience', this.audience)
    }

    let response: Response
    try {
      response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.USER_AGENT,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(this.REFRESH_TIMEOUT_SECONDS * 1000),
      })
    } catch (error) {
      this.recordRefreshAttempt(refreshKey)
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Token refresh request timed out')
      }
      throw new Error(
        `Token refresh network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    // 5. Enhanced error handling with specific error codes
    if (!response.ok) {
      this.recordRefreshAttempt(refreshKey)

      let errorData: { error?: string; error_description?: string } = {}
      try {
        errorData = (await response.json()) as {
          error?: string
          error_description?: string
        }
      } catch {
        errorData = { error: response.statusText }
      }

      // Handle specific Auth0 error codes
      if (errorData.error === 'invalid_grant') {
        throw new Error('Refresh token invalid - re-authentication required')
      }

      if (errorData.error === 'invalid_client') {
        throw new Error(
          'Invalid client credentials - check Auth0 configuration'
        )
      }

      throw new Error(
        `Token refresh failed: ${errorData.error_description ?? errorData.error ?? 'Unknown error'}`
      )
    }

    let data: {
      access_token?: string
      refresh_token?: string
      id_token?: string
      expires_in?: number
      token_type?: string
      scope?: string
    }
    try {
      data = (await response.json()) as typeof data
    } catch {
      this.recordRefreshAttempt(refreshKey)
      throw new Error('Invalid response format from token endpoint')
    }

    // 6. Validate response data
    if (!data.access_token || !data.expires_in) {
      this.recordRefreshAttempt(refreshKey)
      throw new Error('Invalid token response - missing required fields')
    }

    // 7. Validate token expiry is reasonable
    const newExpiry = now + data.expires_in * 1000
    const maxValidityMs =
      this.config.tokenManagement.maxTokenValidityHours * 60 * 60 * 1000
    if (newExpiry <= now || newExpiry > now + maxValidityMs) {
      throw new Error(
        `Invalid token expiry in response (max allowed: ${this.config.tokenManagement.maxTokenValidityHours} hours)`
      )
    }

    const newTokens: Auth0Tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? currentTokens.refresh_token,
      id_token: data.id_token,
      expires_at: newExpiry,
      token_type: data.token_type ?? 'Bearer',
      scope: data.scope,
    }

    // Clear rate limiting on successful refresh
    this.clearRefreshAttempts(refreshKey)

    return newTokens
  }

  /**
   * Validate rate limiting for token refresh attempts
   */
  private validateRefreshRateLimit(refreshToken: string): void {
    const now = Date.now()
    const attempt = this.refreshAttempts.get(refreshToken)

    if (!attempt) {
      return // First attempt
    }

    // Clean up old attempts outside the window
    if (now - attempt.lastAttempt > this.REFRESH_RATE_WINDOW) {
      this.refreshAttempts.delete(refreshToken)
      return
    }

    // Check rate limit
    if (attempt.count >= this.REFRESH_RATE_LIMIT) {
      throw new Error(
        `Too many token refresh attempts. Please wait ${Math.ceil(this.REFRESH_RATE_WINDOW / 60000)} minutes.`
      )
    }
  }

  /**
   * Record a failed refresh attempt
   */
  private recordRefreshAttempt(refreshToken: string): void {
    const now = Date.now()
    const attempt = this.refreshAttempts.get(refreshToken)

    if (!attempt || now - attempt.lastAttempt > this.REFRESH_RATE_WINDOW) {
      this.refreshAttempts.set(refreshToken, { count: 1, lastAttempt: now })
    } else {
      attempt.count++
      attempt.lastAttempt = now
    }
  }

  /**
   * Clear refresh attempts on successful refresh
   */
  private clearRefreshAttempts(refreshToken: string): void {
    this.refreshAttempts.delete(refreshToken)
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string): Promise<void> {
    const revokeEndpoint = `${this.domain}/oauth/revoke`

    const body = new URLSearchParams({
      client_id: this.clientId,
      token,
    })

    await fetch(revokeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
  }
}
