import { BrowserWindow, screen, shell, Menu, Tray, nativeImage, app, ipcMain, globalShortcut } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs from "fs/promises";
import path from "path";
import os from "os";
import AutoLaunch from "auto-launch";
import fs$1 from "fs";
class TokenManager {
  config;
  domain;
  clientId;
  audience;
  refreshAttempts = /* @__PURE__ */ new Map();
  constructor(config, domain, clientId, audience) {
    this.config = config;
    this.domain = domain;
    this.clientId = clientId;
    this.audience = audience;
  }
  // Configurable constants
  get REFRESH_RATE_LIMIT() {
    return this.config.rateLimiting.maxRefreshAttempts;
  }
  get REFRESH_RATE_WINDOW() {
    return this.config.rateLimiting.refreshWindowMinutes * 6e4;
  }
  get MIN_TOKEN_VALIDITY_BUFFER() {
    return this.config.tokenManagement.minValidityBufferMinutes * 6e4;
  }
  get REFRESH_TIMEOUT_SECONDS() {
    return this.config.tokenManagement.refreshTimeoutSeconds;
  }
  get USER_AGENT() {
    return this.config.appInfo.userAgent;
  }
  /**
   * Check if tokens are expired (with security buffer)
   */
  isTokenExpired(tokens) {
    return tokens.expires_at < Date.now() + this.MIN_TOKEN_VALIDITY_BUFFER;
  }
  /**
   * Refresh access tokens using refresh token
   */
  async refreshTokens(currentTokens) {
    if (!currentTokens.refresh_token) {
      throw new Error("No refresh token available");
    }
    const now = Date.now();
    const tokenExpiry = currentTokens.expires_at;
    if (tokenExpiry && tokenExpiry > now + this.MIN_TOKEN_VALIDITY_BUFFER) {
      throw new Error("Token refresh not needed - token still valid");
    }
    if (tokenExpiry && tokenExpiry < now - this.REFRESH_RATE_WINDOW) {
      throw new Error("Token expired too long ago - re-authentication required");
    }
    const refreshKey = currentTokens.refresh_token;
    this.validateRefreshRateLimit(refreshKey);
    if (this.config.security.validateDomainOnRefresh) {
      if (!this.domain || !this.domain.includes(".auth0.com") && !this.domain.includes(".us.auth0.com") && !this.domain.includes("auth.unstuck.gg")) {
        throw new Error("Invalid Auth0 domain for token refresh");
      }
    }
    const tokenEndpoint = `${this.domain}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: currentTokens.refresh_token
    });
    if (this.audience) {
      body.append("audience", this.audience);
    }
    let response;
    try {
      response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": this.USER_AGENT
        },
        body: body.toString(),
        signal: AbortSignal.timeout(this.REFRESH_TIMEOUT_SECONDS * 1e3)
      });
    } catch (error) {
      this.recordRefreshAttempt(refreshKey);
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error("Token refresh request timed out");
      }
      throw new Error(
        `Token refresh network error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
    if (!response.ok) {
      this.recordRefreshAttempt(refreshKey);
      let errorData = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      if (errorData.error === "invalid_grant") {
        throw new Error("Refresh token invalid - re-authentication required");
      }
      if (errorData.error === "invalid_client") {
        throw new Error(
          "Invalid client credentials - check Auth0 configuration"
        );
      }
      throw new Error(
        `Token refresh failed: ${errorData.error_description ?? errorData.error ?? "Unknown error"}`
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      this.recordRefreshAttempt(refreshKey);
      throw new Error("Invalid response format from token endpoint");
    }
    if (!data.access_token || !data.expires_in) {
      this.recordRefreshAttempt(refreshKey);
      throw new Error("Invalid token response - missing required fields");
    }
    const newExpiry = now + data.expires_in * 1e3;
    const maxValidityMs = this.config.tokenManagement.maxTokenValidityHours * 60 * 60 * 1e3;
    if (newExpiry <= now || newExpiry > now + maxValidityMs) {
      throw new Error(
        `Invalid token expiry in response (max allowed: ${this.config.tokenManagement.maxTokenValidityHours} hours)`
      );
    }
    const newTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? currentTokens.refresh_token,
      id_token: data.id_token,
      expires_at: newExpiry,
      token_type: data.token_type ?? "Bearer",
      scope: data.scope
    };
    this.clearRefreshAttempts(refreshKey);
    return newTokens;
  }
  /**
   * Validate rate limiting for token refresh attempts
   */
  validateRefreshRateLimit(refreshToken) {
    const now = Date.now();
    const attempt = this.refreshAttempts.get(refreshToken);
    if (!attempt) {
      return;
    }
    if (now - attempt.lastAttempt > this.REFRESH_RATE_WINDOW) {
      this.refreshAttempts.delete(refreshToken);
      return;
    }
    if (attempt.count >= this.REFRESH_RATE_LIMIT) {
      throw new Error(
        `Too many token refresh attempts. Please wait ${Math.ceil(this.REFRESH_RATE_WINDOW / 6e4)} minutes.`
      );
    }
  }
  /**
   * Record a failed refresh attempt
   */
  recordRefreshAttempt(refreshToken) {
    const now = Date.now();
    const attempt = this.refreshAttempts.get(refreshToken);
    if (!attempt || now - attempt.lastAttempt > this.REFRESH_RATE_WINDOW) {
      this.refreshAttempts.set(refreshToken, { count: 1, lastAttempt: now });
    } else {
      attempt.count++;
      attempt.lastAttempt = now;
    }
  }
  /**
   * Clear refresh attempts on successful refresh
   */
  clearRefreshAttempts(refreshToken) {
    this.refreshAttempts.delete(refreshToken);
  }
  /**
   * Revoke a token
   */
  async revokeToken(token) {
    const revokeEndpoint = `${this.domain}/oauth/revoke`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      token
    });
    await fetch(revokeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
  }
}
class SecureStorage {
  secureDir = path.join(os.homedir(), ".unstuck-secure");
  /**
   * Initialize secure storage directory
   */
  async initialize() {
    await this.ensureSecureDir();
  }
  /**
   * Check if OS-level secure storage is available
   */
  async isSecureStorageAvailable() {
    try {
      const { safeStorage } = await import("electron");
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }
  /**
   * Get an item from secure storage
   */
  async getItem(key) {
    try {
      const { safeStorage } = await import("electron");
      if (!safeStorage.isEncryptionAvailable()) {
        console.error("OS-level encryption is required but not available");
        return null;
      }
      const filePath = path.join(this.secureDir, `${key}.dat`);
      const encrypted = await fs.readFile(filePath);
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  }
  /**
   * Store an item in secure storage
   */
  async setItem(key, value) {
    try {
      const { safeStorage } = await import("electron");
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(
          "OS-level encryption is required but not available. Please ensure Windows Credential Manager is working properly."
        );
      }
      const encrypted = safeStorage.encryptString(value);
      const filePath = path.join(this.secureDir, `${key}.dat`);
      await fs.writeFile(filePath, encrypted, { mode: 384 });
    } catch (error) {
      console.error("Failed to store secure item:", error);
      throw error;
    }
  }
  /**
   * Remove an item from secure storage
   */
  async removeItem(key) {
    try {
      const filePath = path.join(this.secureDir, `${key}.dat`);
      await fs.unlink(filePath);
    } catch {
    }
  }
  /**
   * Ensure secure directory exists with proper permissions
   */
  async ensureSecureDir() {
    try {
      await fs.mkdir(this.secureDir, { recursive: true, mode: 448 });
    } catch {
    }
  }
}
class DeviceFlowManager {
  config;
  domain;
  clientId;
  audience;
  scope;
  currentPollInterval = null;
  currentPollTimeout = null;
  eventCallback = null;
  constructor(config, domain, clientId, audience, scope) {
    this.config = config;
    this.domain = domain;
    this.clientId = clientId;
    this.audience = audience;
    this.scope = scope ?? "openid profile email offline_access";
  }
  get POLLING_INTERVAL() {
    return this.config.deviceFlow.pollingInterval;
  }
  get SLOW_DOWN_INCREMENT() {
    return this.config.deviceFlow.slowDownIncrement;
  }
  get TIMEOUT_MINUTES() {
    return this.config.deviceFlow.timeoutMinutes;
  }
  /**
   * Set callback for device flow events
   */
  setEventCallback(callback) {
    this.eventCallback = callback;
  }
  /**
   * Start Device Authorization Flow
   */
  async startDeviceAuthFlow() {
    const deviceCodeEndpoint = `${this.domain}/oauth/device/code`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scope
    });
    if (this.audience) {
      body.append("audience", this.audience);
    }
    const response = await fetch(deviceCodeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Auth0 API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error,
        error_description: errorData.error_description
      });
      throw new Error(
        `Device authorization request failed: ${errorData.error_description ?? errorData.error ?? response.statusText}`
      );
    }
    const deviceData = await response.json();
    const pollingInterval = deviceData.interval ?? this.POLLING_INTERVAL;
    this.pollForDeviceAuthorization(deviceData.device_code, pollingInterval);
    return {
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      expires_in: deviceData.expires_in ?? 600
    };
  }
  /**
   * Cancel current device authorization flow
   */
  cancelDeviceAuthorization() {
    if (this.currentPollInterval) {
      clearInterval(this.currentPollInterval);
      this.currentPollInterval = null;
    }
    if (this.currentPollTimeout) {
      clearTimeout(this.currentPollTimeout);
      this.currentPollTimeout = null;
    }
  }
  /**
   * Poll for device authorization completion
   */
  pollForDeviceAuthorization(deviceCode, interval) {
    const tokenEndpoint = `${this.domain}/oauth/token`;
    this.cancelDeviceAuthorization();
    this.currentPollInterval = setInterval(() => {
      void (async () => {
        try {
          const body = new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: deviceCode,
            client_id: this.clientId
          });
          const response = await fetch(tokenEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
          });
          const data = await response.json();
          if (response.ok) {
            this.cancelDeviceAuthorization();
            if (!data.access_token) {
              throw new Error(
                "Missing access_token in successful token response"
              );
            }
            const tokens = {
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              id_token: data.id_token,
              expires_at: Date.now() + (data.expires_in ?? 3600) * 1e3,
              token_type: data.token_type ?? "Bearer",
              scope: data.scope
            };
            this.eventCallback?.("SUCCESS", tokens);
          } else if (data.error === "authorization_pending") {
          } else if (data.error === "slow_down") {
            this.cancelDeviceAuthorization();
            const newInterval = interval + this.SLOW_DOWN_INCREMENT;
            setTimeout(() => {
              this.pollForDeviceAuthorization(deviceCode, newInterval);
            }, newInterval * 1e3);
          } else if (data.error === "expired_token") {
            this.cancelDeviceAuthorization();
            this.eventCallback?.(
              "ERROR",
              void 0,
              "Device code expired. Please try again."
            );
          } else if (data.error === "access_denied") {
            this.cancelDeviceAuthorization();
            this.eventCallback?.("ERROR", void 0, "Access denied by user.");
          } else {
            this.cancelDeviceAuthorization();
            this.eventCallback?.(
              "ERROR",
              void 0,
              data.error_description ?? "Authorization failed"
            );
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      })();
    }, interval * 1e3);
    this.currentPollTimeout = setTimeout(
      () => {
        this.cancelDeviceAuthorization();
        this.eventCallback?.(
          "ERROR",
          void 0,
          "Authorization timeout. Please try again."
        );
      },
      this.TIMEOUT_MINUTES * 60 * 1e3
    );
  }
}
class Auth0Service {
  domain = "";
  clientId = "";
  audience;
  scope = "openid profile email offline_access";
  // Specialized components
  tokenManager;
  secureStorage;
  deviceFlowManager;
  // Session state
  currentSession = null;
  listeners = /* @__PURE__ */ new Set();
  /**
   * Initialize Auth0 client configuration and all components
   */
  async initialize(domain, clientId, config) {
    if (!domain || !clientId) {
      throw new Error("Missing Auth0 credentials");
    }
    if (!domain.includes(".auth0.com") && !domain.includes(".us.auth0.com") && !domain.includes("auth.unstuck.gg")) {
      throw new Error("Invalid Auth0 domain format");
    }
    this.domain = domain.startsWith("https://") ? domain : `https://${domain}`;
    this.clientId = clientId;
    this.audience = config.audience;
    this.scope = config.scope;
    this.tokenManager = new TokenManager(
      config,
      this.domain,
      this.clientId,
      this.audience
    );
    this.secureStorage = new SecureStorage();
    this.deviceFlowManager = new DeviceFlowManager(
      config,
      this.domain,
      this.clientId,
      this.audience,
      this.scope
    );
    await this.secureStorage.initialize();
    this.deviceFlowManager.setEventCallback((event, tokens, error) => {
      if (event === "SUCCESS" && tokens) {
        void this.handleDeviceFlowSuccess(tokens);
      } else if (event === "ERROR") {
        this.notifyListeners("ERROR", null, error);
      }
    });
    await this.restoreSession();
    console.log(
      "Auth0 service initialized successfully with modular components"
    );
  }
  /**
   * Start Device Authorization Flow
   */
  async startDeviceAuthFlow() {
    return await this.deviceFlowManager.startDeviceAuthFlow();
  }
  /**
   * Cancel current device authorization flow
   */
  cancelDeviceAuthorization() {
    this.deviceFlowManager.cancelDeviceAuthorization();
  }
  /**
   * Check if user is currently signed in with valid tokens
   */
  isSignedIn() {
    if (!this.currentSession) return false;
    return !this.tokenManager.isTokenExpired(this.currentSession.tokens);
  }
  /**
   * Get current session with automatic token refresh
   */
  async getSession() {
    if (this.currentSession) {
      if (this.tokenManager.isTokenExpired(this.currentSession.tokens)) {
        try {
          const refreshedTokens = await this.tokenManager.refreshTokens(
            this.currentSession.tokens
          );
          this.currentSession.tokens = refreshedTokens;
          await this.storeSession(this.currentSession);
          this.notifyListeners("TOKEN_REFRESHED", this.currentSession);
        } catch (error) {
          console.error(
            "Automatic token refresh failed:",
            error instanceof Error ? error.message : "Unknown error"
          );
          if (error instanceof Error && (error.message.includes("re-authentication required") || error.message.includes("expired too long ago") || error.message.includes("Too many token refresh attempts"))) {
            await this.signOut();
            return { user: null, tokens: null };
          }
          console.warn("Continuing with potentially expired tokens");
        }
      }
      return {
        user: this.currentSession.user,
        tokens: this.currentSession.tokens
      };
    }
    return { user: null, tokens: null };
  }
  /**
   * Sign out user and clear all stored tokens
   */
  async signOut() {
    try {
      if (this.currentSession?.tokens.refresh_token) {
        await this.tokenManager.revokeToken(
          this.currentSession.tokens.refresh_token
        );
      }
      await this.clearSession();
      this.currentSession = null;
      this.deviceFlowManager.cancelDeviceAuthorization();
      this.notifyListeners("SIGNED_OUT", null);
      console.log("🔒 Successfully signed out");
    } catch (error) {
      console.error("Sign out error:", error);
      await this.clearSession();
      this.currentSession = null;
      this.notifyListeners("SIGNED_OUT", null);
    }
  }
  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback) {
    this.listeners.add(callback);
    return {
      unsubscribe: () => {
        this.listeners.delete(callback);
      }
    };
  }
  /**
   * Check if secure storage is available
   */
  async isSecureStorage() {
    return await this.secureStorage.isSecureStorageAvailable();
  }
  // Private methods
  /**
   * Handle successful device flow completion
   */
  async handleDeviceFlowSuccess(tokens) {
    try {
      const user = await this.getUserInfo(tokens.access_token);
      const session = { user, tokens };
      await this.storeSession(session);
      this.currentSession = session;
      this.notifyListeners("SIGNED_IN", session);
    } catch (error) {
      console.error("Failed to complete device flow:", error);
      this.notifyListeners("ERROR", null, "Failed to complete authentication");
    }
  }
  /**
   * Get user information from Auth0
   */
  async getUserInfo(accessToken) {
    const userInfoEndpoint = `${this.domain}/userinfo`;
    const response = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      throw new Error(`User info request failed: ${response.statusText}`);
    }
    return await response.json();
  }
  /**
   * Store session using secure storage
   */
  async storeSession(session) {
    await this.secureStorage.setItem("auth0_session", JSON.stringify(session));
  }
  /**
   * Restore session from secure storage
   */
  async restoreSession() {
    try {
      const sessionData = await this.secureStorage.getItem("auth0_session");
      if (sessionData) {
        const restoredSession = JSON.parse(sessionData);
        if (this.tokenManager.isTokenExpired(restoredSession.tokens)) {
          console.log(
            "Restored session has expired tokens, attempting refresh..."
          );
          this.currentSession = restoredSession;
          try {
            const refreshedTokens = await this.tokenManager.refreshTokens(
              restoredSession.tokens
            );
            this.currentSession.tokens = refreshedTokens;
            await this.storeSession(this.currentSession);
            this.notifyListeners("SIGNED_IN", this.currentSession);
          } catch (refreshError) {
            console.warn(
              "Failed to refresh restored tokens:",
              refreshError instanceof Error ? refreshError.message : "Unknown error"
            );
            await this.clearSession();
            this.currentSession = null;
          }
        } else {
          this.currentSession = restoredSession;
          this.notifyListeners("SIGNED_IN", this.currentSession);
        }
      }
    } catch (error) {
      console.warn(
        "Failed to restore session:",
        error instanceof Error ? error.message : "Unknown error"
      );
      await this.clearSession();
      this.currentSession = null;
    }
  }
  /**
   * Clear session from secure storage
   */
  async clearSession() {
    await this.secureStorage.removeItem("auth0_session");
  }
  /**
   * Notify all listeners of auth events
   */
  notifyListeners(event, session, error) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, session, error);
      } catch (err) {
        console.error("Auth listener error:", err);
      }
    });
  }
}
const auth0Service = new Auth0Service();
const auth0Config = {
  domain: "auth.unstuck.gg",
  clientId: "vVv9ZUVlCqxZQemAwrOGve0HSrK5rTlO",
  // Request access to user profile and enable refresh tokens
  scope: "openid profile email offline_access",
  // Audience for your gaming search API
  audience: "https://unstuck-search-api/",
  deviceFlow: {
    pollingInterval: 5,
    // Poll every 5 seconds
    slowDownIncrement: 5,
    // Increase by 5s when rate limited
    timeoutMinutes: 10
    // Give up after 10 minutes
  },
  tokenManagement: {
    refreshTimeoutSeconds: 30,
    // Network timeout for token refresh
    minValidityBufferMinutes: 5,
    // Refresh tokens 5min before expiry
    fallbackStorageExpiryHours: 24,
    // Fallback storage expires in 24h
    maxTokenValidityHours: 24
    // Maximum allowed token validity (security limit)
  },
  rateLimiting: {
    maxRefreshAttempts: 5,
    // Max 5 refresh attempts
    refreshWindowMinutes: 10080,
    // Within 10080 minutes window
    ipcRateLimits: {
      startFlow: { requests: 5, windowMs: 6e4 },
      getSession: { requests: 10, windowMs: 6e4 },
      signOut: { requests: 3, windowMs: 6e4 },
      isSecureStorage: { requests: 10, windowMs: 6e4 },
      cancelDeviceFlow: { requests: 10, windowMs: 6e4 },
      openExternalUrl: { requests: 5, windowMs: 6e4 }
    },
    defaultIpcRateLimit: { requests: 10, windowMs: 6e4 }
  },
  appInfo: {
    name: "Unstuck",
    version: "1.0.0",
    userAgent: "Unstuck/1.0.0"
  },
  security: {
    enforceHttpsRedirects: true,
    allowInsecureConnections: false,
    // Set to true for local development if needed
    validateDomainOnRefresh: true
  },
  environment: process.env.NODE_ENV === "production" ? "production" : "development"
};
function validateAuth0Config(config) {
  if (!config.domain || !config.clientId) {
    throw new Error(
      "Missing Auth0 configuration. Please set domain and clientId in config/auth.config.ts"
    );
  }
  if (!config.domain.includes(".auth0.com") && !config.domain.includes(".us.auth0.com") && !config.domain.includes("auth.unstuck.gg")) {
    throw new Error(
      'Invalid Auth0 domain format. Domain should be like "your-tenant.auth0.com" or a custom domain'
    );
  }
  if (config.scope && !config.scope.includes("openid")) {
    console.warn(
      'Auth0 scope should include "openid" for proper authentication'
    );
  }
  if (config.audience && !config.audience.startsWith("https://")) {
    console.warn("Auth0 audience should be a valid HTTPS URL");
  }
  if (config.deviceFlow.pollingInterval && config.deviceFlow.pollingInterval < 1) {
    throw new Error("Device flow polling interval must be at least 1 second");
  }
  if (config.tokenManagement.minValidityBufferMinutes && config.tokenManagement.minValidityBufferMinutes < 1) {
    throw new Error("Token validity buffer must be at least 1 minute");
  }
  if (config.environment === "production" && config.security.allowInsecureConnections) {
    throw new Error(
      "Insecure connections cannot be allowed in production environment"
    );
  }
}
class WindowManager {
  constructor(rendererDist, vitePublic, preloadPath, viteDevServerUrl) {
    this.rendererDist = rendererDist;
    this.vitePublic = vitePublic;
    this.preloadPath = preloadPath;
    this.viteDevServerUrl = viteDevServerUrl;
  }
  overlayWindow = null;
  authWindow = null;
  tray = null;
  createAuthWindow() {
    this.authWindow = new BrowserWindow({
      title: "Get Unstuck - Authentication",
      icon: path$1.join(this.vitePublic, "unstuck-logo.ico"),
      width: 500,
      height: 600,
      center: true,
      resizable: false,
      frame: true,
      transparent: false,
      alwaysOnTop: false,
      show: false,
      backgroundColor: "#0a0a0a",
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        devTools: true,
        // Always enable dev tools for auth window debugging
        webSecurity: true,
        // Safe memory optimization
        spellcheck: false,
        // Disable spellcheck to save memory
        offscreen: false
      }
    });
    this.setupAuthWindowSecurity();
    this.setupAuthWindowEvents();
    this.loadAuthWindow();
    return this.authWindow;
  }
  createOverlayWindow() {
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 500;
    const windowHeight = 650;
    this.overlayWindow = new BrowserWindow({
      title: "Unstuck",
      icon: path$1.join(this.vitePublic, "unstuck-logo.ico"),
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
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
        devTools: process.env.NODE_ENV === "development",
        webSecurity: true,
        // Safe memory optimization
        spellcheck: false,
        // Disable spellcheck to save memory
        offscreen: false,
        webgl: false,
        plugins: false
      }
    });
    this.setupOverlayWindowSecurity();
    this.setupOverlayWindowEvents();
    this.loadOverlayWindow();
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    return this.overlayWindow;
  }
  setupAuthWindowSecurity() {
    if (!this.authWindow) return;
    this.authWindow.setMenuBarVisibility(false);
    this.authWindow.webContents.on("will-navigate", (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== "http://localhost:5173" && parsedUrl.origin !== "file://" && !navigationUrl.includes("auth.html")) {
        console.log("Blocked navigation to:", navigationUrl);
        event.preventDefault();
      }
    });
    this.authWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log("Blocked new window creation for:", url);
      void shell.openExternal(url);
      return { action: "deny" };
    });
  }
  setupOverlayWindowSecurity() {
    if (!this.overlayWindow) return;
    this.overlayWindow.webContents.on(
      "will-navigate",
      (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== "http://localhost:5173" && parsedUrl.origin !== "file://" && !navigationUrl.includes("index.html")) {
          console.log("Blocked navigation to:", navigationUrl);
          event.preventDefault();
        }
      }
    );
    this.overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log("Blocked new window creation for:", url);
      void shell.openExternal(url);
      return { action: "deny" };
    });
  }
  setupAuthWindowEvents() {
    if (!this.authWindow) return;
    this.authWindow.once("ready-to-show", () => {
      if (this.authWindow && !this.authWindow.isDestroyed()) {
        this.authWindow.show();
      }
    });
    this.authWindow.on("closed", () => {
      this.authWindow = null;
    });
    if (process.env.NODE_ENV === "development")
      this.authWindow.webContents.on("context-menu", () => {
        const menu = Menu.buildFromTemplate([
          {
            label: "Open DevTools",
            click: () => {
              this.authWindow?.webContents.openDevTools({ mode: "detach" });
            }
          },
          {
            label: "Close DevTools",
            click: () => {
              this.authWindow?.webContents.closeDevTools();
            }
          },
          { type: "separator" },
          {
            label: "Reload",
            click: () => {
              this.authWindow?.webContents.reload();
            }
          }
        ]);
        menu.popup();
      });
  }
  setupOverlayWindowEvents() {
    if (!this.overlayWindow) return;
    this.overlayWindow.on("blur", () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      }
    });
    this.overlayWindow.on("focus", () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      }
    });
    this.overlayWindow.on("show", () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
        this.overlayWindow.focus();
      }
    });
    this.overlayWindow.webContents.on("did-finish-load", () => {
      this.overlayWindow?.webContents.send(
        "main-process-message",
        (/* @__PURE__ */ new Date()).toLocaleString()
      );
    });
    if (process.env.NODE_ENV === "development") {
      this.overlayWindow.webContents.on("context-menu", () => {
        const menu = Menu.buildFromTemplate([
          {
            label: "Open DevTools",
            click: () => {
              this.overlayWindow?.webContents.openDevTools({ mode: "detach" });
            }
          },
          {
            label: "Close DevTools",
            click: () => {
              this.overlayWindow?.webContents.closeDevTools();
            }
          },
          { type: "separator" },
          {
            label: "Reload",
            click: () => {
              this.overlayWindow?.webContents.reload();
            }
          }
        ]);
        menu.popup();
      });
    }
  }
  loadAuthWindow() {
    if (!this.authWindow) return;
    if (this.viteDevServerUrl) {
      void this.authWindow.loadURL(`${this.viteDevServerUrl}/auth.html`);
    } else {
      void this.authWindow.loadFile(path$1.join(this.rendererDist, "auth.html"));
    }
  }
  loadOverlayWindow() {
    if (!this.overlayWindow) return;
    if (this.viteDevServerUrl) {
      void this.overlayWindow.loadURL(this.viteDevServerUrl);
    } else {
      void this.overlayWindow.loadFile(
        path$1.join(this.rendererDist, "index.html")
      );
    }
  }
  // Getters
  getAuthWindow() {
    return this.authWindow;
  }
  getOverlayWindow() {
    return this.overlayWindow;
  }
  // Window management methods
  closeAuthWindow() {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }
  closeOverlayWindow() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }
  focusAuthWindow() {
    if (this.authWindow) {
      if (this.authWindow.isMinimized()) {
        this.authWindow.restore();
      }
      this.authWindow.focus();
    }
  }
  ensureOverlayOnTop() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      this.overlayWindow.moveTop();
    }
  }
  setOverlayMouseEvents(ignore, options) {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setIgnoreMouseEvents(
        ignore,
        options ?? { forward: true }
      );
    }
  }
  // System Tray Management
  createSystemTray() {
    const iconPath = path$1.join(this.vitePublic, "unstuck-logo.ico");
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    this.tray.setToolTip("Unstuck");
    this.setupTrayMenu();
    this.setupTrayEvents();
    return this.tray;
  }
  setupTrayMenu() {
    if (!this.tray) return;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show Overlay",
        type: "normal",
        click: () => {
          if (this.overlayWindow) {
            if (this.overlayWindow.isVisible()) {
              this.overlayWindow.focus();
            } else {
              this.overlayWindow.show();
            }
            this.ensureOverlayOnTop();
          }
        }
      },
      {
        label: "Hide Overlay",
        type: "normal",
        click: () => {
          if (this.overlayWindow?.isVisible()) {
            this.overlayWindow.hide();
          }
        }
      },
      { type: "separator" },
      {
        label: "Settings",
        type: "normal",
        click: () => {
          if (this.overlayWindow) {
            this.overlayWindow.show();
            this.overlayWindow.focus();
            this.ensureOverlayOnTop();
            this.overlayWindow.webContents.send("open-settings-menu");
          }
        }
      },
      { type: "separator" },
      {
        label: "Quit Unstuck",
        type: "normal",
        click: () => {
          app.quit();
        }
      }
    ]);
    this.tray.setContextMenu(contextMenu);
  }
  setupTrayEvents() {
    if (!this.tray) return;
    this.tray.on("click", () => {
      if (this.overlayWindow) {
        if (this.overlayWindow.isVisible()) {
          this.overlayWindow.hide();
        } else {
          this.overlayWindow.show();
          this.overlayWindow.focus();
          this.ensureOverlayOnTop();
        }
      }
    });
    this.tray.on("double-click", () => {
      if (this.overlayWindow) {
        this.overlayWindow.show();
        this.overlayWindow.focus();
        this.ensureOverlayOnTop();
      }
    });
  }
  // Tray management methods
  getTray() {
    return this.tray;
  }
  destroyTray() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
  updateTrayVisibility(overlayVisible) {
    if (!this.tray) return;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: overlayVisible ? "Hide Overlay" : "Show Overlay",
        type: "normal",
        click: () => {
          if (this.overlayWindow) {
            if (overlayVisible) {
              this.overlayWindow.hide();
            } else {
              this.overlayWindow.show();
              this.overlayWindow.focus();
              this.ensureOverlayOnTop();
            }
          }
        }
      },
      { type: "separator" },
      {
        label: "Settings",
        type: "normal",
        click: () => {
          if (this.overlayWindow) {
            this.overlayWindow.show();
            this.overlayWindow.focus();
            this.ensureOverlayOnTop();
            this.overlayWindow.webContents.send("open-settings-menu");
          }
        }
      },
      { type: "separator" },
      {
        label: "Quit Unstuck",
        type: "normal",
        click: () => {
          app.quit();
        }
      }
    ]);
    this.tray.setContextMenu(contextMenu);
  }
}
const SecurityValidator = {
  /**
   * Validate OAuth provider
   */
  validateOAuthProvider(provider) {
    const validProviders = ["google", "github", "discord"];
    if (typeof provider !== "string") {
      throw new Error("OAuth provider must be a string");
    }
    if (!validProviders.includes(provider)) {
      throw new Error(
        `Invalid OAuth provider: ${provider}. Must be one of: ${validProviders.join(", ")}`
      );
    }
    return provider;
  },
  /**
   * Validate URL string
   */
  validateUrl(url) {
    if (typeof url !== "string") {
      throw new Error("URL must be a string");
    }
    if (url.length === 0) {
      throw new Error("URL cannot be empty");
    }
    if (url.length > 2048) {
      throw new Error("URL too long (max 2048 characters)");
    }
    if (!url.startsWith("https://")) {
      throw new Error("URL must use https:// protocol");
    }
    return url;
  },
  /**
   * Validate mouse event options
   */
  validateMouseEventOptions(options) {
    if (options === void 0 || options === null) {
      return void 0;
    }
    if (typeof options !== "object") {
      throw new Error("Mouse event options must be an object");
    }
    const opts = options;
    if ("forward" in opts && typeof opts.forward !== "boolean") {
      throw new Error("Mouse event forward option must be a boolean");
    }
    return { forward: opts.forward };
  },
  /**
   * Validate boolean value
   */
  validateBoolean(value, fieldName) {
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName} must be a boolean`);
    }
    return value;
  },
  /**
   * Validate string with length limits
   */
  validateString(value, fieldName, maxLength = 255) {
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be a string`);
    }
    if (value.length > maxLength) {
      throw new Error(`${fieldName} too long (max ${maxLength} characters)`);
    }
    return value;
  },
  /**
   * Sanitize user object for logging (remove sensitive fields)
   */
  sanitizeUserForLogging(user) {
    if (!user || typeof user !== "object") {
      return user;
    }
    const sanitized = { ...user };
    delete sanitized.access_token;
    delete sanitized.refresh_token;
    delete sanitized.session;
    delete sanitized.raw_app_meta_data;
    delete sanitized.raw_user_meta_data;
    const typedSanitized = sanitized;
    return {
      sub: typedSanitized.sub,
      email: typedSanitized.email,
      name: typedSanitized.name,
      nickname: typedSanitized.nickname,
      picture: typedSanitized.picture,
      email_verified: typedSanitized.email_verified,
      created_at: typedSanitized.created_at,
      updated_at: typedSanitized.updated_at,
      id: typedSanitized.id
      // Keep for backward compatibility
    };
  },
  /**
   * Rate limiting for IPC calls
   */
  rateLimitMap: /* @__PURE__ */ new Map(),
  checkRateLimit(channel, maxRequests, windowMs) {
    const now = Date.now();
    const key = channel;
    const record = this.rateLimitMap.get(key);
    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return;
    }
    if (record.count >= maxRequests) {
      throw new Error(`Rate limit exceeded for channel: ${channel}`);
    }
    record.count++;
  }
};
class AuthIPCHandlers {
  // Will be initialized in setConfig() method
  constructor(windowManager2) {
    this.windowManager = windowManager2;
  }
  config;
  setConfig(config) {
    this.config = config;
  }
  registerHandlers() {
    this.registerAuthFlowHandlers();
    this.registerWindowHandlers();
    this.registerMouseEventHandlers();
  }
  registerAuthFlowHandlers() {
    ipcMain.handle("auth0-start-flow", async () => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.startFlow;
        SecurityValidator.checkRateLimit(
          "auth0-start-flow",
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        );
        const deviceAuth = await auth0Service.startDeviceAuthFlow();
        await shell.openExternal(deviceAuth.verification_uri);
        return { success: true, ...deviceAuth };
      } catch (error) {
        console.error("Start Auth0 device flow error:", error);
        return { success: false, error: error.message };
      }
    });
    ipcMain.handle("auth0-get-session", async () => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.getSession;
        SecurityValidator.checkRateLimit(
          "auth0-get-session",
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        );
        const sessionResult = await auth0Service.getSession();
        const user = sessionResult.user;
        const tokens = sessionResult.tokens;
        const sanitizedUser = user ? SecurityValidator.sanitizeUserForLogging(user) : null;
        return {
          success: true,
          user: sanitizedUser,
          session: user && tokens ? { user: sanitizedUser, tokens } : null,
          tokens: tokens ?? null
        };
      } catch (error) {
        console.error(
          "Get Auth0 session error:",
          SecurityValidator.sanitizeUserForLogging(error)
        );
        return { success: false, error: error.message };
      }
    });
    ipcMain.handle("auth0-sign-out", async () => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.signOut;
        SecurityValidator.checkRateLimit(
          "auth0-sign-out",
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        );
        await auth0Service.signOut();
        return { success: true };
      } catch (error) {
        console.error(
          "Auth0 sign out error:",
          SecurityValidator.sanitizeUserForLogging(error)
        );
        return { success: false, error: error.message };
      }
    });
    ipcMain.handle("auth0-is-secure-storage", async () => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.isSecureStorage;
        SecurityValidator.checkRateLimit(
          "auth0-is-secure-storage",
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        );
        return await auth0Service.isSecureStorage();
      } catch (error) {
        console.error("Secure storage check error:", error);
        return false;
      }
    });
    ipcMain.handle("auth0-cancel-device-flow", () => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.cancelDeviceFlow;
        SecurityValidator.checkRateLimit(
          "auth0-cancel-device-flow",
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        );
        auth0Service.cancelDeviceAuthorization();
        return { success: true };
      } catch (error) {
        console.error("Cancel device flow error:", error);
        return { success: false, error: error.message };
      }
    });
    ipcMain.handle("open-external-url", async (_event, url) => {
      try {
        const rateLimitConfig = this.config.rateLimiting.ipcRateLimits.openExternalUrl;
        SecurityValidator.checkRateLimit(
          "open-external-url",
          rateLimitConfig.requests,
          rateLimitConfig.windowMs
        );
        const validUrl = SecurityValidator.validateUrl(url);
        await shell.openExternal(validUrl);
        return { success: true };
      } catch (error) {
        console.error("Failed to open external URL:", error);
        return { success: false, error: error.message };
      }
    });
  }
  registerWindowHandlers() {
    ipcMain.on("auth-success", (_event, _user) => {
      this.windowManager.closeAuthWindow();
      this.windowManager.createOverlayWindow();
    });
    ipcMain.on("user-logout", () => {
      console.log("User logging out...");
      this.windowManager.closeOverlayWindow();
      this.windowManager.createAuthWindow();
    });
    ipcMain.on("overlay-interaction", () => {
      this.windowManager.ensureOverlayOnTop();
      setTimeout(() => {
        this.windowManager.ensureOverlayOnTop();
      }, 100);
    });
    ipcMain.on("ensure-always-on-top", () => {
      this.windowManager.ensureOverlayOnTop();
    });
  }
  registerMouseEventHandlers() {
    ipcMain.on(
      "set-ignore-mouse-events",
      (_event, ignore, options) => {
        try {
          const validIgnore = SecurityValidator.validateBoolean(
            ignore,
            "ignore"
          );
          const validOptions = SecurityValidator.validateMouseEventOptions(options);
          this.windowManager.setOverlayMouseEvents(
            validIgnore,
            validOptions ?? { forward: true }
          );
        } catch (error) {
          console.error("Mouse events error:", error);
        }
      }
    );
  }
  // Setup auth state change listeners
  setupAuthStateListeners() {
    auth0Service.onAuthStateChange((event, session, error) => {
      const authWindow = this.windowManager.getAuthWindow();
      const overlayWindow = this.windowManager.getOverlayWindow();
      if (event === "SIGNED_IN" && session?.user) {
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send("auth0-success", session);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("auth0-success", session);
        }
        this.windowManager.closeAuthWindow();
        this.windowManager.createOverlayWindow();
      } else if (event === "SIGNED_OUT") {
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send("auth0-success", null);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("auth0-success", null);
        }
        this.windowManager.closeOverlayWindow();
        if (!authWindow || authWindow.isDestroyed()) {
          this.windowManager.createAuthWindow();
        }
      } else if (event === "TOKEN_REFRESHED" && session) {
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send("auth0-token-refresh", session);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("auth0-token-refresh", session);
        }
      } else if (event === "ERROR") {
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send(
            "auth0-error",
            error ?? "Authentication error"
          );
        }
      }
    });
  }
  /**
   * Clean up all IPC handlers to prevent memory leaks
   */
  cleanup() {
    console.log("Cleaning up Auth IPC handlers...");
    ipcMain.removeHandler("auth0-start-flow");
    ipcMain.removeHandler("auth0-get-session");
    ipcMain.removeHandler("auth0-sign-out");
    ipcMain.removeHandler("auth0-is-secure-storage");
    ipcMain.removeHandler("auth0-cancel-device-flow");
    ipcMain.removeHandler("open-external-url");
    ipcMain.removeAllListeners("auth-success");
    ipcMain.removeAllListeners("user-logout");
    ipcMain.removeAllListeners("overlay-interaction");
    ipcMain.removeAllListeners("ensure-always-on-top");
    ipcMain.removeAllListeners("set-ignore-mouse-events");
    ipcMain.removeAllListeners("window-interaction");
  }
}
class AppLifecycleManager {
  constructor(windowManager2) {
    this.windowManager = windowManager2;
  }
  authIPCHandlers;
  shortcutsManager;
  autoLaunchManager;
  /**
   * Register managers for proper cleanup
   */
  registerManagers(authIPCHandlers2, shortcutsManager2, autoLaunchManager2) {
    this.authIPCHandlers = authIPCHandlers2;
    this.shortcutsManager = shortcutsManager2;
    this.autoLaunchManager = autoLaunchManager2;
  }
  /**
   * Clean up all IPC handlers and resources
   */
  cleanupAllResources() {
    console.log("Cleaning up all app resources...");
    ipcMain.removeHandler("update-navigation-shortcut");
    this.authIPCHandlers?.cleanup();
    this.shortcutsManager?.unregisterAllShortcuts();
    this.autoLaunchManager?.cleanup();
    this.windowManager.destroyTray();
  }
  setupAppEvents() {
    app.on("window-all-closed", () => {
      this.cleanupAllResources();
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.windowManager.createAuthWindow();
      }
    });
    app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
      this.windowManager.focusAuthWindow();
    });
    app.on("before-quit", () => {
      this.cleanupAllResources();
      console.log("App is quitting...");
    });
    app.on("will-quit", () => {
      this.cleanupAllResources();
    });
  }
  ensureSingleInstance() {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
      return false;
    }
    return true;
  }
  setAppDefaults() {
  }
}
class ShortcutsManager {
  constructor(windowManager2) {
    this.windowManager = windowManager2;
  }
  currentShortcut = null;
  registerNavigationToggleShortcut(shortcut) {
    if (this.currentShortcut) {
      globalShortcut.unregister(this.currentShortcut);
    }
    const shortcutRegistered = globalShortcut.register(shortcut, () => {
      const overlayWindow = this.windowManager.getOverlayWindow();
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send("toggle-navigation-bar");
      }
    });
    if (!shortcutRegistered) {
      console.warn(`Failed to register global shortcut ${shortcut}`);
    } else {
      console.log(`Global shortcut ${shortcut} registered successfully`);
      this.currentShortcut = shortcut;
    }
  }
  registerGlobalShortcuts() {
    this.registerNavigationToggleShortcut("Shift+\\");
  }
  unregisterAllShortcuts() {
    globalShortcut.unregisterAll();
    this.currentShortcut = null;
  }
  setupShortcutCleanup() {
    app.on("will-quit", () => {
      this.unregisterAllShortcuts();
    });
  }
}
class AutoLaunchManager {
  autoLauncher;
  settingsPath;
  constructor(appName = "Unstuck") {
    this.autoLauncher = new AutoLaunch({
      name: appName,
      path: app.getPath("exe")
    });
    this.settingsPath = path.join(
      app.getPath("userData"),
      "auto-launch-settings.json"
    );
    this.setupIpcHandlers();
  }
  /**
   * Enable auto-launch on system startup
   */
  async enableAutoLaunch() {
    try {
      const isEnabled = await this.autoLauncher.isEnabled();
      if (!isEnabled) {
        await this.autoLauncher.enable();
        await this.saveAutoLaunchSetting(true);
        console.log("Auto-launch enabled");
      }
      return true;
    } catch (error) {
      console.error("Failed to enable auto-launch:", error);
      return false;
    }
  }
  /**
   * Disable auto-launch on system startup
   */
  async disableAutoLaunch() {
    try {
      const isEnabled = await this.autoLauncher.isEnabled();
      if (isEnabled) {
        await this.autoLauncher.disable();
        await this.saveAutoLaunchSetting(false);
        console.log("Auto-launch disabled");
      }
      return true;
    } catch (error) {
      console.error("Failed to disable auto-launch:", error);
      return false;
    }
  }
  /**
   * Check if auto-launch is currently enabled
   */
  async isAutoLaunchEnabled() {
    try {
      return await this.autoLauncher.isEnabled();
    } catch (error) {
      console.error("Failed to check auto-launch status:", error);
      return false;
    }
  }
  /**
   * Toggle auto-launch on/off
   */
  async toggleAutoLaunch() {
    const isEnabled = await this.isAutoLaunchEnabled();
    if (isEnabled) {
      return await this.disableAutoLaunch();
    } else {
      return await this.enableAutoLaunch();
    }
  }
  /**
   * Initialize auto-launch based on saved settings
   */
  async initializeAutoLaunch() {
    try {
      const isFirstRun = !fs$1.existsSync(this.settingsPath);
      const savedSetting = await this.loadAutoLaunchSetting();
      const currentlyEnabled = await this.isAutoLaunchEnabled();
      if (isFirstRun) {
        console.log("First run detected, enabling auto-launch by default");
        await this.enableAutoLaunch();
      } else {
        if (savedSetting && !currentlyEnabled) {
          await this.enableAutoLaunch();
        } else if (!savedSetting && currentlyEnabled) {
          await this.disableAutoLaunch();
        }
      }
      console.log(`Auto-launch initialized. Enabled: ${savedSetting}`);
    } catch (error) {
      console.error("Failed to initialize auto-launch:", error);
    }
  }
  /**
   * Save auto-launch setting to file
   */
  async saveAutoLaunchSetting(enabled) {
    try {
      const settings = { autoLaunch: enabled };
      await fs$1.promises.writeFile(
        this.settingsPath,
        JSON.stringify(settings, null, 2)
      );
    } catch (error) {
      console.error("Failed to save auto-launch setting:", error);
    }
  }
  /**
   * Load auto-launch setting from file
   */
  async loadAutoLaunchSetting() {
    try {
      if (!fs$1.existsSync(this.settingsPath)) {
        return true;
      }
      const data = await fs$1.promises.readFile(this.settingsPath, "utf-8");
      const settings = JSON.parse(data);
      return settings.autoLaunch === true;
    } catch (error) {
      console.error("Failed to load auto-launch setting:", error);
      return true;
    }
  }
  /**
   * Setup IPC handlers for renderer process communication
   */
  setupIpcHandlers() {
    ipcMain.handle("auto-launch:get-status", async () => {
      return await this.isAutoLaunchEnabled();
    });
    ipcMain.handle("auto-launch:enable", async () => {
      return await this.enableAutoLaunch();
    });
    ipcMain.handle("auto-launch:disable", async () => {
      return await this.disableAutoLaunch();
    });
    ipcMain.handle("auto-launch:toggle", async () => {
      return await this.toggleAutoLaunch();
    });
  }
  /**
   * Clean up resources
   */
  cleanup() {
    ipcMain.removeHandler("auto-launch:get-status");
    ipcMain.removeHandler("auto-launch:enable");
    ipcMain.removeHandler("auto-launch:disable");
    ipcMain.removeHandler("auto-launch:toggle");
  }
}
const __dirname = path$1.dirname(fileURLToPath(import.meta.url));
app.setName("Unstuck");
if (process.platform === "win32") {
  app.setAppUserModelId("com.unstuck.app");
}
app.commandLine.appendSwitch("--max-old-space-size", "512");
app.commandLine.appendSwitch("--optimize-for-size");
app.commandLine.appendSwitch("--gc-interval", "100");
if (process.env.NODE_ENV === "development") {
  app.commandLine.appendSwitch("--disable-dev-shm-usage");
  app.commandLine.appendSwitch("--disable-gpu-sandbox");
}
process.env.APP_ROOT = path$1.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
const windowManager = new WindowManager(
  RENDERER_DIST,
  process.env.VITE_PUBLIC,
  path$1.join(__dirname, "preload.mjs"),
  VITE_DEV_SERVER_URL
);
const authIPCHandlers = new AuthIPCHandlers(windowManager);
const appLifecycle = new AppLifecycleManager(windowManager);
const shortcutsManager = new ShortcutsManager(windowManager);
const autoLaunchManager = new AutoLaunchManager("Unstuck");
void app.whenReady().then(async () => {
  appLifecycle.setAppDefaults();
  Menu.setApplicationMenu(null);
  if (!appLifecycle.ensureSingleInstance()) {
    return;
  }
  appLifecycle.setupAppEvents();
  appLifecycle.registerManagers(
    authIPCHandlers,
    shortcutsManager,
    autoLaunchManager
  );
  shortcutsManager.registerGlobalShortcuts();
  shortcutsManager.setupShortcutCleanup();
  ipcMain.handle("update-navigation-shortcut", (_event, shortcut) => {
    shortcutsManager.registerNavigationToggleShortcut(shortcut);
  });
  await autoLaunchManager.initializeAutoLaunch();
  windowManager.createSystemTray();
  try {
    validateAuth0Config(auth0Config);
    await auth0Service.initialize(
      auth0Config.domain,
      auth0Config.clientId,
      auth0Config
    );
    authIPCHandlers.setConfig(auth0Config);
    authIPCHandlers.setupAuthStateListeners();
    authIPCHandlers.registerHandlers();
    if (auth0Service.isSignedIn()) {
      console.log("User already signed in, opening main application");
      windowManager.createOverlayWindow();
    } else {
      console.log("No valid session found, showing authentication window");
      windowManager.createAuthWindow();
    }
  } catch (error) {
    console.error("Failed to initialize Auth0 configuration:", error);
    app.quit();
    return;
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
