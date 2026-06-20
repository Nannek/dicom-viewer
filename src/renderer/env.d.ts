/// <reference types="vite/client" />

import type { DicomFileData } from '../shared/types'

declare global {
  interface Window {
    api: {
      openFiles: () => Promise<DicomFileData[]>
      openFolder: () => Promise<DicomFileData[]>
      onTriggerOpen: (callback: () => void) => () => void
      onTriggerOpenFolder: (callback: () => void) => () => void
      saveImage: (dataUrl: string) => Promise<string | null>
    }
  }
}
