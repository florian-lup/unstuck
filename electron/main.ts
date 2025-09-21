import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
  globalShortcut,
  shell,
  safeStorage,
} from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { authService } from './auth-service'
import { loadEnvironmentConfig, validateConfig } from './env-loader'
import { SecurityValidator } from './security-validators'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Set the app name as early as possible
app.setName('Unstuck')

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let overlayWindow: BrowserWindow | null
let authWindow: BrowserWindow | null

// Handle OAuth callback URLs
async function handleOAuthCallback(url: string) {
  try {
    const user = await authService.handleOAuthCallback(url)
    if (user && authWindow && !authWindow.isDestroyed()) {
      // Notify renderer of successful authentication
      authWindow.webContents.send('auth-success', user)
    }
  } catch (error) {
    console.error('OAuth callback error:', error)
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.webContents.send('auth-error', (error as Error).message)
    }
  }
}

function createAuthWindow() {
  authWindow = new BrowserWindow({
    title: 'Get Unstuck - Authentication',
    icon: path.join(process.env.VITE_PUBLIC, 'unstuck-logo.ico'),
    width: 500,
    height: 700,
    center: true,
    resizable: false,
    frame: true, // Normal window with title bar
    transparent: false, // Normal opaque window
    alwaysOnTop: false, // Normal window behavior
    show: false, // Don't show immediately to prevent blank page flash
    backgroundColor: '#0a0a0a', // Set background color to match loading screen
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      devTools: process.env.NODE_ENV === 'development',
      webSecurity: true,
    },
  })

  // Remove menu bar for cleaner look
  authWindow.setMenuBarVisibility(false)

  // Show window only when content is ready to prevent blank page flash
  authWindow.once('ready-to-show', () => {
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.show()
    }
  })

  // Security: Block external navigation
  authWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    
    // Allow navigation to same origin or localhost
    if (parsedUrl.origin !== 'http://localhost:5173' && 
        parsedUrl.origin !== 'file://' &&
        !navigationUrl.includes('auth.html')) {
      console.log('Blocked navigation to:', navigationUrl)
      event.preventDefault()
    }
  })

  // Security: Block new window creation
  authWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('Blocked new window creation for:', url)
    shell.openExternal(url) // Open in system browser instead
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    void authWindow.loadURL(`${VITE_DEV_SERVER_URL}/auth.html`)
  } else {
    void authWindow.loadFile(path.join(RENDERER_DIST, 'auth.html'))
  }

  // Handle auth window events
  authWindow.on('closed', () => {
    authWindow = null
    // If auth window is closed without authentication, quit the app
    if (!overlayWindow) {
      app.quit()
    }
  })

  return authWindow
}

function createOverlayWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize
  const overlayWindowdowWidth = 450
  const overlayWindowdowHeight = 650

  overlayWindow = new BrowserWindow({
    title: 'Unstuck',
    icon: path.join(process.env.VITE_PUBLIC, 'unstuck-logo.ico'),
    frame: false, // Remove overlayWindowdow frame (title bar, borders)
    transparent: true, // Make overlayWindowdow background transparent
    alwaysOnTop: true, // Keep on top of other overlayWindowdows
    resizable: false, // Prevent resizing
    width: overlayWindowdowWidth, // Fixed width for navigation bar
    height: overlayWindowdowHeight, // Fixed height for chat overlayWindowdow
    x: Math.round((screenWidth - overlayWindowdowWidth) / 2), // Center horizontally
    y: 20, // Position at top of screen
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      devTools: process.env.NODE_ENV === 'development',
      webSecurity: true,
    },
  })

  // Make overlayWindowdow click-through by default (ignores mouse events on empty space)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  // Security: Block external navigation
  overlayWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    
    // Allow navigation to same origin or localhost only
    if (parsedUrl.origin !== 'http://localhost:5173' && 
        parsedUrl.origin !== 'file://' &&
        !navigationUrl.includes('index.html')) {
      console.log('Blocked navigation to:', navigationUrl)
      event.preventDefault()
    }
  })

  // Security: Block new window creation
  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('Blocked new window creation for:', url)
    shell.openExternal(url) // Open in system browser instead
    return { action: 'deny' }
  })

  // Handle overlayWindowdow events to maintain always-on-top behavior
  overlayWindow.on('blur', () => {
    // Ensure overlayWindowdow stays on top even when it loses focus
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    }
  })

  overlayWindow.on('focus', () => {
    // Maintain always-on-top when focused
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    }
  })

  // Handle show event to ensure proper positioning
  overlayWindow.on('show', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      overlayWindow.focus()
    }
  })

  // Test active push message to Renderer-process.
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    void overlayWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // overlayWindow.loadFile('dist/index.html')
    void overlayWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    overlayWindow = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createAuthWindow()
  }
})

void app.whenReady().then(async () => {
  // Set the app name
  app.setName('Unstuck')

  // Remove the default menu bar
  Menu.setApplicationMenu(null)
  
  // Load and validate environment configuration securely
  try {
    const config = loadEnvironmentConfig()
    validateConfig(config)
    
    // Initialize auth service in main process
    await authService.initialize(config.supabaseUrl, config.supabaseAnonKey)
    
    // Listen for auth state changes
    authService.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event)
      if (event === 'SIGNED_IN' && session?.user) {
        // Close auth window and open overlay
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close()
          authWindow = null
        }
        createOverlayWindow()
      } else if (event === 'SIGNED_OUT') {
        // Close overlay and show auth window
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close()
          overlayWindow = null
        }
        if (!authWindow || authWindow.isDestroyed()) {
          createAuthWindow()
        }
      }
    })
  } catch (error) {
    console.error('Failed to initialize auth service:', error)
    app.quit()
    return
  }
  
  // Start with authentication window
  createAuthWindow()


  // Register global shortcut for navigation bar toggle
  globalShortcut.register('Shift+\\', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('toggle-navigation-bar')
    }
  })

  // Handle mouse event control for click-through functionality
  ipcMain.on('set-ignore-mouse-events', (_event, ignore: unknown, options?: unknown) => {
    try {
      SecurityValidator.checkRateLimit('set-ignore-mouse-events', 20, 60000)
      
      const validIgnore = SecurityValidator.validateBoolean(ignore, 'ignore')
      const validOptions = SecurityValidator.validateMouseEventOptions(options)
      
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setIgnoreMouseEvents(validIgnore, validOptions ?? { forward: true })
      }
    } catch (error) {
      console.error('Mouse events error:', error)
    }
  })

  // Handle overlayWindowdow always-on-top control
  ipcMain.on('ensure-always-on-top', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      overlayWindow.moveTop()
    }
  })

  // Handle overlayWindowdow interaction events (when buttons are clicked)
  ipcMain.on('overlayWindowdow-interaction', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      // Immediately ensure overlayWindowdow stays on top when user interacts
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      overlayWindow.moveTop()
      
      // Set a timeout to recheck the overlayWindowdow state
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
        }
      }, 100)
    }
  })

  // Handle authentication success
  ipcMain.on('auth-success', (_event, user) => {
    console.log('Authentication successful for user:', user.email)
    
    // Close auth window
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close()
      authWindow = null
    }
    
    // Create overlay window
    createOverlayWindow()
  })

  // Handle opening external URLs (for OAuth)
  ipcMain.handle('open-external-url', async (_event, url: unknown) => {
    try {
      SecurityValidator.checkRateLimit('open-external-url', 5, 60000)
      const validUrl = SecurityValidator.validateUrl(url)
      
      await shell.openExternal(validUrl)
      return { success: true }
    } catch (error) {
      console.error('Failed to open external URL:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Handle deep links for OAuth callbacks
  app.setAsDefaultProtocolClient('unstuck')
  
  const gotTheLock = app.requestSingleInstanceLock()
  
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (_event, commandLine, _workingDirectory) => {
      // Someone tried to run a second instance, focus our auth window instead
      if (authWindow) {
        if (authWindow.isMinimized()) authWindow.restore()
        authWindow.focus()
      }
      
      // Handle deep link from command line
      const url = commandLine.find(arg => arg.startsWith('unstuck://'))
      if (url) {
        handleOAuthCallback(url)
      }
    })
  }

  // Handle deep links on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleOAuthCallback(url)
  })

  // Handle user logout
  ipcMain.on('user-logout', () => {
    console.log('User logging out...')
    
    // Close overlay window
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close()
      overlayWindow = null
    }
    
    // Create auth window
    createAuthWindow()
  })

  // Secure authentication IPC handlers with validation
  ipcMain.handle('auth-get-oauth-url', async (_event, provider: unknown) => {
    try {
      SecurityValidator.checkRateLimit('auth-get-oauth-url', 5, 60000)
      const validProvider = SecurityValidator.validateOAuthProvider(provider)
      
      const url = await authService.getOAuthUrl(validProvider)
      return { success: true, url }
    } catch (error) {
      console.error('Get OAuth URL error:', SecurityValidator.sanitizeUserForLogging(error))
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth-get-session', async () => {
    try {
      SecurityValidator.checkRateLimit('auth-get-session', 10, 60000)
      
      const { user, session } = await authService.getSession()
      const sanitizedUser = user ? SecurityValidator.sanitizeUserForLogging(user) : null
      
      return { 
        success: true, 
        user: sanitizedUser, 
        session: session ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: sanitizedUser,
        } : null 
      }
    } catch (error) {
      console.error('Get session error:', SecurityValidator.sanitizeUserForLogging(error))
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth-sign-out', async () => {
    try {
      SecurityValidator.checkRateLimit('auth-sign-out', 3, 60000)
      
      await authService.signOut()
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', SecurityValidator.sanitizeUserForLogging(error))
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth-is-secure-storage', () => {
    try {
      SecurityValidator.checkRateLimit('auth-is-secure-storage', 10, 60000)
      return safeStorage.isEncryptionAvailable()
    } catch (error) {
      console.error('Secure storage check error:', error)
      return false
    }
  })
})

// Unregister all global shortcuts when app is quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
