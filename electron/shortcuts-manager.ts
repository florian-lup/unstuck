import { globalShortcut, app } from 'electron'
import { WindowManager } from './window-manager'

export class ShortcutsManager {
  constructor(private readonly windowManager: WindowManager) {}

  registerGlobalShortcuts(): void {
    // Register global shortcut for navigation bar toggle
    const shortcutRegistered = globalShortcut.register('Shift+\\', () => {
      const overlayWindow = this.windowManager.getOverlayWindow()
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('toggle-navigation-bar')
      }
    })

    if (!shortcutRegistered) {
      console.warn('Failed to register global shortcut Shift+\\')
    } else {
      console.log('Global shortcut Shift+\\ registered successfully')
    }
  }

  unregisterAllShortcuts(): void {
    globalShortcut.unregisterAll()
  }

  setupShortcutCleanup(): void {
    // Unregister all global shortcuts when app is quitting
    app.on('will-quit', () => {
      this.unregisterAllShortcuts()
    })
  }
}
