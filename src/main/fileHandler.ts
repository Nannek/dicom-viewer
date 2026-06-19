import { dialog, BrowserWindow } from 'electron'
import { readFile, readdir, open as openFd } from 'fs/promises'
import { join, extname } from 'path'
import type { DicomFileData } from '../shared/types'

const DICOM_EXTENSIONS = new Set(['.dcm', '.dicom', '.ima', '.img'])

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
  return readDicomFiles(filePaths)
}

export async function openDicomFolder(win: BrowserWindow): Promise<DicomFileData[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open DICOM Folder',
    properties: ['openDirectory'],
  })

  if (canceled || !filePaths[0]) return []

  const dirPath = filePaths[0]
  const entries = await readdir(dirPath, { withFileTypes: true })
  const candidates = entries
    .filter((e) => e.isFile())
    .map((e) => join(dirPath, e.name))
    .sort() // lexicographic; store sorts by Instance Number afterward

  const checks = await Promise.all(candidates.map(async (p) => ({ p, ok: await isDicom(p) })))
  const dicomPaths = checks.filter((c) => c.ok).map((c) => c.p)

  if (!dicomPaths.length) return []
  return readDicomFiles(dicomPaths)
}

async function readDicomFiles(filePaths: string[]): Promise<DicomFileData[]> {
  return Promise.all(
    filePaths.map(async (filePath): Promise<DicomFileData> => {
      const nodeBuffer = await readFile(filePath)
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

async function isDicom(filePath: string): Promise<boolean> {
  const ext = extname(filePath).toLowerCase()
  if (DICOM_EXTENSIONS.has(ext)) return true
  // For extensionless files (common in PACS exports), check DICM magic at byte 128.
  if (ext !== '') return false
  try {
    const fd = await openFd(filePath, 'r')
    const buf = Buffer.alloc(4)
    const { bytesRead } = await fd.read(buf, 0, 4, 128)
    await fd.close()
    return bytesRead === 4 && buf.toString('ascii') === 'DICM'
  } catch {
    return false
  }
}
