import { contextBridge, ipcRenderer } from "electron";

export interface NwrActiveStation {
  callSign: string;
  description: string;
  name: string;
}

export type NwrFetchResult =
  | { ok: true; stations: NwrActiveStation[] }
  | { ok: false; error: string };

const bridge = {
  notify(title: string, body: string): Promise<void> {
    return ipcRenderer.invoke("notify", { title, body });
  },
  minimizeToTray(): Promise<void> {
    return ipcRenderer.invoke("window:minimize-to-tray");
  },
  /** Fetch the list of currently-streaming NWR mount points from
   *  weatherUSA's Icecast status endpoint. Done in main to bypass CORS
   *  (the Icecast server doesn't send Access-Control-Allow-Origin). */
  fetchActiveNwrStations(): Promise<NwrFetchResult> {
    return ipcRenderer.invoke("nwr:fetchActiveStations");
  }
};

contextBridge.exposeInMainWorld("awc", bridge);

export type AwcBridge = typeof bridge;

declare global {
  interface Window {
    awc: AwcBridge;
  }
}
