import { useEffect, useRef, useState } from 'react'
import { getLogs, clearLogs, subscribeToLogs } from '../logger'
import type { LogEntry, LogLevel } from '../logger'

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#6a9fb5',
  info: '#4a9eff',
  warn: '#e6c84a',
  error: '#e05c5c',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

export function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>(() => getLogs())
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  useEffect(() => {
    return subscribeToLogs(() => setEntries(getLogs()))
  }, [])

  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [entries])

  function handleScroll() {
    const el = listRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 4
  }

  function handleClear() {
    clearLogs()
    setEntries([])
  }

  const visible = filter === 'all' ? entries : entries.filter((e) => e.level === filter)

  return (
    <div className="log-panel">
      <div className="log-header">
        <span className="log-title">Logs</span>
        <div className="log-filters">
          {(['all', 'debug', 'info', 'warn', 'error'] as const).map((lvl) => (
            <button
              key={lvl}
              className={`log-filter-btn${filter === lvl ? ' active' : ''}`}
              style={lvl !== 'all' ? { color: filter === lvl ? LEVEL_COLORS[lvl] : undefined } : undefined}
              onClick={() => setFilter(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
        <button className="log-clear-btn" onClick={handleClear}>
          Clear
        </button>
      </div>
      <div className="log-list" ref={listRef} onScroll={handleScroll}>
        {visible.length === 0 ? (
          <div className="log-empty">No log entries</div>
        ) : (
          visible.map((e) => (
            <div key={e.id} className="log-entry">
              <span className="log-ts">{formatTime(e.ts)}</span>
              <span className="log-level" style={{ color: LEVEL_COLORS[e.level] }}>
                {e.level.toUpperCase()}
              </span>
              <span className="log-msg">{e.msg}</span>
              {e.detail && <span className="log-detail">{e.detail}</span>}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
