
import { useEffect, useRef, useState } from 'react'

type CameraBackgroundProps = {
  enabled: boolean
}

export function CameraBackground({ enabled }: CameraBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      if (!enabled) return

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not supported on this browser.')
        return
      }

      try {
        setError(null)

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        console.error(err)
        setError('Camera permission denied or unavailable.')
      }
    }

    function stopCamera() {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }

    if (enabled) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [enabled])

  return (
    <>
      <video
        ref={videoRef}
        className={`camera-background ${enabled ? 'is-active' : ''}`}
        playsInline
        muted
        autoPlay
      />

      {enabled && error && (
        <div className="camera-error">
          {error}
        </div>
      )}
    </>
  )
}