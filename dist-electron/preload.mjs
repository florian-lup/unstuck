"use strict";
const electron = require("electron");
const ALLOWED_SEND_CHANNELS = [
  "set-ignore-mouse-events",
  "ensure-always-on-top",
  "window-interaction",
  "user-logout"
];
const ALLOWED_INVOKE_CHANNELS = [
  "open-external-url",
  "auth-get-oauth-url",
  "auth-get-session",
  "auth-sign-out",
  "auth-is-secure-storage",
  "auto-launch:get-status",
  "auto-launch:enable",
  "auto-launch:disable",
  "auto-launch:toggle"
];
const ALLOWED_LISTEN_CHANNELS = [
  "toggle-navigation-bar",
  "open-settings-menu",
  "auth-success",
  "auth-error"
];
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  send(channel, ...args) {
    if (!ALLOWED_SEND_CHANNELS.includes(channel)) {
      throw new Error(`Blocked send to unauthorized channel: ${channel}`);
    }
    electron.ipcRenderer.send(channel, ...args);
  },
  invoke(channel, ...args) {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      throw new Error(`Blocked invoke to unauthorized channel: ${channel}`);
    }
    return electron.ipcRenderer.invoke(channel, ...args);
  },
  on(channel, listener) {
    if (!ALLOWED_LISTEN_CHANNELS.includes(channel)) {
      throw new Error(`Blocked listener on unauthorized channel: ${channel}`);
    }
    const wrappedListener = (_event, ...args) => {
      listener(...args);
    };
    electron.ipcRenderer.on(channel, wrappedListener);
    return wrappedListener;
  },
  off(channel, listener) {
    if (!ALLOWED_LISTEN_CHANNELS.includes(channel)) {
      throw new Error(`Blocked off on unauthorized channel: ${channel}`);
    }
    if (listener) {
      electron.ipcRenderer.off(channel, listener);
    } else {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  }
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  onNavigationBarToggle: (callback) => {
    const listener = () => {
      callback();
    };
    electron.ipcRenderer.on("toggle-navigation-bar", listener);
    return listener;
  },
  removeNavigationBarToggleListener: () => {
    electron.ipcRenderer.removeAllListeners("toggle-navigation-bar");
  },
  onOpenSettingsMenu: (callback) => {
    const listener = () => {
      callback();
    };
    electron.ipcRenderer.on("open-settings-menu", listener);
    return listener;
  },
  removeOpenSettingsMenuListener: () => {
    electron.ipcRenderer.removeAllListeners("open-settings-menu");
  },
  updateNavigationShortcut: (shortcut) => {
    return electron.ipcRenderer.invoke("update-navigation-shortcut", shortcut);
  },
  setIgnoreMouseEvents: (ignore, options) => {
    electron.ipcRenderer.send("set-ignore-mouse-events", ignore, options);
  },
  ensureAlwaysOnTop: () => {
    electron.ipcRenderer.send("ensure-always-on-top");
  },
  windowInteraction: () => {
    electron.ipcRenderer.send("window-interaction");
  },
  openExternalUrl: (url) => {
    return electron.ipcRenderer.invoke("open-external-url", url);
  },
  // Secure Auth0 authentication APIs (no direct Auth0 client exposure)
  auth: {
    startAuthFlow: () => electron.ipcRenderer.invoke("auth0-start-flow"),
    getSession: () => electron.ipcRenderer.invoke("auth0-get-session"),
    signOut: () => electron.ipcRenderer.invoke("auth0-sign-out"),
    isSecureStorage: () => electron.ipcRenderer.invoke("auth0-is-secure-storage"),
    cancelDeviceFlow: () => electron.ipcRenderer.invoke("auth0-cancel-device-flow"),
    // Listen for auth events from main process
    onAuthSuccess: (callback) => {
      const listener = (_event, session) => {
        callback(session);
      };
      electron.ipcRenderer.on("auth0-success", listener);
      return listener;
    },
    onAuthError: (callback) => {
      const listener = (_event, error) => {
        callback(error);
      };
      electron.ipcRenderer.on("auth0-error", listener);
      return listener;
    },
    onTokenRefresh: (callback) => {
      const listener = (_event, session) => {
        callback(session);
      };
      electron.ipcRenderer.on("auth0-token-refresh", listener);
      return listener;
    },
    removeAuthListeners: () => {
      electron.ipcRenderer.removeAllListeners("auth0-success");
      electron.ipcRenderer.removeAllListeners("auth0-error");
      electron.ipcRenderer.removeAllListeners("auth0-token-refresh");
    }
  },
  autoLaunch: {
    getStatus: () => electron.ipcRenderer.invoke("auto-launch:get-status"),
    enable: () => electron.ipcRenderer.invoke("auto-launch:enable"),
    disable: () => electron.ipcRenderer.invoke("auto-launch:disable"),
    toggle: () => electron.ipcRenderer.invoke("auto-launch:toggle")
  }
});
