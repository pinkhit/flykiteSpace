// import { useFrame, useThree } from '@react-three/fiber'
// import { Euler, Vector2 } from 'three'

// let yaw = 0
// let pitch = 0
// let dragging = false
// let lastX = 0
// let lastY = 0

// const rotation = new Euler(0, 0, 0, 'YXZ')

// export const lookVelocity = new Vector2(0, 0)

// export function CameraRig() {
//   const camera = useThree((state) => state.camera)
//   const gl = useThree((state) => state.gl)

//   useFrame((_, delta) => {
//     rotation.set(pitch, yaw, 0)
//     camera.quaternion.setFromEuler(rotation)

//     // Decay look velocity back to zero when player stops moving.
//     const decay = 1 - Math.exp(-delta * 10)
//     lookVelocity.lerp(new Vector2(0, 0), decay)
//   })

//   gl.domElement.onpointerdown = (event) => {
//     dragging = true
//     lastX = event.clientX
//     lastY = event.clientY
//     gl.domElement.setPointerCapture(event.pointerId)
//   }

//   gl.domElement.onpointermove = (event) => {
//     if (!dragging) return

//     const dx = event.clientX - lastX
//     const dy = event.clientY - lastY

//     lastX = event.clientX
//     lastY = event.clientY

//     yaw -= dx * 0.004
//     pitch -= dy * 0.004
//     pitch = Math.max(-1.2, Math.min(1.2, pitch))

//     lookVelocity.set(dx, dy)
//   }

//   gl.domElement.onpointerup = (event) => {
//     dragging = false
//     gl.domElement.releasePointerCapture(event.pointerId)
//   }

//   return null
// }

import { useFrame, useThree } from '@react-three/fiber'
import { Euler, MathUtils, Vector2 } from 'three'
import type { OrientationState } from '../hooks/useDeviceGyro'

let yaw = 0
let pitch = 0
let dragging = false
let lastX = 0
let lastY = 0

let baseAlpha: number | null = null
let baseBeta: number | null = null
let baseGamma: number | null = null

const rotation = new Euler(0, 0, 0, 'YXZ')

export const lookVelocity = new Vector2(0, 0)

type CameraRigProps = {
  cameraMode: boolean
  orientation: OrientationState
}

export function CameraRig({ cameraMode, orientation }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const usePhysicalRotation =
    cameraMode && orientation.permission === 'granted' && orientation.active

  useFrame((_, delta) => {
    if (usePhysicalRotation) {
      /**
       * alpha: compass-like rotation around z axis
       * beta: front/back tilt
       * gamma: left/right tilt
       *
       * We calibrate the first active reading as neutral.
       */
      if (baseAlpha === null) {
        baseAlpha = orientation.alpha
        baseBeta = orientation.beta
        baseGamma = orientation.gamma
      }

      const deltaAlpha = MathUtils.degToRad(orientation.alpha - (baseAlpha ?? 0))
      const deltaBeta = MathUtils.degToRad(orientation.beta - (baseBeta ?? 0))
      const deltaGamma = MathUtils.degToRad(orientation.gamma - (baseGamma ?? 0))

      /**
       * Tune these mappings by feel.
       *
       * Holding the phone up:
       * - turning left/right should affect yaw
       * - tilting up/down should affect pitch
       */
      yaw = -deltaAlpha
      pitch = MathUtils.clamp(deltaBeta * 0.8, -1.2, 1.2)

      /**
       * Feed physical motion into kite tilt.
       * This keeps your Kite.tsx working with lookVelocity.
       */
      lookVelocity.set(
        MathUtils.radToDeg(deltaGamma) * 0.7,
        MathUtils.radToDeg(deltaBeta) * 0.7
      )
    }

    rotation.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(rotation)

    const decay = 1 - Math.exp(-delta * 10)
    lookVelocity.lerp(new Vector2(0, 0), decay)
  })

  gl.domElement.onpointerdown = (event) => {
    dragging = true
    lastX = event.clientX
    lastY = event.clientY
    gl.domElement.setPointerCapture(event.pointerId)
  }

  gl.domElement.onpointermove = (event) => {
    /**
     * In camera passthrough + motion mode, ignore drag look.
     * If motion is not active/granted, drag remains fallback.
     */
    if (usePhysicalRotation) return
    if (!dragging) return

    const dx = event.clientX - lastX
    const dy = event.clientY - lastY

    lastX = event.clientX
    lastY = event.clientY

    yaw -= dx * 0.004
    pitch -= dy * 0.004
    pitch = Math.max(-1.2, Math.min(1.2, pitch))

    lookVelocity.set(dx, dy)
  }

  gl.domElement.onpointerup = (event) => {
    dragging = false
    gl.domElement.releasePointerCapture(event.pointerId)
  }

  return null
}

// For use when exiting camera mode
export function resetCameraOrientationCalibration() {
  baseAlpha = null
  baseBeta = null
  baseGamma = null
}