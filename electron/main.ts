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

let overlayWindow: BrowserWindow | null

function createWindow() {
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
    },
  })

  // Make overlayWindowdow click-through by default (ignores mouse events on empty space)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

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
  // On OS X it's common to re-create a overlayWindowdow in the app when the
  // dock icon is clicked and there are no other overlayWindowdows open.
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
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send(
        'theme-changed',
        nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      )
    }
  })

  // Register global shortcut for navigation bar toggle
  globalShortcut.register('Shift+\\', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('toggle-navigation-bar')
    }
  })

  // Handle mouse event control for click-through functionality
  ipcMain.on(
    'set-ignore-mouse-events',
    (_event, ignore: boolean, options?: { forward?: boolean }) => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setIgnoreMouseEvents(ignore, options ?? { forward: true })
      }
    }
  )

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
})

// Unregister all global shortcuts when app is quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
