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
   * Get current session
   */
  async getSession(): Promise<{
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

    this.user = result.user ?? null
    this.session = result.session ?? null

    return {
      user: this.user,
      session: this.session,
      tokens: result.tokens ?? null,
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

  private setupIpcListeners() {
    if (!window.electronAPI?.auth) {
      console.warn('Auth API not available, skipping IPC listeners')
      return
    }

    // Listen for successful authentication from main process
    window.electronAPI.auth.onAuthSuccess((session: AuthSession) => {
      this.user = session.user
      this.session = session
      this.notifyListeners('SIGNED_IN', session)
    })

    // Listen for authentication errors
    window.electronAPI.auth.onAuthError((error: string) => {
      console.error('Authentication error:', error)
      this.notifyListeners('ERROR', null, error)
    })

    // Listen for token refresh events
    window.electronAPI.auth.onTokenRefresh?.((session: AuthSession) => {
      this.session = session
      this.notifyListeners('TOKEN_REFRESHED', session)
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
      } catch (err) {
        console.error('Auth listener error:', err)
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
  }
}

// Export singleton instance
export const secureAuth = new SecureAuthClient()
