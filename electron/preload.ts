import { ipcRenderer, contextBridge } from 'electron'

// Define allowed channels for security
const ALLOWED_SEND_CHANNELS = [
  'set-ignore-mouse-events',
  'ensure-always-on-top',
  'window-interaction',
  'user-logout',
] as const

const ALLOWED_INVOKE_CHANNELS = [
  'open-external-url',
  'auth-get-oauth-url',
  'auth-get-session',
  'auth-sign-out',
  'auth-is-secure-storage',
] as const

const ALLOWED_LISTEN_CHANNELS = [
  'toggle-navigation-bar',
  'auth-success',
  'auth-error',
] as const

type SendChannel = (typeof ALLOWED_SEND_CHANNELS)[number]
type InvokeChannel = (typeof ALLOWED_INVOKE_CHANNELS)[number]
type ListenChannel = (typeof ALLOWED_LISTEN_CHANNELS)[number]

// --------- Secure IPC API with channel validation ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  send(channel: SendChannel, ...args: unknown[]) {
    if (!ALLOWED_SEND_CHANNELS.includes(channel)) {
      throw new Error(`Blocked send to unauthorized channel: ${channel}`)
    }
    ipcRenderer.send(channel, ...args)
  },

  invoke(channel: InvokeChannel, ...args: unknown[]) {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      throw new Error(`Blocked invoke to unauthorized channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  on(channel: ListenChannel, listener: (...args: unknown[]) => void) {
    if (!ALLOWED_LISTEN_CHANNELS.includes(channel)) {
      throw new Error(`Blocked listener on unauthorized channel: ${channel}`)
    }
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      ...args: unknown[]
    ) => {
      listener(...args)
    }
    ipcRenderer.on(channel, wrappedListener)
    return wrappedListener
  },

  off(channel: ListenChannel, listener?: (...args: unknown[]) => void) {
    if (!ALLOWED_LISTEN_CHANNELS.includes(channel)) {
      throw new Error(`Blocked off on unauthorized channel: ${channel}`)
    }
    if (listener) {
      ipcRenderer.off(channel, listener)
    } else {
      ipcRenderer.removeAllListeners(channel)
    }
  },
})

// Expose Electron API
contextBridge.exposeInMainWorld('electronAPI', {
  onNavigationBarToggle: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('toggle-navigation-bar', listener)
    return listener
  },
  removeNavigationBarToggleListener: () => {
    ipcRenderer.removeAllListeners('toggle-navigation-bar')
  },
  updateNavigationShortcut: (shortcut: string) => {
    return ipcRenderer.invoke('update-navigation-shortcut', shortcut)
  },
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options)
  },
  ensureAlwaysOnTop: () => {
    ipcRenderer.send('ensure-always-on-top')
  },
  windowInteraction: () => {
    ipcRenderer.send('window-interaction')
  },
  // Secure Auth0 authentication APIs (no direct Auth0 client exposure)
  auth: {
    startAuthFlow: () => ipcRenderer.invoke('auth0-start-flow'),
    getSession: () => ipcRenderer.invoke('auth0-get-session'),
    signOut: () => ipcRenderer.invoke('auth0-sign-out'),
    isSecureStorage: () => ipcRenderer.invoke('auth0-is-secure-storage'),
    cancelDeviceFlow: () => ipcRenderer.invoke('auth0-cancel-device-flow'),
    // Listen for auth events from main process
    onAuthSuccess: (callback: (session: unknown) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        session: unknown
      ) => {
        callback(session)
      }
      ipcRenderer.on('auth0-success', listener)
      return listener
    },
    onAuthError: (callback: (error: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string) => {
        callback(error)
      }
      ipcRenderer.on('auth0-error', listener)
      return listener
    },
    onTokenRefresh: (callback: (session: unknown) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        session: unknown
      ) => {
        callback(session)
      }
      ipcRenderer.on('auth0-token-refresh', listener)
      return listener
    },
    removeAuthListeners: () => {
      ipcRenderer.removeAllListeners('auth0-success')
      ipcRenderer.removeAllListeners('auth0-error')
      ipcRenderer.removeAllListeners('auth0-token-refresh')
    },
  },
})
