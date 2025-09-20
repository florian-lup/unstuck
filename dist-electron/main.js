import { app as o, BrowserWindow as l, Menu as m, ipcMain as a, nativeTheme as s, globalShortcut as d, screen as h } from "electron";
import { fileURLToPath as f } from "node:url";
import n from "node:path";
const c = n.dirname(f(import.meta.url));
o.setName("Unstuck");
process.env.APP_ROOT = n.join(c, "..");
const i = process.env.VITE_DEV_SERVER_URL, R = n.join(process.env.APP_ROOT, "dist-electron"), u = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = i ? n.join(process.env.APP_ROOT, "public") : u;
let e;
function p() {
  const { width: r } = h.getPrimaryDisplay().workAreaSize, t = 420;
  e = new l({
    title: "Unstuck",
    icon: n.join(process.env.VITE_PUBLIC, "unstuck-logo.ico"),
    frame: !1,
    // Remove window frame (title bar, borders)
    transparent: !0,
    // Make window background transparent
    alwaysOnTop: !0,
    // Keep on top of other windows
    resizable: !1,
    // Prevent resizing
    width: t,
    // Fixed width for navigation bar
    x: Math.round((r - t) / 2),
    // Center horizontally
    y: 20,
    // Position at top of screen
    webPreferences: {
      preload: n.join(c, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), e.setIgnoreMouseEvents(!0, { forward: !0 }), e.webContents.on("did-finish-load", () => {
    e?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), i ? e.loadURL(i) : e.loadFile(n.join(u, "index.html"));
}
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), e = null);
});
o.on("activate", () => {
  l.getAllWindows().length === 0 && p();
});
o.whenReady().then(() => {
  o.setName("Unstuck"), m.setApplicationMenu(null), p(), a.handle("get-system-theme", () => s.shouldUseDarkColors ? "dark" : "light"), s.on("updated", () => {
    e && !e.isDestroyed() && e.webContents.send("theme-changed", s.shouldUseDarkColors ? "dark" : "light");
  }), d.register("Shift+\\", () => {
    e && !e.isDestroyed() && e.webContents.send("toggle-navigation-bar");
  }), a.on("set-ignore-mouse-events", (r, t, w) => {
    e && !e.isDestroyed() && e.setIgnoreMouseEvents(t, w || { forward: !0 });
  });
});
o.on("will-quit", () => {
  d.unregisterAll();
});
export {
  R as MAIN_DIST,
  u as RENDERER_DIST,
  i as VITE_DEV_SERVER_URL
};
