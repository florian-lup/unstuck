export interface IElectronAPI {
  getSystemTheme: () => Promise<string>
  onThemeChanged: (callback: (theme: string) => void) => void
  removeThemeListener: () => void
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI
    ipcRenderer: {
      on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
      off: (channel: string, ...args: any[]) => void
      send: (channel: string, ...args: any[]) => void
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }
}
