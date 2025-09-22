import { app, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { auth0Service } from './auth0-service'
import { auth0Config, validateAuth0Config } from '../config/auth.config'
import { WindowManager } from './window-manager'
import { AuthIPCHandlers } from './auth-ipc-handlers'
import { AppLifecycleManager } from './app-lifecycle'
import { ShortcutsManager } from './shortcuts-manager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Environment and path setup
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Initialize managers
const windowManager = new WindowManager(
  RENDERER_DIST,
  process.env.VITE_PUBLIC,
  path.join(__dirname, 'preload.mjs'),
  VITE_DEV_SERVER_URL
)

const authIPCHandlers = new AuthIPCHandlers(windowManager)
const appLifecycle = new AppLifecycleManager(windowManager)
const shortcutsManager = new ShortcutsManager(windowManager)

// App initialization
void app.whenReady().then(async () => {
  // Set app defaults
  appLifecycle.setAppDefaults()
  
  // Remove the default menu bar
  Menu.setApplicationMenu(null)
  
  // Ensure single instance
  if (!appLifecycle.ensureSingleInstance()) {
    return
  }
  
  // Setup app lifecycle events
  appLifecycle.setupAppEvents()
  
  // Setup shortcuts
  shortcutsManager.registerGlobalShortcuts()
  shortcutsManager.setupShortcutCleanup()
  
  // Load and validate Auth0 configuration
  try {
    validateAuth0Config(auth0Config)
    
    // Initialize Auth0 service in main process (this will restore any existing session)
    await auth0Service.initialize(auth0Config.domain, auth0Config.clientId)
    
    // Setup auth state listeners
    authIPCHandlers.setupAuthStateListeners()
    
    // Register IPC handlers
    authIPCHandlers.registerHandlers()
    
    // Check if user is already signed in and create appropriate window
    if (auth0Service.isSignedIn()) {
      console.log('User already signed in, opening main application')
      windowManager.createOverlayWindow()
    } else {
      console.log('No valid session found, showing authentication window')
      windowManager.createAuthWindow()
    }
    
  } catch (error) {
    console.error('Failed to initialize Auth0 configuration:', error)
    app.quit()
    return
  }
})
