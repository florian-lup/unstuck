"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    electron.ipcRenderer.on(channel, (event, ...eventArgs) => {
      listener(event, ...eventArgs);
    });
  },
  off(channel, listener) {
    if (listener) {
      electron.ipcRenderer.off(channel, listener);
    } else {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  send(channel, ...args) {
    electron.ipcRenderer.send(channel, ...args);
  },
  invoke(channel, ...args) {
    return electron.ipcRenderer.invoke(channel, ...args);
  }
  // You can expose other APTs you need here.
  // ...
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getSystemTheme: () => electron.ipcRenderer.invoke("get-system-theme"),
  onThemeChanged: (callback) => {
    const listener = (_event, theme) => {
      callback(theme);
    };
    electron.ipcRenderer.on("theme-changed", listener);
    return listener;
  },
  removeThemeListener: () => {
    electron.ipcRenderer.removeAllListeners("theme-changed");
  },
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
  setIgnoreMouseEvents: (ignore, options) => {
    electron.ipcRenderer.send("set-ignore-mouse-events", ignore, options);
  },
  ensureAlwaysOnTop: () => {
    electron.ipcRenderer.send("ensure-always-on-top");
  },
  windowInteraction: () => {
    electron.ipcRenderer.send("window-interaction");
  }
});
