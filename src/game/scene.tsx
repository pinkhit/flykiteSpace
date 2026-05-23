// import { Canvas } from '@react-three/fiber'
// import { Environment } from './environment'
// import { CameraRig } from './camera'
// import { Kite } from './kite'
// import { KiteString } from './string'
// import { Hand } from './arm'

// export function GameCanvas() {
//   return (
//     <Canvas
//       className="canvas"
//       camera={{ position: [0, 1.6, 0], fov: 70 }}
//       gl={{ antialias: true }}
//     >
//       <color attach="background" args={['#8ec5ff']} />

//       <ambientLight intensity={1.2} />
//       <directionalLight position={[5, 8, 4]} intensity={1.5} />

//       <CameraRig />
//       <Environment />
//       <Kite />
//       <KiteString />
//       <Hand />
//     </Canvas>
//   )
// }
import { Canvas } from '@react-three/fiber'
import { Environment } from './environment'
import { CameraRig } from './camera'
import { Kite } from './kite'
import { KiteString } from './string'
import { Hand } from './arm'
import type { OrientationState } from '../hooks/useDeviceGyro'

type GameCanvasProps = {
  cameraMode: boolean
  orientation: OrientationState
}

export function GameCanvas({ cameraMode, orientation }: GameCanvasProps) {
  return (
    <Canvas
      className="canvas"
      camera={{ position: [0, 1.6, 0], fov: 70 }}
      gl={{ antialias: true, alpha: true }}
    >
      {!cameraMode && <color attach="background" args={['#8ec5ff']} />}

      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 8, 4]} intensity={1.5} />

      <CameraRig cameraMode={cameraMode} orientation={orientation} />

      {!cameraMode && <Environment />}

      <Kite />
      <KiteString />
      <Hand />
    </Canvas>
  )
}