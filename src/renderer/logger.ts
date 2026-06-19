export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  ts: number
  level: LogLevel
  msg: string
  detail?: string
}

type Listener = () => void

const MAX_ENTRIES = 500
let _entries: LogEntry[] = []
let _seq = 0
const _listeners = new Set<Listener>()

export function appLog(level: LogLevel, msg: string, detail?: unknown): void {
  const entry: LogEntry = {
    id: ++_seq,
    ts: Date.now(),
    level,
    msg,
    detail: detail !== undefined ? stringify(detail) : undefined,
  }
  if (_entries.length >= MAX_ENTRIES) _entries = _entries.slice(1)
  _entries = [..._entries, entry]
  _listeners.forEach((fn) => fn())
}

export function getLogs(): LogEntry[] {
  return _entries
}

export function clearLogs(): void {
  _entries = []
  _listeners.forEach((fn) => fn())
}

export function subscribeToLogs(fn: Listener): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export function interceptConsole(): void {
  const orig = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...args) => {
    orig.log(...args)
    appLog('debug', args.map(stringify).join(' '))
  }
  console.warn = (...args) => {
    orig.warn(...args)
    appLog('warn', args.map(stringify).join(' '))
  }
  console.error = (...args) => {
    orig.error(...args)
    appLog('error', args.map(stringify).join(' '))
  }
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.message
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
