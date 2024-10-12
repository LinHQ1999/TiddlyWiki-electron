import { contextBridge, ipcRenderer } from "electron";
import { ISearchOpts } from "../api";
import { IpcRendererEvent } from "electron/renderer";

export interface FileInfo {
  name: string;
  path: string;
}

export const api = {
  import: (info: FileInfo) => ipcRenderer.invoke("import", info),
  gc: (files: string[]) => ipcRenderer.invoke("gc", files),
  download: (file: ArrayBuffer, fname: string) =>
    ipcRenderer.invoke("download", file, fname),
  convert: (file: string, fname: string) =>
    ipcRenderer.invoke("convert", file, fname),
  delete: (canonical: string) => ipcRenderer.invoke("delete", canonical),
  save: (abspath: string, text: string) =>
    ipcRenderer.invoke("save", abspath, text),
  savesync: (abspath: string, text: string) =>
    ipcRenderer.sendSync("savesync", abspath, text),
  confirm: (msg: string) => ipcRenderer.sendSync("confirm", msg),
  alert: (msg: string) => ipcRenderer.sendSync("alert", msg),
  search: (action: ISearchOpts) => ipcRenderer.send("search", action),
  onSearch: (handler: (e: IpcRendererEvent ,res: string[]) => void) => ipcRenderer.on("search", handler)
};

contextBridge.exposeInMainWorld("TD", api);
