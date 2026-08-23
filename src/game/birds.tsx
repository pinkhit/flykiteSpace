import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import {
  AnimationAction,
  AnimationMixer,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MathUtils,
  Object3D,
  Vector3,
} from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { setDiscoColor } from './discoPalette'
import { kiteMotion } from './kiteAnchors'
import {
  createVoxelCrossGeometry,
  type VoxelParticleShape,
} from './voxelParticleGeometry'

const BIRD_MODEL_URL = '/models/birds.glb'
const BIRD_FLIGHT_ANIMATION_NAME = 'Take 001'
const BIRD_MODEL_SCALE = 0.1
const BIRD_MODEL_CENTER = new Vector3(0.052, 1.782, 1.092)
const BIRD_MODEL_FORWARD_YAW_OFFSET = 0
const BIRD_MODEL_LEVEL_PITCH = 0
const BIRD_FLIGHT_BANK_ANGLE = 0.16
const BIRD_ORIENTATION_FOLLOW_STRENGTH = 4.2
const BIRD_FLIGHT_ANIMATION_TIME_SCALE = 6
const BIRD_GLIDE_ANIMATION_TIME_SCALE = 0.18
const BIRD_GLIDE_FREQUENCY = 0.55
const BIRD_GLIDE_BLEND_START = 0.7
const BIRD_GLIDE_BLEND_END = 0.94
const BIRD_IMPACT_ANIMATION_TIME_SCALE = 0.35
const BIRD_EXTRACTION_ANIMATION_TIME_SCALE = 1.7
const KITE_COLLISION_RADIUS = 0.82
const BIRD_COLLISION_RADIUS = 0.53
const BIRD_FLIGHT_CENTER_HEIGHT = 1.2
const BIRD_RADIAL_ROAM = 1.25
const BIRD_MIN_PITCH = 0.02
const BIRD_MAX_PITCH = 0.24
const BIRD_MIN_ANGULAR_SPEED = 0.09
const BIRD_ANGULAR_SPEED_VARIATION = 0.09
const BIRD_FLIGHT_FOLLOW_STRENGTH = 1.4
const BIRD_WIND_SPEED_INPUT_MIN = 0
const BIRD_WIND_SPEED_INPUT_MAX = 10
const BIRD_MIN_WIND_SPEED_MULTIPLIER = 0.45
const BIRD_MAX_WIND_SPEED_MULTIPLIER = 1.7
const BIRD_MIN_INTENT_DURATION = 3.8
const BIRD_INTENT_DURATION_VARIATION = 4.2
const BIRD_DIRECTION_CHANGE_CHANCE = 0.18
const BIRD_RESPAWN_DELAY = 4.5
const IMPACT_BOUNCE_DURATION = 1
const IMPACT_BOUNCE_HEIGHT = 0.72
const IMPACT_BOUNCE_APEX_PROGRESS = 0.66
const IMPACT_SETTLE_DROP = 0.28
const IMPACT_AIRBORNE_STRETCH = 0.2
const IMPACT_LANDING_SQUASH = 0.32
const IMPACT_LANDING_SQUASH_START = 0.72
const IMPACT_ROLL_WOBBLE = 0.3
const IMPACT_FLIP_ROTATION = Math.PI
const EXTRACTION_DURATION = 1.25
const EXTRACTION_INITIAL_SPEED = 14
const EXTRACTION_UPWARD_ACCELERATION = 28
const EXTRACTION_WOBBLE_DISTANCE = 0.22
const EXTRACTION_WOBBLE_SPEED = 18
const EXTRACTION_SECONDARY_WOBBLE_SPEED_RATIO = 0.83
const EXTRACTION_IMPACT_VELOCITY_TRANSFER = 0.025
const EXTRACTION_SHRINK_START = 0.76
const EXTRACTION_MIN_SCALE = 0.05
const EXTRACTION_ROTATION_SPEED = 8
const EXTRACTION_MODEL_PITCH = -Math.PI / 2
const EXTRACTION_ROLL_WOBBLE = 0.18
const BIRD_HIT_VOXEL_POOL_SIZE = 96
const BIRD_HIT_VOXELS_PER_BURST = 14
const BIRD_HIT_VOXEL_COLOR = '#ffffff'
const BIRD_HIT_VOXEL_MIN_SPEED = 1.25
const BIRD_HIT_VOXEL_SPEED_VARIATION = 1.85
const BIRD_HIT_VOXEL_SOURCE_VELOCITY_TRANSFER = 0.018
const BIRD_HIT_VOXEL_DRAG = 3.2
const BIRD_HIT_VOXEL_MIN_LIFETIME = 0.42
const BIRD_HIT_VOXEL_LIFETIME_VARIATION = 0.28
const BIRD_HIT_VOXEL_MIN_SIZE = 0.045
const BIRD_HIT_VOXEL_SIZE_VARIATION = 0.055
const BIRD_HIT_VOXEL_MAX_ANGULAR_SPEED = 9
const BIRD_HIT_VOXEL_APPEAR_DURATION = 0.045
const BIRD_HIT_VOXEL_FADE_START = 0.36
const BIRD_HIT_CROSS_CHANCE = 0.5
const BIRD_HIT_CROSS_SIZE_MULTIPLIER = 0.72
const BIRD_HIT_VOXEL_OPACITY = 0.92
const BIRD_HIT_AMBIENT_BRIGHTNESS = 0.62
const BIRD_HIT_DIRECTIONAL_LIGHT_CONTRIBUTION = 0.46
const BIRD_HIT_LIGHT_DIRECTION = new Vector3(-0.35, 0.8, -0.48).normalize()
const BIRD_HIT_DISCO_LIGHT_SPEED = 0.2
const BIRD_HIT_DISCO_LIGHT_SATURATION = 1
const BIRD_HIT_DISCO_LIGHT_BRIGHTNESS = 0.68
const BIRD_PHASE_STEP = 1.618
const BIRD_INITIAL_YAW_OFFSET = 0.28
const MAX_BIRD_FRAME_DELTA = 1 / 20
const RANDOM_UINT_MAX = 0xffffffff
const RANDOM_MULTIPLIER = 1664525
const RANDOM_INCREMENT = 1013904223
const RANDOM_SEED_STEP = 2654435761

// Each bird stays in a separate near-to-far band, but can orbit all the way
// around the player. Reaching a different band requires changing string length.
const BIRD_FLIGHT_RADII = [6, 10, 14, 18, 22, 26, 30, 34, 38, 42] as const
const BIRD_COUNT = BIRD_FLIGHT_RADII.length

type BirdMode = 'flying' | 'impact' | 'extracting' | 'waiting'

type BirdState = {
  age: number
  angularDirection: -1 | 1
  angularVelocity: number
  homeRadius: number
  impactOrigin: Vector3
  impactVelocity: Vector3
  intentDuration: number
  mode: BirdMode
  phase: number
  pitch: number
  position: Vector3
  radialDistance: number
  randomState: number
  targetAngularVelocity: number
  targetPitch: number
  targetRadius: number
  visualYaw: number
  yaw: number
}

type BirdHitVoxel = {
  active: boolean
  age: number
  angularVelocity: Vector3
  lifetime: number
  position: Vector3
  rotation: Vector3
  shape: VoxelParticleShape
  size: number
  velocity: Vector3
}

type BirdModelInstance = {
  action: AnimationAction | null
  mixer: AnimationMixer
  root: Group
}

const previousKitePosition = new Vector3()
const kiteTravel = new Vector3()
const kiteToBird = new Vector3()
const closestKitePoint = new Vector3()
const hitVoxelTransform = new Object3D()

const hitVoxelVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;

  void main() {
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    vec4 worldPosition = modelMatrix * instancePosition;
    vWorldNormal = normalize(
      mat3(modelMatrix) * mat3(instanceMatrix) * normal
    );
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const hitVoxelFragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uLightColor;
  uniform vec3 uLightDirection;
  uniform float uAmbientBrightness;
  uniform float uDirectionalLightContribution;
  uniform float uOpacity;
  varying vec3 vWorldNormal;

  void main() {
    float blockLight = max(
      dot(normalize(vWorldNormal), normalize(uLightDirection)),
      0.0
    );
    vec3 lightIntensity = vec3(uAmbientBrightness)
      + uLightColor * blockLight * uDirectionalLightContribution;
    vec3 shadedPoof = uBaseColor * lightIntensity;

    gl_FragColor = vec4(shadedPoof, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createBirdHitVoxels(): BirdHitVoxel[] {
  return Array.from({ length: BIRD_HIT_VOXEL_POOL_SIZE }, () => ({
    active: false,
    age: 0,
    angularVelocity: new Vector3(),
    lifetime: 0,
    position: new Vector3(),
    rotation: new Vector3(),
    shape: 'cube',
    size: 0,
    velocity: new Vector3(),
  }))
}

function wrappedAngleDelta(current: number, target: number) {
  return (
    MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) -
    Math.PI
  )
}

function getTargetHeadingYaw(bird: BirdState) {
  const flightDirection = bird.angularVelocity >= 0 ? 1 : -1
  return (
    -bird.yaw +
    flightDirection * (Math.PI / 2) +
    BIRD_MODEL_FORWARD_YAW_OFFSET
  )
}

function getFlightAnimationTimeScale(
  bird: BirdState,
  elapsedTime: number,
  flightSpeedMultiplier: number
) {
  const glideSignal =
    Math.sin(
      elapsedTime * BIRD_GLIDE_FREQUENCY * flightSpeedMultiplier + bird.phase
    ) *
      0.5 +
    0.5
  const glideBlend = MathUtils.smoothstep(
    glideSignal,
    BIRD_GLIDE_BLEND_START,
    BIRD_GLIDE_BLEND_END
  )

  return (
    MathUtils.lerp(
      BIRD_FLIGHT_ANIMATION_TIME_SCALE,
      BIRD_GLIDE_ANIMATION_TIME_SCALE,
      glideBlend
    ) * flightSpeedMultiplier
  )
}

function getWindFlightSpeedMultiplier(windSpeed: number) {
  const normalizedWind = MathUtils.inverseLerp(
    BIRD_WIND_SPEED_INPUT_MIN,
    BIRD_WIND_SPEED_INPUT_MAX,
    MathUtils.clamp(
      windSpeed,
      BIRD_WIND_SPEED_INPUT_MIN,
      BIRD_WIND_SPEED_INPUT_MAX
    )
  )

  return MathUtils.lerp(
    BIRD_MIN_WIND_SPEED_MULTIPLIER,
    BIRD_MAX_WIND_SPEED_MULTIPLIER,
    normalizedWind
  )
}

function getImpactBounce(progress: number) {
  if (progress < IMPACT_BOUNCE_APEX_PROGRESS) {
    const ascentProgress = progress / IMPACT_BOUNCE_APEX_PROGRESS
    return Math.sin(ascentProgress * Math.PI * 0.5)
  }

  const descentProgress =
    (progress - IMPACT_BOUNCE_APEX_PROGRESS) /
    (1 - IMPACT_BOUNCE_APEX_PROGRESS)
  return 1 - descentProgress * descentProgress
}

function nextRandom(bird: BirdState) {
  bird.randomState =
    (Math.imul(bird.randomState, RANDOM_MULTIPLIER) + RANDOM_INCREMENT) >>> 0
  return bird.randomState / RANDOM_UINT_MAX
}

function emitBirdHitVoxels(
  bird: BirdState,
  voxels: BirdHitVoxel[],
  firstVoxelIndex: number
) {
  let nextVoxelIndex = firstVoxelIndex

  for (
    let burstIndex = 0;
    burstIndex < BIRD_HIT_VOXELS_PER_BURST;
    burstIndex += 1
  ) {
    const voxel = voxels[nextVoxelIndex]
    nextVoxelIndex = (nextVoxelIndex + 1) % BIRD_HIT_VOXEL_POOL_SIZE
    const verticalDirection = nextRandom(bird) * 2 - 1
    const azimuth = nextRandom(bird) * Math.PI * 2
    const horizontalDirection = Math.sqrt(
      Math.max(0, 1 - verticalDirection * verticalDirection)
    )
    const speed =
      BIRD_HIT_VOXEL_MIN_SPEED +
      nextRandom(bird) * BIRD_HIT_VOXEL_SPEED_VARIATION

    voxel.active = true
    voxel.age = 0
    voxel.lifetime =
      BIRD_HIT_VOXEL_MIN_LIFETIME +
      nextRandom(bird) * BIRD_HIT_VOXEL_LIFETIME_VARIATION
    voxel.position.copy(bird.position)
    voxel.rotation.set(
      nextRandom(bird) * Math.PI,
      nextRandom(bird) * Math.PI,
      nextRandom(bird) * Math.PI
    )
    voxel.shape =
      nextRandom(bird) < BIRD_HIT_CROSS_CHANCE ? 'cross' : 'cube'
    voxel.angularVelocity.set(
      (nextRandom(bird) * 2 - 1) * BIRD_HIT_VOXEL_MAX_ANGULAR_SPEED,
      (nextRandom(bird) * 2 - 1) * BIRD_HIT_VOXEL_MAX_ANGULAR_SPEED,
      (nextRandom(bird) * 2 - 1) * BIRD_HIT_VOXEL_MAX_ANGULAR_SPEED
    )
    voxel.size =
      BIRD_HIT_VOXEL_MIN_SIZE +
      nextRandom(bird) * BIRD_HIT_VOXEL_SIZE_VARIATION
    voxel.velocity.set(
      Math.cos(azimuth) * horizontalDirection * speed +
        kiteMotion.velocity.x * BIRD_HIT_VOXEL_SOURCE_VELOCITY_TRANSFER,
      verticalDirection * speed +
        kiteMotion.velocity.y * BIRD_HIT_VOXEL_SOURCE_VELOCITY_TRANSFER,
      Math.sin(azimuth) * horizontalDirection * speed +
        kiteMotion.velocity.z * BIRD_HIT_VOXEL_SOURCE_VELOCITY_TRANSFER
    )
  }

  return nextVoxelIndex
}

function chooseFlightIntent(bird: BirdState) {
  bird.age = 0
  if (nextRandom(bird) < BIRD_DIRECTION_CHANGE_CHANCE) {
    bird.angularDirection *= -1
  }
  bird.targetAngularVelocity =
    bird.angularDirection *
    (BIRD_MIN_ANGULAR_SPEED +
      nextRandom(bird) * BIRD_ANGULAR_SPEED_VARIATION)
  bird.targetRadius =
    bird.homeRadius + (nextRandom(bird) * 2 - 1) * BIRD_RADIAL_ROAM
  bird.targetPitch = MathUtils.lerp(
    BIRD_MIN_PITCH,
    BIRD_MAX_PITCH,
    nextRandom(bird)
  )
  bird.intentDuration =
    BIRD_MIN_INTENT_DURATION +
    nextRandom(bird) * BIRD_INTENT_DURATION_VARIATION
}

function setFlyingPosition(bird: BirdState, playerPosition: Vector3) {
  const cosPitch = Math.cos(bird.pitch)

  bird.position.set(
    playerPosition.x +
      Math.sin(bird.yaw) * cosPitch * bird.radialDistance,
    playerPosition.y +
      BIRD_FLIGHT_CENTER_HEIGHT +
      Math.sin(bird.pitch) * bird.radialDistance,
    playerPosition.z -
      Math.cos(bird.yaw) * cosPitch * bird.radialDistance
  )
}

function createBirds(playerPosition: Vector3): BirdState[] {
  return BIRD_FLIGHT_RADII.map((homeRadius, index) => {
    const initialPitch = MathUtils.lerp(
      BIRD_MIN_PITCH,
      BIRD_MAX_PITCH,
      ((index * 7) % BIRD_COUNT) / BIRD_COUNT
    )
    const angularDirection = index % 2 === 0 ? 1 : -1
    const yaw =
      BIRD_INITIAL_YAW_OFFSET + (index / BIRD_COUNT) * Math.PI * 2
    const bird: BirdState = {
      age: 0,
      angularDirection,
      angularVelocity: angularDirection * BIRD_MIN_ANGULAR_SPEED,
      homeRadius,
      impactOrigin: new Vector3(),
      impactVelocity: new Vector3(),
      intentDuration: BIRD_MIN_INTENT_DURATION,
      mode: 'flying',
      phase: index * BIRD_PHASE_STEP,
      pitch: initialPitch,
      position: new Vector3(),
      radialDistance: homeRadius,
      randomState: (index + 1) * RANDOM_SEED_STEP,
      targetAngularVelocity:
        angularDirection * BIRD_MIN_ANGULAR_SPEED,
      targetPitch: initialPitch,
      targetRadius: homeRadius,
      visualYaw:
        -yaw +
        angularDirection * (Math.PI / 2) +
        BIRD_MODEL_FORWARD_YAW_OFFSET,
      yaw,
    }
    chooseFlightIntent(bird)
    setFlyingPosition(bird, playerPosition)
    return bird
  })
}

function updateFlyingBird(
  bird: BirdState,
  delta: number,
  playerPosition: Vector3,
  flightSpeedMultiplier: number
) {
  bird.age += delta * flightSpeedMultiplier
  if (bird.age >= bird.intentDuration) {
    chooseFlightIntent(bird)
  }

  const flightFollow =
    1 -
    Math.exp(
      -BIRD_FLIGHT_FOLLOW_STRENGTH * flightSpeedMultiplier * delta
    )
  bird.angularVelocity = MathUtils.lerp(
    bird.angularVelocity,
    bird.targetAngularVelocity,
    flightFollow
  )
  bird.radialDistance = MathUtils.lerp(
    bird.radialDistance,
    bird.targetRadius,
    flightFollow
  )
  bird.pitch = MathUtils.lerp(bird.pitch, bird.targetPitch, flightFollow)
  bird.yaw = MathUtils.euclideanModulo(
    bird.yaw + bird.angularVelocity * flightSpeedMultiplier * delta,
    Math.PI * 2
  )
  const orientationFollow =
    1 -
    Math.exp(
      -BIRD_ORIENTATION_FOLLOW_STRENGTH * flightSpeedMultiplier * delta
    )
  bird.visualYaw +=
    wrappedAngleDelta(bird.visualYaw, getTargetHeadingYaw(bird)) *
    orientationFollow
  setFlyingPosition(bird, playerPosition)
}

function kitePathHitsBird(birdPosition: Vector3) {
  kiteTravel.subVectors(kiteMotion.position, previousKitePosition)
  kiteToBird.subVectors(birdPosition, previousKitePosition)
  const travelLengthSquared = kiteTravel.lengthSq()
  const pathProgress =
    travelLengthSquared > 0.000001
      ? MathUtils.clamp(
          kiteToBird.dot(kiteTravel) / travelLengthSquared,
          0,
          1
        )
      : 1
  closestKitePoint
    .copy(previousKitePosition)
    .addScaledVector(kiteTravel, pathProgress)
  const collisionDistance = KITE_COLLISION_RADIUS + BIRD_COLLISION_RADIUS

  return (
    closestKitePoint.distanceToSquared(birdPosition) <=
    collisionDistance * collisionDistance
  )
}

function beginImpact(bird: BirdState) {
  bird.age = 0
  bird.mode = 'impact'
  bird.impactOrigin.copy(bird.position)
  bird.impactVelocity.copy(kiteMotion.velocity)
}

function respawnBird(bird: BirdState, playerPosition: Vector3) {
  bird.age = 0
  bird.mode = 'flying'
  bird.yaw = nextRandom(bird) * Math.PI * 2
  bird.radialDistance = bird.homeRadius
  bird.pitch = MathUtils.lerp(
    BIRD_MIN_PITCH,
    BIRD_MAX_PITCH,
    nextRandom(bird)
  )
  chooseFlightIntent(bird)
  bird.visualYaw = getTargetHeadingYaw(bird)
  setFlyingPosition(bird, playerPosition)
}

type BirdsProps = {
  discoMode: boolean
  lightColor: string
  visible: boolean
  windSpeed: number
}

export function Birds({
  discoMode,
  lightColor,
  visible,
  windSpeed,
}: BirdsProps) {
  const camera = useThree((state) => state.camera)
  const { animations, scene } = useGLTF(BIRD_MODEL_URL)
  const hitCubeMeshRef = useRef<InstancedMesh>(null)
  const hitCrossMeshRef = useRef<InstancedMesh>(null)
  const birdsRef = useRef<BirdState[] | null>(null)
  const hitVoxelsRef = useRef<BirdHitVoxel[] | null>(null)
  const nextHitVoxel = useRef(0)
  const kitePositionReady = useRef(false)
  if (birdsRef.current === null) {
    birdsRef.current = createBirds(camera.position)
  }
  const birds = birdsRef.current
  if (hitVoxelsRef.current === null) {
    hitVoxelsRef.current = createBirdHitVoxels()
  }
  const hitVoxels = hitVoxelsRef.current
  const hitVoxelUniforms = useMemo(
    () => ({
      uAmbientBrightness: { value: BIRD_HIT_AMBIENT_BRIGHTNESS },
      uBaseColor: { value: new Color(BIRD_HIT_VOXEL_COLOR) },
      uDirectionalLightContribution: {
        value: BIRD_HIT_DIRECTIONAL_LIGHT_CONTRIBUTION,
      },
      uLightColor: { value: new Color(lightColor) },
      uLightDirection: { value: BIRD_HIT_LIGHT_DIRECTION.clone() },
      uOpacity: { value: BIRD_HIT_VOXEL_OPACITY },
    }),
    [lightColor]
  )
  const modelInstances = useMemo<BirdModelInstance[]>(() => {
    const flightClip =
      animations.find(({ name }) => name === BIRD_FLIGHT_ANIMATION_NAME) ??
      animations[0]

    return Array.from({ length: BIRD_COUNT }, () => {
      const root = new Group()
      const visual = cloneSkeleton(scene)
      visual.position.copy(BIRD_MODEL_CENTER).multiplyScalar(-1)
      root.add(visual)
      const mixer = new AnimationMixer(visual)
      return {
        action: flightClip ? mixer.clipAction(flightClip) : null,
        mixer,
        root,
      }
    })
  }, [animations, scene])
  const hitCrossGeometry = useMemo(() => createVoxelCrossGeometry(), [])

  useEffect(() => {
    modelInstances.forEach(({ action }, index) => {
      if (!action) return
      action.reset()
      action.time = (index / BIRD_COUNT) * action.getClip().duration
      action.play()
    })

    return () => {
      modelInstances.forEach(({ mixer }) => {
        mixer.stopAllAction()
      })
    }
  }, [modelInstances])

  useEffect(() => {
    hitCubeMeshRef.current?.instanceMatrix.setUsage(DynamicDrawUsage)
    hitCrossMeshRef.current?.instanceMatrix.setUsage(DynamicDrawUsage)
  }, [])

  useEffect(() => () => hitCrossGeometry.dispose(), [hitCrossGeometry])

  useEffect(() => {
    if (!discoMode) hitVoxelUniforms.uLightColor.value.set(lightColor)
  }, [discoMode, hitVoxelUniforms, lightColor])

  useFrame((state, delta) => {
    if (!visible) {
      if (hitCubeMeshRef.current) hitCubeMeshRef.current.count = 0
      if (hitCrossMeshRef.current) hitCrossMeshRef.current.count = 0
      previousKitePosition.copy(kiteMotion.position)
      kitePositionReady.current = false
      return
    }

    if (discoMode) {
      setDiscoColor(
        hitVoxelUniforms.uLightColor.value,
        state.clock.elapsedTime,
        BIRD_HIT_DISCO_LIGHT_SPEED,
        BIRD_HIT_DISCO_LIGHT_SATURATION,
        BIRD_HIT_DISCO_LIGHT_BRIGHTNESS
      )
    }

    const effectDelta = Math.min(delta, MAX_BIRD_FRAME_DELTA)
    const flightSpeedMultiplier = getWindFlightSpeedMultiplier(windSpeed)

    for (let index = 0; index < birds.length; index += 1) {
      const bird = birds[index]
      const modelInstance = modelInstances[index]
      let scaleX = 1
      let scaleY = 1
      let scaleZ = 1
      let modelPitch = BIRD_MODEL_LEVEL_PITCH
      const actualAngularVelocity =
        bird.angularVelocity * flightSpeedMultiplier
      let modelRoll =
        -MathUtils.clamp(
          actualAngularVelocity /
            (BIRD_MIN_ANGULAR_SPEED + BIRD_ANGULAR_SPEED_VARIATION),
          -1,
          1
        ) * BIRD_FLIGHT_BANK_ANGLE
      let animationTimeScale = getFlightAnimationTimeScale(
        bird,
        state.clock.elapsedTime,
        flightSpeedMultiplier
      )

      if (bird.mode === 'flying') {
        updateFlyingBird(
          bird,
          effectDelta,
          camera.position,
          flightSpeedMultiplier
        )

        if (
          kitePositionReady.current &&
          kitePathHitsBird(bird.position)
        ) {
          nextHitVoxel.current = emitBirdHitVoxels(
            bird,
            hitVoxels,
            nextHitVoxel.current
          )
          beginImpact(bird)
        }
      }

      if (bird.mode === 'impact') {
        bird.age += effectDelta
        const progress = MathUtils.clamp(
          bird.age / IMPACT_BOUNCE_DURATION,
          0,
          1
        )
        const bounce = getImpactBounce(progress)
        const airborneStretch = Math.sin(progress * Math.PI)
        const landingProgress = MathUtils.smoothstep(
          progress,
          IMPACT_LANDING_SQUASH_START,
          1
        )
        const landingSquash = Math.sin(landingProgress * Math.PI)
        const flip = MathUtils.smoothstep(progress, 0, 1)
        const settleDrop = flip * IMPACT_SETTLE_DROP

        bird.position.copy(bird.impactOrigin)
        bird.position.y += bounce * IMPACT_BOUNCE_HEIGHT - settleDrop
        scaleX *=
          1 - airborneStretch * IMPACT_AIRBORNE_STRETCH * 0.5 +
          landingSquash * IMPACT_LANDING_SQUASH
        scaleY *=
          1 + airborneStretch * IMPACT_AIRBORNE_STRETCH -
          landingSquash * IMPACT_LANDING_SQUASH
        scaleZ *=
          1 - airborneStretch * IMPACT_AIRBORNE_STRETCH * 0.5 +
          landingSquash * IMPACT_LANDING_SQUASH
        modelRoll +=
          flip * IMPACT_FLIP_ROTATION +
          landingSquash * IMPACT_ROLL_WOBBLE
        animationTimeScale = BIRD_IMPACT_ANIMATION_TIME_SCALE

        if (progress >= 1) {
          bird.age = 0
          bird.mode = 'extracting'
          bird.impactOrigin.y -= IMPACT_SETTLE_DROP
          bird.position.copy(bird.impactOrigin)
        }
      } else if (bird.mode === 'extracting') {
        bird.age += effectDelta
        const progress = MathUtils.clamp(
          bird.age / EXTRACTION_DURATION,
          0,
          1
        )
        const lift =
          EXTRACTION_INITIAL_SPEED * bird.age +
          0.5 * EXTRACTION_UPWARD_ACCELERATION * bird.age * bird.age
        const wobbleEnvelope = 1 - progress
        const wobble =
          Math.sin(bird.age * EXTRACTION_WOBBLE_SPEED + bird.phase) *
          EXTRACTION_WOBBLE_DISTANCE *
          wobbleEnvelope

        bird.position.set(
          bird.impactOrigin.x +
            bird.impactVelocity.x *
              EXTRACTION_IMPACT_VELOCITY_TRANSFER *
              bird.age +
            wobble,
          bird.impactOrigin.y + lift,
          bird.impactOrigin.z +
            bird.impactVelocity.z *
              EXTRACTION_IMPACT_VELOCITY_TRANSFER *
              bird.age +
            Math.cos(
              bird.age *
                EXTRACTION_WOBBLE_SPEED *
                EXTRACTION_SECONDARY_WOBBLE_SPEED_RATIO +
                bird.phase
            ) *
              EXTRACTION_WOBBLE_DISTANCE *
              wobbleEnvelope
        )
        const shrink = MathUtils.smoothstep(
          progress,
          EXTRACTION_SHRINK_START,
          1
        )
        const extractionScale = MathUtils.lerp(
          1,
          EXTRACTION_MIN_SCALE,
          shrink
        )
        scaleX *= extractionScale
        scaleY *= extractionScale
        scaleZ *= extractionScale
        modelPitch = EXTRACTION_MODEL_PITCH
        modelRoll =
          IMPACT_FLIP_ROTATION +
          Math.sin(bird.age * EXTRACTION_ROTATION_SPEED + bird.phase) *
            EXTRACTION_ROLL_WOBBLE
        animationTimeScale = BIRD_EXTRACTION_ANIMATION_TIME_SCALE

        if (progress >= 1) {
          bird.age = 0
          bird.mode = 'waiting'
          scaleX = 0
          scaleY = 0
          scaleZ = 0
        }
      } else if (bird.mode === 'waiting') {
        bird.age += effectDelta
        scaleX = 0
        scaleY = 0
        scaleZ = 0

        if (bird.age >= BIRD_RESPAWN_DELAY) {
          respawnBird(bird, camera.position)
          scaleX = 1
          scaleY = 1
          scaleZ = 1
        }
      }

      modelInstance.root.position.copy(bird.position)
      modelInstance.root.rotation.set(
        modelPitch,
        bird.visualYaw,
        modelRoll,
        'YXZ'
      )
      modelInstance.root.scale.set(
        scaleX * BIRD_MODEL_SCALE,
        scaleY * BIRD_MODEL_SCALE,
        scaleZ * BIRD_MODEL_SCALE
      )
      if (bird.mode !== 'waiting') {
        modelInstance.mixer.update(effectDelta * animationTimeScale)
      }
    }

    const hitCubeMesh = hitCubeMeshRef.current
    const hitCrossMesh = hitCrossMeshRef.current
    let renderedHitCubeCount = 0
    let renderedHitCrossCount = 0
    for (let index = 0; index < hitVoxels.length; index += 1) {
      const voxel = hitVoxels[index]
      if (voxel.active) {
        voxel.age += effectDelta
        const drag = Math.exp(-BIRD_HIT_VOXEL_DRAG * effectDelta)
        voxel.velocity.multiplyScalar(drag)
        voxel.position.addScaledVector(voxel.velocity, effectDelta)
        voxel.rotation.addScaledVector(voxel.angularVelocity, effectDelta)

        if (voxel.age >= voxel.lifetime) {
          voxel.active = false
        }
      }
      if (!voxel.active) continue

      const lifetimeProgress = voxel.age / voxel.lifetime
      const appear = MathUtils.smoothstep(
        voxel.age,
        0,
        BIRD_HIT_VOXEL_APPEAR_DURATION
      )
      const disappear =
        1 -
        MathUtils.smoothstep(
          lifetimeProgress,
          BIRD_HIT_VOXEL_FADE_START,
          1
        )
      const shapeScale =
        voxel.shape === 'cross' ? BIRD_HIT_CROSS_SIZE_MULTIPLIER : 1
      const scale = voxel.size * shapeScale * appear * disappear

      hitVoxelTransform.position.copy(voxel.position)
      hitVoxelTransform.rotation.set(
        voxel.rotation.x,
        voxel.rotation.y,
        voxel.rotation.z
      )
      hitVoxelTransform.scale.setScalar(scale)
      hitVoxelTransform.updateMatrix()
      if (voxel.shape === 'cross') {
        hitCrossMesh?.setMatrixAt(
          renderedHitCrossCount,
          hitVoxelTransform.matrix
        )
        renderedHitCrossCount += 1
      } else {
        hitCubeMesh?.setMatrixAt(
          renderedHitCubeCount,
          hitVoxelTransform.matrix
        )
        renderedHitCubeCount += 1
      }
    }
    if (hitCubeMesh) {
      hitCubeMesh.count = renderedHitCubeCount
      if (renderedHitCubeCount > 0) {
        hitCubeMesh.instanceMatrix.needsUpdate = true
      }
    }
    if (hitCrossMesh) {
      hitCrossMesh.count = renderedHitCrossCount
      if (renderedHitCrossCount > 0) {
        hitCrossMesh.instanceMatrix.needsUpdate = true
      }
    }

    previousKitePosition.copy(kiteMotion.position)
    kitePositionReady.current = true
  })

  return (
    <group visible={visible}>
      {modelInstances.map(({ root }) => (
        <primitive key={root.uuid} object={root} dispose={null} />
      ))}
      <instancedMesh
        ref={hitCubeMeshRef}
        args={[undefined, undefined, BIRD_HIT_VOXEL_POOL_SIZE]}
        count={0}
        frustumCulled={false}
        renderOrder={920}
      >
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          depthWrite={false}
          fragmentShader={hitVoxelFragmentShader}
          toneMapped={false}
          transparent
          uniforms={hitVoxelUniforms}
          vertexShader={hitVoxelVertexShader}
        />
      </instancedMesh>
      <instancedMesh
        ref={hitCrossMeshRef}
        args={[undefined, undefined, BIRD_HIT_VOXEL_POOL_SIZE]}
        count={0}
        frustumCulled={false}
        renderOrder={921}
      >
        <primitive attach="geometry" object={hitCrossGeometry} />
        <shaderMaterial
          depthWrite={false}
          fragmentShader={hitVoxelFragmentShader}
          toneMapped={false}
          transparent
          uniforms={hitVoxelUniforms}
          vertexShader={hitVoxelVertexShader}
        />
      </instancedMesh>
    </group>
  )
}

useGLTF.preload(BIRD_MODEL_URL)
