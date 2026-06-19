import { useEffect } from 'react'
import { Toolbar } from './components/Toolbar'
import { Viewport } from './components/Viewport'
import { MetadataPanel } from './components/MetadataPanel'
import { CinePlayer } from './components/CinePlayer'
import { LogPanel } from './components/LogPanel'
import { useAppStore } from './store'

export default function App() {
  const loadFiles = useAppStore((s) => s.loadFiles)
  const isLogOpen = useAppStore((s) => s.isLogOpen)

  useEffect(() => {
    return window.api.onTriggerOpen(() => loadFiles())
  }, [loadFiles])

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <div className="viewport-container">
          <Viewport />
        </div>
        <MetadataPanel />
      </div>
      <CinePlayer />
      {isLogOpen && <LogPanel />}
    </div>
  )
}
