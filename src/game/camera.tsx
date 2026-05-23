import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Vector2 } from 'three'

let yaw = 0
let pitch = 0
let dragging = false
let lastX = 0
let lastY = 0

const rotation = new Euler(0, 0, 0, 'YXZ')

export const lookVelocity = new Vector2(0, 0)

export function CameraRig() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useFrame((_, delta) => {
    rotation.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(rotation)

    // Decay look velocity back to zero when player stops moving.
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