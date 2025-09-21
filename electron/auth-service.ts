/**
 * Secure Authentication Service - Main Process Only
 * Supabase client is isolated in main process, renderer gets minimal IPC interface
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export class AuthService {
  private supabase: SupabaseClient | null = null
  private secureDir = path.join(os.homedir(), '.unstuck-secure')

  /**
   * Initialize Supabase client in main process only
   */
  async initialize(supabaseUrl: string, supabaseAnonKey: string) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase credentials')
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
        // Use custom storage that doesn't rely on renderer
        storage: {
          getItem: this.secureGetItem.bind(this),
          setItem: this.secureSetItem.bind(this),
          removeItem: this.secureRemoveItem.bind(this),
        },
      },
    })

    // Ensure secure directory exists
    await this.ensureSecureDir()
    
    console.log('🔒 AuthService initialized in main process')
    return this.supabase
  }

  /**
   * Get OAuth URL for external browser
   */
  async getOAuthUrl(provider: 'google' | 'github' | 'discord') {
    if (!this.supabase) throw new Error('AuthService not initialized')

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'unstuck://auth/callback',
        skipBrowserRedirect: true,
      },
    })

    if (error) throw error
    return data.url
  }

  /**
   * Handle OAuth callback from deep link
   */
  async handleOAuthCallback(callbackUrl: string) {
    if (!this.supabase) throw new Error('AuthService not initialized')

    try {
      const url = new URL(callbackUrl.replace('unstuck://', 'http://localhost/'))
      const accessToken = url.searchParams.get('access_token')
      const refreshToken = url.searchParams.get('refresh_token')

      if (accessToken) {
        const { data, error } = await this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })
        
        if (error) throw error
        return data.user
      }
    } catch (error) {
      console.error('OAuth callback error:', error)
      throw error
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<{ user: User | null; session: Session | null }> {
    if (!this.supabase) throw new Error('AuthService not initialized')

    const { data: { session } } = await this.supabase.auth.getSession()
    return {
      user: session?.user || null,
      session,
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    if (!this.supabase) throw new Error('AuthService not initialized')
    
    const { error } = await this.supabase.auth.signOut()
    if (error) throw error
    
    // Clear all stored tokens
    await this.clearSecureStorage()
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!this.supabase) throw new Error('AuthService not initialized')

    return this.supabase.auth.onAuthStateChange(callback)
  }

  // Private secure storage methods
  private async ensureSecureDir() {
    try {
      await fs.mkdir(this.secureDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  }

  private async secureGetItem(key: string): Promise<string | null> {
    try {
      const { safeStorage } = await import('electron')
      if (!safeStorage.isEncryptionAvailable()) {
        return null
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
        throw new Error('Secure storage not available')
      }

      const encrypted = safeStorage.encryptString(value)
      const filePath = path.join(this.secureDir, `${key}.dat`)
      await fs.writeFile(filePath, encrypted)
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

  private async clearSecureStorage() {
    try {
      const files = await fs.readdir(this.secureDir)
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.secureDir, file)))
      )
    } catch (error) {
      // Directory doesn't exist or is empty
    }
  }
}

// Singleton instance
export const authService = new AuthService()
