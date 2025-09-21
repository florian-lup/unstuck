import {
  app,
  BrowserWindow,
  Menu,
  nativeTheme,
  ipcMain,
  screen,
  globalShortcut,
} from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

let win: BrowserWindow | null

function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize
  const windowWidth = 450
  const windowHeight = 650

  win = new BrowserWindow({
    title: 'Unstuck',
    icon: path.join(process.env.VITE_PUBLIC, 'unstuck-logo.ico'),
    frame: false, // Remove window frame (title bar, borders)
    transparent: true, // Make window background transparent
    alwaysOnTop: true, // Keep on top of other windows
    resizable: false, // Prevent resizing
    skipTaskbar: true, // Don't show in taskbar
    width: windowWidth, // Fixed width for navigation bar
    height: windowHeight, // Fixed height for chat window
    x: Math.round((screenWidth - windowWidth) / 2), // Center horizontally
    y: 20, // Position at top of screen
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Make window click-through by default (ignores mouse events on empty space)
  win.setIgnoreMouseEvents(true, { forward: true })

  // Handle window events to maintain always-on-top behavior
  win.on('blur', () => {
    // Ensure window stays on top even when it loses focus
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver', 1)
    }
  })

  win.on('focus', () => {
    // Maintain always-on-top when focused
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver', 1)
    }
  })

  // Handle show event to ensure proper positioning
  win.on('show', () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver', 1)
      win.focus()
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

void app.whenReady().then(() => {
  // Set the app name
  app.setName('Unstuck')

  // Remove the default menu bar
  Menu.setApplicationMenu(null)
  createWindow()

  // Handle theme detection
  ipcMain.handle('get-system-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Watch for theme changes
  nativeTheme.on('updated', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(
        'theme-changed',
        nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      )
    }
  })

  // Register global shortcut for navigation bar toggle
  globalShortcut.register('Shift+\\', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('toggle-navigation-bar')
    }
  })

  // Handle mouse event control for click-through functionality
  ipcMain.on(
    'set-ignore-mouse-events',
    (_event, ignore: boolean, options?: { forward?: boolean }) => {
      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(ignore, options ?? { forward: true })
      }
    }
  )

  // Handle window always-on-top control
  ipcMain.on('ensure-always-on-top', () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver', 1)
      win.moveTop()
    }
  })

  // Handle window interaction events (when buttons are clicked)
  ipcMain.on('window-interaction', () => {
    if (win && !win.isDestroyed()) {
      // Immediately ensure window stays on top when user interacts
      win.setAlwaysOnTop(true, 'screen-saver', 1)
      win.moveTop()
      
      // Set a timeout to recheck the window state
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.setAlwaysOnTop(true, 'screen-saver', 1)
        }
      }, 100)
    }
  })
})

// Unregister all global shortcuts when app is quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
