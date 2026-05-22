import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useRef } from 'react'
import { Mesh, NearestFilter, Vector3 } from 'three'

const cameraForward = new Vector3()
const targetPosition = new Vector3()
const verticalOffset = new Vector3(0, 1.2, 0)

export function Kite() {
  const kiteRef = useRef<Mesh>(null)
  const camera = useThree((state) => state.camera)

  const kiteTexture = useTexture('/kite.png')

  kiteTexture.magFilter = NearestFilter
  kiteTexture.minFilter = NearestFilter
  kiteTexture.generateMipmaps = false

  useFrame((_, delta) => {
    if (!kiteRef.current) return

    camera.getWorldDirection(cameraForward)

    targetPosition
      .copy(camera.position)
      .add(cameraForward.multiplyScalar(8))
      .add(verticalOffset)

    const follow = 1 - Math.exp(-delta * 3.5)

    kiteRef.current.position.lerp(targetPosition, follow)
    kiteRef.current.lookAt(camera.position)
  })

  return (
    <mesh ref={kiteRef} position={[0, 2.5, -8]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial
        map={kiteTexture}
        transparent
        alphaTest={0.1}
      />
    </mesh>
  )
}