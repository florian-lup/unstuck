import { BrowserWindow, screen, shell } from 'electron'
import path from 'node:path'

export class WindowManager {
  private overlayWindow: BrowserWindow | null = null
  private authWindow: BrowserWindow | null = null

  constructor(
    private readonly rendererDist: string,
    private readonly vitePublic: string,
    private readonly preloadPath: string,
    private readonly viteDevServerUrl?: string
  ) {}

  createAuthWindow(): BrowserWindow {
    this.authWindow = new BrowserWindow({
      title: 'Get Unstuck - Authentication',
      icon: path.join(this.vitePublic, 'unstuck-logo.ico'),
      width: 500,
      height: 600,
      center: true,
      resizable: false,
      frame: true,
      transparent: false,
      alwaysOnTop: false,
      show: false,
      backgroundColor: '#0a0a0a',
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        devTools: process.env.NODE_ENV === 'development',
        webSecurity: true,
      },
    })

    this.setupAuthWindowSecurity()
    this.setupAuthWindowEvents()
    this.loadAuthWindow()

    return this.authWindow
  }

  createOverlayWindow(): BrowserWindow {
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize
    const windowWidth = 450
    const windowHeight = 650

    this.overlayWindow = new BrowserWindow({
      title: 'Unstuck',
      icon: path.join(this.vitePublic, 'unstuck-logo.ico'),
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      width: windowWidth,
      height: windowHeight,
      x: Math.round((screenWidth - windowWidth) / 2),
      y: 20,
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        devTools: process.env.NODE_ENV === 'development',
        webSecurity: true,
      },
    })

    this.setupOverlayWindowSecurity()
    this.setupOverlayWindowEvents()
    this.loadOverlayWindow()

    // Make window click-through by default
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true })

    return this.overlayWindow
  }

  private setupAuthWindowSecurity(): void {
    if (!this.authWindow) return

    // Remove menu bar
    this.authWindow.setMenuBarVisibility(false)

    // Block external navigation
    this.authWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl)
      
      if (parsedUrl.origin !== 'http://localhost:5173' && 
          parsedUrl.origin !== 'file://' &&
          !navigationUrl.includes('auth.html')) {
        console.log('Blocked navigation to:', navigationUrl)
        event.preventDefault()
      }
    })

    // Block new window creation
    this.authWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log('Blocked new window creation for:', url)
      shell.openExternal(url)
      return { action: 'deny' }
    })
  }

  private setupOverlayWindowSecurity(): void {
    if (!this.overlayWindow) return

    // Block external navigation
    this.overlayWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl)
      
      if (parsedUrl.origin !== 'http://localhost:5173' && 
          parsedUrl.origin !== 'file://' &&
          !navigationUrl.includes('index.html')) {
        console.log('Blocked navigation to:', navigationUrl)
        event.preventDefault()
      }
    })

    // Block new window creation
    this.overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log('Blocked new window creation for:', url)
      shell.openExternal(url)
      return { action: 'deny' }
    })
  }

  private setupAuthWindowEvents(): void {
    if (!this.authWindow) return

    this.authWindow.once('ready-to-show', () => {
      if (this.authWindow && !this.authWindow.isDestroyed()) {
        this.authWindow.show()
      }
    })

    this.authWindow.on('closed', () => {
      this.authWindow = null
    })
  }

  private setupOverlayWindowEvents(): void {
    if (!this.overlayWindow) return

    // Maintain always-on-top behavior
    this.overlayWindow.on('blur', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    })

    this.overlayWindow.on('focus', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    })

    this.overlayWindow.on('show', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
        this.overlayWindow.focus()
      }
    })

    this.overlayWindow.webContents.on('did-finish-load', () => {
      this.overlayWindow?.webContents.send('main-process-message', new Date().toLocaleString())
    })
  }

  private loadAuthWindow(): void {
    if (!this.authWindow) return

    if (this.viteDevServerUrl) {
      void this.authWindow.loadURL(`${this.viteDevServerUrl}/auth.html`)
    } else {
      void this.authWindow.loadFile(path.join(this.rendererDist, 'auth.html'))
    }
  }

  private loadOverlayWindow(): void {
    if (!this.overlayWindow) return

    if (this.viteDevServerUrl) {
      void this.overlayWindow.loadURL(this.viteDevServerUrl)
    } else {
      void this.overlayWindow.loadFile(path.join(this.rendererDist, 'index.html'))
    }
  }

  // Getters
  getAuthWindow(): BrowserWindow | null {
    return this.authWindow
  }

  getOverlayWindow(): BrowserWindow | null {
    return this.overlayWindow
  }

  // Window management methods
  closeAuthWindow(): void {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close()
      this.authWindow = null
    }
  }

  closeOverlayWindow(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.close()
      this.overlayWindow = null
    }
  }

  focusAuthWindow(): void {
    if (this.authWindow) {
      if (this.authWindow.isMinimized()) {
        this.authWindow.restore()
      }
      this.authWindow.focus()
    }
  }

  ensureOverlayOnTop(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      this.overlayWindow.moveTop()
    }
  }

  setOverlayMouseEvents(ignore: boolean, options?: { forward?: boolean }): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setIgnoreMouseEvents(ignore, options ?? { forward: true })
    }
  }
}
