import { useEffect, useRef } from 'react'
import { RenderingEngine, Enums } from '@cornerstonejs/core'
import type { IStackViewport } from '@cornerstonejs/core/types'
import { setupToolGroup } from '../cornerstone/tools'
import { setViewportElement } from '../cornerstone/viewportRef'
import { useAppStore } from '../store'

const RENDERING_ENGINE_ID = 'dicom-rendering-engine'
const VIEWPORT_ID = 'dicom-stack-viewport'

export function Viewport() {
  const elementRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<RenderingEngine | null>(null)
  const { imageIds, currentImageIndex } = useAppStore()

  // Initialize rendering engine once on mount
  useEffect(() => {
    if (!elementRef.current) return

    const engine = new RenderingEngine(RENDERING_ENGINE_ID)
    engineRef.current = engine
    setViewportElement(elementRef.current)

    engine.enableElement({
      viewportId: VIEWPORT_ID,
      type: Enums.ViewportType.STACK,
      element: elementRef.current,
    })

    setupToolGroup(VIEWPORT_ID, RENDERING_ENGINE_ID)

    return () => {
      setViewportElement(null)
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  // Load new stack when imageIds change
  useEffect(() => {
    if (!imageIds.length || !engineRef.current) return
    const viewport = engineRef.current.getViewport(VIEWPORT_ID) as IStackViewport
    viewport.setStack(imageIds, 0).then(() => viewport.render())
  }, [imageIds])

  // Navigate to frame (cine / scrubber)
  useEffect(() => {
    if (!imageIds.length || !engineRef.current) return
    const viewport = engineRef.current.getViewport(VIEWPORT_ID) as IStackViewport
    viewport.setImageIdIndex(currentImageIndex).catch(() => {
      // Stack not yet initialised; setStack effect will handle the correct index
    })
  }, [currentImageIndex, imageIds])

  return (
    <div
      ref={elementRef}
      style={{ width: '100%', height: '100%' }}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
