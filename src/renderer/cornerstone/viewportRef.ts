// Single-viewport app — module-level ref avoids prop drilling between
// sibling components (Viewport sets, Toolbar reads).
import { getRenderingEngine } from '@cornerstonejs/core'
import type { IStackViewport } from '@cornerstonejs/core/types'

export const RENDERING_ENGINE_ID = 'dicom-rendering-engine'
export const VIEWPORT_ID = 'dicom-stack-viewport'

let _element: HTMLDivElement | null = null

export const setViewportElement = (el: HTMLDivElement | null): void => {
  _element = el
}

export const getViewportElement = (): HTMLDivElement | null => _element

export function resetView(): void {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID)
  if (!engine) return
  const viewport = engine.getViewport(VIEWPORT_ID) as IStackViewport | undefined
  if (!viewport) return
  viewport.resetCamera()
  viewport.resetProperties()
  viewport.render()
}

export function applyWindowPreset(center: number, width: number): void {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID)
  if (!engine) return
  const viewport = engine.getViewport(VIEWPORT_ID) as IStackViewport | undefined
  if (!viewport) return
  viewport.setProperties({ voiRange: { lower: center - width / 2, upper: center + width / 2 } })
  viewport.render()
}

export function captureViewportAsDataUrl(): string | null {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID)
  if (!engine) return null
  const viewport = engine.getViewport(VIEWPORT_ID)
  if (!viewport) return null
  const canvas = (viewport as unknown as { canvas?: HTMLCanvasElement }).canvas
  return canvas?.toDataURL('image/png') ?? null
}
