import { useFrame, useThree } from '@react-three/fiber'
import { Euler } from 'three'

let yaw = 0
let pitch = 0
let dragging = false
let lastX = 0
let lastY = 0

const rotation = new Euler(0, 0, 0, 'YXZ')

export function CameraRig() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useFrame(() => {
    rotation.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(rotation)
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
  }

  gl.domElement.onpointerup = (event) => {
    dragging = false
    gl.domElement.releasePointerCapture(event.pointerId)
  }

  return null
}