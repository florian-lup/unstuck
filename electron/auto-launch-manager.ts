import AutoLaunch from 'auto-launch'
import { app, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'

export class AutoLaunchManager {
  private autoLauncher: AutoLaunch
  private settingsPath: string

  constructor(appName = 'Unstuck') {
    // Initialize auto-launcher with app details
    this.autoLauncher = new AutoLaunch({
      name: appName,
      path: app.getPath('exe'),
    })

    // Path to store settings
    this.settingsPath = path.join(
      app.getPath('userData'),
      'auto-launch-settings.json'
    )

    this.setupIpcHandlers()
  }

  /**
   * Enable auto-launch on system startup
   */
  async enableAutoLaunch(): Promise<boolean> {
    try {
      const isEnabled = await this.autoLauncher.isEnabled()
      if (!isEnabled) {
        await this.autoLauncher.enable()
        await this.saveAutoLaunchSetting(true)
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Disable auto-launch on system startup
   */
  async disableAutoLaunch(): Promise<boolean> {
    try {
      const isEnabled = await this.autoLauncher.isEnabled()
      if (isEnabled) {
        await this.autoLauncher.disable()
        await this.saveAutoLaunchSetting(false)
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if auto-launch is currently enabled
   */
  async isAutoLaunchEnabled(): Promise<boolean> {
    try {
      return await this.autoLauncher.isEnabled()
    } catch {
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
    try {
      const isFirstRun = !fs.existsSync(this.settingsPath)
      const savedSetting = await this.loadAutoLaunchSetting()
      const currentlyEnabled = await this.isAutoLaunchEnabled()

      // On first run, enable auto-launch by default and save the setting
      if (isFirstRun) {
        await this.enableAutoLaunch()
      } else {
        // Sync the setting with the actual state for existing installations
        if (savedSetting && !currentlyEnabled) {
          await this.enableAutoLaunch()
        } else if (!savedSetting && currentlyEnabled) {
          await this.disableAutoLaunch()
        }
      }
    } catch {
      // Silently ignore errors during initialization
    }
  }

  /**
   * Save auto-launch setting to file
   */
  private async saveAutoLaunchSetting(enabled: boolean): Promise<void> {
    try {
      const settings = { autoLaunch: enabled }
      await fs.promises.writeFile(
        this.settingsPath,
        JSON.stringify(settings, null, 2)
      )
    } catch {
      // Silently ignore save errors
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
    } catch {
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
