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
  "auto-launch:toggle",
  "updater:restart-and-install",
  "update-navigation-shortcut",
  "update-chat-shortcut",
  "update-history-shortcut",
  "update-settings-shortcut",
  "update-new-chat-shortcut"
];
const ALLOWED_LISTEN_CHANNELS = [
  "toggle-navigation-bar",
  "toggle-chat",
  "toggle-history",
  "toggle-settings",
  "trigger-new-chat",
  "open-settings-menu",
  "auth-success",
  "auth-error",
  "updater:update-ready"
];
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  send(channel, ...args) {
    if (!ALLOWED_SEND_CHANNELS.includes(channel)) {
      throw new Error(`Blocked send to unauthorized channel: ${channel}`);
    }
    electron.ipcRenderer.send(channel, ...args);
  },
  async invoke(channel, ...args) {
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
  updateNavigationShortcut: async (shortcut) => {
    return electron.ipcRenderer.invoke(
      "update-navigation-shortcut",
      shortcut
    );
  },
  updateChatShortcut: async (shortcut) => {
    return electron.ipcRenderer.invoke("update-chat-shortcut", shortcut);
  },
  updateHistoryShortcut: async (shortcut) => {
    return electron.ipcRenderer.invoke(
      "update-history-shortcut",
      shortcut
    );
  },
  updateSettingsShortcut: async (shortcut) => {
    return electron.ipcRenderer.invoke(
      "update-settings-shortcut",
      shortcut
    );
  },
  updateNewChatShortcut: async (shortcut) => {
    return electron.ipcRenderer.invoke(
      "update-new-chat-shortcut",
      shortcut
    );
  },
  onChatToggle: (callback) => {
    const listener = () => {
      callback();
    };
    electron.ipcRenderer.on("toggle-chat", listener);
    return listener;
  },
  removeChatToggleListener: () => {
    electron.ipcRenderer.removeAllListeners("toggle-chat");
  },
  onHistoryToggle: (callback) => {
    const listener = () => {
      callback();
    };
    electron.ipcRenderer.on("toggle-history", listener);
    return listener;
  },
  removeHistoryToggleListener: () => {
    electron.ipcRenderer.removeAllListeners("toggle-history");
  },
  onSettingsToggle: (callback) => {
    const listener = () => {
      callback();
    };
    electron.ipcRenderer.on("toggle-settings", listener);
    return listener;
  },
  removeSettingsToggleListener: () => {
    electron.ipcRenderer.removeAllListeners("toggle-settings");
  },
  onNewChatTrigger: (callback) => {
    const listener = () => {
      callback();
    };
    electron.ipcRenderer.on("trigger-new-chat", listener);
    return listener;
  },
  removeNewChatTriggerListener: () => {
    electron.ipcRenderer.removeAllListeners("trigger-new-chat");
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
  openExternalUrl: async (url) => {
    return electron.ipcRenderer.invoke("open-external-url", url);
  },
  // Secure Auth0 authentication APIs (no direct Auth0 client exposure)
  auth: {
    startAuthFlow: async () => electron.ipcRenderer.invoke("auth0-start-flow"),
    getSession: async () => electron.ipcRenderer.invoke("auth0-get-session"),
    signOut: async () => electron.ipcRenderer.invoke("auth0-sign-out"),
    isSecureStorage: async () => electron.ipcRenderer.invoke("auth0-is-secure-storage"),
    cancelDeviceFlow: async () => electron.ipcRenderer.invoke("auth0-cancel-device-flow"),
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
    getStatus: async () => electron.ipcRenderer.invoke("auto-launch:get-status"),
    enable: async () => electron.ipcRenderer.invoke("auto-launch:enable"),
    disable: async () => electron.ipcRenderer.invoke("auto-launch:disable"),
    toggle: async () => electron.ipcRenderer.invoke("auto-launch:toggle")
  },
  updater: {
    onUpdateReady: (callback) => {
      const listener = (_event, version) => {
        callback(version);
      };
      electron.ipcRenderer.on("updater:update-ready", listener);
      return listener;
    },
    removeUpdateReadyListener: () => {
      electron.ipcRenderer.removeAllListeners("updater:update-ready");
    },
    restartAndInstall: async () => electron.ipcRenderer.invoke("updater:restart-and-install")
  }
});
