/**
 * Secure Auth0 Authentication Service - Main Process Only
 * Implements PKCE flow with secure token storage for Electron apps
 */

// shell import removed as not needed in this service
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface Auth0User {
  sub: string
  email?: string
  name?: string
  nickname?: string
  picture?: string
  email_verified?: boolean
  [key: string]: any
}

export interface Auth0Tokens {
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_at: number
  token_type: string
  scope?: string
}

export interface Auth0Session {
  user: Auth0User
  tokens: Auth0Tokens
}

export type Auth0Event = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'ERROR'

export class Auth0Service {
  private domain: string = ''
  private clientId: string = ''
  private audience?: string
  private secureDir = path.join(os.homedir(), '.unstuck-secure')
  private currentSession: Auth0Session | null = null
  private listeners: Set<(event: Auth0Event, session: Auth0Session | null, error?: string) => void> = new Set()
  private currentPollInterval: NodeJS.Timeout | null = null
  private currentPollTimeout: NodeJS.Timeout | null = null

  /**
   * Initialize Auth0 client configuration
   */
  async initialize(domain: string, clientId: string, audience?: string) {
    if (!domain || !clientId) {
      throw new Error('Missing Auth0 credentials')
    }

    // Validate domain format
    if (!domain.includes('.auth0.com') && !domain.includes('.us.auth0.com')) {
      throw new Error('Invalid Auth0 domain format')
    }

    this.domain = domain.startsWith('https://') ? domain : `https://${domain}`
    this.clientId = clientId
    this.audience = audience

    // Ensure secure directory exists
    await this.ensureSecureDir()
    
    // Try to restore existing session
    await this.restoreSession()
    
    console.log('🔒 Auth0Service initialized in main process')
  }

  /**
   * Start Device Authorization Flow
   */
  async startDeviceAuthFlow(): Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number }> {
    const deviceCodeEndpoint = `${this.domain}/oauth/device/code`
    
    const body = new URLSearchParams({
      client_id: this.clientId,
      scope: 'openid profile email offline_access',
    })

    if (this.audience) {
      body.append('audience', this.audience)
    }

    console.log('🔒 Starting Auth0 Device Authorization Flow')
    console.log('🔑 Domain:', this.domain)
    console.log('🔑 Client ID:', this.clientId)

    const response = await fetch(deviceCodeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Auth0 API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      })
      throw new Error(`Device authorization request failed: ${errorData.error_description || errorData.error || response.statusText}`)
    }

    const deviceData = await response.json()
    
    
    // Start polling for completion
    this.pollForDeviceAuthorization(deviceData.device_code, deviceData.interval || 5)
    
    return {
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      expires_in: deviceData.expires_in || 600,
    }
  }

  /**
   * Cancel current device authorization flow
   */
  cancelDeviceAuthorization(): void {
    console.log('🛑 Canceling device authorization polling')
    if (this.currentPollInterval) {
      clearInterval(this.currentPollInterval)
      this.currentPollInterval = null
    }
    if (this.currentPollTimeout) {
      clearTimeout(this.currentPollTimeout)
      this.currentPollTimeout = null
    }
  }

  /**
   * Poll for device authorization completion
   */
  private async pollForDeviceAuthorization(deviceCode: string, interval: number): Promise<void> {
    const tokenEndpoint = `${this.domain}/oauth/token`
    
    // Cancel any existing polling first
    this.cancelDeviceAuthorization()
    
    this.currentPollInterval = setInterval(async () => {
      try {
        const body = new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
          client_id: this.clientId,
        })

        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        })

        const data = await response.json()

        if (response.ok) {
          // Success! We got tokens
          this.cancelDeviceAuthorization()
          
          const tokens: Auth0Tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            id_token: data.id_token,
            expires_at: Date.now() + (data.expires_in * 1000),
            token_type: data.token_type || 'Bearer',
            scope: data.scope,
          }

          // Get user info
          const user = await this.getUserInfo(tokens.access_token)
          
          // Create session
          const session: Auth0Session = { user, tokens }
          
          // Store session securely
          await this.storeSession(session)
          this.currentSession = session
          
          // Notify listeners
          this.notifyListeners('SIGNED_IN', session)
          
          
        } else if (data.error === 'authorization_pending') {
          // Still waiting for user to authorize
          console.log('⏳ Waiting for user authorization...')
        } else if (data.error === 'slow_down') {
          // Increase polling interval
          this.cancelDeviceAuthorization()
          setTimeout(() => {
            this.pollForDeviceAuthorization(deviceCode, interval + 5)
          }, (interval + 5) * 1000)
        } else if (data.error === 'expired_token') {
          // Device code expired
          this.cancelDeviceAuthorization()
          this.notifyListeners('ERROR', null, 'Device code expired. Please try again.')
        } else if (data.error === 'access_denied') {
          // User denied access
          this.cancelDeviceAuthorization()
          this.notifyListeners('ERROR', null, 'Access denied by user.')
        } else {
          // Other error
          this.cancelDeviceAuthorization()
          this.notifyListeners('ERROR', null, data.error_description || 'Authorization failed')
        }
      } catch (error) {
        console.error('Polling error:', error)
        // Continue polling on network errors
      }
    }, interval * 1000)

    // Stop polling after 10 minutes
    this.currentPollTimeout = setTimeout(() => {
      this.cancelDeviceAuthorization()
      this.notifyListeners('ERROR', null, 'Authorization timeout. Please try again.')
    }, 10 * 60 * 1000)
  }

  // OAuth callback handling removed - not needed for Device Authorization Flow

  /**
   * Get current session
   */
  async getSession(): Promise<{ user: Auth0User | null; tokens: Auth0Tokens | null }> {
    if (this.currentSession) {
      // Check if tokens are expired and refresh if needed
      if (this.isTokenExpired(this.currentSession.tokens)) {
        try {
          await this.refreshTokens()
        } catch (error) {
          console.warn('Token refresh failed:', error)
          await this.signOut()
          return { user: null, tokens: null }
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
        await this.revokeToken(this.currentSession.tokens.refresh_token)
      }
      
      // Clear stored session
      await this.clearSession()
      this.currentSession = null
      
      // Notify listeners
      this.notifyListeners('SIGNED_OUT', null)
      
      console.log('🔒 Successfully signed out')
    } catch (error) {
      console.error('Sign out error:', error)
      // Still clear local session even if revocation fails
      await this.clearSession()
      this.currentSession = null
      this.notifyListeners('SIGNED_OUT', null)
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: Auth0Event, session: Auth0Session | null, error?: string) => void) {
    this.listeners.add(callback)
    
    return {
      unsubscribe: () => {
        this.listeners.delete(callback)
      }
    }
  }

  /**
   * Check if secure storage is available
   */
  async isSecureStorage(): Promise<boolean> {
    try {
      const { safeStorage } = await import('electron')
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  // Private methods

  // PKCE methods removed - not needed for Device Authorization Flow

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

    return await response.json()
  }

  private async refreshTokens(): Promise<void> {
    if (!this.currentSession?.tokens.refresh_token) {
      throw new Error('No refresh token available')
    }

    const tokenEndpoint = `${this.domain}/oauth/token`
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: this.currentSession.tokens.refresh_token,
    })

    if (this.audience) {
      body.append('audience', this.audience)
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    
    const newTokens: Auth0Tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.currentSession.tokens.refresh_token,
      id_token: data.id_token,
      expires_at: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
    }

    this.currentSession.tokens = newTokens
    await this.storeSession(this.currentSession)
    this.notifyListeners('TOKEN_REFRESHED', this.currentSession)
    
  }

  private async revokeToken(token: string): Promise<void> {
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

  private isTokenExpired(tokens: Auth0Tokens): boolean {
    // Add 5-minute buffer for token refresh
    return tokens.expires_at < Date.now() + (5 * 60 * 1000)
  }

  private async storeSession(session: Auth0Session): Promise<void> {
    await this.secureSetItem('auth0_session', JSON.stringify(session))
  }

  private async restoreSession(): Promise<void> {
    try {
      const sessionData = await this.secureGetItem('auth0_session')
      if (sessionData) {
        this.currentSession = JSON.parse(sessionData)
      }
    } catch (error) {
      console.warn('Failed to restore session:', error)
      await this.clearSession()
    }
  }

  private async clearSession(): Promise<void> {
    await this.secureRemoveItem('auth0_session')
  }

  private notifyListeners(event: Auth0Event, session: Auth0Session | null, error?: string) {
    this.listeners.forEach(listener => {
      try {
        listener(event, session, error)
      } catch (err) {
        console.error('Auth listener error:', err)
      }
    })
  }

  // Secure storage methods (same pattern as original but more robust)
  private async ensureSecureDir() {
    try {
      await fs.mkdir(this.secureDir, { recursive: true, mode: 0o700 })
    } catch (error) {
      // Directory might already exist
    }
  }

  private async secureGetItem(key: string): Promise<string | null> {
    try {
      const { safeStorage } = await import('electron')
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('Secure storage not available, falling back to file storage')
        return await this.fileGetItem(key)
      }

      const filePath = path.join(this.secureDir, `${key}.dat`)
      const encrypted = await fs.readFile(filePath)
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      return null // Key not found or decryption failed
    }
  }

  private async secureSetItem(key: string, value: string): Promise<void> {
    try {
      const { safeStorage } = await import('electron')
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('Secure storage not available, using file storage with limited security')
        return await this.fileSetItem(key, value)
      }

      const encrypted = safeStorage.encryptString(value)
      const filePath = path.join(this.secureDir, `${key}.dat`)
      await fs.writeFile(filePath, encrypted, { mode: 0o600 })
    } catch (error) {
      console.error('Failed to store secure item:', error)
      throw error
    }
  }

  private async secureRemoveItem(key: string): Promise<void> {
    try {
      const filePath = path.join(this.secureDir, `${key}.dat`)
      await fs.unlink(filePath)
    } catch (error) {
      // File doesn't exist, consider it removed
    }
  }

  // Fallback file storage (less secure but functional)
  private async fileGetItem(key: string): Promise<string | null> {
    try {
      const filePath = path.join(this.secureDir, `${key}.json`)
      const data = await fs.readFile(filePath, 'utf8')
      return JSON.parse(data).value
    } catch {
      return null
    }
  }

  private async fileSetItem(key: string, value: string): Promise<void> {
    const filePath = path.join(this.secureDir, `${key}.json`)
    await fs.writeFile(filePath, JSON.stringify({ value }), { mode: 0o600 })
  }
}

// Singleton instance
export const auth0Service = new Auth0Service()
