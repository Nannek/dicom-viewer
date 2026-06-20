import {
  getRenderingEngine,
  volumeLoader,
  Enums,
  cache,
  cornerstoneStreamingImageVolumeLoader,
} from '@cornerstonejs/core'
import type { IVolumeViewport, IStreamingImageVolume, VolumeLoaderFn } from '@cornerstonejs/core/types'
import {
  addTool,
  CrosshairsTool,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  ToolGroupManager,
  Enums as ToolEnums,
} from '@cornerstonejs/tools'
import { RENDERING_ENGINE_ID } from './viewportRef'
import { appLog } from '../logger'

export const MPR_VIEWPORT_IDS = {
  AXIAL: 'mpr-axial',
  SAGITTAL: 'mpr-sagittal',
  CORONAL: 'mpr-coronal',
} as const

const MPR_TOOL_GROUP_ID = 'mpr-tool-group'
const VOLUME_SCHEME = 'cornerstoneStreamingImageVolume'

let volumeLoaderRegistered = false
let currentVolumeId: string | null = null

function ensureVolumeLoaderRegistered(): void {
  if (volumeLoaderRegistered) return
  volumeLoader.registerVolumeLoader(VOLUME_SCHEME, cornerstoneStreamingImageVolumeLoader as unknown as VolumeLoaderFn)
  volumeLoaderRegistered = true
}

export async function setupMpr(
  imageIds: string[],
  elements: { axial: HTMLDivElement; sagittal: HTMLDivElement; coronal: HTMLDivElement },
): Promise<void> {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID)
  if (!engine) throw new Error('No rendering engine for MPR')

  ensureVolumeLoaderRegistered()

  engine.setViewports([
    {
      viewportId: MPR_VIEWPORT_IDS.AXIAL,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: elements.axial,
      defaultOptions: { orientation: Enums.OrientationAxis.AXIAL },
    },
    {
      viewportId: MPR_VIEWPORT_IDS.SAGITTAL,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: elements.sagittal,
      defaultOptions: { orientation: Enums.OrientationAxis.SAGITTAL },
    },
    {
      viewportId: MPR_VIEWPORT_IDS.CORONAL,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: elements.coronal,
      defaultOptions: { orientation: Enums.OrientationAxis.CORONAL },
    },
  ])

  const volumeId = `${VOLUME_SCHEME}:mpr-${Date.now()}`
  currentVolumeId = volumeId

  appLog('info', `Creating MPR volume from ${imageIds.length} slices`)
  const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds })
  ;(volume as IStreamingImageVolume).load()

  await Promise.all(
    Object.values(MPR_VIEWPORT_IDS).map((vpId) => {
      const vp = engine.getViewport(vpId) as IVolumeViewport
      return vp.setVolumes([{ volumeId }])
    }),
  )

  setupMprToolGroup()
  engine.renderViewports(Object.values(MPR_VIEWPORT_IDS))
  appLog('info', 'MPR ready')
}

function setupMprToolGroup(): void {
  const existing = ToolGroupManager.getToolGroup(MPR_TOOL_GROUP_ID)
  if (existing) ToolGroupManager.destroyToolGroup(MPR_TOOL_GROUP_ID)

  // addTool is idempotent — safe to call if already registered globally
  addTool(CrosshairsTool)
  addTool(WindowLevelTool)
  addTool(PanTool)
  addTool(ZoomTool)

  const tg = ToolGroupManager.createToolGroup(MPR_TOOL_GROUP_ID)!

  tg.addTool(CrosshairsTool.toolName)
  tg.addTool(WindowLevelTool.toolName)
  tg.addTool(PanTool.toolName)
  tg.addTool(ZoomTool.toolName)

  for (const vpId of Object.values(MPR_VIEWPORT_IDS)) {
    tg.addViewport(vpId, RENDERING_ENGINE_ID)
  }

  const { MouseBindings } = ToolEnums
  tg.setToolActive(CrosshairsTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  })
  tg.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Auxiliary }],
  })
  tg.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Secondary }],
  })
  tg.setToolPassive(WindowLevelTool.toolName)
}

export function teardownMpr(): void {
  try {
    ToolGroupManager.destroyToolGroup(MPR_TOOL_GROUP_ID)
  } catch {
    // already destroyed or never created
  }
  if (currentVolumeId) {
    try {
      cache.removeVolumeLoadObject(currentVolumeId)
    } catch {
      // volume may already be gone
    }
    currentVolumeId = null
  }
}
