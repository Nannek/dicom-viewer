import { dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import type { DicomFileData } from '../shared/types'

export async function openDicomFiles(win: BrowserWindow): Promise<DicomFileData[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open DICOM File(s)',
    filters: [
      { name: 'DICOM Files', extensions: ['dcm', 'dicom', 'ima', 'img'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  })

  if (canceled || filePaths.length === 0) return []

  return Promise.all(
    filePaths.map(async (filePath): Promise<DicomFileData> => {
      const nodeBuffer = await readFile(filePath)
      // Slice to get an independent ArrayBuffer (Node Buffer shares underlying memory)
      const buffer = nodeBuffer.buffer.slice(
        nodeBuffer.byteOffset,
        nodeBuffer.byteOffset + nodeBuffer.byteLength,
      )
      return {
        path: filePath,
        name: filePath.split(/[\\/]/).pop() ?? filePath,
        buffer,
      }
    }),
  )
}
