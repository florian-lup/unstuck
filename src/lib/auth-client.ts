/**
 * Secure Auth Client - Renderer Process
 * Uses IPC to communicate with main process for Auth0 authentication
 */

export interface AuthUser {
  sub: string
  email?: string
  name?: string
  nickname?: string
  picture?: string
  email_verified?: boolean
  [key: string]: unknown
}

export interface AuthTokens {
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_at: number
  token_type: string
  scope?: string
}

export interface AuthSession {
  user: AuthUser
  tokens: AuthTokens
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'ERROR'

export class SecureAuthClient {
  private listeners = new Set<
    (event: AuthEvent, session: AuthSession | null, error?: string) => void
  >()
  private user: AuthUser | null = null
  private session: AuthSession | null = null
  private pendingSessionRequest: Promise<{
    user: AuthUser | null
    session: AuthSession | null
    tokens: AuthTokens | null
  }> | null = null

  constructor() {
    this.setupIpcListeners()
  }

  /**
   * Start Auth0 Device Authorization Flow
   */
  async startAuthFlow(): Promise<{
    device_code: string
    user_code: string
    verification_uri: string
    expires_in: number
  }> {
    if (!window.electronAPI?.auth) {
      throw new Error('Auth API not available')
    }

    const result = await window.electronAPI.auth.startAuthFlow()
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to start authentication flow')
    }

    if (
      !result.device_code ||
      !result.user_code ||
      !result.verification_uri ||
      !result.expires_in
    ) {
      throw new Error('Invalid device authorization response')
    }

    return {
      device_code: result.device_code,
      user_code: result.user_code,
      verification_uri: result.verification_uri,
      expires_in: result.expires_in,
    }
  }

  /**
   * Get current session with request deduplication
   * If multiple calls happen simultaneously, they share the same IPC request
   */
  async getSession(): Promise<{
    user: AuthUser | null
    session: AuthSession | null
    tokens: AuthTokens | null
  }> {
    // If there's already a pending request, return it
    // This prevents multiple simultaneous IPC calls (React Strict Mode protection)
    if (this.pendingSessionRequest) {
      return this.pendingSessionRequest
    }

    // Create new request
    this.pendingSessionRequest = this.fetchSession()
    
    try {
      const result = await this.pendingSessionRequest
      return result
    } finally {
      // Clear pending request after completion (success or error)
      this.pendingSessionRequest = null
    }
  }

  /**
   * Internal method to actually fetch the session from IPC
   */
  private async fetchSession(): Promise<{
    user: AuthUser | null
    session: AuthSession | null
    tokens: AuthTokens | null
  }> {
    if (!window.electronAPI?.auth) {
      throw new Error('Auth API not available')
    }

    const result = await window.electronAPI.auth.getSession()
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to get session')
    }

    this.user =
      result.user && typeof result.user === 'object' && 'sub' in result.user
        ? (result.user as AuthUser)
        : null
    this.session =
      result.session &&
      typeof result.session === 'object' &&
      'user' in result.session &&
      'tokens' in result.session
        ? (result.session as AuthSession)
        : null

    return {
      user: this.user,
      session: this.session,
      tokens:
        result.tokens &&
        typeof result.tokens === 'object' &&
        'access_token' in result.tokens
          ? (result.tokens as AuthTokens)
          : null,
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    if (!window.electronAPI?.auth) {
      throw new Error('Auth API not available')
    }

    const result = await window.electronAPI.auth.signOut()
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to sign out')
    }

    this.user = null
    this.session = null

    // Notify listeners
    this.notifyListeners('SIGNED_OUT', null)
  }

  /**
   * Check if secure storage is being used
   */
  async isSecureStorage(): Promise<boolean> {
    if (!window.electronAPI?.auth) {
      return false
    }

    return await window.electronAPI.auth.isSecureStorage()
  }

  /**
   * Cancel device authorization flow
   */
  async cancelDeviceFlow(): Promise<void> {
    if (!window.electronAPI?.auth) {
      throw new Error('Auth API not available')
    }

    const result = await window.electronAPI.auth.cancelDeviceFlow()
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to cancel device flow')
    }
  }

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(
    callback: (
      event: AuthEvent,
      session: AuthSession | null,
      error?: string
    ) => void
  ) {
    this.listeners.add(callback)

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.listeners.delete(callback)
      },
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.user
  }

  /**
   * Get current session
   */
  getCurrentSession(): AuthSession | null {
    return this.session
  }

  /**
   * Get current tokens
   */
  getCurrentTokens(): AuthTokens | null {
    return this.session?.tokens ?? null
  }

  /**
   * Get valid access token - uses cached tokens if valid, refreshes if needed
   * This reduces IPC calls and avoids rate limiting
   */
  async getValidAccessToken(): Promise<string | null> {
    // First try cached tokens
    const cachedTokens = this.getCurrentTokens()
    if (cachedTokens?.access_token) {
      // Check if token is still valid (simple expiration check)
      // If we have an expires_at field, check it; otherwise assume it's valid for a short time
      if (cachedTokens.expires_at) {
        const now = Math.floor(Date.now() / 1000)
        const bufferTime = 300 // 5 minute buffer
        if (cachedTokens.expires_at > now + bufferTime) {
          // Token is still valid
          return cachedTokens.access_token
        }
      } else {
        // No expiration info, assume valid for recent tokens
        return cachedTokens.access_token
      }
    }

    // Cached tokens are expired or missing, get fresh session
    try {
      const sessionData = await this.getSession()
      return sessionData.tokens?.access_token ?? null
    } catch {
      return null
    }
  }

  private setupIpcListeners() {
    if (!window.electronAPI?.auth) {
      return
    }

    // Listen for successful authentication from main process
    window.electronAPI.auth.onAuthSuccess((session: unknown) => {
      if (
        session &&
        typeof session === 'object' &&
        'user' in session &&
        'tokens' in session
      ) {
        const authSession = session as AuthSession
        this.user = authSession.user
        this.session = authSession
        this.notifyListeners('SIGNED_IN', authSession)
      }
    })

    // Listen for authentication errors
    window.electronAPI.auth.onAuthError((error: string) => {
      this.notifyListeners('ERROR', null, error)
    })

    // Listen for token refresh events
    window.electronAPI.auth.onTokenRefresh?.((session: unknown) => {
      if (
        session &&
        typeof session === 'object' &&
        'user' in session &&
        'tokens' in session
      ) {
        const authSession = session as AuthSession
        this.session = authSession
        this.notifyListeners('TOKEN_REFRESHED', authSession)
      }
    })
  }

  private notifyListeners(
    event: AuthEvent,
    session: AuthSession | null,
    error?: string
  ) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, session, error)
      } catch {
        // Auth listener error
      }
    })
  }

  /**
   * Cleanup listeners when component unmounts
   */
  cleanup() {
    if (window.electronAPI?.auth) {
      window.electronAPI.auth.removeAuthListeners()
    }
    this.listeners.clear()
    this.pendingSessionRequest = null
  }
}

// Export singleton instance
export const secureAuth = new SecureAuthClient()
