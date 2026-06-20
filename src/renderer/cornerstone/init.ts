import { init as csInit } from '@cornerstonejs/core'
import { init as csToolsInit } from '@cornerstonejs/tools'
import { init as initDicomImageLoader } from '@cornerstonejs/dicom-image-loader'
import { initTools } from './tools'
import { registerLocalImageLoader } from './localImageLoader'
import { appLog } from '../logger'

let initialized = false

export async function initCornerstone(): Promise<void> {
  if (initialized) return

  appLog('info', 'Initializing Cornerstone3D')
  await csInit()
  await csToolsInit()

  // Initialize dicom-image-loader first — its registerLoaders() purges the CS3D
  // image cache, so it must run before any images are loaded. It registers
  // wadouri:/wadors: loaders for compressed DICOM support.
  initDicomImageLoader({ maxWebWorkers: 2 })

  // Register our custom dicomlocal: loader after the cache purge above.
  registerLocalImageLoader()
  initTools()

  initialized = true
  appLog('info', 'Cornerstone3D initialized')
}
