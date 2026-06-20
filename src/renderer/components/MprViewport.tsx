import { useEffect, useRef } from 'react'
import { RenderingEngine } from '@cornerstonejs/core'
import { RENDERING_ENGINE_ID } from '../cornerstone/viewportRef'
import { setupMpr, teardownMpr } from '../cornerstone/mprSetup'
import { useAppStore } from '../store'
import { appLog } from '../logger'

export function MprViewport() {
  const axialRef = useRef<HTMLDivElement>(null)
  const sagittalRef = useRef<HTMLDivElement>(null)
  const coronalRef = useRef<HTMLDivElement>(null)
  const { imageIds } = useAppStore()

  // Create engine on mount, destroy on unmount
  useEffect(() => {
    const engine = new RenderingEngine(RENDERING_ENGINE_ID)
    return () => {
      teardownMpr()
      engine.destroy()
    }
  }, [])

  // Re-setup MPR whenever imageIds change
  useEffect(() => {
    if (!imageIds.length) return
    if (!axialRef.current || !sagittalRef.current || !coronalRef.current) return
    teardownMpr()
    setupMpr(imageIds, {
      axial: axialRef.current,
      sagittal: sagittalRef.current,
      coronal: coronalRef.current,
    }).catch((err: unknown) => appLog('error', 'MPR setup failed', err))
  }, [imageIds])

  return (
    <div className="mpr-container">
      {(['Axial', 'Sagittal', 'Coronal'] as const).map((plane) => {
        const ref = plane === 'Axial' ? axialRef : plane === 'Sagittal' ? sagittalRef : coronalRef
        return (
          <div key={plane} className="mpr-pane">
            <div className="mpr-label">{plane}</div>
            <div ref={ref} className="mpr-viewport-el" onContextMenu={(e) => e.preventDefault()} />
          </div>
        )
      })}
    </div>
  )
}
