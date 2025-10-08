import { globalShortcut, app } from 'electron'
import { WindowManager } from './window-manager'

export class ShortcutsManager {
  private currentShortcut: string | null = null

  constructor(private readonly windowManager: WindowManager) {}

  registerNavigationToggleShortcut(shortcut: string): void {
    // Unregister existing shortcut first
    if (this.currentShortcut) {
      globalShortcut.unregister(this.currentShortcut)
    }

    // Register new shortcut
    const shortcutRegistered = globalShortcut.register(shortcut, () => {
      const overlayWindow = this.windowManager.getOverlayWindow()
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('toggle-navigation-bar')
      }
    })

    if (shortcutRegistered) {
      this.currentShortcut = shortcut
    }
  }

  registerGlobalShortcuts(): void {
    // Register default shortcut for navigation bar toggle
    this.registerNavigationToggleShortcut('Shift+\\')
  }

  unregisterAllShortcuts(): void {
    globalShortcut.unregisterAll()
    this.currentShortcut = null
  }

  setupShortcutCleanup(): void {
    // Unregister all global shortcuts when app is quitting
    app.on('will-quit', () => {
      this.unregisterAllShortcuts()
    })
  }
}
