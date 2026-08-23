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
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from './environment'
import { CameraRig } from './camera'
import { Kite } from './kite'
import { KiteString } from './string'
import { Hand } from './arm'
import { KiteSubmersionEffects } from './kiteSubmersionEffects'
import type { OrientationState } from '../hooks/useDeviceGyro'
import { useMemo, useRef } from 'react'
import { AmbientLight, Color, DirectionalLight, Fog } from 'three'
import { setDiscoColor } from './discoPalette'

const MIN_DEVICE_PIXEL_RATIO = 1
const MAX_DEVICE_PIXEL_RATIO = 1.5

type GameCanvasProps = {
  bubbleColor: string
  cameraMode: boolean
  discoMode: boolean
  cloudColor: string
  cloudCoverage: number
  cloudSeed: number
  windSpeed: number
  horizonColor: string
  lightColor: string
  orientation: OrientationState
  pulseSpeed: number
  pulseWidth: number
  reflectionClarity: number
  showHands: boolean
  skyColor: string
  skyBrightness: number
  stringLength: number
  waterColor: string
}

export function GameCanvas({
  bubbleColor,
  cameraMode,
  discoMode,
  cloudColor,
  cloudCoverage,
  cloudSeed,
  windSpeed,
  horizonColor,
  lightColor,
  orientation,
  pulseSpeed,
  pulseWidth,
  reflectionClarity,
  showHands,
  skyColor,
  skyBrightness,
  stringLength,
  waterColor,
}: GameCanvasProps) {
  return (
    <Canvas
      className="canvas"
      camera={{ position: [0, 1.6, 0], fov: 70 }}
      dpr={[MIN_DEVICE_PIXEL_RATIO, MAX_DEVICE_PIXEL_RATIO]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
    >
      <SceneAtmosphere
        cameraMode={cameraMode}
        discoMode={discoMode}
        horizonColor={horizonColor}
        lightColor={lightColor}
        skyBrightness={skyBrightness}
      />

      <CameraRig cameraMode={cameraMode} orientation={orientation} />

      <group visible={!cameraMode}>
        <Environment
          cloudColor={cloudColor}
          cloudCoverage={cloudCoverage}
          cloudSeed={cloudSeed}
          discoMode={discoMode}
          windSpeed={windSpeed}
          horizonColor={horizonColor}
          lightColor={lightColor}
          pulseSpeed={pulseSpeed}
          pulseWidth={pulseWidth}
          reflectionClarity={reflectionClarity}
          skyColor={skyColor}
          skyBrightness={skyBrightness}
          waterColor={waterColor}
        />
      </group>

      <Kite
        discoMode={discoMode}
        underwaterEffect={!cameraMode}
        stringLength={stringLength}
        windSpeed={windSpeed}
      />
      <Hand visible={showHands} />
      <KiteString discoMode={discoMode} underwaterEffect={!cameraMode} />
      <KiteSubmersionEffects
        bubbleColor={bubbleColor}
        discoMode={discoMode}
        horizonColor={horizonColor}
        lightColor={lightColor}
        waterColor={waterColor}
        windSpeed={windSpeed}
      />
    </Canvas>
  )
}

type SceneAtmosphereProps = {
  cameraMode: boolean
  discoMode: boolean
  horizonColor: string
  lightColor: string
  skyBrightness: number
}

function SceneAtmosphere({
  cameraMode,
  discoMode,
  horizonColor,
  lightColor,
  skyBrightness,
}: SceneAtmosphereProps) {
  const scene = useThree((state) => state.scene)
  const fogRef = useRef<Fog>(null)
  const ambientRef = useRef<AmbientLight>(null)
  const directionalRef = useRef<DirectionalLight>(null)
  const baseHorizon = useMemo(
    () => new Color(horizonColor).multiplyScalar(skyBrightness),
    [horizonColor, skyBrightness]
  )
  const animatedHorizon = useMemo(() => new Color(), [])
  const animatedLight = useMemo(() => new Color(), [])

  useFrame((state) => {
    const horizon = discoMode
      ? setDiscoColor(
          animatedHorizon,
          state.clock.elapsedTime,
          0.12,
          0.92,
          0.7
        ).multiplyScalar(skyBrightness)
      : baseHorizon
    const directLight = discoMode
      ? setDiscoColor(
          animatedLight,
          state.clock.elapsedTime,
          0.2,
          1,
          0.68
        )
      : animatedLight.set(lightColor)

    if (!cameraMode && scene.background instanceof Color) {
      scene.background.copy(horizon)
    }
    fogRef.current?.color.copy(horizon)
    ambientRef.current?.color.copy(horizon)
    directionalRef.current?.color.copy(directLight)
  })

  return (
    <>
      {!cameraMode && <color attach="background" args={[baseHorizon]} />}
      <fog ref={fogRef} attach="fog" args={[baseHorizon, 70, 360]} />
      <ambientLight ref={ambientRef} color={baseHorizon} intensity={1.2} />
      <directionalLight
        ref={directionalRef}
        color={lightColor}
        position={[5, 8, 4]}
        intensity={1.5}
      />
    </>
  )
}
