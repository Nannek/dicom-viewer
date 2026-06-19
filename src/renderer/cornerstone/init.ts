import { init as csInit } from '@cornerstonejs/core'
import { init as csToolsInit } from '@cornerstonejs/tools'
import { initTools } from './tools'
import { registerLocalImageLoader } from './localImageLoader'

let initialized = false

export async function initCornerstone(): Promise<void> {
  if (initialized) return

  await csInit()
  await csToolsInit()

  registerLocalImageLoader()
  initTools()

  initialized = true
}
