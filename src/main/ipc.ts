import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/ipcChannels'
import { openDicomFiles } from './fileHandler'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.OPEN_FILES, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    return openDicomFiles(win)
  })
}
