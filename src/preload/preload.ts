import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'
import type { DicomFileData } from '../shared/types'

const api = {
  openFiles: (): Promise<DicomFileData[]> => ipcRenderer.invoke(IPC.OPEN_FILES),

  onTriggerOpen: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.TRIGGER_OPEN, handler)
    return () => ipcRenderer.removeListener(IPC.TRIGGER_OPEN, handler)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
