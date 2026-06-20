import { useAppStore } from '../store'
import { setActivePrimaryTool } from '../cornerstone/tools'
import { resetView, applyWindowPreset, captureViewportAsDataUrl } from '../cornerstone/viewportRef'
import { appLog } from '../logger'

const WINDOW_PRESETS = [
  { label: 'Brain', center: 40, width: 80 },
  { label: 'Soft Tissue', center: 50, width: 350 },
  { label: 'Abdomen', center: 60, width: 400 },
  { label: 'Lung', center: -600, width: 1600 },
  { label: 'Bone', center: 400, width: 1500 },
]

const TOOLS = [
  { name: 'WindowLevel', label: 'W/L', title: 'Window / Level  (left-drag)' },
  { name: 'Pan', label: 'Pan', title: 'Pan  (left-drag)' },
  { name: 'Zoom', label: 'Zoom', title: 'Zoom  (left-drag)' },
  { name: 'PlanarRotate', label: 'Rotate', title: 'Rotate  (left-drag)' },
]

export function Toolbar() {
  const { activeTool, setActiveTool, loadFiles, loadFolder, isLogOpen, toggleLogPanel, imageIds, isMprMode, setMprMode } = useAppStore()

  function handleTool(toolName: string) {
    setActivePrimaryTool(toolName)
    setActiveTool(toolName)
  }

  async function handleExport() {
    const dataUrl = captureViewportAsDataUrl()
    if (!dataUrl) return
    const saved = await window.api.saveImage(dataUrl)
    if (saved) appLog('info', `Exported PNG: ${saved}`)
  }

  return (
    <div className="toolbar">
      <button className="toolbar-btn open-btn" onClick={loadFiles}>
        Open Files
      </button>
      <button className="toolbar-btn open-btn" onClick={loadFolder} title="Open all DICOM files in a folder">
        Open Folder
      </button>
      <div className="toolbar-separator" />
      {!isMprMode && TOOLS.map((t) => (
        <button
          key={t.name}
          className={`toolbar-btn${activeTool === t.name ? ' active' : ''}`}
          title={t.title}
          onClick={() => handleTool(t.name)}
        >
          {t.label}
        </button>
      ))}
      {!isMprMode && <div className="toolbar-separator" />}
      {!isMprMode && (
        <button className="toolbar-btn" title="Fit image to window and reset W/L" onClick={resetView}>
          Fit
        </button>
      )}
      {!isMprMode && (
        <select
          className="toolbar-select"
          title="Apply window/level preset"
          value=""
          onChange={(e) => {
            const preset = WINDOW_PRESETS.find((p) => p.label === e.target.value)
            if (preset) applyWindowPreset(preset.center, preset.width)
            e.target.value = ''
          }}
        >
          <option value="" disabled>
            Presets
          </option>
          {WINDOW_PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
      )}
      {!isMprMode && (
        <button className="toolbar-btn" title="Export current frame as PNG" onClick={() => { void handleExport() }}>
          Export
        </button>
      )}
      <div className="toolbar-separator" />
      <button
        className={`toolbar-btn${isMprMode ? ' active' : ''}`}
        title="Multi-Planar Reconstruction — axial/sagittal/coronal views (CT series only)"
        disabled={imageIds.length < 2}
        onClick={() => setMprMode(!isMprMode)}
      >
        MPR
      </button>
      <div className="toolbar-separator" />
      {!isMprMode && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Mid-click: pan &nbsp;|&nbsp; Right-click: zoom &nbsp;|&nbsp; Scroll: navigate stack
        </span>
      )}
      {isMprMode && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Left-drag: crosshairs &nbsp;|&nbsp; Mid-click: pan &nbsp;|&nbsp; Right-click: zoom
        </span>
      )}
      <div style={{ flex: 1 }} />
      <button
        className={`toolbar-btn${isLogOpen ? ' active' : ''}`}
        title="Toggle debug log panel"
        onClick={toggleLogPanel}
      >
        Logs
      </button>
    </div>
  )
}
