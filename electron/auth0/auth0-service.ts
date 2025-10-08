/**
 * Refactored Auth0 Authentication Service - Main Process Only
 * Implements PKCE flow with secure token storage for Electron apps
 *
 * This is the main orchestrator that coordinates the various specialized components:
 * - TokenManager: Handles token refresh, validation, rate limiting
 * - SecureStorage: Manages encrypted storage with fallback mechanisms
 * - DeviceFlowManager: Handles OAuth2 Device Authorization Flow
 */
import { Auth0Config } from '../../config/auth.config'
import { TokenManager, Auth0Tokens } from './token-manager'
import { SecureStorage } from './secure-storage'
import {
  DeviceFlowManager,
  DeviceAuthorizationResult,
} from './device-flow-manager'

export interface Auth0User {
  sub: string
  email?: string
  name?: string
  nickname?: string
  picture?: string
  email_verified?: boolean
  [key: string]: unknown
}

export interface Auth0Session {
  user: Auth0User
  tokens: Auth0Tokens
}

export type Auth0Event =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'ERROR'

export class Auth0Service {
  private domain = ''
  private clientId = ''
  private audience?: string
  private scope = 'openid profile email offline_access'

  // Specialized components
  private tokenManager!: TokenManager
  private secureStorage!: SecureStorage
  private deviceFlowManager!: DeviceFlowManager

  // Session state
  private currentSession: Auth0Session | null = null
  private listeners = new Set<
    (event: Auth0Event, session: Auth0Session | null, error?: string) => void
  >()

  /**
   * Initialize Auth0 client configuration and all components
   */
  async initialize(
    domain: string,
    clientId: string,
    config: Auth0Config
  ): Promise<void> {
    if (!domain || !clientId) {
      throw new Error('Missing Auth0 credentials')
    }

    // Validate domain format (supports both standard Auth0 domains and custom domains)
    if (
      !domain.includes('.auth0.com') &&
      !domain.includes('.us.auth0.com') &&
      !domain.includes('auth.unstuck.gg')
    ) {
      throw new Error('Invalid Auth0 domain format')
    }

    this.domain = domain.startsWith('https://') ? domain : `https://${domain}`
    this.clientId = clientId
    this.audience = config.audience
    this.scope = config.scope

    // Initialize specialized components
    this.tokenManager = new TokenManager(
      config,
      this.domain,
      this.clientId,
      this.audience
    )
    this.secureStorage = new SecureStorage()
    this.deviceFlowManager = new DeviceFlowManager(
      config,
      this.domain,
      this.clientId,
      this.audience,
      this.scope
    )

    // Initialize secure storage
    await this.secureStorage.initialize()

    // Set up device flow event handling
    this.deviceFlowManager.setEventCallback((event, tokens, error) => {
      if (event === 'SUCCESS' && tokens) {
        void this.handleDeviceFlowSuccess(tokens)
      } else if (event === 'ERROR') {
        this.notifyListeners('ERROR', null, error)
      }
    })

    // Try to restore existing session
    await this.restoreSession()
  }

  /**
   * Start Device Authorization Flow
   */
  async startDeviceAuthFlow(): Promise<DeviceAuthorizationResult> {
    return await this.deviceFlowManager.startDeviceAuthFlow()
  }

  /**
   * Cancel current device authorization flow
   */
  cancelDeviceAuthorization(): void {
    this.deviceFlowManager.cancelDeviceAuthorization()
  }

  /**
   * Check if user is currently signed in with valid tokens
   */
  isSignedIn(): boolean {
    if (!this.currentSession) return false
    return !this.tokenManager.isTokenExpired(this.currentSession.tokens)
  }

  /**
   * Get current session with automatic token refresh
   */
  async getSession(): Promise<{
    user: Auth0User | null
    tokens: Auth0Tokens | null
  }> {
    if (this.currentSession) {
      // Check if tokens are expired and refresh if needed
      if (this.tokenManager.isTokenExpired(this.currentSession.tokens)) {
        try {
          const refreshedTokens = await this.tokenManager.refreshTokens(
            this.currentSession.tokens
          )
          this.currentSession.tokens = refreshedTokens
          await this.storeSession(this.currentSession)
          this.notifyListeners('TOKEN_REFRESHED', this.currentSession)
        } catch (error) {
          // Handle specific refresh errors that require re-authentication
          if (
            error instanceof Error &&
            (error.message.includes('re-authentication required') ||
              error.message.includes('expired too long ago') ||
              error.message.includes('Too many token refresh attempts'))
          ) {
            await this.signOut()
            return { user: null, tokens: null }
          }
        }
      }

      return {
        user: this.currentSession.user,
        tokens: this.currentSession.tokens,
      }
    }

    return { user: null, tokens: null }
  }

  /**
   * Sign out user and clear all stored tokens
   */
  async signOut(): Promise<void> {
    try {
      // Revoke tokens if available
      if (this.currentSession?.tokens.refresh_token) {
        await this.tokenManager.revokeToken(
          this.currentSession.tokens.refresh_token
        )
      }

      // Clear stored session
      await this.clearSession()
      this.currentSession = null

      // Cancel any ongoing device flow
      this.deviceFlowManager.cancelDeviceAuthorization()

      // Notify listeners
      this.notifyListeners('SIGNED_OUT', null)
    } catch {
      // Still clear local session even if revocation fails
      await this.clearSession()
      this.currentSession = null
      this.notifyListeners('SIGNED_OUT', null)
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(
    callback: (
      event: Auth0Event,
      session: Auth0Session | null,
      error?: string
    ) => void
  ) {
    this.listeners.add(callback)

    return {
      unsubscribe: () => {
        this.listeners.delete(callback)
      },
    }
  }

  /**
   * Check if secure storage is available
   */
  async isSecureStorage(): Promise<boolean> {
    return await this.secureStorage.isSecureStorageAvailable()
  }

  // Private methods

  /**
   * Handle successful device flow completion
   */
  private async handleDeviceFlowSuccess(tokens: Auth0Tokens): Promise<void> {
    try {
      // Get user info
      const user = await this.getUserInfo(tokens.access_token)

      // Create session
      const session: Auth0Session = { user, tokens }

      // Store session securely
      await this.storeSession(session)
      this.currentSession = session

      // Notify listeners
      this.notifyListeners('SIGNED_IN', session)
    } catch {
      this.notifyListeners('ERROR', null, 'Failed to complete authentication')
    }
  }

  /**
   * Get user information from Auth0
   */
  private async getUserInfo(accessToken: string): Promise<Auth0User> {
    const userInfoEndpoint = `${this.domain}/userinfo`

    const response = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`User info request failed: ${response.statusText}`)
    }

    return (await response.json()) as Auth0User
  }

  /**
   * Store session using secure storage
   */
  private async storeSession(session: Auth0Session): Promise<void> {
    await this.secureStorage.setItem('auth0_session', JSON.stringify(session))
  }

  /**
   * Restore session from secure storage
   */
  private async restoreSession(): Promise<void> {
    try {
      const sessionData = await this.secureStorage.getItem('auth0_session')
      if (sessionData) {
        const restoredSession = JSON.parse(sessionData) as Auth0Session

        // Check if the restored tokens are still valid
        if (this.tokenManager.isTokenExpired(restoredSession.tokens)) {
          this.currentSession = restoredSession

          try {
            // Try to refresh the tokens
            const refreshedTokens = await this.tokenManager.refreshTokens(
              restoredSession.tokens
            )
            this.currentSession.tokens = refreshedTokens
            await this.storeSession(this.currentSession)
            this.notifyListeners('SIGNED_IN', this.currentSession)
          } catch {
            await this.clearSession()
            this.currentSession = null
          }
        } else {
          // Tokens are still valid
          this.currentSession = restoredSession
          this.notifyListeners('SIGNED_IN', this.currentSession)
        }
      }
    } catch {
      await this.clearSession()
      this.currentSession = null
    }
  }

  /**
   * Clear session from secure storage
   */
  private async clearSession(): Promise<void> {
    await this.secureStorage.removeItem('auth0_session')
  }

  /**
   * Notify all listeners of auth events
   */
  private notifyListeners(
    event: Auth0Event,
    session: Auth0Session | null,
    error?: string
  ) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, session, error)
      } catch {
        // Silently ignore listener errors
      }
    })
  }
}

// Export both the class and a singleton instance for backward compatibility
export const auth0Service = new Auth0Service()
