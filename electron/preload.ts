import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    ipcRenderer.on(channel, (event, ...eventArgs: unknown[]) => {
      listener(event, ...eventArgs)
    })
  },
  off(channel: string, listener?: (...args: unknown[]) => void) {
    if (listener) {
      ipcRenderer.off(channel, listener)
    } else {
      ipcRenderer.removeAllListeners(channel)
    }
  },
  send(channel: string, ...args: unknown[]) {
    ipcRenderer.send(channel, ...args)
  },
  invoke(channel: string, ...args: unknown[]) {
    return ipcRenderer.invoke(channel, ...args)
  },

  // You can expose other APTs you need here.
  // ...
})

// Expose theme API
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChanged: (callback: (theme: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: string) => {
      callback(theme)
    }
    ipcRenderer.on('theme-changed', listener)
    return listener
  },
  removeThemeListener: () => {
    ipcRenderer.removeAllListeners('theme-changed')
  }
})