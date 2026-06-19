import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'

export function CinePlayer() {
  const { imageIds, currentImageIndex, isPlaying, playbackFps, setCurrentImageIndex, setIsPlaying, setPlaybackFps } =
    useAppStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (isPlaying && imageIds.length > 1) {
      intervalRef.current = setInterval(() => {
        useAppStore.setState((s) => ({
          currentImageIndex: (s.currentImageIndex + 1) % s.imageIds.length,
        }))
      }, 1000 / playbackFps)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, playbackFps, imageIds.length])

  if (imageIds.length <= 1) return null

  return (
    <div className="playback-bar">
      <button className="pb-btn" onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? '⏸' : '▶'}
      </button>

      <span className="pb-counter">
        {currentImageIndex + 1}&thinsp;/&thinsp;{imageIds.length}
      </span>

      <input
        type="range"
        className="pb-scrubber"
        min={0}
        max={imageIds.length - 1}
        value={currentImageIndex}
        onChange={(e) => {
          setIsPlaying(false)
          setCurrentImageIndex(Number(e.target.value))
        }}
      />

      <label className="pb-fps">
        <span>{playbackFps} fps</span>
        <input
          type="range"
          min={1}
          max={60}
          value={playbackFps}
          onChange={(e) => setPlaybackFps(Number(e.target.value))}
        />
      </label>
    </div>
  )
}
