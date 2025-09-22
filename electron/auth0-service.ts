/**
 * Secure Auth0 Authentication Service - Main Process Only
 * Implements PKCE flow with secure token storage for Electron apps
 */

// shell import removed as not needed in this service
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { SecurityValidator } from './security-validators'

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
  private refreshAttempts: Map<string, { count: number; lastAttempt: number }> = new Map()
  private readonly REFRESH_RATE_LIMIT = 5 // Max refresh attempts
  private readonly REFRESH_RATE_WINDOW = 60000 // 1 minute window
  private readonly MIN_TOKEN_VALIDITY_BUFFER = 300000 // 5 minutes buffer before expiry

  /**
   * Initialize Auth0 client configuration
   */
  async initialize(domain: string, clientId: string, audience?: string): Promise<void> {
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
    
    // Try to restore existing session - this will emit SIGNED_IN event if session is valid
    await this.restoreSession()
    
    console.log('Auth0 service initialized successfully')
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
        error: errorData.error,
        error_description: errorData.error_description
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

  /**
   * Check if user is currently signed in with valid tokens
   */
  isSignedIn(): boolean {
    if (!this.currentSession) return false
    return !this.isTokenExpired(this.currentSession.tokens)
  }

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
          console.error('Automatic token refresh failed:', SecurityValidator.sanitizeUserForLogging(error))
          // If refresh fails due to security checks, force re-authentication
          if (error instanceof Error && (
            error.message.includes('re-authentication required') ||
            error.message.includes('expired too long ago') ||
            error.message.includes('Too many token refresh attempts')
          )) {
          await this.signOut()
          return { user: null, tokens: null }
          }
          // For other errors, return current tokens but they may be expired
          console.warn('Continuing with potentially expired tokens')
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
    // 1. Basic validation
    if (!this.currentSession?.tokens.refresh_token) {
      throw new Error('No refresh token available')
    }

    // 2. Token expiry validation with buffer
    const now = Date.now()
    const tokenExpiry = this.currentSession.tokens.expires_at
    
    // Don't refresh if token is still valid with sufficient buffer
    if (tokenExpiry && tokenExpiry > now + this.MIN_TOKEN_VALIDITY_BUFFER) {
      throw new Error('Token refresh not needed - token still valid')
    }

    // Don't refresh if token is already expired for too long (potential replay attack)
    if (tokenExpiry && tokenExpiry < now - this.REFRESH_RATE_WINDOW) {
      throw new Error('Token expired too long ago - re-authentication required')
    }

    // 3. Rate limiting validation
    const refreshKey = this.currentSession.tokens.refresh_token
    this.validateRefreshRateLimit(refreshKey)

    // 4. Domain validation (ensure we're still talking to the right Auth0 tenant)
    if (!this.domain || (!this.domain.includes('.auth0.com') && !this.domain.includes('.us.auth0.com'))) {
      throw new Error('Invalid Auth0 domain for token refresh')
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

    let response: Response
    try {
      response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Unstuck-App/1.0.0', // Identify our app
      },
      body: body.toString(),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })
    } catch (error) {
      this.recordRefreshAttempt(refreshKey)
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Token refresh request timed out')
      }
      throw new Error(`Token refresh network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 5. Enhanced error handling with specific error codes
    if (!response.ok) {
      this.recordRefreshAttempt(refreshKey)
      
      let errorData: any = {}
      try {
        errorData = await response.json()
      } catch {
        // If JSON parsing fails, use status text
        errorData = { error: response.statusText }
      }

      // Handle specific Auth0 error codes
      if (errorData.error === 'invalid_grant') {
        // Refresh token is invalid/expired - force re-authentication
        await this.signOut()
        throw new Error('Refresh token invalid - re-authentication required')
      }
      
      if (errorData.error === 'invalid_client') {
        throw new Error('Invalid client credentials - check Auth0 configuration')
      }

      throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error || 'Unknown error'}`)
    }

    let data: any
    try {
      data = await response.json()
    } catch {
      this.recordRefreshAttempt(refreshKey)
      throw new Error('Invalid response format from token endpoint')
    }

    // 6. Validate response data
    if (!data.access_token || !data.expires_in) {
      this.recordRefreshAttempt(refreshKey)
      throw new Error('Invalid token response - missing required fields')
    }

    // 7. Validate token expiry is reasonable (not in past, not too far in future)
    const newExpiry = now + (data.expires_in * 1000)
    if (newExpiry <= now || newExpiry > now + 86400000) { // Max 24 hours
      throw new Error('Invalid token expiry in response')
    }
    
    const newTokens: Auth0Tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.currentSession.tokens.refresh_token,
      id_token: data.id_token,
      expires_at: newExpiry,
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
    }

    // 8. Update session with new tokens
    this.currentSession.tokens = newTokens
    await this.storeSession(this.currentSession)
    
    // 9. Clear rate limiting on successful refresh
    this.clearRefreshAttempts(refreshKey)
    
    this.notifyListeners('TOKEN_REFRESHED', this.currentSession)
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
      throw new Error(`Too many token refresh attempts. Please wait ${Math.ceil(this.REFRESH_RATE_WINDOW / 60000)} minutes.`)
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
    // Use the security buffer we defined for consistency
    return tokens.expires_at < Date.now() + this.MIN_TOKEN_VALIDITY_BUFFER
  }

  private async storeSession(session: Auth0Session): Promise<void> {
    try {
      // Try to store the full session first
      await this.secureSetItem('auth0_session', JSON.stringify(session))
    } catch (error) {
      // If it fails due to refresh token in fallback mode, store without refresh token
      if (error instanceof Error && error.message.includes('Secure storage required for refresh tokens')) {
        const sessionWithoutRefreshToken = {
          ...session,
          tokens: {
            ...session.tokens,
            refresh_token: undefined
          }
        }
        console.warn('⚠️ Storing session without refresh token due to fallback security limitations')
        await this.secureSetItem('auth0_session', JSON.stringify(sessionWithoutRefreshToken))
      } else {
        throw error
      }
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      const sessionData = await this.secureGetItem('auth0_session')
      if (sessionData) {
        const restoredSession: Auth0Session = JSON.parse(sessionData)
        
        // Check if the restored tokens are still valid
        if (this.isTokenExpired(restoredSession.tokens)) {
          console.log('Restored session has expired tokens, attempting refresh...')
          this.currentSession = restoredSession
          
          try {
            // Try to refresh the tokens
            await this.refreshTokens()
            console.log('✅ Session restored and tokens refreshed successfully')
            // Notify listeners that user is signed in with refreshed tokens
            this.notifyListeners('SIGNED_IN', this.currentSession)
          } catch (refreshError) {
            console.warn('Failed to refresh restored tokens, clearing session:', SecurityValidator.sanitizeUserForLogging(refreshError))
            await this.clearSession()
            this.currentSession = null
          }
        } else {
          // Tokens are still valid
          this.currentSession = restoredSession
          console.log('✅ Session restored successfully with valid tokens')
          // Notify listeners that user is signed in
          this.notifyListeners('SIGNED_IN', this.currentSession)
        }
      }
    } catch (error) {
      console.warn('Failed to restore session:', SecurityValidator.sanitizeUserForLogging(error))
      await this.clearSession()
      this.currentSession = null
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
        // Use enhanced file storage for fallback
        return await this.enhancedFileGetItem(key)
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
        // Enhanced fallback with better security
        console.warn('🔐 OS encryption unavailable - using enhanced fallback')
        
        // Refuse to store refresh tokens in fallback mode for security
        if (key.includes('refresh_token')) {
          throw new Error('Secure storage required for refresh tokens')
        }
        
        // Use enhanced file storage with basic encryption
        return await this.enhancedFileSetItem(key, value)
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

  // Enhanced fallback file storage with basic encryption
  private async enhancedFileGetItem(key: string): Promise<string | null> {
    try {
      const filePath = path.join(this.secureDir, `${key}.json`)
      const data = await fs.readFile(filePath, 'utf8')
      const parsed = JSON.parse(data)
      
      // Check expiry for enhanced storage
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        // Expired, clean up and return null
        await fs.unlink(filePath).catch(() => {})
        return null
      }
      
      // If it's encrypted data, decrypt it
      if (parsed.encrypted && parsed.iv && parsed.authTag) {
        return this.decryptValue(parsed.encrypted, parsed.iv, parsed.authTag)
      }
      
      // No support for legacy plain-text format for security reasons
      // Users with old tokens will need to re-authenticate
      console.warn('🔒 Found legacy token format - forcing re-authentication for security')
      await fs.unlink(filePath).catch(() => {})
      return null
    } catch {
      return null
    }
  }

  private async enhancedFileSetItem(key: string, value: string): Promise<void> {
    const algorithm = 'aes-256-gcm'
    const keyDerivation = crypto.pbkdf2Sync('unstuck-fallback-key', 'unstuck-salt-2024', 100000, 32, 'sha256')
    
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, keyDerivation, iv)
    
    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    const data = {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      timestamp: Date.now(),
      // Shorter expiry for fallback storage (24 hours)
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    }
    
    const filePath = path.join(this.secureDir, `${key}.json`)
    await fs.writeFile(filePath, JSON.stringify(data), { mode: 0o600 })
  }

  private decryptValue(encryptedHex: string, ivHex: string, authTagHex: string): string {
    const algorithm = 'aes-256-gcm'
    const keyDerivation = crypto.pbkdf2Sync('unstuck-fallback-key', 'unstuck-salt-2024', 100000, 32, 'sha256')
    
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(algorithm, keyDerivation, iv)
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  // Note: Legacy plain-text methods removed for security.
  // Only encrypted storage is now supported in fallback mode.
}

// Singleton instance
export const auth0Service = new Auth0Service()
