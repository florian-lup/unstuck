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
let overlayWindow;
function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const overlayWindowdowWidth = 450;
  const overlayWindowdowHeight = 650;
  overlayWindow = new BrowserWindow({
    title: "Unstuck",
    icon: path.join(process.env.VITE_PUBLIC, "unstuck-logo.ico"),
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
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
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
    void overlayWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
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
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send(
        "theme-changed",
        nativeTheme.shouldUseDarkColors ? "dark" : "light"
      );
    }
  });
  globalShortcut.register("Shift+\\", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("toggle-navigation-bar");
    }
  });
  ipcMain.on(
    "set-ignore-mouse-events",
    (_event, ignore, options) => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setIgnoreMouseEvents(ignore, options ?? { forward: true });
      }
    }
  );
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
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
