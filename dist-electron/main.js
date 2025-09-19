import { app, BrowserWindow, Menu, ipcMain, nativeTheme, globalShortcut, screen } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 420;
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    frame: false,
    // Remove window frame (title bar, borders)
    transparent: true,
    // Make window background transparent
    alwaysOnTop: true,
    // Keep on top of other windows
    resizable: false,
    // Prevent resizing
    width: windowWidth,
    // Fixed width for navigation bar
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
  Menu.setApplicationMenu(null);
  createWindow();
  ipcMain.handle("get-system-theme", () => {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  });
  nativeTheme.on("updated", () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("theme-changed", nativeTheme.shouldUseDarkColors ? "dark" : "light");
    }
  });
  globalShortcut.register("Shift+\\", () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("toggle-navigation-bar");
    }
  });
  ipcMain.on("set-ignore-mouse-events", (_event, ignore, options) => {
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options || { forward: true });
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
