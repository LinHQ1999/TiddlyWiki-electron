import { contextBridge, ipcRenderer } from "electron";
import type { SearchAction, SearchResult } from "../api";

const api = {
  search: (action: SearchAction) => ipcRenderer.send('search', action),
  onResult: (cb: (res: SearchResult) => void) => {
    const handler = (_: unknown, res: SearchResult) => cb(res)
    ipcRenderer.on('search:result', handler)
    return () => ipcRenderer.removeListener('search:result', handler)
  }
}

contextBridge.exposeInMainWorld('SC', api)
