import { useEffect, useRef } from 'react'
import { RenderingEngine, Enums } from '@cornerstonejs/core'
import type { IStackViewport } from '@cornerstonejs/core/types'
import { setupToolGroup } from '../cornerstone/tools'
import { setViewportElement, RENDERING_ENGINE_ID, VIEWPORT_ID } from '../cornerstone/viewportRef'
import { useAppStore } from '../store'
import { appLog } from '../logger'

export function Viewport() {
  const elementRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<RenderingEngine | null>(null)
  const stackReadyRef = useRef(false)
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

    return () => {
      appLog('debug', 'Destroying RenderingEngine')
      stackReadyRef.current = false
      setViewportElement(null)
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
    <div
      ref={elementRef}
      style={{ width: '100%', height: '100%' }}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
