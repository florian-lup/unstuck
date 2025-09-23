/**
 * Secure Storage Service
 * Handles encrypted storage with fallback mechanisms
 */
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { Auth0Config } from '../../config/auth.config'

export class SecureStorage {
  private config: Auth0Config
  private secureDir = path.join(os.homedir(), '.unstuck-secure')

  constructor(config: Auth0Config) {
    this.config = config
  }

  private get FALLBACK_STORAGE_EXPIRY_HOURS() {
    return this.config.tokenManagement.fallbackStorageExpiryHours
  }

  /**
   * Initialize secure storage directory
   */
  async initialize(): Promise<void> {
    await this.ensureSecureDir()
  }

  /**
   * Check if OS-level secure storage is available
   */
  async isSecureStorageAvailable(): Promise<boolean> {
    try {
      const { safeStorage } = await import('electron')
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  /**
   * Get an item from secure storage
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const { safeStorage } = await import('electron')
      if (!safeStorage.isEncryptionAvailable()) {
        return await this.enhancedFileGetItem(key)
      }

      const filePath = path.join(this.secureDir, `${key}.dat`)
      const encrypted = await fs.readFile(filePath)
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      return null // Key not found or decryption failed
    }
  }

  /**
   * Store an item in secure storage
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      const { safeStorage } = await import('electron')
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('🔐 OS encryption unavailable - using enhanced fallback')
        
        // Refuse to store refresh tokens in fallback mode for security
        if (key.includes('refresh_token')) {
          throw new Error('Secure storage required for refresh tokens')
        }
        
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

  /**
   * Remove an item from secure storage
   */
  async removeItem(key: string): Promise<void> {
    try {
      const filePath = path.join(this.secureDir, `${key}.dat`)
      await fs.unlink(filePath)
    } catch (error) {
      // File doesn't exist, consider it removed
    }
  }

  /**
   * Enhanced fallback file storage with encryption
   */
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
      console.warn('🔒 Found legacy token format - forcing re-authentication for security')
      await fs.unlink(filePath).catch(() => {})
      return null
    } catch {
      return null
    }
  }

  /**
   * Enhanced fallback file storage with encryption
   */
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
      expiresAt: Date.now() + (this.FALLBACK_STORAGE_EXPIRY_HOURS * 60 * 60 * 1000)
    }
    
    const filePath = path.join(this.secureDir, `${key}.json`)
    await fs.writeFile(filePath, JSON.stringify(data), { mode: 0o600 })
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
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

  /**
   * Ensure secure directory exists with proper permissions
   */
  private async ensureSecureDir(): Promise<void> {
    try {
      await fs.mkdir(this.secureDir, { recursive: true, mode: 0o700 })
    } catch (error) {
      // Directory might already exist
    }
  }
}
