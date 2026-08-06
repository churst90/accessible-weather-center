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

  // Navigation hardening: the renderer displays remote-derived strings
  // (alert text, FAA XML, Icecast metadata). A crafted link or redirect
  // must not be able to navigate the window or spawn new ones.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = isDev ? url.startsWith("http://localhost:5173") : url.startsWith("file://");
    if (!allowed) event.preventDefault();
  });

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

// Fetch weatherUSA's Icecast status JSON and return the list of mount
// points that are actually serving audio. We do this in main rather than
// renderer because radio.weatherusa.net doesn't send an
// Access-Control-Allow-Origin header, so browser fetch would be blocked.
//
// Also tolerates a known malformed-JSON quirk: some entries embed
// `"title": - ,` with an unquoted dash as the value. We patch that before
// JSON.parse so the whole response doesn't fail.
ipcMain.handle("nwr:fetchActiveStations", async () => {
  type Source = {
    bitrate?: number;
    server_name?: string;
    server_description?: string;
    listenurl?: string;
  };
  try {
    const res = await fetch("https://radio.weatherusa.net/status-json.xsl", {
      headers: { "User-Agent": "AccessibleWeatherCenter/0.9.6" }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    let text = await res.text();
    text = text.replace(/"title":\s*-\s*,/g, '"title":null,');
    text = text.replace(/"title":\s*-\s*}/g, '"title":null}');
    const data = JSON.parse(text) as { icestats?: { source?: Source[] | Source } };
    // Icecast returns a bare object (not a one-element array) when only a
    // single mount is live.
    const raw = data.icestats?.source;
    const sources = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const active = sources
      .filter((s) => s.bitrate || s.server_name)
      .map((s) => {
        const m = s.listenurl?.match(/NWR\/(.+?)\.mp3/);
        return m
          ? {
              callSign: m[1],
              description: (s.server_description || "").trim(),
              name: (s.server_name || "").trim()
            }
          : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
    return { ok: true, stations: active };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

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
