import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, MathUtils, Quaternion, Vector3 } from 'three'
import type { OrientationState } from '../hooks/useDeviceGyro'
import { lookVelocity } from './cameraInput'

const HALF_SQRT = Math.sqrt(0.5)
const CAMERA_ALIGNMENT = new Quaternion(-HALF_SQRT, 0, 0, HALF_SQRT)
const SCREEN_AXIS = new Vector3(0, 0, 1)
const LOOK_SENSITIVITY = 0.004

function getScreenOrientation() {
  if (typeof window === 'undefined') return 0

  const angle = window.screen.orientation?.angle
  if (typeof angle === 'number') return MathUtils.degToRad(angle)

  const legacyOrientation = (window as Window & { orientation?: number })
    .orientation
  return MathUtils.degToRad(legacyOrientation ?? 0)
}

function setDeviceQuaternion(
  target: Quaternion,
  euler: Euler,
  screenRotation: Quaternion,
  orientation: OrientationState
) {
  euler.set(
    MathUtils.degToRad(orientation.beta),
    MathUtils.degToRad(orientation.alpha),
    -MathUtils.degToRad(orientation.gamma),
    'YXZ'
  )

  target.setFromEuler(euler)
  target.multiply(CAMERA_ALIGNMENT)
  screenRotation.setFromAxisAngle(SCREEN_AXIS, -getScreenOrientation())
  target.multiply(screenRotation)
}

function wrappedAngleDelta(current: number, previous: number) {
  return (
    MathUtils.euclideanModulo(current - previous + Math.PI, Math.PI * 2) -
    Math.PI
  )
}

type CameraRigProps = {
  cameraMode: boolean
  orientation: OrientationState
}

export function CameraRig({ cameraMode, orientation }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const yaw = useRef(0)
  const pitch = useRef(0)
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const physicalRotationActive = useRef(false)
  const viewMotionReady = useRef(false)

  const pointerRotation = useRef(new Euler(0, 0, 0, 'YXZ'))
  const deviceEuler = useRef(new Euler(0, 0, 0, 'YXZ'))
  const deviceQuaternion = useRef(new Quaternion())
  const inverseCalibration = useRef(new Quaternion())
  const cameraAtCalibration = useRef(new Quaternion())
  const relativeRotation = useRef(new Quaternion())
  const targetRotation = useRef(new Quaternion())
  const screenRotation = useRef(new Quaternion())
  const previousViewEuler = useRef(new Euler(0, 0, 0, 'YXZ'))
  const currentViewEuler = useRef(new Euler(0, 0, 0, 'YXZ'))

  useEffect(() => {
    const element = gl.domElement

    function motionControlsActive() {
      return (
        cameraMode &&
        orientation.permission === 'granted' &&
        orientation.active
      )
    }

    function handlePointerDown(event: PointerEvent) {
      if (motionControlsActive()) return

      dragging.current = true
      lastPointer.current.x = event.clientX
      lastPointer.current.y = event.clientY
      element.setPointerCapture(event.pointerId)
    }

    function handlePointerMove(event: PointerEvent) {
      if (motionControlsActive() || !dragging.current) return

      const dx = event.clientX - lastPointer.current.x
      const dy = event.clientY - lastPointer.current.y

      lastPointer.current.x = event.clientX
      lastPointer.current.y = event.clientY
      yaw.current -= dx * LOOK_SENSITIVITY
      pitch.current = MathUtils.clamp(
        pitch.current - dy * LOOK_SENSITIVITY,
        -1.2,
        1.2
      )
      lookVelocity.set(dx, dy)
    }

    function endPointerDrag(event: PointerEvent) {
      dragging.current = false
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId)
      }
    }

    element.addEventListener('pointerdown', handlePointerDown)
    element.addEventListener('pointermove', handlePointerMove)
    element.addEventListener('pointerup', endPointerDrag)
    element.addEventListener('pointercancel', endPointerDrag)

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown)
      element.removeEventListener('pointermove', handlePointerMove)
      element.removeEventListener('pointerup', endPointerDrag)
      element.removeEventListener('pointercancel', endPointerDrag)
    }
  }, [cameraMode, gl, orientation])

  useFrame((_, delta) => {
    const usePhysicalRotation =
      cameraMode &&
      orientation.permission === 'granted' &&
      orientation.active

    if (usePhysicalRotation) {
      setDeviceQuaternion(
        deviceQuaternion.current,
        deviceEuler.current,
        screenRotation.current,
        orientation
      )

      if (!physicalRotationActive.current) {
        inverseCalibration.current.copy(deviceQuaternion.current).invert()
        cameraAtCalibration.current.copy(camera.quaternion)
        physicalRotationActive.current = true
        viewMotionReady.current = false
      }

      relativeRotation.current
        .copy(deviceQuaternion.current)
        .multiply(inverseCalibration.current)
      targetRotation.current
        .copy(relativeRotation.current)
        .multiply(cameraAtCalibration.current)

      const smoothing = 1 - Math.exp(-delta * 18)
      camera.quaternion.slerp(targetRotation.current, smoothing)

      currentViewEuler.current.setFromQuaternion(camera.quaternion, 'YXZ')
      if (viewMotionReady.current) {
        const yawDelta = wrappedAngleDelta(
          currentViewEuler.current.y,
          previousViewEuler.current.y
        )
        const pitchDelta = wrappedAngleDelta(
          currentViewEuler.current.x,
          previousViewEuler.current.x
        )
        lookVelocity.set(
          MathUtils.clamp(-yawDelta / LOOK_SENSITIVITY, -30, 30),
          MathUtils.clamp(-pitchDelta / LOOK_SENSITIVITY, -30, 30)
        )
      } else {
        viewMotionReady.current = true
      }
      previousViewEuler.current.copy(currentViewEuler.current)
    } else {
      if (physicalRotationActive.current) {
        pointerRotation.current.setFromQuaternion(camera.quaternion, 'YXZ')
        pitch.current = MathUtils.clamp(pointerRotation.current.x, -1.2, 1.2)
        yaw.current = pointerRotation.current.y
        physicalRotationActive.current = false
        viewMotionReady.current = false
      }

      pointerRotation.current.set(pitch.current, yaw.current, 0, 'YXZ')
      camera.quaternion.setFromEuler(pointerRotation.current)
    }

    lookVelocity.multiplyScalar(Math.exp(-delta * 10))
  })

  return null
}
