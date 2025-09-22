import { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell, screen } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs from "fs/promises";
import path from "path";
import os from "os";
import fs$1 from "fs";
class Auth0Service {
  domain = "";
  clientId = "";
  audience;
  secureDir = path.join(os.homedir(), ".unstuck-secure");
  currentSession = null;
  listeners = /* @__PURE__ */ new Set();
  currentPollInterval = null;
  currentPollTimeout = null;
  /**
   * Initialize Auth0 client configuration
   */
  async initialize(domain, clientId, audience) {
    if (!domain || !clientId) {
      throw new Error("Missing Auth0 credentials");
    }
    if (!domain.includes(".auth0.com") && !domain.includes(".us.auth0.com")) {
      throw new Error("Invalid Auth0 domain format");
    }
    this.domain = domain.startsWith("https://") ? domain : `https://${domain}`;
    this.clientId = clientId;
    this.audience = audience;
    await this.ensureSecureDir();
    await this.restoreSession();
    console.log("🔒 Auth0Service initialized in main process");
  }
  /**
   * Start Device Authorization Flow
   */
  async startDeviceAuthFlow() {
    const deviceCodeEndpoint = `${this.domain}/oauth/device/code`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      scope: "openid profile email offline_access"
    });
    if (this.audience) {
      body.append("audience", this.audience);
    }
    console.log("🔒 Starting Auth0 Device Authorization Flow");
    console.log("🔑 Domain:", this.domain);
    console.log("🔑 Client ID:", this.clientId);
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
        errorData
      });
      throw new Error(`Device authorization request failed: ${errorData.error_description || errorData.error || response.statusText}`);
    }
    const deviceData = await response.json();
    this.pollForDeviceAuthorization(deviceData.device_code, deviceData.interval || 5);
    return {
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      expires_in: deviceData.expires_in || 600
    };
  }
  /**
   * Cancel current device authorization flow
   */
  cancelDeviceAuthorization() {
    console.log("🛑 Canceling device authorization polling");
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
  async pollForDeviceAuthorization(deviceCode, interval) {
    const tokenEndpoint = `${this.domain}/oauth/token`;
    this.cancelDeviceAuthorization();
    this.currentPollInterval = setInterval(async () => {
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
          const tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            id_token: data.id_token,
            expires_at: Date.now() + data.expires_in * 1e3,
            token_type: data.token_type || "Bearer",
            scope: data.scope
          };
          const user = await this.getUserInfo(tokens.access_token);
          const session = { user, tokens };
          await this.storeSession(session);
          this.currentSession = session;
          this.notifyListeners("SIGNED_IN", session);
        } else if (data.error === "authorization_pending") {
          console.log("⏳ Waiting for user authorization...");
        } else if (data.error === "slow_down") {
          this.cancelDeviceAuthorization();
          setTimeout(() => {
            this.pollForDeviceAuthorization(deviceCode, interval + 5);
          }, (interval + 5) * 1e3);
        } else if (data.error === "expired_token") {
          this.cancelDeviceAuthorization();
          this.notifyListeners("ERROR", null, "Device code expired. Please try again.");
        } else if (data.error === "access_denied") {
          this.cancelDeviceAuthorization();
          this.notifyListeners("ERROR", null, "Access denied by user.");
        } else {
          this.cancelDeviceAuthorization();
          this.notifyListeners("ERROR", null, data.error_description || "Authorization failed");
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, interval * 1e3);
    this.currentPollTimeout = setTimeout(() => {
      this.cancelDeviceAuthorization();
      this.notifyListeners("ERROR", null, "Authorization timeout. Please try again.");
    }, 10 * 60 * 1e3);
  }
  // OAuth callback handling removed - not needed for Device Authorization Flow
  /**
   * Get current session
   */
  async getSession() {
    if (this.currentSession) {
      if (this.isTokenExpired(this.currentSession.tokens)) {
        try {
          await this.refreshTokens();
        } catch (error) {
          console.warn("Token refresh failed:", error);
          await this.signOut();
          return { user: null, tokens: null };
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
        await this.revokeToken(this.currentSession.tokens.refresh_token);
      }
      await this.clearSession();
      this.currentSession = null;
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
    try {
      const { safeStorage } = await import("electron");
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }
  // Private methods
  // PKCE methods removed - not needed for Device Authorization Flow
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
  async refreshTokens() {
    if (!this.currentSession?.tokens.refresh_token) {
      throw new Error("No refresh token available");
    }
    const tokenEndpoint = `${this.domain}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: this.currentSession.tokens.refresh_token
    });
    if (this.audience) {
      body.append("audience", this.audience);
    }
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    if (!response.ok) {
      throw new Error("Token refresh failed");
    }
    const data = await response.json();
    const newTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.currentSession.tokens.refresh_token,
      id_token: data.id_token,
      expires_at: Date.now() + data.expires_in * 1e3,
      token_type: data.token_type || "Bearer",
      scope: data.scope
    };
    this.currentSession.tokens = newTokens;
    await this.storeSession(this.currentSession);
    this.notifyListeners("TOKEN_REFRESHED", this.currentSession);
  }
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
  isTokenExpired(tokens) {
    return tokens.expires_at < Date.now() + 5 * 60 * 1e3;
  }
  async storeSession(session) {
    await this.secureSetItem("auth0_session", JSON.stringify(session));
  }
  async restoreSession() {
    try {
      const sessionData = await this.secureGetItem("auth0_session");
      if (sessionData) {
        this.currentSession = JSON.parse(sessionData);
      }
    } catch (error) {
      console.warn("Failed to restore session:", error);
      await this.clearSession();
    }
  }
  async clearSession() {
    await this.secureRemoveItem("auth0_session");
  }
  notifyListeners(event, session, error) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, session, error);
      } catch (err) {
        console.error("Auth listener error:", err);
      }
    });
  }
  // Secure storage methods (same pattern as original but more robust)
  async ensureSecureDir() {
    try {
      await fs.mkdir(this.secureDir, { recursive: true, mode: 448 });
    } catch (error) {
    }
  }
  async secureGetItem(key) {
    try {
      const { safeStorage } = await import("electron");
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn("Secure storage not available, falling back to file storage");
        return await this.fileGetItem(key);
      }
      const filePath = path.join(this.secureDir, `${key}.dat`);
      const encrypted = await fs.readFile(filePath);
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      return null;
    }
  }
  async secureSetItem(key, value) {
    try {
      const { safeStorage } = await import("electron");
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn("Secure storage not available, using file storage with limited security");
        return await this.fileSetItem(key, value);
      }
      const encrypted = safeStorage.encryptString(value);
      const filePath = path.join(this.secureDir, `${key}.dat`);
      await fs.writeFile(filePath, encrypted, { mode: 384 });
    } catch (error) {
      console.error("Failed to store secure item:", error);
      throw error;
    }
  }
  async secureRemoveItem(key) {
    try {
      const filePath = path.join(this.secureDir, `${key}.dat`);
      await fs.unlink(filePath);
    } catch (error) {
    }
  }
  // Fallback file storage (less secure but functional)
  async fileGetItem(key) {
    try {
      const filePath = path.join(this.secureDir, `${key}.json`);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data).value;
    } catch {
      return null;
    }
  }
  async fileSetItem(key, value) {
    const filePath = path.join(this.secureDir, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify({ value }), { mode: 384 });
  }
}
const auth0Service = new Auth0Service();
function loadEnvironmentConfig() {
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    try {
      const envPath = path.join(process.env.APP_ROOT || process.cwd(), ".env");
      const envFile = fs$1.readFileSync(envPath, "utf8");
      const envVars = {};
      envFile.split("\n").forEach((line) => {
        const [key, value] = line.split("=");
        if (key && value) {
          envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
        }
      });
      return {
        auth0Domain: envVars.VITE_AUTH0_DOMAIN,
        auth0ClientId: envVars.VITE_AUTH0_CLIENT_ID,
        auth0Audience: envVars.VITE_AUTH0_AUDIENCE
      };
    } catch (error) {
      console.error("Failed to load .env file:", error);
    }
  }
  return {
    auth0Domain: process.env.VITE_AUTH0_DOMAIN || process.env.AUTH0_DOMAIN || "",
    auth0ClientId: process.env.VITE_AUTH0_CLIENT_ID || process.env.AUTH0_CLIENT_ID || "",
    auth0Audience: process.env.VITE_AUTH0_AUDIENCE || process.env.AUTH0_AUDIENCE
  };
}
function validateConfig(config) {
  if (!config.auth0Domain || !config.auth0ClientId) {
    throw new Error(
      "Missing Auth0 configuration. Please ensure VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID are set."
    );
  }
  if (!config.auth0Domain.includes(".auth0.com") && !config.auth0Domain.includes(".us.auth0.com")) {
    throw new Error(
      'Invalid Auth0 domain format. Domain should be like "your-tenant.auth0.com"'
    );
  }
  console.log("✅ Auth0 configuration loaded securely in main process");
}
class SecurityValidator {
  /**
   * Validate OAuth provider
   */
  static validateOAuthProvider(provider) {
    const validProviders = ["google", "github", "discord"];
    if (typeof provider !== "string") {
      throw new Error("OAuth provider must be a string");
    }
    if (!validProviders.includes(provider)) {
      throw new Error(`Invalid OAuth provider: ${provider}. Must be one of: ${validProviders.join(", ")}`);
    }
    return provider;
  }
  /**
   * Validate URL string
   */
  static validateUrl(url) {
    if (typeof url !== "string") {
      throw new Error("URL must be a string");
    }
    if (url.length === 0) {
      throw new Error("URL cannot be empty");
    }
    if (url.length > 2048) {
      throw new Error("URL too long (max 2048 characters)");
    }
    if (!url.startsWith("https://") && !url.startsWith("unstuck://")) {
      throw new Error("URL must use https:// or unstuck:// protocol");
    }
    return url;
  }
  /**
   * Validate mouse event options
   */
  static validateMouseEventOptions(options) {
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
  }
  /**
   * Validate boolean value
   */
  static validateBoolean(value, fieldName) {
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName} must be a boolean`);
    }
    return value;
  }
  /**
   * Validate string with length limits
   */
  static validateString(value, fieldName, maxLength = 255) {
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be a string`);
    }
    if (value.length > maxLength) {
      throw new Error(`${fieldName} too long (max ${maxLength} characters)`);
    }
    return value;
  }
  /**
   * Sanitize user object for logging (remove sensitive fields)
   */
  static sanitizeUserForLogging(user) {
    if (!user || typeof user !== "object") {
      return user;
    }
    const sanitized = { ...user };
    delete sanitized.access_token;
    delete sanitized.refresh_token;
    delete sanitized.session;
    delete sanitized.raw_app_meta_data;
    delete sanitized.raw_user_meta_data;
    return {
      id: sanitized.id,
      email: sanitized.email,
      created_at: sanitized.created_at
    };
  }
  /**
   * Rate limiting for IPC calls
   */
  static rateLimitMap = /* @__PURE__ */ new Map();
  static checkRateLimit(channel, maxRequests = 10, windowMs = 6e4) {
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
}
const __dirname = path$1.dirname(fileURLToPath(import.meta.url));
app.setName("Unstuck");
process.env.APP_ROOT = path$1.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let overlayWindow;
let authWindow;
function createAuthWindow() {
  authWindow = new BrowserWindow({
    title: "Get Unstuck - Authentication",
    icon: path$1.join(process.env.VITE_PUBLIC, "unstuck-logo.ico"),
    width: 500,
    height: 600,
    center: true,
    resizable: false,
    frame: true,
    // Normal window with title bar
    transparent: false,
    // Normal opaque window
    alwaysOnTop: false,
    // Normal window behavior
    show: false,
    // Don't show immediately to prevent blank page flash
    backgroundColor: "#0a0a0a",
    // Set background color to match loading screen
    webPreferences: {
      preload: path$1.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      devTools: process.env.NODE_ENV === "development",
      webSecurity: true
    }
  });
  authWindow.setMenuBarVisibility(false);
  authWindow.once("ready-to-show", () => {
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.show();
    }
  });
  authWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== "http://localhost:5173" && parsedUrl.origin !== "file://" && !navigationUrl.includes("auth.html")) {
      console.log("Blocked navigation to:", navigationUrl);
      event.preventDefault();
    }
  });
  authWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Blocked new window creation for:", url);
    shell.openExternal(url);
    return { action: "deny" };
  });
  if (VITE_DEV_SERVER_URL) {
    void authWindow.loadURL(`${VITE_DEV_SERVER_URL}/auth.html`);
  } else {
    void authWindow.loadFile(path$1.join(RENDERER_DIST, "auth.html"));
  }
  authWindow.on("closed", () => {
    authWindow = null;
    if (!overlayWindow) {
      app.quit();
    }
  });
  return authWindow;
}
function createOverlayWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const overlayWindowdowWidth = 450;
  const overlayWindowdowHeight = 650;
  overlayWindow = new BrowserWindow({
    title: "Unstuck",
    icon: path$1.join(process.env.VITE_PUBLIC, "unstuck-logo.ico"),
    frame: false,
    // Remove overlayWindowdow frame (title bar, borders)
    transparent: true,
    // Make overlayWindowdow background transparent
    alwaysOnTop: true,
    // Keep on top of other overlayWindowdows
    resizable: false,
    // Prevent resizing
    width: overlayWindowdowWidth,
    // Fixed width for navigation bar
    height: overlayWindowdowHeight,
    // Fixed height for chat overlayWindowdow
    x: Math.round((screenWidth - overlayWindowdowWidth) / 2),
    // Center horizontally
    y: 20,
    // Position at top of screen
    webPreferences: {
      preload: path$1.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      devTools: process.env.NODE_ENV === "development",
      webSecurity: true
    }
  });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== "http://localhost:5173" && parsedUrl.origin !== "file://" && !navigationUrl.includes("index.html")) {
      console.log("Blocked navigation to:", navigationUrl);
      event.preventDefault();
    }
  });
  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Blocked new window creation for:", url);
    shell.openExternal(url);
    return { action: "deny" };
  });
  overlayWindow.on("blur", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
    }
  });
  overlayWindow.on("focus", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
    }
  });
  overlayWindow.on("show", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      overlayWindow.focus();
    }
  });
  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    void overlayWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void overlayWindow.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    overlayWindow = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createAuthWindow();
  }
});
void app.whenReady().then(async () => {
  app.setName("Unstuck");
  Menu.setApplicationMenu(null);
  try {
    const config = loadEnvironmentConfig();
    validateConfig(config);
    await auth0Service.initialize(config.auth0Domain, config.auth0ClientId, config.auth0Audience);
    auth0Service.onAuthStateChange((event, session, error) => {
      if (event === "SIGNED_IN" && session?.user) {
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send("auth0-success", session);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("auth0-success", session);
        }
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
          authWindow = null;
        }
        createOverlayWindow();
      } else if (event === "SIGNED_OUT") {
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.webContents.send("auth0-success", null);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("auth0-success", null);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close();
          overlayWindow = null;
        }
        if (!authWindow || authWindow.isDestroyed()) {
          createAuthWindow();
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
          authWindow.webContents.send("auth0-error", error || "Authentication error");
        }
      }
    });
  } catch (error) {
    console.error("Failed to initialize auth service:", error);
    app.quit();
    return;
  }
  createAuthWindow();
  globalShortcut.register("Shift+\\", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("toggle-navigation-bar");
    }
  });
  ipcMain.on("set-ignore-mouse-events", (_event, ignore, options) => {
    try {
      SecurityValidator.checkRateLimit("set-ignore-mouse-events", 20, 6e4);
      const validIgnore = SecurityValidator.validateBoolean(ignore, "ignore");
      const validOptions = SecurityValidator.validateMouseEventOptions(options);
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setIgnoreMouseEvents(validIgnore, validOptions ?? { forward: true });
      }
    } catch (error) {
      console.error("Mouse events error:", error);
    }
  });
  ipcMain.on("ensure-always-on-top", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      overlayWindow.moveTop();
    }
  });
  ipcMain.on("overlayWindowdow-interaction", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      overlayWindow.moveTop();
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
        }
      }, 100);
    }
  });
  ipcMain.on("auth-success", (_event, _user) => {
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close();
      authWindow = null;
    }
    createOverlayWindow();
  });
  ipcMain.handle("open-external-url", async (_event, url) => {
    try {
      SecurityValidator.checkRateLimit("open-external-url", 5, 6e4);
      const validUrl = SecurityValidator.validateUrl(url);
      await shell.openExternal(validUrl);
      return { success: true };
    } catch (error) {
      console.error("Failed to open external URL:", error);
      return { success: false, error: error.message };
    }
  });
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
      if (authWindow) {
        if (authWindow.isMinimized()) authWindow.restore();
        authWindow.focus();
      }
    });
  }
  ipcMain.on("user-logout", () => {
    console.log("User logging out...");
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
    }
    createAuthWindow();
  });
  ipcMain.handle("auth0-start-flow", async () => {
    try {
      SecurityValidator.checkRateLimit("auth0-start-flow", 5, 6e4);
      const deviceAuth = await auth0Service.startDeviceAuthFlow();
      await shell.openExternal(deviceAuth.verification_uri);
      console.log("✅ Browser opened successfully");
      return { success: true, ...deviceAuth };
    } catch (error) {
      console.error("Start Auth0 device flow error:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("auth0-get-session", async () => {
    try {
      SecurityValidator.checkRateLimit("auth0-get-session", 10, 6e4);
      const { user, tokens } = await auth0Service.getSession();
      const sanitizedUser = user ? SecurityValidator.sanitizeUserForLogging(user) : null;
      return {
        success: true,
        user: sanitizedUser,
        session: user && tokens ? { user: sanitizedUser, tokens } : null,
        tokens: tokens || null
      };
    } catch (error) {
      console.error("Get Auth0 session error:", SecurityValidator.sanitizeUserForLogging(error));
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("auth0-sign-out", async () => {
    try {
      SecurityValidator.checkRateLimit("auth0-sign-out", 3, 6e4);
      await auth0Service.signOut();
      return { success: true };
    } catch (error) {
      console.error("Auth0 sign out error:", SecurityValidator.sanitizeUserForLogging(error));
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("auth0-is-secure-storage", async () => {
    try {
      SecurityValidator.checkRateLimit("auth0-is-secure-storage", 10, 6e4);
      return await auth0Service.isSecureStorage();
    } catch (error) {
      console.error("Secure storage check error:", error);
      return false;
    }
  });
  ipcMain.handle("auth0-cancel-device-flow", async () => {
    try {
      SecurityValidator.checkRateLimit("auth0-cancel-device-flow", 10, 6e4);
      auth0Service.cancelDeviceAuthorization();
      return { success: true };
    } catch (error) {
      console.error("Cancel device flow error:", error);
      return { success: false, error: error.message };
    }
  });
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
