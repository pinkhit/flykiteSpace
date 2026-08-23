import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Object3D,
  Vector3,
} from 'three'
import { kiteMotion, WATER_LEVEL } from './kiteAnchors'
import { setDiscoColor } from './discoPalette'
import { createVoxelCrossGeometry } from './voxelParticleGeometry'

const BUBBLE_COUNT = 80
const SPLASH_PARTICLE_COUNT = 48
const BUBBLE_FADE_DURATION = 0.5
const SURFACE_LIFETIME = 0.6
const SPLASH_GRAVITY = 0.62
const SPLASH_LINEAR_DRAG = 0.55
const SPLASH_MIN_LIFETIME = 1.25
const SPLASH_LIFETIME_VARIATION = 0.75
const SPLASH_MIN_HORIZONTAL_SPEED = 0.12
const SPLASH_HORIZONTAL_SPEED_VARIATION = 0.28
const SPLASH_MIN_VERTICAL_SPEED = 0.42
const SPLASH_VERTICAL_SPEED_VARIATION = 0.5
const SPLASH_MAX_ANGULAR_SPEED = 1.25
const SPLASH_MIN_SIZE = 0.04
const SPLASH_SIZE_VARIATION = 0.026
const SPLASH_SOURCE_VELOCITY_TRANSFER = 0.035
const SPLASH_MAX_INHERITED_VELOCITY = 0.26
const SPLASH_SURFACE_OFFSET = 0.035
const SPLASH_WATER_REENTRY_GRACE = 0.18
const SPLASH_APPEAR_DURATION = 0.08
const SPLASH_FADE_DURATION = 0.45
const SPLASH_MAX_OPACITY = 0.88
const MAX_EFFECT_FRAME_DELTA = 1 / 20
const MAX_BUBBLE_EMISSION_BUDGET = 4
const BUBBLE_SPLASH_PARTICLE_COUNT = 1
const INITIAL_KITE_SPLASH_PARTICLE_COUNT = 4
const TRAILING_KITE_SPLASH_PARTICLE_COUNT = 2
const SPLASH_AMBIENT_BRIGHTNESS = 0.72
const SPLASH_DIRECTIONAL_LIGHT_CONTRIBUTION = 0.42
const SPLASH_HORIZON_TINT = 0.08
const SPLASH_LIGHT_DIRECTION = new Vector3(-0.35, 0.8, -0.48).normalize()
// Interleaving opposite points makes the silhouette readable before a full
// emission cycle completes: diamond, inner spars, then a knotted kite tail.
const KITE_PARTICLE_PATTERN = [
  [0, 0.38],
  [0, -0.38],
  [0.34, 0],
  [-0.34, 0],
  [0.17, 0.19],
  [-0.17, -0.19],
  [-0.17, 0.19],
  [0.17, -0.19],
  [0, -0.51],
  [0.1, -0.64],
  [-0.1, -0.77],
  [0, -0.9],
  [0, 0.18],
  [0, 0],
  [0, -0.18],
] as const
const hiddenPosition = new Vector3(0, -1000, 0)
const instanceTransform = new Object3D()
const splashOrigin = new Vector3()

const bubbleVertexShader = /* glsl */ `
  uniform float uWaterLevel;
  attribute float instanceOpacity;
  varying float vOpacity;
  varying float vSurfaceClarity;
  varying vec3 vViewDirection;
  varying vec3 vWorldNormal;

  void main() {
    vOpacity = instanceOpacity;
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    vec4 worldPosition = modelMatrix * instancePosition;
    vSurfaceClarity = smoothstep(
      uWaterLevel - 2.2,
      uWaterLevel + 0.02,
      worldPosition.y
    );
    // Bubble instances only use translation and uniform scale, so their local
    // normal direction is preserved by the instance transform.
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const bubbleFragmentShader = /* glsl */ `
  uniform vec3 uBubbleColor;
  uniform vec3 uLightColor;
  varying float vOpacity;
  varying float vSurfaceClarity;
  varying vec3 vViewDirection;
  varying vec3 vWorldNormal;

  void main() {
    if (vOpacity <= 0.001) discard;
    vec3 normalDirection = normalize(vWorldNormal);
    vec3 lightDirection = normalize(vec3(-0.35, 0.58, -0.72));
    float diffuse = max(dot(normalDirection, lightDirection), 0.0);
    float facing = max(
      dot(normalDirection, normalize(vViewDirection)),
      0.0
    );
    float fresnel = pow(1.0 - facing, 2.2);

    vec3 shadedColor = uBubbleColor * (0.58 + diffuse * 0.42);
    vec3 surfaceLight = mix(uBubbleColor, uLightColor, 0.42);
    vec3 litColor = mix(
      shadedColor,
      surfaceLight,
      vSurfaceClarity * (0.34 + diffuse * 0.28)
    );
    litColor = mix(
      litColor,
      vec3(1.0),
      fresnel * mix(0.08, 0.32, vSurfaceClarity)
    );

    float depthVisibility = mix(0.55, 0.98, vSurfaceClarity);
    float fresnelVisibility = mix(0.82, 1.0, fresnel);
    gl_FragColor = vec4(
      litColor,
      vOpacity * depthVisibility * fresnelVisibility
    );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const outlineVertexShader = /* glsl */ `
  uniform float uWaterLevel;
  attribute float instanceOpacity;
  varying float vOpacity;
  varying float vSurfaceClarity;

  void main() {
    vOpacity = instanceOpacity;
    vec3 outlinedPosition = position * 1.2;
    vec4 instancePosition = instanceMatrix * vec4(outlinedPosition, 1.0);
    vec4 worldPosition = modelMatrix * instancePosition;
    vSurfaceClarity = smoothstep(
      uWaterLevel - 2.2,
      uWaterLevel + 0.02,
      worldPosition.y
    );
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const outlineFragmentShader = /* glsl */ `
  varying float vOpacity;
  varying float vSurfaceClarity;

  void main() {
    if (vOpacity <= 0.001) discard;
    float outlineVisibility = mix(0.3, 0.82, vSurfaceClarity);
    gl_FragColor = vec4(
      vec3(1.0),
      vOpacity * outlineVisibility
    );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const splashVertexShader = /* glsl */ `
  attribute float instanceOpacity;
  varying float vOpacity;
  varying vec3 vWorldNormal;

  void main() {
    vOpacity = instanceOpacity;
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    vec4 worldPosition = modelMatrix * instancePosition;
    vWorldNormal = normalize(
      mat3(modelMatrix) * mat3(instanceMatrix) * normal
    );
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const splashFragmentShader = /* glsl */ `
  uniform vec3 uWaterColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uLightDirection;
  uniform float uAmbientBrightness;
  uniform float uDirectionalLightContribution;
  uniform float uHorizonTint;
  varying float vOpacity;
  varying vec3 vWorldNormal;

  void main() {
    if (vOpacity <= 0.001) discard;
    float blockLight = max(
      dot(normalize(vWorldNormal), normalize(uLightDirection)),
      0.0
    );
    float lightIntensity = uAmbientBrightness
      + blockLight * uDirectionalLightContribution;
    vec3 splashColor = mix(uWaterColor, uHorizonColor, uHorizonTint);
    vec3 shadedSplash = splashColor * lightIntensity;

    gl_FragColor = vec4(shadedSplash, vOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function smoothstep(value: number) {
  const clamped = MathUtils.clamp(value, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}

type Bubble = {
  active: boolean
  age: number
  lifetime: number
  phase: number
  position: Vector3
  radius: number
  surfaceAge: number
  velocity: Vector3
}

type SplashParticle = {
  active: boolean
  age: number
  angularVelocity: Vector3
  lifetime: number
  position: Vector3
  rotation: Vector3
  size: number
  velocity: Vector3
}

type KiteSubmersionEffectsProps = {
  bubbleColor: string
  discoMode: boolean
  horizonColor: string
  lightColor: string
  waterColor: string
  windSpeed: number
}

export function KiteSubmersionEffects({
  bubbleColor,
  discoMode,
  horizonColor,
  lightColor,
  waterColor,
  windSpeed,
}: KiteSubmersionEffectsProps) {
  const bubbleMeshRef = useRef<InstancedMesh>(null)
  const outlineMeshRef = useRef<InstancedMesh>(null)
  const splashCrossMeshRef = useRef<InstancedMesh>(null)
  const emissionBudget = useRef(0)
  const nextPatternPoint = useRef(0)
  const nextBubble = useRef(0)
  const nextSplashParticle = useRef(0)
  const wasKiteSkimming = useRef(false)
  const skimMovementDistance = useRef(0)
  const timeSinceSkimSplash = useRef(Number.POSITIVE_INFINITY)
  const lastSkimPosition = useRef(new Vector3())
  const opacityValues = useMemo(() => new Float32Array(BUBBLE_COUNT), [])
  const splashCrossOpacityValues = useMemo(
    () => new Float32Array(SPLASH_PARTICLE_COUNT),
    []
  )
  const splashCrossGeometry = useMemo(() => {
    const geometry = createVoxelCrossGeometry()
    geometry.setAttribute(
      'instanceOpacity',
      new InstancedBufferAttribute(splashCrossOpacityValues, 1)
    )
    return geometry
  }, [splashCrossOpacityValues])
  const bubbleUniforms = useMemo(
    () => ({
      uBubbleColor: { value: new Color() },
      uLightColor: { value: new Color() },
      uWaterLevel: { value: WATER_LEVEL },
    }),
    []
  )
  const outlineUniforms = useMemo(
    () => ({ uWaterLevel: { value: WATER_LEVEL } }),
    []
  )
  const splashUniforms = useMemo(
    () => ({
      uWaterColor: { value: new Color() },
      uHorizonColor: { value: new Color() },
      uLightDirection: { value: SPLASH_LIGHT_DIRECTION.clone() },
      uAmbientBrightness: { value: SPLASH_AMBIENT_BRIGHTNESS },
      uDirectionalLightContribution: {
        value: SPLASH_DIRECTIONAL_LIGHT_CONTRIBUTION,
      },
      uHorizonTint: { value: SPLASH_HORIZON_TINT },
    }),
    []
  )
  const bubbleState = useRef<Bubble[]>(
    Array.from({ length: BUBBLE_COUNT }, () => ({
      active: false,
      age: 0,
      lifetime: 0,
      phase: 0,
      position: hiddenPosition.clone(),
      radius: 0,
      surfaceAge: -1,
      velocity: new Vector3(),
    }))
  )
  const splashState = useRef<SplashParticle[]>(
    Array.from({ length: SPLASH_PARTICLE_COUNT }, () => ({
      active: false,
      age: 0,
      angularVelocity: new Vector3(),
      lifetime: 0,
      position: hiddenPosition.clone(),
      rotation: new Vector3(),
      size: 0,
      velocity: new Vector3(),
    }))
  )

  const emitSplashBurst = useCallback(
    (
      origin: Vector3,
      count: number,
      strength: number,
      sourceVelocity: Vector3
    ) => {
      for (let burstIndex = 0; burstIndex < count; burstIndex += 1) {
        const particle =
          splashState.current[nextSplashParticle.current]
        nextSplashParticle.current =
          (nextSplashParticle.current + 1) % SPLASH_PARTICLE_COUNT
        const angle = Math.random() * Math.PI * 2
        const horizontalSpeed =
          (SPLASH_MIN_HORIZONTAL_SPEED +
            Math.random() * SPLASH_HORIZONTAL_SPEED_VARIATION) *
          strength

        particle.active = true
        particle.age = 0
        particle.lifetime =
          SPLASH_MIN_LIFETIME +
          Math.random() * SPLASH_LIFETIME_VARIATION
        particle.position.copy(origin)
        particle.position.y = WATER_LEVEL + SPLASH_SURFACE_OFFSET
        particle.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        )
        particle.angularVelocity.set(
          (Math.random() * 2 - 1) * SPLASH_MAX_ANGULAR_SPEED,
          (Math.random() * 2 - 1) * SPLASH_MAX_ANGULAR_SPEED,
          (Math.random() * 2 - 1) * SPLASH_MAX_ANGULAR_SPEED
        )
        particle.size =
          (SPLASH_MIN_SIZE + Math.random() * SPLASH_SIZE_VARIATION) *
          MathUtils.lerp(0.82, 1.2, strength)
        particle.velocity.set(
          Math.cos(angle) * horizontalSpeed +
            MathUtils.clamp(
              sourceVelocity.x * SPLASH_SOURCE_VELOCITY_TRANSFER,
              -SPLASH_MAX_INHERITED_VELOCITY,
              SPLASH_MAX_INHERITED_VELOCITY
            ),
          (SPLASH_MIN_VERTICAL_SPEED +
            Math.random() * SPLASH_VERTICAL_SPEED_VARIATION) *
            strength,
          Math.sin(angle) * horizontalSpeed +
            MathUtils.clamp(
              sourceVelocity.z * SPLASH_SOURCE_VELOCITY_TRANSFER,
              -SPLASH_MAX_INHERITED_VELOCITY,
              SPLASH_MAX_INHERITED_VELOCITY
            )
        )
      }
    },
    []
  )

  useEffect(
    () => () => splashCrossGeometry.dispose(),
    [splashCrossGeometry]
  )

  useEffect(() => {
    if (discoMode) return
    bubbleUniforms.uBubbleColor.value.set(bubbleColor)
    bubbleUniforms.uLightColor.value.set(lightColor)
    splashUniforms.uWaterColor.value.set(waterColor)
    splashUniforms.uHorizonColor.value.set(horizonColor)
  }, [
    bubbleColor,
    bubbleUniforms,
    discoMode,
    horizonColor,
    lightColor,
    splashUniforms,
    waterColor,
  ])

  useEffect(() => {
    const mesh = bubbleMeshRef.current
    const outlineMesh = outlineMeshRef.current
    const splashCrossMesh = splashCrossMeshRef.current
    if (!mesh || !outlineMesh || !splashCrossMesh) return

    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    outlineMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    splashCrossMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    const opacityAttribute = mesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute
    const outlineOpacityAttribute = outlineMesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute
    const splashCrossOpacityAttribute = splashCrossMesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute
    opacityAttribute.setUsage(DynamicDrawUsage)
    outlineOpacityAttribute.setUsage(DynamicDrawUsage)
    splashCrossOpacityAttribute.setUsage(DynamicDrawUsage)
  }, [])

  useFrame((state, delta) => {
    const mesh = bubbleMeshRef.current
    const outlineMesh = outlineMeshRef.current
    const splashCrossMesh = splashCrossMeshRef.current
    if (!mesh || !outlineMesh || !splashCrossMesh) return
    const opacityAttribute = mesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute
    const outlineOpacityAttribute = outlineMesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute
    const splashCrossOpacityAttribute = splashCrossMesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute

    const planarSpeed = Math.hypot(
      kiteMotion.velocity.x,
      kiteMotion.velocity.z
    )
    const bubbleStormBoost =
      Math.exp(Math.max(0, windSpeed - 5) * 0.18) - 1
    const effectDelta = Math.min(delta, MAX_EFFECT_FRAME_DELTA)

    if (discoMode) {
      setDiscoColor(
        bubbleUniforms.uBubbleColor.value,
        state.clock.elapsedTime,
        0.92,
        0.95,
        0.56
      )
      setDiscoColor(
        bubbleUniforms.uLightColor.value,
        state.clock.elapsedTime,
        0.2,
        1,
        0.68
      )
      setDiscoColor(
        splashUniforms.uWaterColor.value,
        state.clock.elapsedTime,
        0.66,
        0.88,
        0.43
      )
      setDiscoColor(
        splashUniforms.uHorizonColor.value,
        state.clock.elapsedTime,
        0.12,
        0.92,
        0.7
      )
    }

    if (kiteMotion.submersion > 0.01) {
      const movementBubbles = MathUtils.clamp(planarSpeed * 0.18, 0, 2.5)
      const emissionRate =
        16 +
        kiteMotion.submersion * 6 +
        movementBubbles +
        bubbleStormBoost * 10
      emissionBudget.current = Math.min(
        MAX_BUBBLE_EMISSION_BUDGET,
        emissionBudget.current + effectDelta * emissionRate
      )
    } else {
      emissionBudget.current = Math.min(emissionBudget.current, 0.35)
      nextPatternPoint.current = 0
    }

    let emittedThisFrame = 0
    while (emissionBudget.current >= 1 && emittedThisFrame < 3) {
      const bubble = bubbleState.current[nextBubble.current]
      nextBubble.current = (nextBubble.current + 1) % BUBBLE_COUNT
      emissionBudget.current -= 1
      emittedThisFrame += 1

      const patternIndex = nextPatternPoint.current
      const patternPoint = KITE_PARTICLE_PATTERN[patternIndex]
      nextPatternPoint.current =
        (patternIndex + 1) % KITE_PARTICLE_PATTERN.length
      const bubbleAggression = MathUtils.clamp(
        1 + bubbleStormBoost * 0.28,
        1,
        1.5
      )
      const riseSpeed =
        (0.48 + Math.random() * 0.32) *
        (1 + bubbleStormBoost * 0.22)
      const outlineJitterX = (Math.random() - 0.5) * 0.024
      const outlineJitterY = (Math.random() - 0.5) * 0.024
      const tailBubble = patternIndex >= 8 && patternIndex <= 11

      bubble.active = true
      bubble.age = 0
      bubble.phase = Math.random() * Math.PI * 2
      bubble.position.copy(kiteMotion.bubbleOrigin)
      // Keep the top point just under the surface at first contact. Each source
      // point is transformed by the real kite plane, so the particle drawing
      // follows its billboard orientation and tilt.
      bubble.position.y -= 0.33
      bubble.position.addScaledVector(
        kiteMotion.bubbleRight,
        patternPoint[0] + outlineJitterX
      )
      bubble.position.addScaledVector(
        kiteMotion.bubbleUp,
        patternPoint[1] + outlineJitterY
      )
      bubble.radius =
        (0.022 + Math.pow(Math.random(), 1.8) * 0.037) *
        (tailBubble ? 0.82 : 1) *
        bubbleAggression
      bubble.surfaceAge = -1
      bubble.velocity.set(
        MathUtils.clamp(kiteMotion.velocity.x * 0.035, -0.32, 0.32) +
          (Math.random() - 0.5) * 0.045 * bubbleAggression,
        riseSpeed,
        MathUtils.clamp(kiteMotion.velocity.z * 0.035, -0.32, 0.32) +
          (Math.random() - 0.5) * 0.045 * bubbleAggression
      )
      bubble.lifetime =
        Math.max(0, WATER_LEVEL - bubble.position.y) / riseSpeed +
        SURFACE_LIFETIME
    }

    let renderedBubbleCount = 0
    for (let index = 0; index < BUBBLE_COUNT; index += 1) {
      const bubble = bubbleState.current[index]

      if (bubble.active) {
        bubble.age += effectDelta

        if (bubble.surfaceAge < 0) {
          const wobble =
            Math.sin(
              state.clock.elapsedTime *
                (4.5 + bubbleStormBoost * 1.2) +
                bubble.phase
            ) *
            (0.035 + bubbleStormBoost * 0.012)
          bubble.position.x += (bubble.velocity.x + wobble) * effectDelta
          bubble.position.y += bubble.velocity.y * effectDelta
          bubble.position.z +=
            (bubble.velocity.z + Math.cos(bubble.phase) * 0.025) *
            effectDelta

          if (bubble.position.y >= WATER_LEVEL + 0.015) {
            bubble.position.y = WATER_LEVEL + 0.015
            bubble.surfaceAge = 0
            bubble.lifetime = bubble.age + SURFACE_LIFETIME
            const splashStrength = MathUtils.clamp(
              bubble.radius / 0.055,
              0.62,
              1.05
            )
            emitSplashBurst(
              bubble.position,
              BUBBLE_SPLASH_PARTICLE_COUNT,
              splashStrength,
              bubble.velocity
            )
          }
        } else {
          bubble.surfaceAge += effectDelta
          bubble.position.x += bubble.velocity.x * effectDelta * 0.5
          bubble.position.z += bubble.velocity.z * effectDelta * 0.5
        }

        if (bubble.age >= bubble.lifetime) {
          bubble.active = false
        }
      }

      if (!bubble.active) continue

      instanceTransform.position.copy(bubble.position)
      instanceTransform.rotation.set(0, 0, 0)
      const surfaceGrowth =
        bubble.surfaceAge >= 0 ? 1 + bubble.surfaceAge : 1
      const depthBelowSurface = Math.max(0, WATER_LEVEL - bubble.position.y)
      const surfaceClarity = smoothstep(1 - depthBelowSurface / 2.2)
      const pressureGrowth = MathUtils.lerp(0.78, 1, surfaceClarity)
      const scale = bubble.radius * surfaceGrowth * pressureGrowth
      const remainingLifetime = bubble.lifetime - bubble.age
      const opacity =
        smoothstep(remainingLifetime / BUBBLE_FADE_DURATION) * 0.66
      instanceTransform.scale.setScalar(scale)
      instanceTransform.updateMatrix()
      mesh.setMatrixAt(renderedBubbleCount, instanceTransform.matrix)
      outlineMesh.setMatrixAt(
        renderedBubbleCount,
        instanceTransform.matrix
      )
      opacityAttribute.setX(renderedBubbleCount, opacity)
      outlineOpacityAttribute.setX(renderedBubbleCount, opacity)
      renderedBubbleCount += 1
    }
    mesh.count = renderedBubbleCount
    outlineMesh.count = renderedBubbleCount

    const foamSurfaceBand =
      MathUtils.smoothstep(kiteMotion.submersion, 0.015, 0.12) *
      (1 - MathUtils.smoothstep(kiteMotion.submersion, 0.72, 0.96))
    const skimMotion = MathUtils.smoothstep(planarSpeed, 0.35, 1.6)
    const skimStrength = foamSurfaceBand * skimMotion
    const isKiteSkimming = skimStrength > 0.025
    timeSinceSkimSplash.current += effectDelta

    if (isKiteSkimming) {
      splashOrigin.set(
        kiteMotion.position.x,
        WATER_LEVEL + 0.035,
        kiteMotion.position.z
      )

      if (!wasKiteSkimming.current) {
        lastSkimPosition.current.copy(splashOrigin)
        skimMovementDistance.current = 0
        emitSplashBurst(
          splashOrigin,
          INITIAL_KITE_SPLASH_PARTICLE_COUNT,
          MathUtils.lerp(0.82, 1.18, skimStrength),
          kiteMotion.velocity
        )
        timeSinceSkimSplash.current = 0
      } else {
        const frameTravel = Math.hypot(
          splashOrigin.x - lastSkimPosition.current.x,
          splashOrigin.z - lastSkimPosition.current.z
        )
        lastSkimPosition.current.copy(splashOrigin)
        skimMovementDistance.current += Math.min(frameTravel, 0.35)
        const emissionDistance = MathUtils.lerp(
          0.48,
          0.26,
          MathUtils.clamp(planarSpeed / 7, 0, 1)
        )

        if (
          skimMovementDistance.current >= emissionDistance &&
          timeSinceSkimSplash.current >= 0.12
        ) {
          skimMovementDistance.current -= emissionDistance
          emitSplashBurst(
            splashOrigin,
            TRAILING_KITE_SPLASH_PARTICLE_COUNT,
            MathUtils.lerp(0.76, 1.08, skimStrength),
            kiteMotion.velocity
          )
          timeSinceSkimSplash.current = 0
        }
      }
    } else {
      skimMovementDistance.current = 0
      lastSkimPosition.current.set(
        kiteMotion.position.x,
        WATER_LEVEL + 0.035,
        kiteMotion.position.z
      )
    }
    wasKiteSkimming.current = isKiteSkimming

    let renderedSplashCrossCount = 0
    for (let index = 0; index < SPLASH_PARTICLE_COUNT; index += 1) {
      const particle = splashState.current[index]

      if (particle.active) {
        particle.age += effectDelta
        const drag = Math.exp(-SPLASH_LINEAR_DRAG * effectDelta)
        particle.velocity.multiplyScalar(drag)
        particle.velocity.y -= SPLASH_GRAVITY * effectDelta
        particle.position.addScaledVector(particle.velocity, effectDelta)
        particle.rotation.addScaledVector(
          particle.angularVelocity,
          effectDelta
        )

        if (
          particle.age >= particle.lifetime ||
          (particle.age > SPLASH_WATER_REENTRY_GRACE &&
            particle.position.y <= WATER_LEVEL)
        ) {
          particle.active = false
        }
      }

      if (!particle.active) continue

      instanceTransform.position.copy(particle.position)
      instanceTransform.rotation.set(
        particle.rotation.x,
        particle.rotation.y,
        particle.rotation.z
      )
      const remainingLifetime = particle.lifetime - particle.age
      const appear = MathUtils.smoothstep(
        particle.age,
        0,
        SPLASH_APPEAR_DURATION
      )
      const disappear = MathUtils.smoothstep(
        remainingLifetime,
        0,
        SPLASH_FADE_DURATION
      )
      const particleScale = particle.size * appear * disappear
      instanceTransform.scale.setScalar(particleScale)
      instanceTransform.updateMatrix()
      splashCrossMesh.setMatrixAt(
        renderedSplashCrossCount,
        instanceTransform.matrix
      )
      splashCrossOpacityAttribute.setX(
        renderedSplashCrossCount,
        disappear * SPLASH_MAX_OPACITY
      )
      renderedSplashCrossCount += 1
    }
    splashCrossMesh.count = renderedSplashCrossCount

    if (renderedBubbleCount > 0) {
      mesh.instanceMatrix.needsUpdate = true
      outlineMesh.instanceMatrix.needsUpdate = true
      opacityAttribute.needsUpdate = true
      outlineOpacityAttribute.needsUpdate = true
    }
    if (renderedSplashCrossCount > 0) {
      splashCrossMesh.instanceMatrix.needsUpdate = true
      splashCrossOpacityAttribute.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh
        ref={outlineMeshRef}
        args={[undefined, undefined, BUBBLE_COUNT]}
        frustumCulled={false}
        renderOrder={899}
      >
        <sphereGeometry args={[1, 6, 4]}>
          <instancedBufferAttribute
            attach="attributes-instanceOpacity"
            args={[opacityValues, 1]}
          />
        </sphereGeometry>
        <shaderMaterial
          depthTest={false}
          depthWrite={false}
          fragmentShader={outlineFragmentShader}
          side={BackSide}
          toneMapped={false}
          transparent
          uniforms={outlineUniforms}
          vertexShader={outlineVertexShader}
        />
      </instancedMesh>

      <instancedMesh
        ref={bubbleMeshRef}
        args={[undefined, undefined, BUBBLE_COUNT]}
        frustumCulled={false}
        renderOrder={900}
      >
        <sphereGeometry args={[1, 6, 4]}>
          <instancedBufferAttribute
            attach="attributes-instanceOpacity"
            args={[opacityValues, 1]}
          />
        </sphereGeometry>
        <shaderMaterial
          depthTest={false}
          depthWrite={false}
          fragmentShader={bubbleFragmentShader}
          toneMapped={false}
          transparent
          uniforms={bubbleUniforms}
          vertexShader={bubbleVertexShader}
        />
      </instancedMesh>

      <instancedMesh
        ref={splashCrossMeshRef}
        args={[undefined, undefined, SPLASH_PARTICLE_COUNT]}
        frustumCulled={false}
        renderOrder={910}
      >
        <primitive attach="geometry" object={splashCrossGeometry} />
        <shaderMaterial
          depthWrite={false}
          fragmentShader={splashFragmentShader}
          toneMapped={false}
          transparent
          uniforms={splashUniforms}
          vertexShader={splashVertexShader}
        />
      </instancedMesh>
    </>
  )
}
