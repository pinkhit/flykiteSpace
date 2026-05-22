import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Mesh, Vector3 } from 'three'

const cameraForward = new Vector3()
const targetPosition = new Vector3()

export function Kite() {
  const kiteRef = useRef<Mesh>(null)
  const camera = useThree((state) => state.camera)

  useFrame((_, delta) => {
    if (!kiteRef.current) return

    camera.getWorldDirection(cameraForward)

    targetPosition
      .copy(camera.position)
      .add(cameraForward.multiplyScalar(8))
      .add(new Vector3(0, 1.2, 0))

    const follow = 1 - Math.exp(-delta * 3.5)

    kiteRef.current.position.lerp(targetPosition, follow)
    kiteRef.current.lookAt(camera.position)
  })

  return (
    <mesh ref={kiteRef} position={[0, 2.5, -8]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial color="#ff4444" />
    </mesh>
  )
}