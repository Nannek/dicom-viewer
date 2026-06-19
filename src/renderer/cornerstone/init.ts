import { init as csInit } from '@cornerstonejs/core'
import { init as csToolsInit } from '@cornerstonejs/tools'
import { initTools } from './tools'
import { registerLocalImageLoader } from './localImageLoader'
import { appLog } from '../logger'

let initialized = false

export async function initCornerstone(): Promise<void> {
  if (initialized) return

  appLog('info', 'Initializing Cornerstone3D')
  await csInit()
  await csToolsInit()

  registerLocalImageLoader()
  initTools()

  initialized = true
  appLog('info', 'Cornerstone3D initialized')
}
