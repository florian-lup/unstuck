import AutoLaunch from 'auto-launch'
import { app, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'

export class AutoLaunchManager {
  private autoLauncher: AutoLaunch
  private settingsPath: string
  private isDevelopment: boolean

  constructor(appName = 'Unstuck') {
    // Check if we're in development mode
    this.isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged
    
    // Initialize auto-launcher with app details
    // In development, use a dummy path to prevent errors, but we won't actually use it
    const appPath = this.isDevelopment 
      ? process.execPath  // Use Node.js executable path as dummy in dev
      : app.getPath('exe') // Use actual app executable in production
    
    this.autoLauncher = new AutoLaunch({
      name: appName,
      path: appPath,
      isHidden: false, // Show the app window when launched
    })

    // Path to store settings
    this.settingsPath = path.join(app.getPath('userData'), 'auto-launch-settings.json')
    
    this.setupIpcHandlers()
  }

  /**
   * Enable auto-launch on system startup
   */
  async enableAutoLaunch(): Promise<boolean> {
    if (this.isDevelopment) {
      console.log('Auto-launch disabled in development mode')
      return false
    }
    
    try {
      const isEnabled = await this.autoLauncher.isEnabled()
      if (!isEnabled) {
        await this.autoLauncher.enable()
        await this.saveAutoLaunchSetting(true)
        console.log('Auto-launch enabled')
      }
      return true
    } catch (error) {
      console.error('Failed to enable auto-launch:', error)
      return false
    }
  }

  /**
   * Disable auto-launch on system startup
   */
  async disableAutoLaunch(): Promise<boolean> {
    if (this.isDevelopment) {
      console.log('Auto-launch disabled in development mode')
      return true // Return true since it's "disabled" conceptually
    }
    
    try {
      const isEnabled = await this.autoLauncher.isEnabled()
      if (isEnabled) {
        await this.autoLauncher.disable()
        await this.saveAutoLaunchSetting(false)
        console.log('Auto-launch disabled')
      }
      return true
    } catch (error) {
      console.error('Failed to disable auto-launch:', error)
      return false
    }
  }

  /**
   * Check if auto-launch is currently enabled
   */
  async isAutoLaunchEnabled(): Promise<boolean> {
    if (this.isDevelopment) {
      return false // Always disabled in development
    }
    
    try {
      return await this.autoLauncher.isEnabled()
    } catch (error) {
      console.error('Failed to check auto-launch status:', error)
      return false
    }
  }

  /**
   * Toggle auto-launch on/off
   */
  async toggleAutoLaunch(): Promise<boolean> {
    const isEnabled = await this.isAutoLaunchEnabled()
    if (isEnabled) {
      return await this.disableAutoLaunch()
    } else {
      return await this.enableAutoLaunch()
    }
  }

  /**
   * Initialize auto-launch based on saved settings
   */
  async initializeAutoLaunch(): Promise<void> {
    if (this.isDevelopment) {
      console.log('Auto-launch initialization skipped in development mode')
      return
    }
    
    try {
      const isFirstRun = !fs.existsSync(this.settingsPath)
      const savedSetting = await this.loadAutoLaunchSetting()
      const currentlyEnabled = await this.isAutoLaunchEnabled()

      // On first run, enable auto-launch by default and save the setting
      if (isFirstRun) {
        console.log('First run detected, enabling auto-launch by default')
        await this.enableAutoLaunch()
      } else {
        // Sync the setting with the actual state for existing installations
        if (savedSetting && !currentlyEnabled) {
          await this.enableAutoLaunch()
        } else if (!savedSetting && currentlyEnabled) {
          await this.disableAutoLaunch()
        }
      }

      console.log(`Auto-launch initialized. Enabled: ${savedSetting}`)
    } catch (error) {
      console.error('Failed to initialize auto-launch:', error)
    }
  }

  /**
   * Save auto-launch setting to file
   */
  private async saveAutoLaunchSetting(enabled: boolean): Promise<void> {
    try {
      const settings = { autoLaunch: enabled }
      await fs.promises.writeFile(this.settingsPath, JSON.stringify(settings, null, 2))
    } catch (error) {
      console.error('Failed to save auto-launch setting:', error)
    }
  }

  /**
   * Load auto-launch setting from file
   */
  private async loadAutoLaunchSetting(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return true // Default to enabled on first install
      }
      
      const data = await fs.promises.readFile(this.settingsPath, 'utf-8')
      const settings = JSON.parse(data) as { autoLaunch?: boolean }
      return settings.autoLaunch === true
    } catch (error) {
      console.error('Failed to load auto-launch setting:', error)
      return true // Default to enabled on error
    }
  }

  /**
   * Setup IPC handlers for renderer process communication
   */
  private setupIpcHandlers(): void {
    ipcMain.handle('auto-launch:get-status', async () => {
      return await this.isAutoLaunchEnabled()
    })

    ipcMain.handle('auto-launch:enable', async () => {
      return await this.enableAutoLaunch()
    })

    ipcMain.handle('auto-launch:disable', async () => {
      return await this.disableAutoLaunch()
    })

    ipcMain.handle('auto-launch:toggle', async () => {
      return await this.toggleAutoLaunch()
    })
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Remove IPC handlers
    ipcMain.removeHandler('auto-launch:get-status')
    ipcMain.removeHandler('auto-launch:enable')
    ipcMain.removeHandler('auto-launch:disable')
    ipcMain.removeHandler('auto-launch:toggle')
  }
}
