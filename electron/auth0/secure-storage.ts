/**
 * Secure Storage Service
 * Handles OS-level encrypted storage using Electron's safeStorage
 */
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export class SecureStorage {
  private secureDir = path.join(os.homedir(), '.unstuck-secure')

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
        return null
      }

      const filePath = path.join(this.secureDir, `${key}.dat`)
      const encrypted = await fs.readFile(filePath)
      return safeStorage.decryptString(encrypted)
    } catch {
      return null // Key not found or decryption failed
    }
  }

  /**
   * Store an item in secure storage
   */
  async setItem(key: string, value: string): Promise<void> {
    const { safeStorage } = await import('electron')
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'OS-level encryption is required but not available. Please ensure Windows Credential Manager is working properly.'
      )
    }

    const encrypted = safeStorage.encryptString(value)
    const filePath = path.join(this.secureDir, `${key}.dat`)
    await fs.writeFile(filePath, encrypted, { mode: 0o600 })
  }

  /**
   * Remove an item from secure storage
   */
  async removeItem(key: string): Promise<void> {
    try {
      const filePath = path.join(this.secureDir, `${key}.dat`)
      await fs.unlink(filePath)
    } catch {
      // File doesn't exist, consider it removed
    }
  }

  /**
   * Ensure secure directory exists with proper permissions
   */
  private async ensureSecureDir(): Promise<void> {
    try {
      await fs.mkdir(this.secureDir, { recursive: true, mode: 0o700 })
    } catch {
      // Directory might already exist
    }
  }
}
