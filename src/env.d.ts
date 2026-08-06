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
