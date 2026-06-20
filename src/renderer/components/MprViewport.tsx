import { useEffect, useRef, useState } from 'react'
import { RenderingEngine } from '@cornerstonejs/core'
import { RENDERING_ENGINE_ID } from '../cornerstone/viewportRef'
import { setupMpr, teardownMpr, set3DPreset, VOLUME_3D_PRESETS } from '../cornerstone/mprSetup'
import { useAppStore } from '../store'
import { appLog } from '../logger'

export function MprViewport() {
  const axialRef = useRef<HTMLDivElement>(null)
  const sagittalRef = useRef<HTMLDivElement>(null)
  const coronalRef = useRef<HTMLDivElement>(null)
  const vol3dRef = useRef<HTMLDivElement>(null)
  const [preset, setPreset] = useState<string>('CT-Bone')
  const { imageIds } = useAppStore()

  useEffect(() => {
    const engine = new RenderingEngine(RENDERING_ENGINE_ID)
    return () => {
      teardownMpr()
      engine.destroy()
    }
  }, [])

  useEffect(() => {
    if (!imageIds.length) return
    if (!axialRef.current || !sagittalRef.current || !coronalRef.current || !vol3dRef.current) return
    teardownMpr()
    setupMpr(
      imageIds,
      {
        axial: axialRef.current,
        sagittal: sagittalRef.current,
        coronal: coronalRef.current,
        vol3d: vol3dRef.current,
      },
      preset,
    ).catch((err: unknown) => appLog('error', 'MPR setup failed', err))
  }, [imageIds]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePresetChange(value: string) {
    setPreset(value)
    set3DPreset(value)
  }

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
      <div className="mpr-pane">
        <div className="mpr-label mpr-label-3d">
          3D Volume
          <select
            className="toolbar-select mpr-preset-select"
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {VOLUME_3D_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div ref={vol3dRef} className="mpr-viewport-el" onContextMenu={(e) => e.preventDefault()} />
      </div>
    </div>
  )
}
