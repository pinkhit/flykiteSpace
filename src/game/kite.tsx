import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import {
  Mesh,
  NearestFilter,
  Quaternion,
  Vector3,
  MathUtils,
  MeshBasicMaterial,
  DoubleSide,
  Euler,
} from 'three'
import { lookVelocity } from './camera'
import {
  kiteMotion,
  kiteStringAnchor,
  WATER_LEVEL,
} from './kiteAnchors'
import { setDiscoColor } from './discoPalette'


// initialize variables
const cameraForward = new Vector3()
const cameraRight = new Vector3()
const cameraUp = new Vector3()
const targetPosition = new Vector3()
const verticalOffset = new Vector3(0, 1.2, 0)

const KITE_FOLLOW_STRENGTH = 3.5
const KITE_SIZE = 1.5

const localTilt = new Euler(0, 0, 0, 'XYZ')
const localStringAttachment = new Vector3()
const bubbleRight = new Vector3()
const bubbleUp = new Vector3()
const measuredVelocity = new Vector3()

type KiteProps = {
  discoMode: boolean
  stringLength: number
  windSpeed: number
}

// A simple kite that tracks the center of an fps camera
export function Kite({ discoMode, stringLength, windSpeed }: KiteProps) {
  const kiteRef = useRef<Mesh>(null)
  const kiteMaterialRef = useRef<MeshBasicMaterial>(null)
  const currentRoll = useRef(0)
  const currentPitchTilt = useRef(0)
  const idleBlend = useRef(0)
  const previousPosition = useRef(new Vector3())
  const previousCameraRotation = useRef(new Quaternion())
  const cameraRotationReady = useRef(false)
  const motionReady = useRef(false)

  const camera = useThree((state) => state.camera)

  const sourceTexture = useTexture('/kite.png')
  const kiteTexture = useMemo(() => {
    const texture = sourceTexture.clone()
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    return texture
  }, [sourceTexture])

  useEffect(() => () => kiteTexture.dispose(), [kiteTexture])

  useFrame((state, delta) => {
    if (!kiteRef.current) return

    if (kiteMaterialRef.current) {
      if (discoMode) {
        setDiscoColor(
          kiteMaterialRef.current.color,
          state.clock.elapsedTime,
          0.82,
          1,
          0.64
        )
      } else {
        kiteMaterialRef.current.color.set('#ffffff')
      }
    }

    let cameraAngularSpeed = 0
    if (cameraRotationReady.current && delta > 0.0001) {
      cameraAngularSpeed =
        camera.quaternion.angleTo(previousCameraRotation.current) / delta
    } else {
      cameraRotationReady.current = true
    }
    previousCameraRotation.current.copy(camera.quaternion)

    const targetIdleBlend =
      1 - MathUtils.smoothstep(cameraAngularSpeed, 0.025, 0.45)
    const idleFollow =
      1 -
      Math.exp(
        -delta * (targetIdleBlend > idleBlend.current ? 1.35 : 8)
      )
    idleBlend.current = MathUtils.lerp(
      idleBlend.current,
      targetIdleBlend,
      idleFollow
    )

    // Move kite toward point in front of camera.
    camera.getWorldDirection(cameraForward)
    cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
    cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion)

    targetPosition
      .copy(camera.position)
      .addScaledVector(cameraForward, stringLength)
      .add(verticalOffset)

    // Incommensurate harmonics create a slowly changing, non-looping wind
    // motion without per-frame randomness or noise texture sampling.
    const safeWindSpeed = Math.max(0, windSpeed)
    // The nonlinear response keeps low settings breezy while giving the top
    // of the slider enough energy to feel genuinely stormy.
    const baseWindStrength =
      Math.sqrt(safeWindSpeed) * 0.65 +
      Math.pow(safeWindSpeed, 1.45) * 0.16
    const animeStormBoost =
      Math.exp(Math.max(0, safeWindSpeed - 5) * 0.24) - 1
    const windStrength = MathUtils.clamp(
      baseWindStrength + animeStormBoost * 1.35,
      0,
      10
    )
    const windFrequency =
      0.7 +
      safeWindSpeed * 0.13 +
      safeWindSpeed * safeWindSpeed * 0.007 +
      animeStormBoost * 0.25
    const storminess = MathUtils.smoothstep(safeWindSpeed, 4, 10)
    const windTime = state.clock.elapsedTime * windFrequency
    const gustStrength =
      0.78 +
      Math.sin(windTime * 0.17 + 1.9) * 0.14 +
      Math.sin(windTime * 0.071 + 4.2) * 0.08 +
      Math.sin(windTime * 0.43 + 5.6) * 0.12 * storminess
    const horizontalBob =
      (Math.sin(windTime * 0.73 + 0.4) +
        Math.sin(windTime * 1.31 + 2.7) * 0.38 +
        Math.sin(windTime * 2.17 + 5.1) * 0.16 +
        Math.sin(windTime * 3.91 + 1.8) * 0.22 * storminess) *
      0.14 *
      gustStrength *
      windStrength *
      idleBlend.current
    const verticalWave =
      Math.sin(windTime * 0.57 + 2.1) +
      Math.sin(windTime * 1.09 + 4.8) * 0.34 +
      Math.sin(windTime * 3.17 + 0.9) * 0.18 * storminess
    const liftiness = MathUtils.smoothstep(safeWindSpeed, 1, 10)
    const shapedVerticalWave =
      verticalWave >= 0
        ? verticalWave * (1 + liftiness * 0.9)
        : verticalWave * (1 - liftiness * 0.35)
    const updraft =
      Math.pow(
        Math.max(0, Math.sin(windTime * 0.37 + 2.4)),
        2
      ) *
      0.06 *
      windStrength *
      liftiness
    const verticalBob =
      shapedVerticalWave *
      0.1 *
      gustStrength *
      windStrength *
      idleBlend.current +
      updraft * idleBlend.current
    const depthBob =
      (Math.sin(windTime * 0.41 + 3.6) +
        Math.sin(windTime * 0.89 + 0.7) * 0.28 +
        Math.sin(windTime * 2.83 + 4.4) * 0.16 * storminess) *
      0.055 *
      windStrength *
      idleBlend.current
    targetPosition
      .addScaledVector(cameraRight, horizontalBob)
      .addScaledVector(cameraUp, verticalBob)
      .addScaledVector(cameraForward, depthBob)

    const follow = 1 - Math.exp(-delta * KITE_FOLLOW_STRENGTH)
    kiteRef.current.position.lerp(targetPosition, follow)

    // Billboard base orientation.
    kiteRef.current.quaternion.copy(camera.quaternion)

    // Convert input movement into local visual tilt.
    // When not moving, lookVelocity decays to 0, so the kite returns to neutral.
    const animeStorminess = MathUtils.smoothstep(safeWindSpeed, 5, 10)
    const maxRoll = MathUtils.degToRad(
      MathUtils.lerp(35, 70, animeStorminess)
    )
    const maxPitchTilt = MathUtils.degToRad(
      MathUtils.lerp(18, 36, animeStorminess)
    )

    // Flip this sign if left/right feels backwards.
    const windRoll =
      (Math.sin(windTime * 0.67 + 1.2) +
        Math.sin(windTime * 1.43 + 4.1) * 0.32 +
        Math.sin(windTime * 3.73 + 2.2) * 0.24 * storminess) *
      MathUtils.degToRad(4.5) *
      windStrength *
      idleBlend.current
    const targetRoll = MathUtils.clamp(
      -lookVelocity.x * 5.0 + windRoll,
      -maxRoll,
      maxRoll
    )

    // Optional vertical tilt. Flip sign if up/down feels backwards.
    const windPitch =
      (Math.sin(windTime * 0.49 + 3.2) +
        Math.sin(windTime * 1.19 + 0.3) * 0.28 +
        Math.sin(windTime * 3.31 + 5.3) * 0.2 * storminess) *
      MathUtils.degToRad(2.8) *
      windStrength *
      idleBlend.current
    const targetPitchTilt = MathUtils.clamp(
      lookVelocity.y * 3.0 + windPitch,
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

    bubbleRight.set(1, 0, 0).applyQuaternion(kiteRef.current.quaternion)
    bubbleUp.set(0, 1, 0).applyQuaternion(kiteRef.current.quaternion)
    kiteMotion.bubbleRight.copy(bubbleRight)
    kiteMotion.bubbleUp.copy(bubbleUp)

    localStringAttachment
      .set(0, -KITE_SIZE * 0.38, 0)
      .applyQuaternion(kiteRef.current.quaternion)
    kiteStringAnchor
      .copy(kiteRef.current.position)
      .add(localStringAttachment)

    if (motionReady.current && delta > 0.0001) {
      measuredVelocity
        .subVectors(kiteRef.current.position, previousPosition.current)
        .multiplyScalar(1 / delta)
      const velocityFollow = 1 - Math.exp(-delta * 10)
      kiteMotion.velocity.lerp(measuredVelocity, velocityFollow)
    } else {
      kiteMotion.velocity.set(0, 0, 0)
      motionReady.current = true
    }

    previousPosition.current.copy(kiteRef.current.position)
    kiteMotion.position.copy(kiteRef.current.position)

    const lowerEdge = kiteRef.current.position.y - KITE_SIZE * 0.5
    kiteMotion.submersion = MathUtils.clamp(
      (WATER_LEVEL - lowerEdge) / (KITE_SIZE * 0.7),
      0,
      1
    )
    kiteMotion.bubbleOrigin.copy(kiteRef.current.position)
    kiteMotion.bubbleOrigin.y = Math.min(
      WATER_LEVEL - 0.06,
      kiteRef.current.position.y - KITE_SIZE * 0.3
    )
  })

  return (
    // The kite is a simple plane bilboarding to the camera
    <mesh ref={kiteRef} position={[0, 2.5, -8]}>
      <planeGeometry args={[KITE_SIZE, KITE_SIZE]} />
      <meshBasicMaterial
        ref={kiteMaterialRef}
        map={kiteTexture}
        transparent
        alphaTest={0.1}
        side={DoubleSide}
      />
    </mesh>
  )
}
