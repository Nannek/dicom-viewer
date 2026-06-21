import { useEffect, useRef, useState } from 'react'
import { RenderingEngine, Enums, cache, utilities } from '@cornerstonejs/core'
import { Enums as ToolEnums } from '@cornerstonejs/tools'
import type { IStackViewport } from '@cornerstonejs/core/types'
import { setupToolGroup } from '../cornerstone/tools'
import { setViewportElement, RENDERING_ENGINE_ID, VIEWPORT_ID } from '../cornerstone/viewportRef'
import { useAppStore } from '../store'
import { appLog } from '../logger'

export function Viewport() {
  const elementRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<RenderingEngine | null>(null)
  const stackReadyRef = useRef(false)
  const [huValue, setHuValue] = useState<number | null>(null)
  const { imageIds, currentImageIndex } = useAppStore()

  // Initialize rendering engine once on mount
  useEffect(() => {
    if (!elementRef.current) return

    appLog('debug', 'Creating RenderingEngine')
    const engine = new RenderingEngine(RENDERING_ENGINE_ID)
    engineRef.current = engine
    setViewportElement(elementRef.current)

    engine.enableElement({
      viewportId: VIEWPORT_ID,
      type: Enums.ViewportType.STACK,
      element: elementRef.current,
    })

    setupToolGroup(VIEWPORT_ID, RENDERING_ENGINE_ID)
    appLog('debug', 'Viewport element enabled')

    const el = elementRef.current
    const handleHuMove = (evt: Event) => {
      const detail = (evt as CustomEvent<{ currentPoints: { world: [number, number, number] } }>)
        .detail
      const worldPoint = detail.currentPoints.world
      const viewport = engine.getViewport(VIEWPORT_ID) as IStackViewport
      const imageId = viewport.getCurrentImageId()
      if (!imageId) return
      const image = cache.getImage(imageId)
      if (!image) return
      try {
        const imageCoords = utilities.worldToImageCoords(imageId, worldPoint)
        if (!imageCoords) return
        const [row, col] = imageCoords
        const r = Math.floor(row)
        const c = Math.floor(col)
        if (c >= 0 && c < image.columns && r >= 0 && r < image.rows) {
          setHuValue((image.getPixelData() as Float32Array)[r * image.columns + c])
        }
      } catch {
        // metadata not available for this imageId
      }
    }
    const handleHuLeave = () => setHuValue(null)
    el.addEventListener(ToolEnums.Events.MOUSE_MOVE, handleHuMove)
    el.addEventListener('mouseleave', handleHuLeave)

    return () => {
      appLog('debug', 'Destroying RenderingEngine')
      stackReadyRef.current = false
      setViewportElement(null)
      el.removeEventListener(ToolEnums.Events.MOUSE_MOVE, handleHuMove)
      el.removeEventListener('mouseleave', handleHuLeave)
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  // Load new stack when imageIds change
  useEffect(() => {
    if (!imageIds.length || !engineRef.current) return

    stackReadyRef.current = false
    const viewport = engineRef.current.getViewport(VIEWPORT_ID) as IStackViewport
    appLog('debug', `setStack: ${imageIds.length} image(s)`)

    viewport
      .setStack(imageIds, 0)
      .then(() => {
        viewport.resetCamera()
        viewport.render()
        stackReadyRef.current = true
        appLog('info', 'Stack loaded and rendered')
      })
      .catch((err: unknown) => {
        appLog('error', 'setStack failed', err)
      })
  }, [imageIds])

  // Navigate to frame (cine / scrubber) — only after stack is ready
  useEffect(() => {
    if (!stackReadyRef.current || !engineRef.current) return

    const viewport = engineRef.current.getViewport(VIEWPORT_ID) as IStackViewport
    viewport
      .setImageIdIndex(currentImageIndex)
      .then(() => viewport.render())
      .catch(() => {
        // Stack may be in the middle of loading a new set; setStack effect handles it
      })
  }, [currentImageIndex])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={elementRef}
        style={{ width: '100%', height: '100%' }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {huValue !== null && <div className="hu-overlay">HU: {Math.round(huValue)}</div>}
    </div>
  )
}
