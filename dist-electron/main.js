import { BrowserWindow, screen, shell, Tray, nativeImage, Menu, app, ipcMain, globalShortcut } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs$1 from "fs";
import require$$0 from "util";
import require$$2 from "child_process";
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
      id: typedSanitized.id,
      email: typedSanitized.email,
      created_at: typedSanitized.created_at
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
      if (!this.domain || !this.domain.includes(".auth0.com") && !this.domain.includes(".us.auth0.com")) {
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
  config;
  secureDir = path.join(os.homedir(), ".unstuck-secure");
  constructor(config) {
    this.config = config;
  }
  get FALLBACK_STORAGE_EXPIRY_HOURS() {
    return this.config.tokenManagement.fallbackStorageExpiryHours;
  }
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
        return await this.enhancedFileGetItem(key);
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
        console.warn("🔐 OS encryption unavailable - using enhanced fallback");
        if (key.includes("refresh_token")) {
          throw new Error("Secure storage required for refresh tokens");
        }
        await this.enhancedFileSetItem(key, value);
        return;
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
   * Enhanced fallback file storage with encryption
   */
  async enhancedFileGetItem(key) {
    try {
      const filePath = path.join(this.secureDir, `${key}.json`);
      const data = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        await fs.unlink(filePath).catch(() => {
        });
        return null;
      }
      if (parsed.encrypted && parsed.iv && parsed.authTag) {
        return this.decryptValue(parsed.encrypted, parsed.iv, parsed.authTag);
      }
      console.warn(
        "🔒 Found legacy token format - forcing re-authentication for security"
      );
      await fs.unlink(filePath).catch(() => {
      });
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Enhanced fallback file storage with encryption
   */
  async enhancedFileSetItem(key, value) {
    const algorithm = "aes-256-gcm";
    const keyDerivation = crypto.pbkdf2Sync(
      "unstuck-fallback-key",
      "unstuck-salt-2024",
      1e5,
      32,
      "sha256"
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, keyDerivation, iv);
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    const data = {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      timestamp: Date.now(),
      expiresAt: Date.now() + this.FALLBACK_STORAGE_EXPIRY_HOURS * 60 * 60 * 1e3
    };
    const filePath = path.join(this.secureDir, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(data), { mode: 384 });
  }
  /**
   * Decrypt a value using AES-256-GCM
   */
  decryptValue(encryptedHex, ivHex, authTagHex) {
    const algorithm = "aes-256-gcm";
    const keyDerivation = crypto.pbkdf2Sync(
      "unstuck-fallback-key",
      "unstuck-salt-2024",
      1e5,
      32,
      "sha256"
    );
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, keyDerivation, iv);
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
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
    if (!domain.includes(".auth0.com") && !domain.includes(".us.auth0.com")) {
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
    this.secureStorage = new SecureStorage(config);
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
            SecurityValidator.sanitizeUserForLogging(error)
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
    try {
      await this.secureStorage.setItem("auth0_session", JSON.stringify(session));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Secure storage required for refresh tokens")) {
        const sessionWithoutRefreshToken = {
          ...session,
          tokens: {
            ...session.tokens,
            refresh_token: void 0
          }
        };
        console.warn(
          "⚠️ Storing session without refresh token due to fallback security limitations"
        );
        await this.secureStorage.setItem(
          "auth0_session",
          JSON.stringify(sessionWithoutRefreshToken)
        );
      } else {
        throw error;
      }
    }
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
            console.log("✅ Session restored and tokens refreshed successfully");
            this.notifyListeners("SIGNED_IN", this.currentSession);
          } catch (refreshError) {
            console.warn(
              "Failed to refresh restored tokens, clearing session:",
              SecurityValidator.sanitizeUserForLogging(refreshError)
            );
            await this.clearSession();
            this.currentSession = null;
          }
        } else {
          this.currentSession = restoredSession;
          console.log("✅ Session restored successfully with valid tokens");
          this.notifyListeners("SIGNED_IN", this.currentSession);
        }
      }
    } catch (error) {
      console.warn(
        "Failed to restore session:",
        SecurityValidator.sanitizeUserForLogging(error)
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
  domain: "dev-go8elfmr2gh3aye8.us.auth0.com",
  clientId: "vVv9ZUVlCqxZQemAwrOGve0HSrK5rTlO",
  // Request access to user profile and enable refresh tokens
  scope: "openid profile email offline_access",
  // Optional: Add if you have an API to access
  // audience: 'https://your-api.example.com',
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
    refreshWindowMinutes: 1,
    // Within 1 minute window
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
  if (!config.domain.includes(".auth0.com") && !config.domain.includes(".us.auth0.com")) {
    throw new Error(
      'Invalid Auth0 domain format. Domain should be like "your-tenant.auth0.com"'
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
        devTools: process.env.NODE_ENV === "development",
        webSecurity: true
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
        webSecurity: true
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
}
class AppLifecycleManager {
  constructor(windowManager2) {
    this.windowManager = windowManager2;
  }
  setupAppEvents() {
    app.on("window-all-closed", () => {
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
      this.windowManager.destroyTray();
      console.log("App is quitting...");
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
    app.setName("Unstuck");
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
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var pathIsAbsolute = { exports: {} };
var hasRequiredPathIsAbsolute;
function requirePathIsAbsolute() {
  if (hasRequiredPathIsAbsolute) return pathIsAbsolute.exports;
  hasRequiredPathIsAbsolute = 1;
  function posix(path2) {
    return path2.charAt(0) === "/";
  }
  function win32(path2) {
    var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;
    var result = splitDeviceRe.exec(path2);
    var device = result[1] || "";
    var isUnc = Boolean(device && device.charAt(1) !== ":");
    return Boolean(result[2] || isUnc);
  }
  pathIsAbsolute.exports = process.platform === "win32" ? win32 : posix;
  pathIsAbsolute.exports.posix = posix;
  pathIsAbsolute.exports.win32 = win32;
  return pathIsAbsolute.exports;
}
var registry;
var hasRequiredRegistry;
function requireRegistry() {
  if (hasRequiredRegistry) return registry;
  hasRequiredRegistry = 1;
  var util = require$$0, path$12 = path, spawn = require$$2.spawn, HKLM = "HKLM", HKCU = "HKCU", HKCR = "HKCR", HKU = "HKU", HKCC = "HKCC", HIVES = [HKLM, HKCU, HKCR, HKU, HKCC], REG_SZ = "REG_SZ", REG_MULTI_SZ = "REG_MULTI_SZ", REG_EXPAND_SZ = "REG_EXPAND_SZ", REG_DWORD = "REG_DWORD", REG_QWORD = "REG_QWORD", REG_BINARY = "REG_BINARY", REG_NONE = "REG_NONE", REG_TYPES = [REG_SZ, REG_MULTI_SZ, REG_EXPAND_SZ, REG_DWORD, REG_QWORD, REG_BINARY, REG_NONE], DEFAULT_VALUE = "", KEY_PATTERN = /(\\[a-zA-Z0-9_\s]+)*/, PATH_PATTERN = /^(HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER|HKEY_CLASSES_ROOT|HKEY_USERS|HKEY_CURRENT_CONFIG)(.*)$/, ITEM_PATTERN = /^(.*)\s(REG_SZ|REG_MULTI_SZ|REG_EXPAND_SZ|REG_DWORD|REG_QWORD|REG_BINARY|REG_NONE)\s+([^\s].*)$/;
  function ProcessUncleanExitError(message, code) {
    if (!(this instanceof ProcessUncleanExitError))
      return new ProcessUncleanExitError(message, code);
    Error.captureStackTrace(this, ProcessUncleanExitError);
    this.__defineGetter__("name", function() {
      return ProcessUncleanExitError.name;
    });
    this.__defineGetter__("message", function() {
      return message;
    });
    this.__defineGetter__("code", function() {
      return code;
    });
  }
  util.inherits(ProcessUncleanExitError, Error);
  function captureOutput(child) {
    var output = { "stdout": "", "stderr": "" };
    child.stdout.on("data", function(data) {
      output["stdout"] += data.toString();
    });
    child.stderr.on("data", function(data) {
      output["stderr"] += data.toString();
    });
    return output;
  }
  function mkErrorMsg(registryCommand, code, output) {
    var stdout = output["stdout"].trim();
    var stderr = output["stderr"].trim();
    var msg = util.format("%s command exited with code %d:\n%s\n%s", registryCommand, code, stdout, stderr);
    return new ProcessUncleanExitError(msg, code);
  }
  function convertArchString(archString) {
    if (archString == "x64") {
      return "64";
    } else if (archString == "x86") {
      return "32";
    } else {
      throw new Error("illegal architecture: " + archString + " (use x86 or x64)");
    }
  }
  function pushArch(args, arch) {
    if (arch) {
      args.push("/reg:" + convertArchString(arch));
    }
  }
  function getRegExePath() {
    if (process.platform === "win32") {
      return path$12.join(process.env.windir, "system32", "reg.exe");
    } else {
      return "REG";
    }
  }
  function RegistryItem(host, hive, key, name, type, value, arch) {
    if (!(this instanceof RegistryItem))
      return new RegistryItem(host, hive, key, name, type, value, arch);
    var _host = host, _hive = hive, _key = key, _name = name, _type = type, _value = value, _arch = arch;
    this.__defineGetter__("host", function() {
      return _host;
    });
    this.__defineGetter__("hive", function() {
      return _hive;
    });
    this.__defineGetter__("key", function() {
      return _key;
    });
    this.__defineGetter__("name", function() {
      return _name;
    });
    this.__defineGetter__("type", function() {
      return _type;
    });
    this.__defineGetter__("value", function() {
      return _value;
    });
    this.__defineGetter__("arch", function() {
      return _arch;
    });
  }
  util.inherits(RegistryItem, Object);
  function Registry(options) {
    if (!(this instanceof Registry))
      return new Registry(options);
    var _options = options || {}, _host = "" + (_options.host || ""), _hive = "" + (_options.hive || HKLM), _key = "" + (_options.key || ""), _arch = _options.arch || null;
    this.__defineGetter__("host", function() {
      return _host;
    });
    this.__defineGetter__("hive", function() {
      return _hive;
    });
    this.__defineGetter__("key", function() {
      return _key;
    });
    this.__defineGetter__("path", function() {
      return (_host.length == 0 ? "" : "\\\\" + _host + "\\") + _hive + _key;
    });
    this.__defineGetter__("arch", function() {
      return _arch;
    });
    this.__defineGetter__("parent", function() {
      var i = _key.lastIndexOf("\\");
      return new Registry({
        host: this.host,
        hive: this.hive,
        key: i == -1 ? "" : _key.substring(0, i),
        arch: this.arch
      });
    });
    if (HIVES.indexOf(_hive) == -1)
      throw new Error("illegal hive specified.");
    if (!KEY_PATTERN.test(_key))
      throw new Error("illegal key specified.");
    if (_arch && _arch != "x64" && _arch != "x86")
      throw new Error("illegal architecture specified (use x86 or x64)");
  }
  Registry.HKLM = HKLM;
  Registry.HKCU = HKCU;
  Registry.HKCR = HKCR;
  Registry.HKU = HKU;
  Registry.HKCC = HKCC;
  Registry.HIVES = HIVES;
  Registry.REG_SZ = REG_SZ;
  Registry.REG_MULTI_SZ = REG_MULTI_SZ;
  Registry.REG_EXPAND_SZ = REG_EXPAND_SZ;
  Registry.REG_DWORD = REG_DWORD;
  Registry.REG_QWORD = REG_QWORD;
  Registry.REG_BINARY = REG_BINARY;
  Registry.REG_NONE = REG_NONE;
  Registry.REG_TYPES = REG_TYPES;
  Registry.DEFAULT_VALUE = DEFAULT_VALUE;
  Registry.prototype.values = function values(cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    var args = ["QUERY", this.path];
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), buffer = "", self = this, error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("QUERY", code, output), null);
      } else {
        var items = [], result = [], lines = buffer.split("\n"), lineNumber = 0;
        for (var i = 0, l = lines.length; i < l; i++) {
          var line = lines[i].trim();
          if (line.length > 0) {
            if (lineNumber != 0) {
              items.push(line);
            }
            ++lineNumber;
          }
        }
        for (var i = 0, l = items.length; i < l; i++) {
          var match = ITEM_PATTERN.exec(items[i]), name, type, value;
          if (match) {
            name = match[1].trim();
            type = match[2].trim();
            value = match[3];
            result.push(new RegistryItem(self.host, self.hive, self.key, name, type, value, self.arch));
          }
        }
        cb(null, result);
      }
    });
    proc.stdout.on("data", function(data) {
      buffer += data.toString();
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.keys = function keys(cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    var args = ["QUERY", this.path];
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), buffer = "", self = this, error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("QUERY", code, output), null);
      }
    });
    proc.stdout.on("data", function(data) {
      buffer += data.toString();
    });
    proc.stdout.on("end", function() {
      var items = [], result = [], lines = buffer.split("\n");
      for (var i = 0, l = lines.length; i < l; i++) {
        var line = lines[i].trim();
        if (line.length > 0) {
          items.push(line);
        }
      }
      for (var i = 0, l = items.length; i < l; i++) {
        var match = PATH_PATTERN.exec(items[i]), key;
        if (match) {
          match[1];
          key = match[2];
          if (key && key !== self.key) {
            result.push(new Registry({
              host: self.host,
              hive: self.hive,
              key,
              arch: self.arch
            }));
          }
        }
      }
      cb(null, result);
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.get = function get(name, cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    var args = ["QUERY", this.path];
    if (name == "")
      args.push("/ve");
    else
      args = args.concat(["/v", name]);
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), buffer = "", self = this, error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("QUERY", code, output), null);
      } else {
        var items = [], result = null, lines = buffer.split("\n"), lineNumber = 0;
        for (var i = 0, l = lines.length; i < l; i++) {
          var line = lines[i].trim();
          if (line.length > 0) {
            if (lineNumber != 0) {
              items.push(line);
            }
            ++lineNumber;
          }
        }
        var item = items[items.length - 1] || "", match = ITEM_PATTERN.exec(item), name2, type, value;
        if (match) {
          name2 = match[1].trim();
          type = match[2].trim();
          value = match[3];
          result = new RegistryItem(self.host, self.hive, self.key, name2, type, value, self.arch);
        }
        cb(null, result);
      }
    });
    proc.stdout.on("data", function(data) {
      buffer += data.toString();
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.set = function set(name, type, value, cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    if (REG_TYPES.indexOf(type) == -1)
      throw Error("illegal type specified.");
    var args = ["ADD", this.path];
    if (name == "")
      args.push("/ve");
    else
      args = args.concat(["/v", name]);
    args = args.concat(["/t", type, "/d", value, "/f"]);
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("ADD", code, output));
      } else {
        cb(null);
      }
    });
    proc.stdout.on("data", function(data) {
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.remove = function remove(name, cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    var args = name ? ["DELETE", this.path, "/f", "/v", name] : ["DELETE", this.path, "/f", "/ve"];
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("DELETE", code, output), null);
      } else {
        cb(null);
      }
    });
    proc.stdout.on("data", function(data) {
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.clear = function clear(cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    var args = ["DELETE", this.path, "/f", "/va"];
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("DELETE", code, output), null);
      } else {
        cb(null);
      }
    });
    proc.stdout.on("data", function(data) {
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.erase = Registry.prototype.clear;
  Registry.prototype.destroy = function destroy(cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    var args = ["DELETE", this.path, "/f"];
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("DELETE", code, output), null);
      } else {
        cb(null);
      }
    });
    proc.stdout.on("data", function(data) {
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.create = function create(cb) {
    if (typeof cb !== "function")
      throw new TypeError("must specify a callback");
    var args = ["ADD", this.path, "/f"];
    pushArch(args, this.arch);
    var proc = spawn(getRegExePath(), args, {
      cwd: void 0,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }), error = null;
    var output = captureOutput(proc);
    proc.on("close", function(code) {
      if (error) {
        return;
      } else if (code !== 0) {
        cb(mkErrorMsg("ADD", code, output), null);
      } else {
        cb(null);
      }
    });
    proc.stdout.on("data", function(data) {
    });
    proc.on("error", function(err) {
      error = err;
      cb(err);
    });
    return this;
  };
  Registry.prototype.keyExists = function keyExists(cb) {
    this.values(function(err, items) {
      if (err) {
        if (err.code == 1) {
          return cb(null, false);
        }
        return cb(err);
      }
      cb(null, true);
    });
    return this;
  };
  Registry.prototype.valueExists = function valueExists(name, cb) {
    this.get(name, function(err, item) {
      if (err) {
        if (err.code == 1) {
          return cb(null, false);
        }
        return cb(err);
      }
      cb(null, true);
    });
    return this;
  };
  registry = Registry;
  return registry;
}
var AutoLaunchWindows;
var hasRequiredAutoLaunchWindows;
function requireAutoLaunchWindows() {
  if (hasRequiredAutoLaunchWindows) return AutoLaunchWindows;
  hasRequiredAutoLaunchWindows = 1;
  var Winreg, fs2, path$12, regKey;
  fs2 = fs$1;
  path$12 = path;
  Winreg = requireRegistry();
  regKey = new Winreg({
    hive: Winreg.HKCU,
    key: "\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
  });
  AutoLaunchWindows = {
    /* Public */
    enable: function(arg) {
      var appName, appPath, isHiddenOnLaunch;
      appName = arg.appName, appPath = arg.appPath, isHiddenOnLaunch = arg.isHiddenOnLaunch;
      return new Promise(function(resolve, reject) {
        var args, pathToAutoLaunchedApp, ref, updateDotExe;
        pathToAutoLaunchedApp = appPath;
        args = "";
        updateDotExe = path$12.join(path$12.dirname(process.execPath), "..", "update.exe");
        if (((ref = process.versions) != null ? ref.electron : void 0) != null && fs2.existsSync(updateDotExe)) {
          pathToAutoLaunchedApp = updateDotExe;
          args = ' --processStart "' + path$12.basename(process.execPath) + '"';
          if (isHiddenOnLaunch) {
            args += ' --process-start-args "--hidden"';
          }
        } else {
          if (isHiddenOnLaunch) {
            args += " --hidden";
          }
        }
        return regKey.set(appName, Winreg.REG_SZ, '"' + pathToAutoLaunchedApp + '"' + args, function(err) {
          if (err != null) {
            return reject(err);
          }
          return resolve();
        });
      });
    },
    disable: function(appName) {
      return new Promise(function(resolve, reject) {
        return regKey.remove(appName, function(err) {
          if (err != null) {
            if (err.message.indexOf("The system was unable to find the specified registry key or value") !== -1) {
              return resolve(false);
            }
            return reject(err);
          }
          return resolve();
        });
      });
    },
    isEnabled: function(appName) {
      return new Promise(function(resolve, reject) {
        return regKey.get(appName, function(err, item) {
          if (err != null) {
            return resolve(false);
          }
          return resolve(item != null);
        });
      });
    }
  };
  return AutoLaunchWindows;
}
var applescript = {};
var applescriptParser = {};
var hasRequiredApplescriptParser;
function requireApplescriptParser() {
  if (hasRequiredApplescriptParser) return applescriptParser;
  hasRequiredApplescriptParser = 1;
  (function(exports) {
    exports.parse = function(str) {
      if (str.length == 0) {
        return;
      }
      var rtn = parseFromFirstRemaining.call({
        value: str,
        index: 0
      });
      return rtn;
    };
    function parseFromFirstRemaining() {
      var cur = this.value[this.index];
      switch (cur) {
        case "{":
          return exports.ArrayParser.call(this);
        case '"':
          return exports.StringParser.call(this);
        case "a":
          if (this.value.substring(this.index, this.index + 5) == "alias") {
            return exports.AliasParser.call(this);
          }
          break;
        case "«":
          if (this.value.substring(this.index, this.index + 5) == "«data") {
            return exports.DataParser.call(this);
          }
          break;
      }
      if (!isNaN(cur)) {
        return exports.NumberParser.call(this);
      }
      return exports.UndefinedParser.call(this);
    }
    exports.AliasParser = function() {
      this.index += 6;
      return "/Volumes/" + exports.StringParser.call(this).replace(/:/g, "/");
    };
    exports.ArrayParser = function() {
      var rtn = [], cur = this.value[++this.index];
      while (cur != "}") {
        rtn.push(parseFromFirstRemaining.call(this));
        if (this.value[this.index] == ",") this.index += 2;
        cur = this.value[this.index];
      }
      this.index++;
      return rtn;
    };
    exports.DataParser = function() {
      var body = exports.UndefinedParser.call(this);
      body = body.substring(6, body.length - 1);
      var type = body.substring(0, 4);
      body = body.substring(4, body.length);
      var buf = new Buffer(body.length / 2);
      var count = 0;
      for (var i = 0, l = body.length; i < l; i += 2) {
        buf[count++] = parseInt(body[i] + body[i + 1], 16);
      }
      buf.type = type;
      return buf;
    };
    exports.NumberParser = function() {
      return Number(exports.UndefinedParser.call(this));
    };
    exports.StringParser = function(str) {
      var rtn = "", end = ++this.index, cur = this.value[end++];
      while (cur != '"') {
        if (cur == "\\") {
          rtn += this.value.substring(this.index, end - 1);
          this.index = end++;
        }
        cur = this.value[end++];
      }
      rtn += this.value.substring(this.index, end - 1);
      this.index = end;
      return rtn;
    };
    var END_OF_TOKEN = /}|,|\n/;
    exports.UndefinedParser = function() {
      var end = this.index, cur = this.value[end++];
      while (!END_OF_TOKEN.test(cur)) {
        cur = this.value[end++];
      }
      var rtn = this.value.substring(this.index, end - 1);
      this.index = end - 1;
      return rtn;
    };
  })(applescriptParser);
  return applescriptParser;
}
var hasRequiredApplescript;
function requireApplescript() {
  if (hasRequiredApplescript) return applescript;
  hasRequiredApplescript = 1;
  (function(exports) {
    var spawn = require$$2.spawn;
    exports.Parsers = requireApplescriptParser();
    var parse = exports.Parsers.parse;
    exports.osascript = "osascript";
    exports.execFile = function execFile(file, args, callback) {
      if (!Array.isArray(args)) {
        callback = args;
        args = [];
      }
      return runApplescript(file, args, callback);
    };
    exports.execString = function execString(str, callback) {
      return runApplescript(str, callback);
    };
    function runApplescript(strOrPath, args, callback) {
      var isString = false;
      if (!Array.isArray(args)) {
        callback = args;
        args = [];
        isString = true;
      }
      args.push("-ss");
      if (!isString) {
        args.push(strOrPath);
      }
      var interpreter = spawn(exports.osascript, args);
      bufferBody(interpreter.stdout);
      bufferBody(interpreter.stderr);
      interpreter.on("exit", function(code) {
        var result = parse(interpreter.stdout.body);
        var err;
        if (code) {
          err = new Error(interpreter.stderr.body);
          err.appleScript = strOrPath;
          err.exitCode = code;
        }
        if (callback) {
          callback(err, result, interpreter.stderr.body);
        }
      });
      if (isString) {
        interpreter.stdin.write(strOrPath);
        interpreter.stdin.end();
      }
    }
    function bufferBody(stream) {
      stream.body = "";
      stream.setEncoding("utf8");
      stream.on("data", function(chunk) {
        stream.body += chunk;
      });
    }
  })(applescript);
  return applescript;
}
var untildify;
var hasRequiredUntildify;
function requireUntildify() {
  if (hasRequiredUntildify) return untildify;
  hasRequiredUntildify = 1;
  const home = os.homedir();
  untildify = (str) => {
    if (typeof str !== "string") {
      throw new TypeError(`Expected a string, got ${typeof str}`);
    }
    return home ? str.replace(/^~(?=$|\/|\\)/, home) : str;
  };
  return untildify;
}
var mkdirp;
var hasRequiredMkdirp;
function requireMkdirp() {
  if (hasRequiredMkdirp) return mkdirp;
  hasRequiredMkdirp = 1;
  var path$12 = path;
  var fs2 = fs$1;
  var _0777 = parseInt("0777", 8);
  mkdirp = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;
  function mkdirP(p, opts, f, made) {
    if (typeof opts === "function") {
      f = opts;
      opts = {};
    } else if (!opts || typeof opts !== "object") {
      opts = { mode: opts };
    }
    var mode = opts.mode;
    var xfs = opts.fs || fs2;
    if (mode === void 0) {
      mode = _0777;
    }
    if (!made) made = null;
    var cb = f || /* istanbul ignore next */
    function() {
    };
    p = path$12.resolve(p);
    xfs.mkdir(p, mode, function(er) {
      if (!er) {
        made = made || p;
        return cb(null, made);
      }
      switch (er.code) {
        case "ENOENT":
          if (path$12.dirname(p) === p) return cb(er);
          mkdirP(path$12.dirname(p), opts, function(er2, made2) {
            if (er2) cb(er2, made2);
            else mkdirP(p, opts, cb, made2);
          });
          break;
        // In the case of any other error, just see if there's a dir
        // there already.  If so, then hooray!  If not, then something
        // is borked.
        default:
          xfs.stat(p, function(er2, stat) {
            if (er2 || !stat.isDirectory()) cb(er, made);
            else cb(null, made);
          });
          break;
      }
    });
  }
  mkdirP.sync = function sync(p, opts, made) {
    if (!opts || typeof opts !== "object") {
      opts = { mode: opts };
    }
    var mode = opts.mode;
    var xfs = opts.fs || fs2;
    if (mode === void 0) {
      mode = _0777;
    }
    if (!made) made = null;
    p = path$12.resolve(p);
    try {
      xfs.mkdirSync(p, mode);
      made = made || p;
    } catch (err0) {
      switch (err0.code) {
        case "ENOENT":
          made = sync(path$12.dirname(p), opts, made);
          sync(p, opts, made);
          break;
        // In the case of any other error, just see if there's a dir
        // there already.  If so, then hooray!  If not, then something
        // is borked.
        default:
          var stat;
          try {
            stat = xfs.statSync(p);
          } catch (err1) {
            throw err0;
          }
          if (!stat.isDirectory()) throw err0;
          break;
      }
    }
    return made;
  };
  return mkdirp;
}
var fileBasedUtilities;
var hasRequiredFileBasedUtilities;
function requireFileBasedUtilities() {
  if (hasRequiredFileBasedUtilities) return fileBasedUtilities;
  hasRequiredFileBasedUtilities = 1;
  var fs2, mkdirp2;
  fs2 = fs$1;
  mkdirp2 = requireMkdirp();
  fileBasedUtilities = {
    /* Public */
    createFile: function(arg) {
      var data, directory, filePath;
      directory = arg.directory, filePath = arg.filePath, data = arg.data;
      return new Promise(function(resolve, reject) {
        return mkdirp2(directory, function(mkdirErr) {
          if (mkdirErr != null) {
            return reject(mkdirErr);
          }
          return fs2.writeFile(filePath, data, function(writeErr) {
            if (writeErr != null) {
              return reject(writeErr);
            }
            return resolve();
          });
        });
      });
    },
    isEnabled: function(filePath) {
      return new Promise(/* @__PURE__ */ function(_this) {
        return function(resolve, reject) {
          return fs2.stat(filePath, function(err, stat) {
            if (err != null) {
              return resolve(false);
            }
            return resolve(stat != null);
          });
        };
      }());
    },
    removeFile: function(filePath) {
      return new Promise(/* @__PURE__ */ function(_this) {
        return function(resolve, reject) {
          return fs2.stat(filePath, function(statErr) {
            if (statErr != null) {
              return resolve();
            }
            return fs2.unlink(filePath, function(unlinkErr) {
              if (unlinkErr != null) {
                return reject(unlinkErr);
              }
              return resolve();
            });
          });
        };
      }());
    }
  };
  return fileBasedUtilities;
}
var AutoLaunchMac;
var hasRequiredAutoLaunchMac;
function requireAutoLaunchMac() {
  if (hasRequiredAutoLaunchMac) return AutoLaunchMac;
  hasRequiredAutoLaunchMac = 1;
  var applescript2, fileBasedUtilities2, untildify2, indexOf = [].indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (i in this && this[i] === item) return i;
    }
    return -1;
  };
  applescript2 = requireApplescript();
  untildify2 = requireUntildify();
  fileBasedUtilities2 = requireFileBasedUtilities();
  AutoLaunchMac = {
    /* Public */
    enable: function(arg) {
      var appName, appPath, data, isHiddenOnLaunch, isHiddenValue, mac, programArguments, programArgumentsSection, properties;
      appName = arg.appName, appPath = arg.appPath, isHiddenOnLaunch = arg.isHiddenOnLaunch, mac = arg.mac;
      if (mac.useLaunchAgent) {
        programArguments = [appPath];
        if (isHiddenOnLaunch) {
          programArguments.push("--hidden");
        }
        programArgumentsSection = programArguments.map(function(argument) {
          return "    <string>" + argument + "</string>";
        }).join("\n");
        data = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>Label</key>\n  <string>' + appName + "</string>\n  <key>ProgramArguments</key>\n  <array>\n  " + programArgumentsSection + "\n  </array>\n  <key>RunAtLoad</key>\n  <true/>\n</dict>\n</plist>";
        return fileBasedUtilities2.createFile({
          data,
          directory: this.getDirectory(),
          filePath: this.getFilePath(appName)
        });
      }
      isHiddenValue = isHiddenOnLaunch ? "true" : "false";
      properties = '{path:"' + appPath + '", hidden:' + isHiddenValue + ', name:"' + appName + '"}';
      return this.execApplescriptCommand("make login item at end with properties " + properties);
    },
    disable: function(appName, mac) {
      if (mac.useLaunchAgent) {
        return fileBasedUtilities2.removeFile(this.getFilePath(appName));
      }
      return this.execApplescriptCommand('delete login item "' + appName + '"');
    },
    isEnabled: function(appName, mac) {
      if (mac.useLaunchAgent) {
        return fileBasedUtilities2.isEnabled(this.getFilePath(appName));
      }
      return this.execApplescriptCommand("get the name of every login item").then(function(loginItems) {
        return loginItems != null && indexOf.call(loginItems, appName) >= 0;
      });
    },
    /* Private */
    execApplescriptCommand: function(commandSuffix) {
      return new Promise(function(resolve, reject) {
        return applescript2.execString('tell application "System Events" to ' + commandSuffix, function(err, result) {
          if (err != null) {
            return reject(err);
          }
          return resolve(result);
        });
      });
    },
    getDirectory: function() {
      return untildify2("~/Library/LaunchAgents/");
    },
    getFilePath: function(appName) {
      return "" + this.getDirectory() + appName + ".plist";
    }
  };
  return AutoLaunchMac;
}
var AutoLaunchLinux;
var hasRequiredAutoLaunchLinux;
function requireAutoLaunchLinux() {
  if (hasRequiredAutoLaunchLinux) return AutoLaunchLinux;
  hasRequiredAutoLaunchLinux = 1;
  var fileBasedUtilities2, untildify2;
  untildify2 = requireUntildify();
  fileBasedUtilities2 = requireFileBasedUtilities();
  AutoLaunchLinux = {
    /* Public */
    enable: function(arg) {
      var appName, appPath, data, hiddenArg, isHiddenOnLaunch;
      appName = arg.appName, appPath = arg.appPath, isHiddenOnLaunch = arg.isHiddenOnLaunch;
      hiddenArg = isHiddenOnLaunch ? " --hidden" : "";
      data = "[Desktop Entry]\nType=Application\nVersion=1.0\nName=" + appName + "\nComment=" + appName + "startup script\nExec=" + appPath + hiddenArg + "\nStartupNotify=false\nTerminal=false";
      return fileBasedUtilities2.createFile({
        data,
        directory: this.getDirectory(),
        filePath: this.getFilePath(appName)
      });
    },
    disable: function(appName) {
      return fileBasedUtilities2.removeFile(this.getFilePath(appName));
    },
    isEnabled: function(appName) {
      return fileBasedUtilities2.isEnabled(this.getFilePath(appName));
    },
    /* Private */
    getDirectory: function() {
      return untildify2("~/.config/autostart/");
    },
    getFilePath: function(appName) {
      return "" + this.getDirectory() + appName + ".desktop";
    }
  };
  return AutoLaunchLinux;
}
var dist;
var hasRequiredDist;
function requireDist() {
  if (hasRequiredDist) return dist;
  hasRequiredDist = 1;
  var isPathAbsolute, bind = function(fn, me) {
    return function() {
      return fn.apply(me, arguments);
    };
  };
  isPathAbsolute = requirePathIsAbsolute();
  dist = function() {
    function AutoLaunch2(arg) {
      var isHidden, mac, name, path2, versions;
      name = arg.name, isHidden = arg.isHidden, mac = arg.mac, path2 = arg.path;
      this.fixOpts = bind(this.fixOpts, this);
      this.isEnabled = bind(this.isEnabled, this);
      this.disable = bind(this.disable, this);
      this.enable = bind(this.enable, this);
      if (name == null) {
        throw new Error("You must specify a name");
      }
      this.opts = {
        appName: name,
        isHiddenOnLaunch: isHidden != null ? isHidden : false,
        mac: mac != null ? mac : {}
      };
      versions = typeof process !== "undefined" && process !== null ? process.versions : void 0;
      if (path2 != null) {
        if (!isPathAbsolute(path2)) {
          throw new Error("path must be absolute");
        }
        this.opts.appPath = path2;
      } else if (versions != null && (versions.nw != null || versions["node-webkit"] != null || versions.electron != null)) {
        this.opts.appPath = process.execPath;
      } else {
        throw new Error("You must give a path (this is only auto-detected for NW.js and Electron apps)");
      }
      this.fixOpts();
      this.api = null;
      if (/^win/.test(process.platform)) {
        this.api = requireAutoLaunchWindows();
      } else if (/darwin/.test(process.platform)) {
        this.api = requireAutoLaunchMac();
      } else if (/linux/.test(process.platform) || /freebsd/.test(process.platform)) {
        this.api = requireAutoLaunchLinux();
      } else {
        throw new Error("Unsupported platform");
      }
    }
    AutoLaunch2.prototype.enable = function() {
      return this.api.enable(this.opts);
    };
    AutoLaunch2.prototype.disable = function() {
      return this.api.disable(this.opts.appName, this.opts.mac);
    };
    AutoLaunch2.prototype.isEnabled = function() {
      return this.api.isEnabled(this.opts.appName, this.opts.mac);
    };
    AutoLaunch2.prototype.fixMacExecPath = function(path2, macOptions) {
      path2 = path2.replace(/(^.+?[^\/]+?\.app)\/Contents\/(Frameworks\/((\1|[^\/]+?) Helper)\.app\/Contents\/MacOS\/\3|MacOS\/Electron)/, "$1");
      if (!macOptions.useLaunchAgent) {
        path2 = path2.replace(/\.app\/Contents\/MacOS\/[^\/]*$/, ".app");
      }
      return path2;
    };
    AutoLaunch2.prototype.fixOpts = function() {
      var tempPath;
      this.opts.appPath = this.opts.appPath.replace(/\/$/, "");
      if (/darwin/.test(process.platform)) {
        this.opts.appPath = this.fixMacExecPath(this.opts.appPath, this.opts.mac);
      }
      if (this.opts.appPath.indexOf("/") !== -1) {
        tempPath = this.opts.appPath.split("/");
        this.opts.appName = tempPath[tempPath.length - 1];
      } else if (this.opts.appPath.indexOf("\\") !== -1) {
        tempPath = this.opts.appPath.split("\\");
        this.opts.appName = tempPath[tempPath.length - 1];
        this.opts.appName = this.opts.appName.substr(0, this.opts.appName.length - ".exe".length);
      }
      if (/darwin/.test(process.platform)) {
        if (this.opts.appName.indexOf(".app", this.opts.appName.length - ".app".length) !== -1) {
          return this.opts.appName = this.opts.appName.substr(0, this.opts.appName.length - ".app".length);
        }
      }
    };
    return AutoLaunch2;
  }();
  return dist;
}
var distExports = requireDist();
const AutoLaunch = /* @__PURE__ */ getDefaultExportFromCjs(distExports);
class AutoLaunchManager {
  autoLauncher;
  settingsPath;
  constructor(appName = "Unstuck") {
    this.autoLauncher = new AutoLaunch({
      name: appName,
      path: app.getPath("exe")
    });
    this.settingsPath = path.join(app.getPath("userData"), "auto-launch-settings.json");
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
      await fs$1.promises.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
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
