/**
 * Global type declarations for the renderer process.
 * The `window.awc` bridge is injected by the Electron preload script
 * via `contextBridge.exposeInMainWorld`. It's only available in
 * Electron — in a plain browser it will be undefined.
 */

interface NwrActiveStation {
  callSign: string;
  description: string;
  name: string;
}

type NwrFetchResult =
  | { ok: true; stations: NwrActiveStation[] }
  | { ok: false; error: string };

interface AwcBridge {
  notify(title: string, body: string): Promise<void>;
  minimizeToTray(): Promise<void>;
  fetchActiveNwrStations(): Promise<NwrFetchResult>;
}

interface Window {
  awc?: AwcBridge;
}

/**
 * The version string from package.json, substituted at build time by the
 * `define` in vite.config.ts (and by the matching one in
 * scripts/run-tests.mjs, so test bundles resolve it too). Declared as a bare
 * global rather than read from package.json at runtime because the renderer
 * ships without one.
 */
declare const __APP_VERSION__: string;
