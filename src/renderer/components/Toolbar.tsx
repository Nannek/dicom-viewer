import { useAppStore } from '../store'
import { setActivePrimaryTool } from '../cornerstone/tools'
import { resetView, applyWindowPreset } from '../cornerstone/viewportRef'

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
  const { activeTool, setActiveTool, loadFiles, loadFolder, isLogOpen, toggleLogPanel } = useAppStore()

  function handleTool(toolName: string) {
    setActivePrimaryTool(toolName)
    setActiveTool(toolName)
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
      {TOOLS.map((t) => (
        <button
          key={t.name}
          className={`toolbar-btn${activeTool === t.name ? ' active' : ''}`}
          title={t.title}
          onClick={() => handleTool(t.name)}
        >
          {t.label}
        </button>
      ))}
      <div className="toolbar-separator" />
      <button className="toolbar-btn" title="Fit image to window and reset W/L" onClick={resetView}>
        Fit
      </button>
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
      <div className="toolbar-separator" />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Mid-click: pan &nbsp;|&nbsp; Right-click: zoom &nbsp;|&nbsp; Scroll: navigate stack
      </span>
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
