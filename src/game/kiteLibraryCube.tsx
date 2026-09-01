import { Edges } from '@react-three/drei'
import {
  type ThreeEvent,
  useFrame,
} from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  Color,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { CLOUD_LAYER_CEILING } from './environmentBounds'
import { DISCO_PALETTE } from './discoPalette'
import { kiteMotion, WATER_LEVEL } from './kiteAnchors'
import { kiteLibraryCubeMotion } from './kiteLibraryCubeMotion'
import type { ImpactFeedback } from './impactFeedback'

const CUBE_SIZE = 3
const CUBE_HALF_SIZE = CUBE_SIZE * 0.5
const CUBE_BOUNDING_RADIUS = Math.sqrt(3) * CUBE_HALF_SIZE
const CUBE_COLLISION_RADIUS = CUBE_BOUNDING_RADIUS
const KITE_COLLISION_RADIUS = 0.82
const PLAYER_FLIGHT_RADIUS = 35
const CUBE_CENTER_FLIGHT_RADIUS =
  PLAYER_FLIGHT_RADIUS - CUBE_BOUNDING_RADIUS
const CUBE_TRAVEL_SPEED_SCALE = ( 3 / 4 ) 
const MAX_FRAME_DELTA = 1 / 30
const HELIUM_LIFT = 0.32
const AIR_DRAG = 0.08
const ANGULAR_DRAG = 0.3
const SPIN_AXIS_FOLLOW_STRENGTH = 0.42
const MIN_SPIN_SPEED = 0.22
const MAX_SPIN_SPEED = 0.67
const MIN_SPIN_AXIS_DURATION = 3.5
const SPIN_AXIS_DURATION_VARIATION = 4.5
const DISCO_COLOR_CHANGES_PER_SECOND = 0.42
const DISCO_PULSE_SPEED = 1.8
const DISCO_PULSE_AMOUNT = 0.08
const MIN_HORIZONTAL_CRUISE_SPEED = 1.22 * CUBE_TRAVEL_SPEED_SCALE
const MIN_VERTICAL_CRUISE_SPEED = 1.67 * CUBE_TRAVEL_SPEED_SCALE
const MAX_BODY_SPEED = 32 * CUBE_TRAVEL_SPEED_SCALE
const SKY_BOUNDARY_RESTITUTION = 0.94
const CLOUD_CEILING_RESTITUTION = 0.9
const WATER_RESTITUTION = 0.72
const WATER_SPRING = 3.4
const WATER_DAMPING = 1.8
const MAX_WATER_SUBMERSION = 0.45
const KITE_CANNON_VELOCITY_TRANSFER = 0.9 * CUBE_TRAVEL_SPEED_SCALE
const KITE_CANNON_BASE_SPEED = 18 * CUBE_TRAVEL_SPEED_SCALE
const KITE_CANNON_SPEED_TRANSFER = 0.65 * CUBE_TRAVEL_SPEED_SCALE
// Just beyond the default kite radius: immediately discoverable in the
// sun-facing starting view, but not already colliding on the first frame.
const INITIAL_POSITION = new Vector3(-4.5, 9.2, -9.5)

const kiteTravel = new Vector3()
const kiteToCube = new Vector3()
const closestKitePoint = new Vector3()
const collisionNormal = new Vector3()
const impactVelocity = new Vector3()
const impactOffset = new Vector3()
const spinImpulse = new Vector3()
const windAcceleration = new Vector3()
const playerToCube = new Vector3()
const boundaryNormal = new Vector3()
const cubeDiscoColor = new Color()
const cubeDiscoPalette = DISCO_PALETTE.map((color) => new Color(color))

function chooseRandomSpin(target: Vector3) {
  const vertical = Math.random() * 2 - 1
  const azimuth = Math.random() * Math.PI * 2
  const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical))
  const speed = MathUtils.lerp(
    MIN_SPIN_SPEED,
    MAX_SPIN_SPEED,
    Math.random()
  )

  target
    .set(
      Math.cos(azimuth) * horizontal,
      vertical,
      Math.sin(azimuth) * horizontal
    )
    .multiplyScalar(speed)
}

function createLibraryTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')

  if (context) {
    context.fillStyle = '#0645ad'
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.strokeStyle = '#ffffff'
    context.lineWidth = 22
    context.strokeRect(30, 30, canvas.width - 60, canvas.height - 60)

    context.fillStyle = '#ffffff'
    context.font = 'bold 82px "Courier New", monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('KITE', canvas.width / 2, 190)
    context.fillText('LIBRARY', canvas.width / 2, 285)

    context.font = 'bold 28px "Courier New", monospace'
    context.fillText('CLICK TO OPEN', canvas.width / 2, 385)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function kitePathHitsCube(cubePosition: Vector3, previousKitePosition: Vector3) {
  kiteTravel.subVectors(kiteMotion.position, previousKitePosition)
  kiteToCube.subVectors(cubePosition, previousKitePosition)
  const travelLengthSquared = kiteTravel.lengthSq()
  const pathProgress =
    travelLengthSquared > 0.000001
      ? MathUtils.clamp(
          kiteToCube.dot(kiteTravel) / travelLengthSquared,
          0,
          1
        )
      : 1

  closestKitePoint
    .copy(previousKitePosition)
    .addScaledVector(kiteTravel, pathProgress)

  return (
    closestKitePoint.distanceToSquared(cubePosition) <=
    (CUBE_COLLISION_RADIUS + KITE_COLLISION_RADIUS) ** 2
  )
}

type KiteLibraryCubeProps = {
  discoMode: boolean
  onKiteImpact: (feedback?: ImpactFeedback) => void
  onOpenLibrary: () => void
  visible: boolean
  windSpeed: number
}

export function KiteLibraryCube({
  discoMode,
  onKiteImpact,
  onOpenLibrary,
  visible,
  windSpeed,
}: KiteLibraryCubeProps) {
  const cubeRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshBasicMaterial>(null)
  const velocity = useRef(
    new Vector3(2.1, 2.7, 1.64).multiplyScalar(CUBE_TRAVEL_SPEED_SCALE)
  )
  const angularVelocity = useRef(new Vector3(0.04, -0.055, 0.035))
  const targetAngularVelocity = useRef(new Vector3(0.04, -0.055, 0.035))
  const nextSpinAxisChange = useRef(0)
  const previousKitePosition = useRef(new Vector3())
  const kitePositionReady = useRef(false)
  const kiteCollisionActive = useRef(false)
  const libraryTexture = useMemo(() => createLibraryTexture(), [])

  useEffect(() => () => libraryTexture.dispose(), [libraryTexture])
  useEffect(
    () => () => {
      document.body.style.cursor = ''
    },
    []
  )

  useFrame((state, frameDelta) => {
    const cube = cubeRef.current
    if (!cube) return

    const delta = Math.min(frameDelta, MAX_FRAME_DELTA)
    const elapsedTime = state.clock.elapsedTime
    kiteLibraryCubeMotion.previousPosition.copy(cube.position)

    if (materialRef.current) {
      if (discoMode) {
        const discoProgress =
          elapsedTime * DISCO_COLOR_CHANGES_PER_SECOND
        const discoIndex =
          Math.floor(discoProgress) % cubeDiscoPalette.length
        const nextDiscoIndex =
          (discoIndex + 1) % cubeDiscoPalette.length
        const discoBlend = MathUtils.smoothstep(
          discoProgress % 1,
          0,
          1
        )
        const discoPulse =
          1 +
          Math.sin(elapsedTime * DISCO_PULSE_SPEED) *
            DISCO_PULSE_AMOUNT
        materialRef.current.color
          .copy(
            cubeDiscoColor.lerpColors(
              cubeDiscoPalette[discoIndex],
              cubeDiscoPalette[nextDiscoIndex],
              discoBlend
            )
          )
          .multiplyScalar(discoPulse)
      } else {
        materialRef.current.color.set('#ffffff')
      }
    }

    if (elapsedTime >= nextSpinAxisChange.current) {
      chooseRandomSpin(targetAngularVelocity.current)
      nextSpinAxisChange.current =
        elapsedTime +
        MIN_SPIN_AXIS_DURATION +
        Math.random() * SPIN_AXIS_DURATION_VARIATION
    }

    if (kitePositionReady.current) {
      const kiteHitsCube = kitePathHitsCube(
        cube.position,
        previousKitePosition.current
      )

      if (kiteHitsCube && !kiteCollisionActive.current) {
        onKiteImpact()
        collisionNormal.subVectors(cube.position, closestKitePoint)
        if (collisionNormal.lengthSq() < 0.0001) {
          collisionNormal.copy(kiteMotion.velocity)
        }
        if (collisionNormal.lengthSq() < 0.0001) {
          collisionNormal.set(0, 1, 0)
        } else {
          collisionNormal.normalize()
        }

        impactVelocity.copy(kiteMotion.velocity)
        if (impactVelocity.length() > 24) impactVelocity.setLength(24)

        const collisionDistance =
          CUBE_COLLISION_RADIUS + KITE_COLLISION_RADIUS
        const penetration = Math.max(
          0,
          collisionDistance - cube.position.distanceTo(closestKitePoint)
        )
        cube.position.addScaledVector(
          collisionNormal,
          penetration + 0.12
        )

        velocity.current
          .copy(collisionNormal)
          .multiplyScalar(
            KITE_CANNON_BASE_SPEED +
              impactVelocity.length() * KITE_CANNON_SPEED_TRANSFER
          )
          .addScaledVector(
            impactVelocity,
            KITE_CANNON_VELOCITY_TRANSFER
          )
        if (velocity.current.length() > MAX_BODY_SPEED) {
          velocity.current.setLength(MAX_BODY_SPEED)
        }

        impactOffset.subVectors(closestKitePoint, cube.position)
        spinImpulse
          .crossVectors(impactOffset, impactVelocity)
          .multiplyScalar(0.05)
        angularVelocity.current.add(spinImpulse)
      }

      kiteCollisionActive.current = kiteHitsCube
    } else {
      kitePositionReady.current = true
    }
    previousKitePosition.current.copy(kiteMotion.position)

    windAcceleration.set(
      Math.sin(elapsedTime * 0.19 + 0.6) +
        Math.sin(elapsedTime * 0.071 + 2.8) * 0.45,
      0,
      Math.cos(elapsedTime * 0.16 + 1.7) +
        Math.sin(elapsedTime * 0.083 + 4.1) * 0.4
    )
    windAcceleration.multiplyScalar(0.036 + Math.max(0, windSpeed) * 0.012)

    velocity.current.addScaledVector(windAcceleration, delta)
    velocity.current.y += HELIUM_LIFT * delta
    velocity.current.multiplyScalar(Math.exp(-AIR_DRAG * delta))

    // Preserve a slow, unmistakable three-axis DVD-logo cruise. Impacts can
    // temporarily make it faster, while drag brings it back toward this floor.
    if (Math.abs(velocity.current.x) < MIN_HORIZONTAL_CRUISE_SPEED) {
      velocity.current.x =
        (Math.sign(velocity.current.x) || 1) * MIN_HORIZONTAL_CRUISE_SPEED
    }
    if (Math.abs(velocity.current.y) < MIN_VERTICAL_CRUISE_SPEED) {
      velocity.current.y =
        (Math.sign(velocity.current.y) || 1) * MIN_VERTICAL_CRUISE_SPEED
    }
    if (Math.abs(velocity.current.z) < MIN_HORIZONTAL_CRUISE_SPEED) {
      velocity.current.z =
        (Math.sign(velocity.current.z) || 1) * MIN_HORIZONTAL_CRUISE_SPEED
    }
    if (velocity.current.length() > MAX_BODY_SPEED) {
      velocity.current.setLength(MAX_BODY_SPEED)
    }

    cube.position.addScaledVector(velocity.current, delta)

    const waterContactHeight = WATER_LEVEL + CUBE_HALF_SIZE
    if (cube.position.y < waterContactHeight) {
      const bobTarget =
        waterContactHeight -
        0.12 +
        Math.sin(elapsedTime * 1.35 + cube.position.x * 0.08) * 0.16
      const buoyancyAcceleration =
        (bobTarget - cube.position.y) * WATER_SPRING -
        velocity.current.y * WATER_DAMPING
      velocity.current.y += buoyancyAcceleration * delta

      if (velocity.current.y < 0) {
        velocity.current.y = Math.max(
          MIN_VERTICAL_CRUISE_SPEED,
          -velocity.current.y * WATER_RESTITUTION
        )
      }

      const waterDrag = Math.exp(-0.9 * delta)
      velocity.current.x *= waterDrag
      velocity.current.z *= waterDrag

      const minimumCenterHeight =
        waterContactHeight - MAX_WATER_SUBMERSION
      if (cube.position.y < minimumCenterHeight) {
        cube.position.y = minimumCenterHeight
        velocity.current.y = Math.max(0.35, -velocity.current.y * 0.28)
      }
    }

    if (cube.position.y > CLOUD_LAYER_CEILING) {
      cube.position.y = CLOUD_LAYER_CEILING
      if (velocity.current.y > 0) {
        velocity.current.y = -Math.max(
          MIN_VERTICAL_CRUISE_SPEED,
          velocity.current.y * CLOUD_CEILING_RESTITUTION
        )
      }
    }

    playerToCube.subVectors(cube.position, state.camera.position)
    const distanceFromPlayer = playerToCube.length()
    if (distanceFromPlayer > CUBE_CENTER_FLIGHT_RADIUS) {
      boundaryNormal
        .copy(playerToCube)
        .multiplyScalar(1 / distanceFromPlayer)
      cube.position
        .copy(state.camera.position)
        .addScaledVector(boundaryNormal, CUBE_CENTER_FLIGHT_RADIUS)
      const outwardSpeed = velocity.current.dot(boundaryNormal)
      if (outwardSpeed > 0) {
        velocity.current.addScaledVector(
          boundaryNormal,
          -outwardSpeed * (1 + SKY_BOUNDARY_RESTITUTION)
        )
      }
    }

    angularVelocity.current.multiplyScalar(Math.exp(-ANGULAR_DRAG * delta))
    angularVelocity.current.lerp(
      targetAngularVelocity.current,
      1 - Math.exp(-SPIN_AXIS_FOLLOW_STRENGTH * delta)
    )
    cube.rotation.x += angularVelocity.current.x * delta
    cube.rotation.y += angularVelocity.current.y * delta
    cube.rotation.z += angularVelocity.current.z * delta

    kiteLibraryCubeMotion.active = visible
    kiteLibraryCubeMotion.collisionRadius = CUBE_COLLISION_RADIUS
    kiteLibraryCubeMotion.position.copy(cube.position)
    kiteLibraryCubeMotion.velocity.copy(velocity.current)
    kiteLibraryCubeMotion.waterContactOffset = CUBE_HALF_SIZE
  })

  function handlePointerOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    document.body.style.cursor = 'pointer'
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    document.body.style.cursor = ''
  }

  function handleOpen(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    onOpenLibrary()
  }

  return (
    <mesh
      onClick={handleOpen}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerOut={handlePointerOut}
      onPointerOver={handlePointerOver}
      position={INITIAL_POSITION}
      ref={cubeRef}
      visible={visible}
    >
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      <meshBasicMaterial
        color="#ffffff"
        map={libraryTexture}
        ref={materialRef}
        toneMapped={false}
      />
      <Edges color="#ffffff" scale={1.002} threshold={15} />
    </mesh>
  )
}
