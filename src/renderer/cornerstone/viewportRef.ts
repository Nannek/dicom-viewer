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
