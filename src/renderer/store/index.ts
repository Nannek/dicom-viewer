import { create } from 'zustand'
import dicomParser from 'dicom-parser'
import type { DicomFileData } from '../../shared/types'
import { storeBuffer, clearCache } from '../cornerstone/localImageLoader'

export interface MetadataEntry {
  tag: string
  name: string
  value: string
}

interface AppState {
  imageIds: string[]
  currentImageIndex: number
  metadata: MetadataEntry[]
  isPlaying: boolean
  playbackFps: number
  activeTool: string

  loadFiles: () => Promise<void>
  setCurrentImageIndex: (i: number) => void
  setIsPlaying: (p: boolean) => void
  setPlaybackFps: (fps: number) => void
  setActiveTool: (tool: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  imageIds: [],
  currentImageIndex: 0,
  metadata: [],
  isPlaying: false,
  playbackFps: 10,
  activeTool: 'WindowLevel',

  loadFiles: async () => {
    const files = await window.api.openFiles()
    if (!files.length) return

    clearCache()
    const sorted = sortByInstanceNumber(files)
    const imageIds = sorted.map((f) => storeBuffer(f.buffer))
    const metadata = extractKnownTags(sorted[0].buffer)

    set({ imageIds, currentImageIndex: 0, metadata, isPlaying: false })
  },

  setCurrentImageIndex: (currentImageIndex) => set({ currentImageIndex }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackFps: (playbackFps) => set({ playbackFps }),
  setActiveTool: (activeTool) => set({ activeTool }),
}))

function sortByInstanceNumber(files: DicomFileData[]): DicomFileData[] {
  return [...files].sort((a, b) => {
    try {
      const numA = parseInt(dicomParser.parseDicom(new Uint8Array(a.buffer)).string('x00200013') ?? '0', 10)
      const numB = parseInt(dicomParser.parseDicom(new Uint8Array(b.buffer)).string('x00200013') ?? '0', 10)
      return numA - numB
    } catch {
      return 0
    }
  })
}

function extractKnownTags(buffer: ArrayBuffer): MetadataEntry[] {
  try {
    const dataset = dicomParser.parseDicom(new Uint8Array(buffer))
    return Object.entries(KNOWN_TAGS)
      .flatMap(([tag, name]) => {
        try {
          const value = dataset.string(tag as `x${string}`)
          return value ? [{ tag: toDisplayTag(tag), name, value }] : []
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

function toDisplayTag(tag: string): string {
  const hex = tag.slice(1)
  return `(${hex.slice(0, 4)},${hex.slice(4)})`
}

const KNOWN_TAGS: Record<string, string> = {
  x00100010: 'Patient Name',
  x00100020: 'Patient ID',
  x00100030: 'Patient Birth Date',
  x00100040: 'Patient Sex',
  x00080020: 'Study Date',
  x00080030: 'Study Time',
  x00080060: 'Modality',
  x00080070: 'Manufacturer',
  x00080080: 'Institution Name',
  x0008103e: 'Series Description',
  x00181030: 'Protocol Name',
  x00200010: 'Study ID',
  x00200011: 'Series Number',
  x00200013: 'Instance Number',
  x00280010: 'Rows',
  x00280011: 'Columns',
  x00280030: 'Pixel Spacing',
  x00280100: 'Bits Allocated',
  x00280101: 'Bits Stored',
  x00281050: 'Window Center',
  x00281051: 'Window Width',
  x00281052: 'Rescale Intercept',
  x00281053: 'Rescale Slope',
}
