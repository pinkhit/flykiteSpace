import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import {
  Group,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three'
import { handStringAnchor } from './kiteAnchors'

const negativeZ = new Vector3(0, 0, -1)
const wristCameraPosition = new Vector3()
const handCameraPosition = new Vector3()
const hiddenStringCameraPosition = new Vector3()
const armDirection = new Vector3()
const armLocalRotation = new Quaternion()
const armFaceRotation = new Quaternion()

function cameraSpacePoint(
  target: Vector3,
  ndcX: number,
  ndcY: number,
  depth: number,
  camera: PerspectiveCamera
) {
  const halfHeight = Math.tan(MathUtils.degToRad(camera.fov * 0.5)) * depth
  const halfWidth = halfHeight * camera.aspect
  return target.set(ndcX * halfWidth, ndcY * halfHeight, -depth)
}

/**
 * A Minecraft-style first-person arm. Its two endpoints are defined in
 * normalized screen space so it keeps the same composition on wide monitors
 * and portrait phones instead of drifting with the camera aspect ratio.
 */
type HandProps = {
  visible: boolean
}

export function Hand({ visible }: HandProps) {
  const armRef = useRef<Group>(null)
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const size = useThree((state) => state.size)

  useFrame(() => {
    if (!armRef.current) return

    const portrait = size.height > size.width
    const wristDepth = portrait ? 0.68 : 0.64
    const handDepth = portrait ? 1.02 : 0.94

    cameraSpacePoint(
      wristCameraPosition,
      0.64,
      portrait ? -1.04 : -1.2,
      wristDepth,
      camera
    )
    cameraSpacePoint(
      handCameraPosition,
      portrait ? 0.5 : 0.44,
      portrait ? -0.58 : -0.44,
      handDepth,
      camera
    )

    armDirection.subVectors(handCameraPosition, wristCameraPosition)
    const armLength = armDirection.length()
    armLocalRotation.setFromUnitVectors(negativeZ, armDirection.normalize())
    armFaceRotation.setFromAxisAngle(
      negativeZ,
      MathUtils.degToRad(portrait ? -10 : -12)
    )
    armLocalRotation.multiply(armFaceRotation)

    // Minecraft's idle arm enters from the lower-right, angles inward toward
    // screen center, and rolls slightly so both the top and inner faces show.
    // Scale from vertical FOV so the block width remains stable on screen.
    const wristHalfHeight =
      Math.tan(MathUtils.degToRad(camera.fov * 0.5)) * wristDepth
    const armWidth = wristHalfHeight * (portrait ? 0.21 : 0.3)

    armRef.current.position
      .copy(wristCameraPosition)
      .applyQuaternion(camera.quaternion)
      .add(camera.position)
    armRef.current.quaternion
      .copy(camera.quaternion)
      .multiply(armLocalRotation)
    armRef.current.scale.set(armWidth, armWidth, armLength)

    cameraSpacePoint(
      hiddenStringCameraPosition,
      0.88,
      -1.08,
      portrait ? 0.76 : 0.72,
      camera
    )

    // Without the hand, the string enters from just beyond the lower-right
    // edge instead of remaining attached to an invisible fingertip.
    handStringAnchor
      .copy(visible ? handCameraPosition : hiddenStringCameraPosition)
      .applyQuaternion(camera.quaternion)
      .add(camera.position)
  })

  return (
    <group
      ref={armRef}
      frustumCulled={false}
      renderOrder={1000}
      visible={visible}
    >
      <mesh position={[0, 0, -0.29]} renderOrder={1000}>
        <boxGeometry args={[1, 1, 0.58]} />
        <meshBasicMaterial attach="material-0" color="#327c83" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-1" color="#4aa0a4" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-2" color="#62b3b1" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-3" color="#286d76" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-4" color="#4b989b" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-5" color="#347f86" opacity={1} toneMapped={false} transparent />
      </mesh>

      <mesh position={[0, 0, -0.625]} renderOrder={1001}>
        <boxGeometry args={[1.03, 1.03, 0.09]} />
        <meshBasicMaterial color="#286d76" opacity={1} toneMapped={false} transparent />
      </mesh>

      <mesh position={[0, 0, -0.835]} renderOrder={1002}>
        <boxGeometry args={[1, 1, 0.33]} />
        <meshBasicMaterial attach="material-0" color="#a9674c" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-1" color="#d99870" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-2" color="#e5aa7d" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-3" color="#995b43" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-4" color="#c98461" opacity={1} toneMapped={false} transparent />
        <meshBasicMaterial attach="material-5" color="#b87355" opacity={1} toneMapped={false} transparent />
      </mesh>
    </group>
  )
}
