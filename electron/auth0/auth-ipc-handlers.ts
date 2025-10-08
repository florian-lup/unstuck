import { ipcMain, shell } from 'electron'
import { Auth0Config } from '../../config/auth.config'
import { WindowManager } from '../window-manager'
import { auth0Service } from './auth0-service'
import { SecurityValidator } from './security-validators'

export class AuthIPCHandlers {
  private config!: Auth0Config // Will be initialized in setConfig() method

  constructor(private readonly windowManager: WindowManager) {}

  setConfig(config: Auth0Config): void {
    this.config = config
  }

  registerHandlers(): void {
    this.registerAuthFlowHandlers()
    this.registerWindowHandlers()
    this.registerMouseEventHandlers()
  }

  private registerAuthFlowHandlers(): void {
    // Auth0 Device Authorization Flow
    ipcMain.handle('auth0-start-flow', async () => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.startFlow
        SecurityValidator.checkRateLimit(
          'auth0-start-flow',
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        )

        const deviceAuth = await auth0Service.startDeviceAuthFlow()

        // Open the verification URL in system browser
        await shell.openExternal(deviceAuth.verification_uri)

        return { success: true, ...deviceAuth }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.handle('auth0-get-session', async () => {
      try {
        const rateLimitConfig =
          this.config.rateLimiting.ipcRateLimits.getSession
        SecurityValidator.checkRateLimit(
          'auth0-get-session',
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        )

        const sessionResult = await auth0Service.getSession()
        const user = sessionResult.user
        const tokens = sessionResult.tokens
        const sanitizedUser = user
          ? SecurityValidator.sanitizeUserForLogging(user)
          : null

        return {
          success: true,
          user: sanitizedUser,
          session: user && tokens ? { user: sanitizedUser, tokens } : null,
          tokens: tokens ?? null,
        }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.handle('auth0-sign-out', async () => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.signOut
        SecurityValidator.checkRateLimit(
          'auth0-sign-out',
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        )

        await auth0Service.signOut()
        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.handle('auth0-is-secure-storage', async () => {
      try {
        const rateLimitConfig =
          this.config.rateLimiting.ipcRateLimits.isSecureStorage
        SecurityValidator.checkRateLimit(
          'auth0-is-secure-storage',
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        )
        return await auth0Service.isSecureStorage()
      } catch {
        return false
      }
    })

    ipcMain.handle('auth0-cancel-device-flow', () => {
      try {
        const rateLimitConfig =
          this.config.rateLimiting.ipcRateLimits.cancelDeviceFlow
        SecurityValidator.checkRateLimit(
          'auth0-cancel-device-flow',
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        )
        auth0Service.cancelDeviceAuthorization()
        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    })

    // External URL handling
    ipcMain.handle('open-external-url', async (_event, url: unknown) => {
      try {
        const rateLimitConfig =
          this.config.rateLimiting.ipcRateLimits.openExternalUrl
        SecurityValidator.checkRateLimit(
          'open-external-url',
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        )
        const validUrl = SecurityValidator.validateUrl(url)

        await shell.openExternal(validUrl)
        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    })
  }

  private registerWindowHandlers(): void {
    // Legacy auth success handler (kept for compatibility)
    ipcMain.on('auth-success', (_event, _user) => {
      this.windowManager.closeAuthWindow()
      this.windowManager.createOverlayWindow()
    })

    // User logout handler
    ipcMain.on('user-logout', () => {
      this.windowManager.closeOverlayWindow()
      this.windowManager.createAuthWindow()
    })

    // Window interaction handler
    ipcMain.on('overlay-interaction', () => {
      this.windowManager.ensureOverlayOnTop()

      // Double-check after a short delay
      setTimeout(() => {
        this.windowManager.ensureOverlayOnTop()
      }, 100)
    })

    // Always on top handler
    ipcMain.on('ensure-always-on-top', () => {
      this.windowManager.ensureOverlayOnTop()
    })
  }

  private registerMouseEventHandlers(): void {
    // Handle mouse event control for click-through functionality
    ipcMain.on(
      'set-ignore-mouse-events',
      (_event, ignore: unknown, options?: unknown) => {
        try {
          const validIgnore = SecurityValidator.validateBoolean(
            ignore,
            'ignore'
          )
          const validOptions =
            SecurityValidator.validateMouseEventOptions(options)

          this.windowManager.setOverlayMouseEvents(
            validIgnore,
            validOptions ?? { forward: true }
          )
        } catch {
          // Silently ignore mouse event errors
        }
      }
    )
  }

  // Setup auth state change listeners
  setupAuthStateListeners(): void {
    auth0Service.onAuthStateChange((event, session, error) => {
      const authWindow = this.windowManager.getAuthWindow()
      const overlayWindow = this.windowManager.getOverlayWindow()

      if (event === 'SIGNED_IN' && session?.user) {
        // Notify renderer processes
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send('auth0-success', session)
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('auth0-success', session)
        }

        // Close auth window and open overlay
        this.windowManager.closeAuthWindow()
        this.windowManager.createOverlayWindow()
      } else if (event === 'SIGNED_OUT') {
        // Notify renderer processes
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send('auth0-success', null)
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('auth0-success', null)
        }

        // Close overlay and show auth window
        this.windowManager.closeOverlayWindow()
        if (!authWindow || authWindow.isDestroyed()) {
          this.windowManager.createAuthWindow()
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Notify renderer processes of token refresh
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send('auth0-token-refresh', session)
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('auth0-token-refresh', session)
        }
      } else if (event === 'ERROR') {
        // Notify renderer processes of errors
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send(
            'auth0-error',
            error ?? 'Authentication error'
          )
        }
      }
    })
  }

  /**
   * Clean up all IPC handlers to prevent memory leaks
   */
  cleanup(): void {
    // Remove all IPC handlers
    ipcMain.removeHandler('auth0-start-flow')
    ipcMain.removeHandler('auth0-get-session')
    ipcMain.removeHandler('auth0-sign-out')
    ipcMain.removeHandler('auth0-is-secure-storage')
    ipcMain.removeHandler('auth0-cancel-device-flow')
    ipcMain.removeHandler('open-external-url')

    // Remove all IPC listeners
    ipcMain.removeAllListeners('auth-success')
    ipcMain.removeAllListeners('user-logout')
    ipcMain.removeAllListeners('overlay-interaction')
    ipcMain.removeAllListeners('ensure-always-on-top')
    ipcMain.removeAllListeners('set-ignore-mouse-events')
    ipcMain.removeAllListeners('window-interaction')
  }
}
