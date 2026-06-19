import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { IPC } from '../shared/ipcChannels'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'DICOM Viewer',
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function buildMenu(win: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open DICOM File(s)...',
          accelerator: 'CmdOrCtrl+O',
          click: () => win.webContents.send(IPC.TRIGGER_OPEN),
        },
        {
          label: 'Open DICOM Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => win.webContents.send(IPC.TRIGGER_OPEN_FOLDER),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
      ],
    },
  ])
}

app.whenReady().then(() => {
  registerIpcHandlers()
  const win = createWindow()
  Menu.setApplicationMenu(buildMenu(win))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
