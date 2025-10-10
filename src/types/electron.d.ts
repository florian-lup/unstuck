export interface IElectronAPI {
  onNavigationBarToggle: (callback: () => void) => void
  removeNavigationBarToggleListener: () => void
  onChatToggle: (callback: () => void) => void
  removeChatToggleListener: () => void
  onHistoryToggle: (callback: () => void) => void
  removeHistoryToggleListener: () => void
  onSettingsToggle: (callback: () => void) => void
  removeSettingsToggleListener: () => void
  onNewChatTrigger: (callback: () => void) => void
  removeNewChatTriggerListener: () => void
  onVoiceChatToggle: (callback: () => void) => void
  removeVoiceChatToggleListener: () => void
  onOpenSettingsMenu: (callback: () => void) => void
  removeOpenSettingsMenuListener: () => void
  updateNavigationShortcut: (shortcut: string) => Promise<void>
  updateChatShortcut: (shortcut: string) => Promise<void>
  updateHistoryShortcut: (shortcut: string) => Promise<void>
  updateSettingsShortcut: (shortcut: string) => Promise<void>
  updateNewChatShortcut: (shortcut: string) => Promise<void>
  updateVoiceChatShortcut: (shortcut: string) => Promise<void>
  setIgnoreMouseEvents: (
    ignore: boolean,
    options?: { forward?: boolean }
  ) => void
  ensureAlwaysOnTop: () => void
  windowInteraction: () => void
  openExternalUrl: (
    url: string
  ) => Promise<{ success: boolean; error?: string }>
  auth: {
    startAuthFlow: () => Promise<{
      success: boolean
      device_code?: string
      user_code?: string
      verification_uri?: string
      expires_in?: number
      error?: string
    }>
    getSession: () => Promise<{
      success: boolean
      user?: unknown
      session?: unknown
      tokens?: unknown
      error?: string
    }>
    signOut: () => Promise<{ success: boolean; error?: string }>
    isSecureStorage: () => Promise<boolean>
    cancelDeviceFlow: () => Promise<{ success: boolean; error?: string }>
    onAuthSuccess: (callback: (session: unknown) => void) => unknown
    onAuthError: (callback: (error: string) => void) => unknown
    onTokenRefresh?: (callback: (session: unknown) => void) => unknown
    removeAuthListeners: () => void
  }
  autoLaunch: {
    getStatus: () => Promise<boolean>
    enable: () => Promise<boolean>
    disable: () => Promise<boolean>
    toggle: () => Promise<boolean>
  }
  updater: {
    onUpdateReady: (callback: (version: string) => void) => unknown
    removeUpdateReadyListener: () => void
    restartAndInstall: () => Promise<{ success: boolean }>
  }
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI
    ipcRenderer: {
      on: (
        channel: string,
        listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
      ) => void
      off: (channel: string, listener?: (...args: unknown[]) => void) => void
      send: (channel: string, ...args: unknown[]) => void
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}
