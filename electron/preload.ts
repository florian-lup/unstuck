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
  'auto-launch:get-status',
  'auto-launch:enable',
  'auto-launch:disable',
  'auto-launch:toggle',
  'updater:restart-and-install',
  'update-navigation-shortcut',
  'update-chat-shortcut',
  'update-history-shortcut',
  'update-settings-shortcut',
  'update-new-chat-shortcut',
  'update-voice-chat-shortcut',
] as const

const ALLOWED_LISTEN_CHANNELS = [
  'toggle-navigation-bar',
  'toggle-chat',
  'toggle-history',
  'toggle-settings',
  'trigger-new-chat',
  'toggle-voice-chat',
  'open-settings-menu',
  'auth-success',
  'auth-error',
  'updater:update-ready',
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

  async invoke(channel: InvokeChannel, ...args: unknown[]): Promise<unknown> {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      throw new Error(`Blocked invoke to unauthorized channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args) as Promise<unknown>
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
  onOpenSettingsMenu: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('open-settings-menu', listener)
    return listener
  },
  removeOpenSettingsMenuListener: () => {
    ipcRenderer.removeAllListeners('open-settings-menu')
  },
  updateNavigationShortcut: async (shortcut: string): Promise<unknown> => {
    return ipcRenderer.invoke(
      'update-navigation-shortcut',
      shortcut
    ) as Promise<unknown>
  },
  updateChatShortcut: async (shortcut: string): Promise<unknown> => {
    return ipcRenderer.invoke('update-chat-shortcut', shortcut) as Promise<unknown>
  },
  updateHistoryShortcut: async (shortcut: string): Promise<unknown> => {
    return ipcRenderer.invoke(
      'update-history-shortcut',
      shortcut
    ) as Promise<unknown>
  },
  updateSettingsShortcut: async (shortcut: string): Promise<unknown> => {
    return ipcRenderer.invoke(
      'update-settings-shortcut',
      shortcut
    ) as Promise<unknown>
  },
  updateNewChatShortcut: async (shortcut: string): Promise<unknown> => {
    return ipcRenderer.invoke(
      'update-new-chat-shortcut',
      shortcut
    ) as Promise<unknown>
  },
  updateVoiceChatShortcut: async (shortcut: string): Promise<unknown> => {
    return ipcRenderer.invoke(
      'update-voice-chat-shortcut',
      shortcut
    ) as Promise<unknown>
  },
  onChatToggle: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('toggle-chat', listener)
    return listener
  },
  removeChatToggleListener: () => {
    ipcRenderer.removeAllListeners('toggle-chat')
  },
  onHistoryToggle: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('toggle-history', listener)
    return listener
  },
  removeHistoryToggleListener: () => {
    ipcRenderer.removeAllListeners('toggle-history')
  },
  onSettingsToggle: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('toggle-settings', listener)
    return listener
  },
  removeSettingsToggleListener: () => {
    ipcRenderer.removeAllListeners('toggle-settings')
  },
  onNewChatTrigger: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('trigger-new-chat', listener)
    return listener
  },
  removeNewChatTriggerListener: () => {
    ipcRenderer.removeAllListeners('trigger-new-chat')
  },
  onVoiceChatToggle: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('toggle-voice-chat', listener)
    return listener
  },
  removeVoiceChatToggleListener: () => {
    ipcRenderer.removeAllListeners('toggle-voice-chat')
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
  openExternalUrl: async (url: string): Promise<unknown> => {
    return ipcRenderer.invoke('open-external-url', url) as Promise<unknown>
  },
  // Secure Auth0 authentication APIs (no direct Auth0 client exposure)
  auth: {
    startAuthFlow: async (): Promise<unknown> =>
      ipcRenderer.invoke('auth0-start-flow') as Promise<unknown>,
    getSession: async (): Promise<unknown> =>
      ipcRenderer.invoke('auth0-get-session') as Promise<unknown>,
    signOut: async (): Promise<unknown> =>
      ipcRenderer.invoke('auth0-sign-out') as Promise<unknown>,
    isSecureStorage: async (): Promise<unknown> =>
      ipcRenderer.invoke('auth0-is-secure-storage') as Promise<unknown>,
    cancelDeviceFlow: async (): Promise<unknown> =>
      ipcRenderer.invoke('auth0-cancel-device-flow') as Promise<unknown>,
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
  autoLaunch: {
    getStatus: async (): Promise<unknown> =>
      ipcRenderer.invoke('auto-launch:get-status') as Promise<unknown>,
    enable: async (): Promise<unknown> =>
      ipcRenderer.invoke('auto-launch:enable') as Promise<unknown>,
    disable: async (): Promise<unknown> =>
      ipcRenderer.invoke('auto-launch:disable') as Promise<unknown>,
    toggle: async (): Promise<unknown> =>
      ipcRenderer.invoke('auto-launch:toggle') as Promise<unknown>,
  },
  updater: {
    onUpdateReady: (callback: (version: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, version: string) => {
        callback(version)
      }
      ipcRenderer.on('updater:update-ready', listener)
      return listener
    },
    removeUpdateReadyListener: () => {
      ipcRenderer.removeAllListeners('updater:update-ready')
    },
    restartAndInstall: async (): Promise<unknown> =>
      ipcRenderer.invoke('updater:restart-and-install') as Promise<unknown>,
  },
})
