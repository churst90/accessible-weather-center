import { contextBridge, ipcRenderer } from "electron";

const bridge = {
  notify(title: string, body: string): Promise<void> {
    return ipcRenderer.invoke("notify", { title, body });
  },
  minimizeToTray(): Promise<void> {
    return ipcRenderer.invoke("window:minimize-to-tray");
  }
};

contextBridge.exposeInMainWorld("awc", bridge);

export type AwcBridge = typeof bridge;

declare global {
  interface Window {
    awc: AwcBridge;
  }
}
