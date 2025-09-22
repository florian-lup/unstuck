export interface IElectronAPI {
  onNavigationBarToggle: (callback: () => void) => void
  removeNavigationBarToggleListener: () => void
  setIgnoreMouseEvents: (
    ignore: boolean,
    options?: { forward?: boolean }
  ) => void
  ensureAlwaysOnTop: () => void
  windowInteraction: () => void
  auth: {
    startAuthFlow: () => Promise<{ success: boolean; device_code?: string; user_code?: string; verification_uri?: string; expires_in?: number; error?: string }>
    getSession: () => Promise<{ success: boolean; user?: any; session?: any; tokens?: any; error?: string }>
    signOut: () => Promise<{ success: boolean; error?: string }>
    isSecureStorage: () => Promise<boolean>
    cancelDeviceFlow: () => Promise<{ success: boolean; error?: string }>
    onAuthSuccess: (callback: (session: any) => void) => any
    onAuthError: (callback: (error: string) => void) => any
    onTokenRefresh?: (callback: (session: any) => void) => any
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
