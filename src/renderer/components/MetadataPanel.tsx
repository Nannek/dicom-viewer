import { useState } from 'react'
import { useAppStore } from '../store'

export function MetadataPanel() {
  const metadata = useAppStore((s) => s.metadata)
  const [search, setSearch] = useState('')

  const lc = search.toLowerCase()
  const visible = lc
    ? metadata.filter(
        (e) =>
          e.name.toLowerCase().includes(lc) ||
          e.tag.toLowerCase().includes(lc) ||
          e.value.toLowerCase().includes(lc),
      )
    : metadata

  return (
    <div className="metadata-panel">
      <div className="metadata-header">
        <h3>DICOM Metadata</h3>
        <input
          type="search"
          className="metadata-search"
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="metadata-list">
        {visible.length === 0 && (
          <div className="metadata-empty">
            {metadata.length === 0 ? 'Open a DICOM file to view metadata' : 'No matching tags'}
          </div>
        )}
        {visible.map((entry) => (
          <div key={entry.tag} className="metadata-row">
            <div className="metadata-tag">{entry.tag}</div>
            <div className="metadata-name">{entry.name}</div>
            <div className="metadata-value" title={entry.value}>
              {entry.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
