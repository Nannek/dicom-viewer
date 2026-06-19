import { useAppStore } from '../store'
import { setActivePrimaryTool } from '../cornerstone/tools'

const TOOLS = [
  { name: 'WindowLevel', label: 'W/L', title: 'Window / Level  (left-drag)' },
  { name: 'Pan', label: 'Pan', title: 'Pan  (left-drag)' },
  { name: 'Zoom', label: 'Zoom', title: 'Zoom  (left-drag)' },
  { name: 'PlanarRotate', label: 'Rotate', title: 'Rotate  (left-drag)' },
]

export function Toolbar() {
  const { activeTool, setActiveTool, loadFiles } = useAppStore()

  function handleTool(toolName: string) {
    setActivePrimaryTool(toolName)
    setActiveTool(toolName)
  }

  return (
    <div className="toolbar">
      <button className="toolbar-btn open-btn" onClick={loadFiles}>
        Open DICOM
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
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Mid-click: pan &nbsp;|&nbsp; Right-click: zoom &nbsp;|&nbsp; Scroll: navigate stack
      </span>
    </div>
  )
}
