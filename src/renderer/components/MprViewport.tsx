import { useEffect, useRef, useState } from 'react'
import { RenderingEngine } from '@cornerstonejs/core'
import { RENDERING_ENGINE_ID } from '../cornerstone/viewportRef'
import { setupMpr, teardownMpr, set3DPreset, set3DClipBounds, VOLUME_3D_PRESETS } from '../cornerstone/mprSetup'
import type { ClipBounds } from '../cornerstone/mprSetup'
import { useAppStore } from '../store'
import { appLog } from '../logger'

type PaneId = 'axial' | 'sagittal' | 'coronal' | 'vol3d'

const PANE_DEFS: { id: PaneId; label: string; gridRow: number; gridColumn: number }[] = [
  { id: 'axial',    label: 'Axial',    gridRow: 1, gridColumn: 1 },
  { id: 'sagittal', label: 'Sagittal', gridRow: 1, gridColumn: 3 },
  { id: 'coronal',  label: 'Coronal',  gridRow: 3, gridColumn: 1 },
  { id: 'vol3d',    label: '3D Volume',gridRow: 3, gridColumn: 3 },
]

export function MprViewport() {
  const axialRef    = useRef<HTMLDivElement>(null)
  const sagittalRef = useRef<HTMLDivElement>(null)
  const coronalRef  = useRef<HTMLDivElement>(null)
  const vol3dRef    = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const elRefs: Record<PaneId, React.RefObject<HTMLDivElement>> = {
    axial: axialRef, sagittal: sagittalRef, coronal: coronalRef, vol3d: vol3dRef,
  }

  const [preset,    setPreset]    = useState('CT-Bone')
  const [colSplit,  setColSplit]  = useState(50)
  const [rowSplit,  setRowSplit]  = useState(50)
  const [maximized, setMaximized] = useState<PaneId | null>(null)
  const [showClip,  setShowClip]  = useState(false)
  const DEFAULT_CLIP: ClipBounds = { xLow: 0, xHigh: 100, yLow: 0, yHigh: 100, zLow: 0, zHigh: 100 }
  const [clipBounds, setClipBounds] = useState<ClipBounds>(DEFAULT_CLIP)

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
      { axial: axialRef.current, sagittal: sagittalRef.current, coronal: coronalRef.current, vol3d: vol3dRef.current },
      preset,
    ).catch((err: unknown) => appLog('error', 'MPR setup failed', err))
  }, [imageIds]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePresetChange(value: string) {
    setPreset(value)
    set3DPreset(value)
  }

  function handleClipChange(key: keyof ClipBounds, raw: string) {
    const v = parseInt(raw, 10)
    const next = { ...clipBounds, [key]: v }
    // keep low ≤ high
    if (key.endsWith('Low')  && v > clipBounds[key.replace('Low',  'High') as keyof ClipBounds]) return
    if (key.endsWith('High') && v < clipBounds[key.replace('High', 'Low')  as keyof ClipBounds]) return
    setClipBounds(next)
    set3DClipBounds(next)
  }

  function resetClip() {
    setClipBounds(DEFAULT_CLIP)
    set3DClipBounds(DEFAULT_CLIP)
  }

  function startDragCol(e: React.MouseEvent) {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const totalWidth = container.getBoundingClientRect().width
    const startX = e.clientX
    const startSplit = colSplit
    function onMove(me: MouseEvent) {
      const pct = startSplit + ((me.clientX - startX) / totalWidth) * 100
      setColSplit(Math.min(80, Math.max(20, pct)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startDragRow(e: React.MouseEvent) {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const totalHeight = container.getBoundingClientRect().height
    const startY = e.clientY
    const startSplit = rowSplit
    function onMove(me: MouseEvent) {
      const pct = startSplit + ((me.clientY - startY) / totalHeight) * 100
      setRowSplit(Math.min(80, Math.max(20, pct)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `${colSplit}fr 6px ${100 - colSplit}fr`,
    gridTemplateRows:    `${rowSplit}fr 6px ${100 - rowSplit}fr`,
  }

  return (
    <div className="mpr-container" ref={containerRef} style={gridStyle}>
      {PANE_DEFS.map(({ id, label, gridRow, gridColumn }) => {
        const isMax    = maximized === id
        const isHidden = maximized !== null && !isMax

        const paneStyle: React.CSSProperties = isMax
          ? { position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', background: '#000' }
          : { gridRow, gridColumn, visibility: isHidden ? 'hidden' : 'visible' }

        return (
          <div key={id} className="mpr-pane" style={paneStyle}>
            <div className="mpr-label">
              <span className="mpr-label-text">{label}</span>
              {id === 'vol3d' && (
                <>
                  <button
                    className={`mpr-maximize-btn${showClip ? ' active' : ''}`}
                    title="Toggle clipping controls"
                    onClick={() => setShowClip((s) => !s)}
                  >
                    Clip
                  </button>
                  <select
                    className="toolbar-select mpr-preset-select"
                    value={preset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                  >
                    {VOLUME_3D_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </>
              )}
              <button
                className="mpr-maximize-btn"
                title={isMax ? 'Restore' : 'Maximize'}
                onClick={() => setMaximized(isMax ? null : id)}
              >
                {isMax ? '⊟' : '⛶'}
              </button>
            </div>
            {id === 'vol3d' && (
              <div className="mpr-clip-panel" style={{ display: showClip ? 'flex' : 'none' }}>
                {(['X', 'Y', 'Z'] as const).map((axis) => {
                  const lowKey  = `${axis.toLowerCase()}Low`  as keyof ClipBounds
                  const highKey = `${axis.toLowerCase()}High` as keyof ClipBounds
                  return (
                    <div key={axis} className="mpr-clip-row">
                      <span className="mpr-clip-axis">{axis}</span>
                      <input
                        className="mpr-clip-slider"
                        type="range" min={0} max={100} step={1}
                        value={clipBounds[lowKey]}
                        title={`${axis} start: ${clipBounds[lowKey]}%`}
                        onChange={(e) => handleClipChange(lowKey, e.target.value)}
                      />
                      <input
                        className="mpr-clip-slider"
                        type="range" min={0} max={100} step={1}
                        value={clipBounds[highKey]}
                        title={`${axis} end: ${clipBounds[highKey]}%`}
                        onChange={(e) => handleClipChange(highKey, e.target.value)}
                      />
                      <span className="mpr-clip-val">
                        {clipBounds[lowKey]}–{clipBounds[highKey]}
                      </span>
                    </div>
                  )
                })}
                <button className="mpr-clip-reset" onClick={resetClip}>Reset</button>
              </div>
            )}
            <div
              ref={elRefs[id]}
              className="mpr-viewport-el"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        )
      })}

      {!maximized && (
        <>
          <div
            className="mpr-gutter mpr-gutter-v"
            style={{ gridRow: '1 / span 3', gridColumn: 2 }}
            onMouseDown={startDragCol}
          />
          <div
            className="mpr-gutter mpr-gutter-h"
            style={{ gridRow: 2, gridColumn: '1 / span 3' }}
            onMouseDown={startDragRow}
          />
        </>
      )}
    </div>
  )
}
