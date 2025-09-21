export interface IElectronAPI {
  getSystemTheme: () => Promise<string>
  onThemeChanged: (callback: (theme: string) => void) => void
  removeThemeListener: () => void
  onNavigationBarToggle: (callback: () => void) => void
  removeNavigationBarToggleListener: () => void
  setIgnoreMouseEvents: (
    ignore: boolean,
    options?: { forward?: boolean }
  ) => void
  ensureAlwaysOnTop: () => void
  windowInteraction: () => void
  auth: {
    getOAuthUrl: (provider: 'google' | 'github' | 'discord') => Promise<{ success: boolean; url?: string; error?: string }>
    getSession: () => Promise<{ success: boolean; user?: any; session?: any; error?: string }>
    signOut: () => Promise<{ success: boolean; error?: string }>
    isSecureStorage: () => Promise<boolean>
    onAuthSuccess: (callback: (user: any) => void) => any
    onAuthError: (callback: (error: string) => void) => any
    removeAuthListeners: () => void
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
