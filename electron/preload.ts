import { ipcRenderer, contextBridge } from 'electron'

// Define allowed channels for security
const ALLOWED_SEND_CHANNELS = [
  'set-ignore-mouse-events',
  'ensure-always-on-top',
  'window-interaction',
  'user-logout'
] as const

const ALLOWED_INVOKE_CHANNELS = [
  'open-external-url',
  'auth-get-oauth-url',
  'auth-get-session', 
  'auth-sign-out',
  'auth-is-secure-storage'
] as const

const ALLOWED_LISTEN_CHANNELS = [
  'toggle-navigation-bar',
  'auth-success',
  'auth-error'
] as const

type SendChannel = typeof ALLOWED_SEND_CHANNELS[number]
type InvokeChannel = typeof ALLOWED_INVOKE_CHANNELS[number] 
type ListenChannel = typeof ALLOWED_LISTEN_CHANNELS[number]

// --------- Secure IPC API with channel validation ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  send(channel: SendChannel, ...args: unknown[]) {
    if (!ALLOWED_SEND_CHANNELS.includes(channel as SendChannel)) {
      throw new Error(`Blocked send to unauthorized channel: ${channel}`)
    }
    ipcRenderer.send(channel, ...args)
  },
  
  invoke(channel: InvokeChannel, ...args: unknown[]) {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel as InvokeChannel)) {
      throw new Error(`Blocked invoke to unauthorized channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  on(channel: ListenChannel, listener: (...args: unknown[]) => void) {
    if (!ALLOWED_LISTEN_CHANNELS.includes(channel as ListenChannel)) {
      throw new Error(`Blocked listener on unauthorized channel: ${channel}`)
    }
    const wrappedListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      listener(...args)
    }
    ipcRenderer.on(channel, wrappedListener)
    return wrappedListener
  },

  off(channel: ListenChannel, listener?: (...args: unknown[]) => void) {
    if (!ALLOWED_LISTEN_CHANNELS.includes(channel as ListenChannel)) {
      throw new Error(`Blocked off on unauthorized channel: ${channel}`)
    }
    if (listener) {
      ipcRenderer.off(channel, listener)
    } else {
      ipcRenderer.removeAllListeners(channel)
    }
  }
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
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options)
  },
  ensureAlwaysOnTop: () => {
    ipcRenderer.send('ensure-always-on-top')
  },
  windowInteraction: () => {
    ipcRenderer.send('window-interaction')
  },
  // Secure authentication APIs (no direct Supabase client exposure)
  auth: {
    getOAuthUrl: (provider: 'google' | 'github' | 'discord') => 
      ipcRenderer.invoke('auth-get-oauth-url', provider),
    getSession: () => ipcRenderer.invoke('auth-get-session'),
    signOut: () => ipcRenderer.invoke('auth-sign-out'),
    isSecureStorage: () => ipcRenderer.invoke('auth-is-secure-storage'),
    // Listen for auth events from main process
    onAuthSuccess: (callback: (user: any) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, user: any) => callback(user)
      ipcRenderer.on('auth-success', listener)
      return listener
    },
    onAuthError: (callback: (error: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('auth-error', listener)  
      return listener
    },
    removeAuthListeners: () => {
      ipcRenderer.removeAllListeners('auth-success')
      ipcRenderer.removeAllListeners('auth-error')
    },
  },
})
