import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, protocol, net } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const isDev = process.env.NODE_ENV === "development";

/**
 * Custom scheme the packaged app is served from.
 *
 * Why not file://: every media URL the renderer builds is root-relative
 * ("/assets/narration/..."), because that is what the web deployment needs.
 * Loaded over file://, those resolve against the filesystem root — the app
 * would look for /assets/narration on the system drive and 404 everything.
 * Serving the app from a scheme with a host gives "/" a meaning we control,
 * so the same URLs work in Electron and in a browser with no branching in
 * the renderer.
 */
const APP_SCHEME = "awc-asset";
const APP_ORIGIN = `${APP_SCHEME}://app`;

// Must be called before `app.ready`. `standard` gives the scheme normal URL
// parsing and a real origin; `stream` is what lets <audio> issue Range
// requests against it, which media playback and seeking depend on.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
  }
]);

/**
 * Where the media library lives, in priority order:
 *   1. AWC_ASSETS_DIR                      — explicit override
 *   2. <userData>/assets                   — where scripts/fetch-assets.mjs puts it
 *   3. <resources>/assets                  — if bundled into the installer
 *   4. <repo>/assets                       — running unpackaged from source
 *
 * Resolved once per launch. The app is designed to run without any of these
 * (system fonts, no music, screen-reader narration only), so a miss here is
 * degraded, not fatal.
 */
function resolveAssetsDir(): string | null {
  const candidates = [
    process.env.AWC_ASSETS_DIR,
    path.join(app.getPath("userData"), "assets"),
    path.join(process.resourcesPath ?? "", "assets"),
    path.join(__dirname, "..", "assets")
  ].filter((p): p is string => Boolean(p));

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
    } catch {
      // Unreadable candidate — try the next one.
    }
  }
  return null;
}

let assetsDir: string | null = null;

/**
 * Serve the app bundle and the media library over APP_SCHEME.
 *
 * "/assets/*" maps into the media library; everything else maps into the
 * built renderer in dist/. Requests are delegated to net.fetch against a
 * file:// URL rather than read manually, so Range requests, MIME sniffing
 * and streaming all behave the way <audio> expects.
 */
function registerAppProtocol(): void {
  assetsDir = resolveAssetsDir();
  const distDir = path.join(__dirname, "..", "dist");
  if (!assetsDir) {
    console.warn("[awc] No assets directory found. Running without media.");
  }

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";

    let root: string;
    if (rel.startsWith("/assets/")) {
      if (!assetsDir) return new Response("Media library not installed", { status: 404 });
      root = assetsDir;
      rel = rel.slice("/assets".length);
    } else {
      root = distDir;
    }

    // Contain the request inside its root. Without this, "/../../etc/passwd"
    // in a URL the renderer was tricked into requesting would escape.
    const target = path.join(root, rel);
    const rootResolved = path.resolve(root) + path.sep;
    if (!path.resolve(target).startsWith(rootResolved)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      return await net.fetch(pathToFileURL(target).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

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
    const allowed = isDev ? url.startsWith("http://localhost:5173") : url.startsWith(APP_ORIGIN);
    if (!allowed) event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    if (process.env.AWC_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
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
  // Sourced from the media library, which may not be installed — the catch
  // below falls back to an empty image rather than failing to start.
  const iconRoot = assetsDir ?? path.join(__dirname, "..", "assets");
  const iconPath = path.join(iconRoot, "logos", "app-icon-180.png");
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
  // Dev loads from the Vite server, which already serves /assets via its own
  // middleware; the custom scheme is only needed for packaged builds.
  if (!isDev) registerAppProtocol();
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
