import { useEffect } from 'react'
import { Toolbar } from './components/Toolbar'
import { Viewport } from './components/Viewport'
import { MprViewport } from './components/MprViewport'
import { MetadataPanel } from './components/MetadataPanel'
import { CinePlayer } from './components/CinePlayer'
import { LogPanel } from './components/LogPanel'
import { useAppStore } from './store'

export default function App() {
  const loadFiles = useAppStore((s) => s.loadFiles)
  const loadFolder = useAppStore((s) => s.loadFolder)
  const isLogOpen = useAppStore((s) => s.isLogOpen)
  const isMprMode = useAppStore((s) => s.isMprMode)

  useEffect(() => {
    return window.api.onTriggerOpen(() => loadFiles())
  }, [loadFiles])

  useEffect(() => {
    return window.api.onTriggerOpenFolder(() => loadFolder())
  }, [loadFolder])

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <div className="viewport-container">
          {isMprMode ? <MprViewport /> : <Viewport />}
        </div>
        <MetadataPanel />
      </div>
      {!isMprMode && <CinePlayer />}
      {isLogOpen && <LogPanel />}
    </div>
  )
}
