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
  TrackballRotateTool,
  ToolGroupManager,
  Enums as ToolEnums,
} from '@cornerstonejs/tools'
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane'
import { RENDERING_ENGINE_ID } from './viewportRef'
import { appLog } from '../logger'

export interface ClipBounds {
  xLow: number; xHigh: number  // 0–100 percent of volume extent
  yLow: number; yHigh: number
  zLow: number; zHigh: number
}

type VtkMapperLike = {
  removeAllClippingPlanes(): void
  addClippingPlane(p: ReturnType<typeof vtkPlane.newInstance>): void
  getInputData(): { getBounds(): [number, number, number, number, number, number] } | null
}

export const MPR_VIEWPORT_IDS = {
  AXIAL: 'mpr-axial',
  SAGITTAL: 'mpr-sagittal',
  CORONAL: 'mpr-coronal',
  VOLUME_3D: 'mpr-3d',
} as const

export const VOLUME_3D_PRESETS = [
  { label: 'CT Bone', value: 'CT-Bone' },
  { label: 'CT Bone (alt)', value: 'CT-Bones' },
  { label: 'CT Soft Tissue', value: 'CT-Soft-Tissue' },
  { label: 'CT Muscle', value: 'CT-Muscle' },
  { label: 'CT Lung', value: 'CT-Lung' },
  { label: 'CT MIP', value: 'CT-MIP' },
  { label: 'CT Cardiac', value: 'CT-Cardiac' },
  { label: 'CT Chest Vessels', value: 'CT-Chest-Vessels' },
] as const

const MPR_TOOL_GROUP_ID = 'mpr-tool-group'
const VOL3D_TOOL_GROUP_ID = 'mpr-3d-tool-group'
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
  elements: {
    axial: HTMLDivElement
    sagittal: HTMLDivElement
    coronal: HTMLDivElement
    vol3d: HTMLDivElement
  },
  initialPreset = 'CT-Bone',
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
    {
      viewportId: MPR_VIEWPORT_IDS.VOLUME_3D,
      type: Enums.ViewportType.VOLUME_3D,
      element: elements.vol3d,
    },
  ])

  const volumeId = `${VOLUME_SCHEME}:mpr-${Date.now()}`
  currentVolumeId = volumeId

  appLog('info', `Creating MPR volume from ${imageIds.length} slices`)
  const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds })
  ;(volume as IStreamingImageVolume).load()

  const sliceViewportIds = [
    MPR_VIEWPORT_IDS.AXIAL,
    MPR_VIEWPORT_IDS.SAGITTAL,
    MPR_VIEWPORT_IDS.CORONAL,
  ]

  await Promise.all(
    sliceViewportIds.map((vpId) => {
      const vp = engine.getViewport(vpId) as IVolumeViewport
      return vp.setVolumes([{ volumeId }])
    }),
  )

  const vp3d = engine.getViewport(MPR_VIEWPORT_IDS.VOLUME_3D) as IVolumeViewport
  await vp3d.setVolumes([{ volumeId }])
  vp3d.setProperties({ preset: initialPreset })

  setupMprToolGroup()
  setupVol3dToolGroup()
  engine.renderViewports(Object.values(MPR_VIEWPORT_IDS))
  appLog('info', 'MPR + 3D ready')
}

export function set3DPreset(presetName: string): void {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID)
  if (!engine) return
  const vp = engine.getViewport(MPR_VIEWPORT_IDS.VOLUME_3D) as IVolumeViewport | undefined
  if (!vp) return
  vp.setProperties({ preset: presetName })
  vp.render()
}

export function set3DClipBounds(bounds: ClipBounds): void {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID)
  if (!engine) return
  const vp = engine.getViewport(MPR_VIEWPORT_IDS.VOLUME_3D) as IVolumeViewport | undefined
  if (!vp) return

  const actors = vp.getActors()
  if (!actors.length) return
  const mapper = (actors[0].actor as unknown as { getMapper(): VtkMapperLike }).getMapper()
  const imageData = mapper.getInputData()
  if (!imageData) return

  const [vxMin, vxMax, vyMin, vyMax, vzMin, vzMax] = imageData.getBounds()

  mapper.removeAllClippingPlanes()

  function lerp(a: number, b: number, t: number) { return a + t * (b - a) }
  const { xLow, xHigh, yLow, yHigh, zLow, zHigh } = bounds

  // Each axis: a "low" plane (normal points +axis) and "high" plane (normal points -axis)
  const planes: [number, number, number, number, number, number][] = [
    [lerp(vxMin, vxMax, xLow / 100),  0, 0,  1, 0, 0],
    [lerp(vxMin, vxMax, xHigh / 100), 0, 0, -1, 0, 0],
    [0, lerp(vyMin, vyMax, yLow / 100),  0,  0, 1, 0],
    [0, lerp(vyMin, vyMax, yHigh / 100), 0,  0,-1, 0],
    [0, 0, lerp(vzMin, vzMax, zLow / 100),   0, 0, 1],
    [0, 0, lerp(vzMin, vzMax, zHigh / 100),  0, 0,-1],
  ]

  for (const [ox, oy, oz, nx, ny, nz] of planes) {
    const p = vtkPlane.newInstance()
    p.setOrigin(ox, oy, oz)
    p.setNormal(nx, ny, nz)
    mapper.addClippingPlane(p)
  }

  vp.render()
}

function setupMprToolGroup(): void {
  const existing = ToolGroupManager.getToolGroup(MPR_TOOL_GROUP_ID)
  if (existing) ToolGroupManager.destroyToolGroup(MPR_TOOL_GROUP_ID)

  addTool(CrosshairsTool)
  addTool(WindowLevelTool)
  addTool(PanTool)
  addTool(ZoomTool)

  const tg = ToolGroupManager.createToolGroup(MPR_TOOL_GROUP_ID)!

  tg.addTool(CrosshairsTool.toolName)
  tg.addTool(WindowLevelTool.toolName)
  tg.addTool(PanTool.toolName)
  tg.addTool(ZoomTool.toolName)

  // Only slice viewports get crosshairs — VOLUME_3D has its own group
  const sliceViewportIds = [MPR_VIEWPORT_IDS.AXIAL, MPR_VIEWPORT_IDS.SAGITTAL, MPR_VIEWPORT_IDS.CORONAL]
  for (const vpId of sliceViewportIds) {
    tg.addViewport(vpId, RENDERING_ENGINE_ID)
  }

  const { MouseBindings, KeyboardBindings } = ToolEnums
  tg.setToolActive(CrosshairsTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  })
  tg.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Auxiliary }],
  })
  tg.setToolActive(ZoomTool.toolName, {
    bindings: [
      { mouseButton: MouseBindings.Secondary },
      { mouseButton: MouseBindings.Wheel, modifierKey: KeyboardBindings.Ctrl },
    ],
  })
  tg.setToolPassive(WindowLevelTool.toolName)
}

function setupVol3dToolGroup(): void {
  const existing = ToolGroupManager.getToolGroup(VOL3D_TOOL_GROUP_ID)
  if (existing) ToolGroupManager.destroyToolGroup(VOL3D_TOOL_GROUP_ID)

  addTool(TrackballRotateTool)
  addTool(PanTool)
  addTool(ZoomTool)

  const tg = ToolGroupManager.createToolGroup(VOL3D_TOOL_GROUP_ID)!

  tg.addTool(TrackballRotateTool.toolName)
  tg.addTool(PanTool.toolName)
  tg.addTool(ZoomTool.toolName)

  tg.addViewport(MPR_VIEWPORT_IDS.VOLUME_3D, RENDERING_ENGINE_ID)

  const { MouseBindings, KeyboardBindings } = ToolEnums
  tg.setToolActive(TrackballRotateTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  })
  tg.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Auxiliary }],
  })
  tg.setToolActive(ZoomTool.toolName, {
    bindings: [
      { mouseButton: MouseBindings.Secondary },
      { mouseButton: MouseBindings.Wheel, modifierKey: KeyboardBindings.Ctrl },
    ],
  })
}

export function teardownMpr(): void {
  try {
    ToolGroupManager.destroyToolGroup(MPR_TOOL_GROUP_ID)
  } catch {
    // already destroyed or never created
  }
  try {
    ToolGroupManager.destroyToolGroup(VOL3D_TOOL_GROUP_ID)
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
