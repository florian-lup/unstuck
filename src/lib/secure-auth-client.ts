/**
 * Secure Auth Client - Renderer Process
 * Uses IPC to communicate with main process instead of direct Supabase client
 */

export interface AuthUser {
  id: string
  email?: string
  user_metadata?: Record<string, any>
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: AuthUser
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'

export class SecureAuthClient {
  private listeners: Set<(event: AuthEvent, session: AuthSession | null) => void> = new Set()
  private user: AuthUser | null = null
  private session: AuthSession | null = null
  
  constructor() {
    this.setupIpcListeners()
  }

  /**
   * Get OAuth URL for system browser authentication
   */
  async getOAuthUrl(provider: 'google' | 'github' | 'discord'): Promise<string> {
    if (!window.electronAPI?.auth) {
      throw new Error('Auth API not available')
    }

    const result = await window.electronAPI.auth.getOAuthUrl(provider)
    if (!result.success) {
      throw new Error(result.error || 'Failed to get OAuth URL')
    }
    
    return result.url!
  }

  /**
   * Get current session
   */
  async getSession(): Promise<{ user: AuthUser | null; session: AuthSession | null }> {
    if (!window.electronAPI?.auth) {
      throw new Error('Auth API not available')
    }

    const result = await window.electronAPI.auth.getSession()
    if (!result.success) {
      throw new Error(result.error || 'Failed to get session')
    }

    this.user = result.user || null
    this.session = result.session || null

    return {
      user: this.user,
      session: this.session,
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
      throw new Error(result.error || 'Failed to sign out')
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
   * Listen for auth state changes
   */
  onAuthStateChange(callback: (event: AuthEvent, session: AuthSession | null) => void) {
    this.listeners.add(callback)
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.listeners.delete(callback)
      }
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

  private setupIpcListeners() {
    if (!window.electronAPI?.auth) {
      console.warn('Auth API not available, skipping IPC listeners')
      return
    }

    // Listen for successful authentication from main process
    window.electronAPI.auth.onAuthSuccess((user: AuthUser) => {
      console.log('Authentication successful:', user)
      this.user = user
      // Session will be updated via getSession call
      this.getSession().then(({ session }) => {
        if (session) {
          this.notifyListeners('SIGNED_IN', session)
        }
      })
    })

    // Listen for authentication errors
    window.electronAPI.auth.onAuthError((error: string) => {
      console.error('Authentication error:', error)
      // Could emit an error event here if needed
    })
  }

  private notifyListeners(event: AuthEvent, session: AuthSession | null) {
    this.listeners.forEach(listener => {
      try {
        listener(event, session)
      } catch (error) {
        console.error('Auth listener error:', error)
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
