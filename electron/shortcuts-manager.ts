import { globalShortcut, app } from 'electron'
import { WindowManager } from './window-manager'

export class ShortcutsManager {
  private navigationShortcut: string | null = null
  private chatShortcut: string | null = null
  private historyShortcut: string | null = null
  private settingsShortcut: string | null = null
  private newChatShortcut: string | null = null

  constructor(private readonly windowManager: WindowManager) {}

  registerNavigationToggleShortcut(shortcut: string): void {
    // Unregister existing shortcut first
    if (this.navigationShortcut) {
      globalShortcut.unregister(this.navigationShortcut)
    }

    // Register new shortcut
    const shortcutRegistered = globalShortcut.register(shortcut, () => {
      const overlayWindow = this.windowManager.getOverlayWindow()
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('toggle-navigation-bar')
      }
    })

    if (shortcutRegistered) {
      this.navigationShortcut = shortcut
    }
  }

  registerChatToggleShortcut(shortcut: string): void {
    // Unregister existing shortcut first
    if (this.chatShortcut) {
      globalShortcut.unregister(this.chatShortcut)
    }

    // Register new shortcut
    const shortcutRegistered = globalShortcut.register(shortcut, () => {
      const overlayWindow = this.windowManager.getOverlayWindow()
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('toggle-chat')
      }
    })

    if (shortcutRegistered) {
      this.chatShortcut = shortcut
    }
  }

  registerHistoryToggleShortcut(shortcut: string): void {
    // Unregister existing shortcut first
    if (this.historyShortcut) {
      globalShortcut.unregister(this.historyShortcut)
    }

    // Register new shortcut
    const shortcutRegistered = globalShortcut.register(shortcut, () => {
      const overlayWindow = this.windowManager.getOverlayWindow()
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('toggle-history')
      }
    })

    if (shortcutRegistered) {
      this.historyShortcut = shortcut
    }
  }

  registerSettingsToggleShortcut(shortcut: string): void {
    // Unregister existing shortcut first
    if (this.settingsShortcut) {
      globalShortcut.unregister(this.settingsShortcut)
    }

    // Register new shortcut
    const shortcutRegistered = globalShortcut.register(shortcut, () => {
      const overlayWindow = this.windowManager.getOverlayWindow()
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('toggle-settings')
      }
    })

    if (shortcutRegistered) {
      this.settingsShortcut = shortcut
    }
  }

  registerNewChatShortcut(shortcut: string): void {
    // Unregister existing shortcut first
    if (this.newChatShortcut) {
      globalShortcut.unregister(this.newChatShortcut)
    }

    // Register new shortcut
    const shortcutRegistered = globalShortcut.register(shortcut, () => {
      const overlayWindow = this.windowManager.getOverlayWindow()
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('trigger-new-chat')
      }
    })

    if (shortcutRegistered) {
      this.newChatShortcut = shortcut
    }
  }

  registerGlobalShortcuts(): void {
    // Register default shortcuts
    this.registerNavigationToggleShortcut('Shift+\\')
    this.registerChatToggleShortcut('Shift+Z')
    this.registerHistoryToggleShortcut('Shift+X')
    this.registerSettingsToggleShortcut('Shift+C')
    this.registerNewChatShortcut('Ctrl+Z')
  }

  unregisterAllShortcuts(): void {
    globalShortcut.unregisterAll()
    this.navigationShortcut = null
    this.chatShortcut = null
    this.historyShortcut = null
    this.settingsShortcut = null
    this.newChatShortcut = null
  }

  setupShortcutCleanup(): void {
    // Unregister all global shortcuts when app is quitting
    app.on('will-quit', () => {
      this.unregisterAllShortcuts()
    })
  }
}
