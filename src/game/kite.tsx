import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useRef } from 'react'
import {
  Mesh,
  NearestFilter,
  Vector3,
  MathUtils,
  DoubleSide,
  Euler,
} from 'three'
import { lookVelocity } from './camera'


// initialize variables
const cameraForward = new Vector3()
const targetPosition = new Vector3()
const verticalOffset = new Vector3(0, 1.2, 0)

const KITE_DISTANCE = 8
const KITE_FOLLOW_STRENGTH = 3.5
const KITE_SIZE = 1.5

const localTilt = new Euler(0, 0, 0, 'XYZ')

// A simple kite that tracks the center of an fps camera
export function Kite() {
  const kiteRef = useRef<Mesh>(null)
  const currentRoll = useRef(0)
  const currentPitchTilt = useRef(0)

  const camera = useThree((state) => state.camera)

  const kiteTexture = useTexture('/kite.png')

  kiteTexture.magFilter = NearestFilter
  kiteTexture.minFilter = NearestFilter
  kiteTexture.generateMipmaps = false

  useFrame((_, delta) => {
    if (!kiteRef.current) return

    // Move kite toward point in front of camera.
    camera.getWorldDirection(cameraForward)

    targetPosition
      .copy(camera.position)
      .add(cameraForward.multiplyScalar(KITE_DISTANCE))
      .add(verticalOffset)

    const follow = 1 - Math.exp(-delta * KITE_FOLLOW_STRENGTH)
    kiteRef.current.position.lerp(targetPosition, follow)

    // Billboard base orientation.
    kiteRef.current.quaternion.copy(camera.quaternion)

    // Convert input movement into local visual tilt.
    // When not moving, lookVelocity decays to 0, so the kite returns to neutral.
    const maxRoll = MathUtils.degToRad(35)
    const maxPitchTilt = MathUtils.degToRad(18)

    // Flip this sign if left/right feels backwards.
    const targetRoll = MathUtils.clamp(
      -lookVelocity.x * 5.0,
      -maxRoll,
      maxRoll
    )

    // Optional vertical tilt. Flip sign if up/down feels backwards.
    const targetPitchTilt = MathUtils.clamp(
      lookVelocity.y * 3.0,
      -maxPitchTilt,
      maxPitchTilt
    )

    const tiltFollow = 1 - Math.exp(-delta * 8)

    currentRoll.current = MathUtils.lerp(
      currentRoll.current,
      targetRoll,
      tiltFollow
    )

    currentPitchTilt.current = MathUtils.lerp(
      currentPitchTilt.current,
      targetPitchTilt,
      tiltFollow
    )

    // Apply local tilt after billboard.
    localTilt.set(currentPitchTilt.current, 0, currentRoll.current)
    kiteRef.current.rotateX(localTilt.x)
    kiteRef.current.rotateZ(localTilt.z)
  })

  return (
    // The kite is a simple plane bilboarding to the camera
    <mesh ref={kiteRef} position={[0, 2.5, -8]}>
      <planeGeometry args={[KITE_SIZE, KITE_SIZE]} />
      <meshBasicMaterial
        map={kiteTexture}
        transparent
        alphaTest={0.1}
        side={DoubleSide}
      />
    </mesh>
  )
}