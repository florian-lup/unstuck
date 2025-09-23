import { app, BrowserWindow, ipcMain } from 'electron'
import { WindowManager } from './window-manager'
import { AuthIPCHandlers } from './auth0/auth-ipc-handlers'
import { ShortcutsManager } from './shortcuts-manager'
import { AutoLaunchManager } from './auto-launch-manager'

export class AppLifecycleManager {
  private authIPCHandlers?: AuthIPCHandlers
  private shortcutsManager?: ShortcutsManager
  private autoLaunchManager?: AutoLaunchManager

  constructor(private readonly windowManager: WindowManager) {}

  /**
   * Register managers for proper cleanup
   */
  registerManagers(
    authIPCHandlers: AuthIPCHandlers,
    shortcutsManager: ShortcutsManager,
    autoLaunchManager: AutoLaunchManager
  ): void {
    this.authIPCHandlers = authIPCHandlers
    this.shortcutsManager = shortcutsManager
    this.autoLaunchManager = autoLaunchManager
  }

  /**
   * Clean up all IPC handlers and resources
   */
  private cleanupAllResources(): void {
    console.log('Cleaning up all app resources...')
    
    // Clean up main IPC handlers
    ipcMain.removeHandler('update-navigation-shortcut')
    
    // Clean up manager resources
    this.authIPCHandlers?.cleanup()
    this.shortcutsManager?.unregisterAllShortcuts()
    this.autoLaunchManager?.cleanup()
    
    // Clean up tray icon
    this.windowManager.destroyTray()
  }

  setupAppEvents(): void {
    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      // Clean up resources before quitting
      this.cleanupAllResources()
      
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // On OS X, re-create a window when the dock icon is clicked
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.windowManager.createAuthWindow()
      }
    })

    // Handle second instance attempts
    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
      // Someone tried to run a second instance, focus our auth window instead
      this.windowManager.focusAuthWindow()
    })

    // Handle app quit preparation
    app.on('before-quit', () => {
      // Clean up all resources before quitting
      this.cleanupAllResources()
      console.log('App is quitting...')
    })

    // Handle app termination (forced quit)
    app.on('will-quit', () => {
      // Final cleanup in case other events didn't trigger
      this.cleanupAllResources()
    })
  }

  ensureSingleInstance(): boolean {
    const gotTheLock = app.requestSingleInstanceLock()

    if (!gotTheLock) {
      app.quit()
      return false
    }

    return true
  }

  setAppDefaults(): void {
    // App name is now set in main.ts for all processes
    // Any other app-level defaults can be added here
  }
}
