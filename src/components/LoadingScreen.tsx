import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

const LOADING_ART_URL = '/loading/loading_01.gif'

const FADE_DELAY_MS = 250
const REMOVE_DELAY_MS = 800

export function LoadingScreen() {
  const { active, progress, total } = useProgress()
  const [isExiting, setIsExiting] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const roundedProgress = Math.round(Math.min(100, Math.max(0, progress)))
  const isComplete = total > 0 && !active && roundedProgress >= 100

  useEffect(() => {
    if (!isComplete) return

    const fadeTimer = window.setTimeout(
      () => setIsExiting(true),
      FADE_DELAY_MS
    )
    const removeTimer = window.setTimeout(
      () => setIsVisible(false),
      REMOVE_DELAY_MS
    )

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(removeTimer)
    }
  }, [isComplete])

  if (!isVisible) return null

  return (
    <div
      aria-busy={!isComplete}
      aria-label="Loading game"
      className={`loading-screen ${isExiting ? 'is-exiting' : ''}`}
      role="status"
    >
      <div className="loading-screen-content">
        <img
          alt=""
          className="loading-art"
          src={LOADING_ART_URL}
        />

        <div className="loading-progress-group">
          <div
            aria-label="Asset loading progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={roundedProgress}
            className="loading-progress-track"
            role="progressbar"
          >
            <span
              className="loading-progress-fill"
              style={{ transform: `scaleX(${roundedProgress / 100})` }}
            />
          </div>
          <p className="loading-progress-label">{roundedProgress}%</p>
        </div>
      </div>
    </div>
  )
}
