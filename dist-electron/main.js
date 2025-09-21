import { app, BrowserWindow, Menu, ipcMain, nativeTheme, globalShortcut, screen } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.setName("Unstuck");
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 450;
  const windowHeight = 650;
  win = new BrowserWindow({
    title: "Unstuck",
    icon: path.join(process.env.VITE_PUBLIC, "unstuck-logo.ico"),
    frame: false,
    // Remove window frame (title bar, borders)
    transparent: true,
    // Make window background transparent
    alwaysOnTop: true,
    // Keep on top of other windows
    resizable: false,
    // Prevent resizing
    skipTaskbar: true,
    // Don't show in taskbar
    width: windowWidth,
    // Fixed width for navigation bar
    height: windowHeight,
    // Fixed height for chat window
    x: Math.round((screenWidth - windowWidth) / 2),
    // Center horizontally
    y: 20,
    // Position at top of screen
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on("blur", () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, "screen-saver", 1);
    }
  });
  win.on("focus", () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, "screen-saver", 1);
    }
  });
  win.on("show", () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.focus();
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
void app.whenReady().then(() => {
  app.setName("Unstuck");
  Menu.setApplicationMenu(null);
  createWindow();
  ipcMain.handle("get-system-theme", () => {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  });
  nativeTheme.on("updated", () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(
        "theme-changed",
        nativeTheme.shouldUseDarkColors ? "dark" : "light"
      );
    }
  });
  globalShortcut.register("Shift+\\", () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("toggle-navigation-bar");
    }
  });
  ipcMain.on(
    "set-ignore-mouse-events",
    (_event, ignore, options) => {
      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(ignore, options ?? { forward: true });
      }
    }
  );
  ipcMain.on("ensure-always-on-top", () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.moveTop();
    }
  });
  ipcMain.on("window-interaction", () => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.moveTop();
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.setAlwaysOnTop(true, "screen-saver", 1);
        }
      }, 100);
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
