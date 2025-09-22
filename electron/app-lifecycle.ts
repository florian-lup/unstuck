import { app, BrowserWindow } from 'electron'
import { WindowManager } from './window-manager'

export class AppLifecycleManager {
  constructor(private readonly windowManager: WindowManager) {}

  setupAppEvents(): void {
    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
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
      // Cleanup logic if needed
      console.log('App is quitting...')
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
    // Set the app name as early as possible
    app.setName('Unstuck')
  }
}
