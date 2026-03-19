import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("save-config", config),
  restartServer: () => ipcRenderer.invoke("restart-server"),
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  setupComplete: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("setup-complete", config),
  isElectron: true,
  platform: process.platform,
});
