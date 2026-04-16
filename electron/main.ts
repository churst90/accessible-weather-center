import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain } from "electron";
import * as path from "node:path";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Accessible Weather Center",
    backgroundColor: "#0a1f4a",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    if (process.env.AWC_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (!(app as unknown as { isQuitting?: boolean }).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray(): void {
  // Use the app icon for the tray. Electron resizes to ~16x16 on Windows.
  const iconPath = isDev
    ? path.join(__dirname, "..", "assets", "logos", "app-icon-180.png")
    : path.join(__dirname, "..", "dist", "assets", "logos", "app-icon-180.png");
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip("Accessible Weather Center");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: () => mainWindow?.show() },
      { label: "Hide", click: () => mainWindow?.hide() },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          (app as unknown as { isQuitting?: boolean }).isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

ipcMain.handle("notify", (_evt, payload: { title: string; body: string }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      urgency: "critical"
    });
    // Clicking the toast brings the app window to the front.
    notification.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notification.show();
  }
});

ipcMain.handle("window:minimize-to-tray", () => {
  mainWindow?.hide();
});

app.whenReady().then(() => {
  // Kill the default native menu entirely — this app is keyboard-driven
  // and the menu just clutters the frame. Set DevTools can still be opened
  // with AWC_DEVTOOLS=1 at launch.
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Stay alive in tray on all platforms — this is a background-capable app.
});

app.on("before-quit", () => {
  (app as unknown as { isQuitting?: boolean }).isQuitting = true;
});
