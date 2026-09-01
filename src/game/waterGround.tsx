import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  MathUtils,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import { SUN_DIRECTION } from './sun'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { kiteMotion, WATER_LEVEL } from './kiteAnchors'
import { kiteLibraryCubeMotion } from './kiteLibraryCubeMotion'
import { setDiscoColor } from './discoPalette'

const WATER_SIZE = 1400
const REFLECTION_RESOLUTION = 256
// At the fastest emission cadence, twelve slots cover the complete ripple
// lifetime without recycling a ring while it is still visibly expanding.
const KITE_RIPPLE_COUNT = 12
const KITE_RIPPLE_LIFETIME = 2.8
const KITE_FOAM_COUNT = 6
const KITE_FOAM_LIFETIME = 0.62
const SURFACE_CONTACT_GRACE = 0.14

type KiteRippleEvent = {
  active: boolean
  age: number
  center: Vector2
  strength: number
}

type CubeRippleState = {
  contactDuration: number
  lastSurfacePosition: Vector2
  movementDistance: number
  previousSubmersion: number
  timeAboveSurface: number
  timeSinceEmission: number
}

function createCubeRippleState(): CubeRippleState {
  return {
    contactDuration: 0,
    lastSurfacePosition: new Vector2(),
    movementDistance: 0,
    previousSubmersion: 0,
    timeAboveSurface: Number.POSITIVE_INFINITY,
    timeSinceEmission: 0,
  }
}

function emitRippleEvent(
  events: KiteRippleEvent[],
  firstIndex: number,
  position: Vector3,
  strength: number
) {
  let rippleIndex = -1
  for (let offset = 0; offset < KITE_RIPPLE_COUNT; offset += 1) {
    const index = (firstIndex + offset) % KITE_RIPPLE_COUNT
    if (!events[index].active) {
      rippleIndex = index
      break
    }
  }
  if (rippleIndex === -1) {
    rippleIndex = events.reduce(
      (oldestIndex, ripple, index, ripples) =>
        ripple.age > ripples[oldestIndex].age ? index : oldestIndex,
      0
    )
  }

  const ripple = events[rippleIndex]
  ripple.active = true
  ripple.age = 0
  ripple.center.set(position.x, position.z)
  ripple.strength = strength
  return (rippleIndex + 1) % KITE_RIPPLE_COUNT
}

const radialPulseShader = /* glsl */ `
  uniform vec2 pulseCenter;
  uniform float pulseSpeed;
  uniform float pulseWidth;
  uniform float reflectionClarity;
  uniform float waterFadeStart;
  uniform float waterFadeEnd;
  uniform vec2 kiteRingCenters[${KITE_RIPPLE_COUNT}];
  uniform float kiteRingAges[${KITE_RIPPLE_COUNT}];
  uniform float kiteRingStrengths[${KITE_RIPPLE_COUNT}];
  uniform vec2 kiteWakeCenter;
  uniform vec2 kiteWakeVelocity;
  uniform float kiteWakeStrength;
  uniform vec2 cubeWakeCenter;
  uniform vec2 cubeWakeVelocity;
  uniform float cubeWakeStrength;
  uniform vec2 kiteFoamCenter;
  uniform vec2 kiteFoamCenters[${KITE_FOAM_COUNT}];
  uniform float kiteFoamAges[${KITE_FOAM_COUNT}];
  uniform float kiteFoamStrengths[${KITE_FOAM_COUNT}];
  uniform float kiteFoamStrength;
  const float inactiveEffectThreshold = 0.001;
  const float foamMaximumDistanceFromKite = 1.35;
  const float foamRadialCullWidth = 0.12;
  const float rippleGaussianCutoffWidths = 3.0;

  float pixelHash(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  }

  float kiteSurfaceFroth(vec2 worldPosition) {
    const float pixelsPerUnit = 14.0;
    float froth = 0.0;

    if (kiteFoamStrength <= inactiveEffectThreshold) return 0.0;

    // Every slot is one independent, hard-edged pixel ring. The CPU activates
    // only one slot per skim event; there is no generated companion ring.
    for (int index = 0; index < ${KITE_FOAM_COUNT}; index += 1) {
      float eventStrength = kiteFoamStrengths[index];
      if (eventStrength <= inactiveEffectThreshold) continue;
      float distanceFromKite = length(
        kiteFoamCenters[index] - kiteFoamCenter
      );
      if (distanceFromKite >= foamMaximumDistanceFromKite) continue;
      vec2 fromRing = worldPosition - kiteFoamCenters[index];
      vec2 pixelPosition = (
        floor(fromRing * pixelsPerUnit) + 0.5
      ) / pixelsPerUnit;
      float radius = length(pixelPosition);
      float age = kiteFoamAges[index];
      float ringRadius = 0.1 + age * 0.95;
      if (abs(radius - ringRadius) >= foamRadialCullWidth) continue;
      float angularCell = floor(
        (atan(pixelPosition.y, pixelPosition.x) + 3.14159265) * 7.0
      );
      float ringJitter = (
        pixelHash(vec2(angularCell, float(index) * 17.0 + 3.0)) - 0.5
      ) * 0.1;
      float ringLine = 1.0 - step(
        0.058,
        abs(radius - (ringRadius + ringJitter))
      );
      float ageFade = 1.0 - smoothstep(0.34, 0.62, age);
      float nearKite = 1.0 - smoothstep(0.65, 1.35, distanceFromKite);
      float eventFroth = ringLine
        * ageFade
        * nearKite
        * eventStrength;
      froth = max(froth, eventFroth);
    }

    return froth * kiteFoamStrength;
  }

  float gaussianPulseSlope(float distanceFromPulse, float width) {
    const float waveHeight = 0.09;
    float normalizedDistance = distanceFromPulse / width;
    float envelope = exp(-0.5 * normalizedDistance * normalizedDistance);
    return -waveHeight * distanceFromPulse * envelope / (width * width);
  }

  vec2 expandingKiteRing(
    vec2 worldPosition,
    vec2 center,
    float age,
    float strength
  ) {
    float radius = length(worldPosition - center);
    vec2 direction = (worldPosition - center) / max(radius, 0.001);
    float ringRadius = age * 2.2;
    float distanceFromRing = radius - ringRadius;
    float ringWidth = 0.34 + age * 0.07;
    if (
      abs(distanceFromRing) >= ringWidth * rippleGaussianCutoffWidths
    ) return vec2(0.0);
    float ageFade = 1.0 - smoothstep(1.65, 2.8, age);
    float originFade = smoothstep(0.0, 0.32, ringRadius);
    float slope = gaussianPulseSlope(distanceFromRing, ringWidth)
      * strength
      * ageFade
      * originFade;
    return direction * clamp(slope, -0.13, 0.13);
  }

  vec2 movingSurfaceWake(
    vec2 worldPosition,
    vec2 wakeCenter,
    vec2 wakeVelocity,
    float wakeStrength
  ) {
    if (wakeStrength <= inactiveEffectThreshold) return vec2(0.0);
    vec2 fromSource = worldPosition - wakeCenter;
    float sourceSpeed = length(wakeVelocity);
    vec2 travelDirection = wakeVelocity / max(sourceSpeed, 0.001);
    vec2 wakeSide = vec2(-travelDirection.y, travelDirection.x);
    float alongWake = dot(fromSource, travelDirection);
    float acrossWake = dot(fromSource, wakeSide);
    float behindSource = 1.0 - smoothstep(-0.4, 0.8, alongWake);
    float wakeEnvelope = behindSource
      * exp(-abs(acrossWake) * 0.72)
      * exp(-max(-alongWake, 0.0) * 0.16);
    float moving = smoothstep(0.15, 2.5, sourceSpeed);
    float wakeSlope = sin(
      acrossWake * 5.0 + alongWake * 1.15 - time * 4.2
    ) * wakeEnvelope * moving * 0.018 * wakeStrength;
    return wakeSide * wakeSlope;
  }

  vec4 getNoise(vec2 worldPosition) {
    vec2 fromCenter = worldPosition - pulseCenter;
    float radius = length(fromCenter);
    vec2 radialDirection = fromCenter / max(radius, 0.001);

    const float pulseSpacing = 11.0;
    float width = max(pulseWidth, 0.15);
    float travelledDistance = radius - time * pulseSpeed;
    float distanceFromPulse = mod(
      travelledDistance + pulseSpacing * 0.5,
      pulseSpacing
    ) - pulseSpacing * 0.5;

    // The derivative of a Gaussian pulse gives the surface slope used by the
    // reflection shader. It makes a smooth crest rather than a sharp sine ring.
    float radialSlope =
      gaussianPulseSlope(distanceFromPulse - pulseSpacing, width) +
      gaussianPulseSlope(distanceFromPulse, width) +
      gaussianPulseSlope(distanceFromPulse + pulseSpacing, width);

    // Avoid a singular normal where every ring is emitted from the player.
    radialSlope *= smoothstep(0.0, 1.5, radius);
    radialSlope *= 1.0 - smoothstep(90.0, 240.0, radius);
    radialSlope = clamp(radialSlope, -0.16, 0.16);

    vec2 gradient = radialDirection * radialSlope;

    // Each contact event contributes exactly one expanding ring. Additional
    // slots are activated progressively by actual kite travel on the CPU.
    for (int index = 0; index < ${KITE_RIPPLE_COUNT}; index += 1) {
      float ringStrength = kiteRingStrengths[index];
      if (ringStrength <= inactiveEffectThreshold) continue;
      gradient += expandingKiteRing(
        worldPosition,
        kiteRingCenters[index],
        kiteRingAges[index],
        ringStrength
      );
    }

    // Restrained directional wakes appear only while a source is moving.
    gradient += movingSurfaceWake(
      worldPosition,
      kiteWakeCenter,
      kiteWakeVelocity,
      kiteWakeStrength
    );
    gradient += movingSurfaceWake(
      worldPosition,
      cubeWakeCenter,
      cubeWakeVelocity,
      cubeWakeStrength
    );

    vec3 tangentNormal = normalize(vec3(-gradient.x, -gradient.y, 1.0));
    return vec4(tangentNormal, 1.0);
  }

`

function applyRadialPulseShader(material: ShaderMaterial) {
  const functionStart = material.fragmentShader.indexOf('vec4 getNoise')
  const functionEnd = material.fragmentShader.indexOf('void sunLight')
  const waterOutput = 'gl_FragColor = vec4( outgoingLight, alpha );'
  const fresnelBase = 'float rf0 = 0.02;'
  const waterScatter =
    'vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;'

  if (
    functionStart === -1 ||
    functionEnd === -1 ||
    !material.fragmentShader.includes(waterOutput) ||
    !material.fragmentShader.includes(fresnelBase) ||
    !material.fragmentShader.includes(waterScatter)
  ) {
    throw new Error('Unable to locate the Three.js water noise shader')
  }

  material.uniforms.pulseCenter = { value: new Vector2() }
  material.uniforms.pulseSpeed = { value: 3.8 }
  material.uniforms.pulseWidth = { value: 2.6 }
  material.uniforms.reflectionClarity = { value: 0.67 }
  material.uniforms.waterFadeStart = { value: 120 }
  material.uniforms.waterFadeEnd = { value: 360 }
  material.uniforms.kiteRingCenters = {
    value: Array.from({ length: KITE_RIPPLE_COUNT }, () => new Vector2()),
  }
  material.uniforms.kiteRingAges = {
    value: new Float32Array(KITE_RIPPLE_COUNT).fill(KITE_RIPPLE_LIFETIME),
  }
  material.uniforms.kiteRingStrengths = {
    value: new Float32Array(KITE_RIPPLE_COUNT),
  }
  material.uniforms.kiteWakeCenter = { value: new Vector2() }
  material.uniforms.kiteWakeVelocity = { value: new Vector2() }
  material.uniforms.kiteWakeStrength = { value: 0 }
  material.uniforms.cubeWakeCenter = { value: new Vector2() }
  material.uniforms.cubeWakeVelocity = { value: new Vector2() }
  material.uniforms.cubeWakeStrength = { value: 0 }
  material.uniforms.kiteFoamCenter = { value: new Vector2() }
  material.uniforms.kiteFoamCenters = {
    value: Array.from({ length: KITE_FOAM_COUNT }, () => new Vector2()),
  }
  material.uniforms.kiteFoamAges = {
    value: new Float32Array(KITE_FOAM_COUNT).fill(KITE_FOAM_LIFETIME),
  }
  material.uniforms.kiteFoamStrengths = {
    value: new Float32Array(KITE_FOAM_COUNT),
  }
  material.uniforms.kiteFoamStrength = { value: 0 }
  material.fragmentShader =
    material.fragmentShader.slice(0, functionStart) +
    radialPulseShader +
    material.fragmentShader.slice(functionEnd)

  const reflectionStart = material.fragmentShader.indexOf(
    'vec2 distortion = surfaceNormal.xz'
  )
  const reflectionEnd = material.fragmentShader.indexOf(
    'float theta =',
    reflectionStart
  )

  if (reflectionStart === -1 || reflectionEnd === -1) {
    throw new Error('Unable to locate the Three.js water reflection sample')
  }

  material.fragmentShader =
    material.fragmentShader.slice(0, reflectionStart) +
    /* glsl */ `
      float grazingAngle = abs(dot(eyeDirection, vec3(0.0, 1.0, 0.0)));
      float distortionFade = smoothstep(0.015, 0.12, grazingAngle);
      vec2 distortion = surfaceNormal.xz
        * (0.001 + 1.0 / distance)
        * distortionScale
        * distortionFade;

      vec2 reflectionUv = mirrorCoord.xy / max(mirrorCoord.w, 0.0001)
        + distortion;
      float reflectionEdgeDistance = min(
        min(reflectionUv.x, 1.0 - reflectionUv.x),
        min(reflectionUv.y, 1.0 - reflectionUv.y)
      );
      vec2 safeReflectionUv = clamp(
        reflectionUv,
        vec2(0.008),
        vec2(0.992)
      );
      vec3 reflectedColor = vec3(
        texture2D(mirrorSampler, safeReflectionUv)
      );
      float validReflection = smoothstep(
        0.0,
        0.025,
        reflectionEdgeDistance
      );
      vec3 reflectionSample = mix(fogColor, reflectedColor, validReflection);
      float pulseSlopeHighlight = smoothstep(
        0.004,
        0.04,
        length(surfaceNormal.xz)
      );
      float reflectedBrightness = dot(
        reflectionSample,
        vec3(0.2126, 0.7152, 0.0722)
      );
      vec3 lightColoredReflection = sunColor
        * mix(0.55, 1.35, reflectedBrightness);
      reflectionSample = mix(
        reflectionSample,
        lightColoredReflection,
        pulseSlopeHighlight * 0.9
      );

    ` +
    material.fragmentShader.slice(reflectionEnd)

  material.fragmentShader = material.fragmentShader.replace(
    waterOutput,
    /* glsl */ `
      float fogDistance = max(
        distance - waterFadeStart * 0.15,
        0.0
      );
      float distanceMist = 1.0 - exp(
        -fogDistance / max(waterFadeEnd * 0.55, 0.001)
      );
      float grazingMist = 1.0 - smoothstep(
        0.035,
        0.32,
        grazingAngle
      );
      float waterFogAmount = clamp(
        distanceMist * mix(0.32, 1.0, grazingMist),
        0.0,
        1.0
      );
      vec3 horizonMatchedWater = mix(
        outgoingLight,
        fogColor,
        waterFogAmount
      );
      float kiteFoam = kiteSurfaceFroth(worldPosition.xz)
        * (1.0 - waterFogAmount);
      vec3 foamColor = mix(vec3(0.8, 0.92, 1.0), vec3(1.0), 0.72);
      vec3 waterWithFroth = mix(
        horizonMatchedWater,
        foamColor,
        kiteFoam * 0.82
      );
      gl_FragColor = vec4(waterWithFroth, alpha);
    `
  )
  material.fragmentShader = material.fragmentShader
    .replace(
      fresnelBase,
      'float rf0 = mix(0.02, 0.16, clamp(reflectionClarity, 0.0, 1.0));'
    )
    .replace(
      waterScatter,
      `vec3 scatter = max(
        0.0,
        dot(surfaceNormal, eyeDirection)
      ) * waterColor * mix(1.0, 0.52, reflectionClarity);`
    )
  material.needsUpdate = true
}

type WaterGroundProps = {
  discoMode: boolean
  pulseSpeed: number
  pulseWidth: number
  reflectionClarity: number
  lightColor: string
  waterColor: string
}

export function WaterGround({
  discoMode,
  pulseSpeed,
  pulseWidth,
  reflectionClarity,
  lightColor,
  waterColor,
}: WaterGroundProps) {
  const waterRef = useRef<Water>(null)
  const previousSubmersion = useRef(0)
  const timeAboveSurface = useRef(Number.POSITIVE_INFINITY)
  const contactDuration = useRef(0)
  const movementDistance = useRef(0)
  const timeSinceEmission = useRef(0)
  const foamMovementDistance = useRef(0)
  const timeSinceFoamEmission = useRef(Number.POSITIVE_INFINITY)
  const wasFoamSkimming = useRef(false)
  const foamStrength = useRef(0)
  const nextRipple = useRef(0)
  const nextFoam = useRef(0)
  const cubeRippleState = useRef(createCubeRippleState())
  const lastSurfacePosition = useRef(new Vector2())
  const lastFoamPosition = useRef(new Vector2())
  const rippleEvents = useRef<KiteRippleEvent[]>(
    Array.from({ length: KITE_RIPPLE_COUNT }, () => ({
      active: false,
      age: KITE_RIPPLE_LIFETIME,
      center: new Vector2(),
      strength: 0,
    }))
  )
  const foamEvents = useRef<KiteRippleEvent[]>(
    Array.from({ length: KITE_FOAM_COUNT }, () => ({
      active: false,
      age: KITE_FOAM_LIFETIME,
      center: new Vector2(),
      strength: 0,
    }))
  )
  const water = useMemo(() => {
    const geometry = new PlaneGeometry(WATER_SIZE, WATER_SIZE)
    const surface = new Water(geometry, {
      textureWidth: REFLECTION_RESOLUTION,
      textureHeight: REFLECTION_RESOLUTION,
      sunDirection: new Vector3(...SUN_DIRECTION).normalize(),
      sunColor: '#43a758',
      waterColor: '#4069c9',
      distortionScale: 0.85,
      alpha: 1,
      fog: true,
    })

    applyRadialPulseShader(surface.material)
    surface.rotation.x = -Math.PI / 2
    surface.position.y = WATER_LEVEL
    surface.frustumCulled = false
    return surface
  }, [])

  useEffect(
    () => () => {
      water.geometry.dispose()
      water.material.dispose()
    },
    [water]
  )

  useFrame((state, delta) => {
    if (!waterRef.current) return

    const uniforms = waterRef.current.material.uniforms
    const elapsed = state.clock.elapsedTime
    uniforms.time.value = elapsed
    uniforms.pulseCenter.value.set(state.camera.position.x, state.camera.position.z)
    uniforms.pulseSpeed.value = pulseSpeed
    uniforms.pulseWidth.value = pulseWidth
    uniforms.reflectionClarity.value = reflectionClarity
    if (discoMode) {
      setDiscoColor(
        uniforms.sunColor.value,
        elapsed,
        0.2,
        1,
        0.68
      )
      setDiscoColor(
        uniforms.waterColor.value,
        elapsed,
        0.66,
        0.88,
        0.43
      )
    } else {
      uniforms.sunColor.value.set(lightColor)
      uniforms.waterColor.value.set(waterColor)
    }

    for (const ripple of rippleEvents.current) {
      if (!ripple.active) continue
      ripple.age += delta
      if (ripple.age >= KITE_RIPPLE_LIFETIME) ripple.active = false
    }
    for (const foam of foamEvents.current) {
      if (!foam.active) continue
      foam.age += delta
      if (foam.age >= KITE_FOAM_LIFETIME) foam.active = false
    }

    const planarSpeed = Math.hypot(
      kiteMotion.velocity.x,
      kiteMotion.velocity.z
    )
    const depthBelowSurface = Math.max(
      0,
      WATER_LEVEL - kiteMotion.position.y
    )
    const surfaceProximity = Math.exp(-depthBelowSurface * 0.48)
    const isSubmerged = kiteMotion.submersion > 0.02
    const crossedIntoWater =
      isSubmerged && previousSubmersion.current <= 0.02
    const justEntered =
      crossedIntoWater &&
      timeAboveSurface.current >= SURFACE_CONTACT_GRACE
    if (isSubmerged) {
      timeAboveSurface.current = 0
    } else {
      timeAboveSurface.current += delta
    }
    timeSinceEmission.current += delta

    let emitStrength = 0
    if (justEntered) {
      // First contact creates one initial ring. Existing rings keep fading so
      // grazing the surface cannot erase the wake behind the kite.
      emitStrength = surfaceProximity
      contactDuration.current = 0
      movementDistance.current = 0
      lastSurfacePosition.current.set(
        kiteMotion.position.x,
        kiteMotion.position.z
      )
    } else if (isSubmerged) {
      contactDuration.current += delta
      const frameTravel = Math.hypot(
        kiteMotion.position.x - lastSurfacePosition.current.x,
        kiteMotion.position.z - lastSurfacePosition.current.y
      )
      lastSurfacePosition.current.set(
        kiteMotion.position.x,
        kiteMotion.position.z
      )
      // Count only horizontal travel after contact. Vertical impact speed was
      // causing several follow-up rings before the player dragged the kite.
      movementDistance.current += Math.min(frameTravel, 0.4)
      const speedFactor = MathUtils.clamp(planarSpeed / 8, 0, 1)
      const emissionDistance = MathUtils.lerp(1.5, 0.8, speedFactor)

      if (
        contactDuration.current >= 0.7 &&
        movementDistance.current >= emissionDistance &&
        timeSinceEmission.current >= 0.24
      ) {
        movementDistance.current -= emissionDistance
        emitStrength =
          (0.38 + MathUtils.clamp(planarSpeed * 0.085, 0, 0.7)) *
          surfaceProximity
      }
    } else if (timeAboveSurface.current >= SURFACE_CONTACT_GRACE) {
      // Treat very brief exits as continuous surface contact. This prevents
      // threshold jitter while skimming from restarting the wake every frame.
      contactDuration.current = 0
      movementDistance.current = 0
    }

    if (emitStrength > 0) {
      // Prefer a free slot. If an unusually rapid series of contacts fills the
      // pool, replace the oldest (already almost transparent) ring rather than
      // blindly overwriting a young, prominent one.
      nextRipple.current = emitRippleEvent(
        rippleEvents.current,
        nextRipple.current,
        kiteMotion.position,
        emitStrength
      )
      timeSinceEmission.current = 0
    }

    const cubeState = cubeRippleState.current
    const cubeContactOffset = kiteLibraryCubeMotion.waterContactOffset
    const cubeIsActive =
      kiteLibraryCubeMotion.active && cubeContactOffset > 0
    const cubeDepthBelowSurface = cubeIsActive
      ? Math.max(
          0,
          WATER_LEVEL +
            cubeContactOffset -
            kiteLibraryCubeMotion.position.y
        )
      : 0
    const cubeSubmersion =
      cubeContactOffset > 0
        ? MathUtils.clamp(
            cubeDepthBelowSurface / cubeContactOffset,
            0,
            1
          )
        : 0
    const cubePlanarSpeed = Math.hypot(
      kiteLibraryCubeMotion.velocity.x,
      kiteLibraryCubeMotion.velocity.z
    )
    const cubeSurfaceProximity = Math.exp(
      -cubeDepthBelowSurface * 0.48
    )
    const cubeIsSubmerged = cubeIsActive && cubeDepthBelowSurface > 0.02
    const cubeJustEntered =
      cubeIsSubmerged &&
      cubeState.previousSubmersion <= 0.02 &&
      cubeState.timeAboveSurface >= SURFACE_CONTACT_GRACE

    if (cubeIsSubmerged) {
      cubeState.timeAboveSurface = 0
    } else {
      cubeState.timeAboveSurface += delta
    }
    cubeState.timeSinceEmission += delta

    let cubeEmitStrength = 0
    if (cubeJustEntered) {
      cubeEmitStrength = cubeSurfaceProximity
      cubeState.contactDuration = 0
      cubeState.movementDistance = 0
      cubeState.lastSurfacePosition.set(
        kiteLibraryCubeMotion.position.x,
        kiteLibraryCubeMotion.position.z
      )
    } else if (cubeIsSubmerged) {
      cubeState.contactDuration += delta
      const cubeFrameTravel = Math.hypot(
        kiteLibraryCubeMotion.position.x -
          cubeState.lastSurfacePosition.x,
        kiteLibraryCubeMotion.position.z -
          cubeState.lastSurfacePosition.y
      )
      cubeState.lastSurfacePosition.set(
        kiteLibraryCubeMotion.position.x,
        kiteLibraryCubeMotion.position.z
      )
      cubeState.movementDistance += Math.min(cubeFrameTravel, 0.4)
      const cubeSpeedFactor = MathUtils.clamp(cubePlanarSpeed / 8, 0, 1)
      const cubeEmissionDistance = MathUtils.lerp(
        1.5,
        0.8,
        cubeSpeedFactor
      )

      if (
        cubeState.contactDuration >= 0.7 &&
        cubeState.movementDistance >= cubeEmissionDistance &&
        cubeState.timeSinceEmission >= 0.24
      ) {
        cubeState.movementDistance -= cubeEmissionDistance
        cubeEmitStrength =
          (0.38 + MathUtils.clamp(cubePlanarSpeed * 0.085, 0, 0.7)) *
          cubeSurfaceProximity
      }
    } else if (
      cubeState.timeAboveSurface >= SURFACE_CONTACT_GRACE
    ) {
      cubeState.contactDuration = 0
      cubeState.movementDistance = 0
    }

    if (cubeEmitStrength > 0) {
      nextRipple.current = emitRippleEvent(
        rippleEvents.current,
        nextRipple.current,
        kiteLibraryCubeMotion.position,
        cubeEmitStrength
      )
      cubeState.timeSinceEmission = 0
    }
    cubeState.previousSubmersion = cubeSubmersion

    const ringCenters = uniforms.kiteRingCenters.value as Vector2[]
    const ringAges = uniforms.kiteRingAges.value as Float32Array
    const ringStrengths = uniforms.kiteRingStrengths.value as Float32Array
    for (let index = 0; index < KITE_RIPPLE_COUNT; index += 1) {
      const ripple = rippleEvents.current[index]
      ringCenters[index].copy(ripple.center)
      ringAges[index] = ripple.age
      ringStrengths[index] = ripple.active ? ripple.strength : 0
    }

    uniforms.kiteWakeCenter.value.set(
      kiteMotion.position.x,
      kiteMotion.position.z
    )
    uniforms.kiteWakeVelocity.value.set(
      kiteMotion.velocity.x,
      kiteMotion.velocity.z
    )
    uniforms.kiteWakeStrength.value =
      kiteMotion.submersion *
      MathUtils.smoothstep(planarSpeed, 0.15, 2.5) *
      MathUtils.smoothstep(contactDuration.current, 0.65, 1.15) *
      surfaceProximity
    uniforms.cubeWakeCenter.value.set(
      kiteLibraryCubeMotion.position.x,
      kiteLibraryCubeMotion.position.z
    )
    uniforms.cubeWakeVelocity.value.set(
      kiteLibraryCubeMotion.velocity.x,
      kiteLibraryCubeMotion.velocity.z
    )
    uniforms.cubeWakeStrength.value =
      cubeSubmersion *
      MathUtils.smoothstep(cubePlanarSpeed, 0.15, 2.5) *
      MathUtils.smoothstep(cubeState.contactDuration, 0.65, 1.15) *
      cubeSurfaceProximity
    const foamSurfaceBand =
      MathUtils.smoothstep(kiteMotion.submersion, 0.015, 0.12) *
      (1 - MathUtils.smoothstep(kiteMotion.submersion, 0.72, 0.96))
    const foamSkimMotion = MathUtils.smoothstep(
      planarSpeed,
      0.35,
      1.6
    )
    const targetFoamStrength = foamSurfaceBand * foamSkimMotion
    const isFoamSkimming = targetFoamStrength > 0.025
    timeSinceFoamEmission.current += delta

    let emitFoamStrength = 0
    if (isFoamSkimming) {
      if (!wasFoamSkimming.current) {
        // The first valid skim frame emits exactly one close contact ring.
        lastFoamPosition.current.set(
          kiteMotion.position.x,
          kiteMotion.position.z
        )
        foamMovementDistance.current = 0
        emitFoamStrength = MathUtils.lerp(
          0.72,
          1,
          targetFoamStrength
        )
      } else {
        const foamFrameTravel = Math.hypot(
          kiteMotion.position.x - lastFoamPosition.current.x,
          kiteMotion.position.z - lastFoamPosition.current.y
        )
        lastFoamPosition.current.set(
          kiteMotion.position.x,
          kiteMotion.position.z
        )
        foamMovementDistance.current += Math.min(foamFrameTravel, 0.35)
        const skimSpeedFactor = MathUtils.clamp(planarSpeed / 7, 0, 1)
        const foamEmissionDistance = MathUtils.lerp(
          0.48,
          0.26,
          skimSpeedFactor
        )

        if (
          foamMovementDistance.current >= foamEmissionDistance &&
          timeSinceFoamEmission.current >= 0.12
        ) {
          foamMovementDistance.current -= foamEmissionDistance
          emitFoamStrength = MathUtils.lerp(
            0.72,
            1,
            targetFoamStrength
          )
        }
      }
    } else {
      foamMovementDistance.current = 0
      lastFoamPosition.current.set(
        kiteMotion.position.x,
        kiteMotion.position.z
      )
    }
    wasFoamSkimming.current = isFoamSkimming

    if (emitFoamStrength > 0) {
      let foamIndex = -1
      for (let offset = 0; offset < KITE_FOAM_COUNT; offset += 1) {
        const index = (nextFoam.current + offset) % KITE_FOAM_COUNT
        if (!foamEvents.current[index].active) {
          foamIndex = index
          break
        }
      }
      if (foamIndex === -1) {
        foamIndex = foamEvents.current.reduce(
          (oldestIndex, foam, index, events) =>
            foam.age > events[oldestIndex].age ? index : oldestIndex,
          0
        )
      }

      const foam = foamEvents.current[foamIndex]
      foam.active = true
      foam.age = 0
      foam.center.set(kiteMotion.position.x, kiteMotion.position.z)
      foam.strength = emitFoamStrength
      nextFoam.current = (foamIndex + 1) % KITE_FOAM_COUNT
      timeSinceFoamEmission.current = 0
    }

    const foamFollow =
      1 -
      Math.exp(
        -delta * (targetFoamStrength > foamStrength.current ? 18 : 14)
      )
    foamStrength.current = MathUtils.lerp(
      foamStrength.current,
      targetFoamStrength,
      foamFollow
    )
    uniforms.kiteFoamCenter.value.set(
      kiteMotion.position.x,
      kiteMotion.position.z
    )
    uniforms.kiteFoamStrength.value = foamStrength.current
    const foamCenters = uniforms.kiteFoamCenters.value as Vector2[]
    const foamAges = uniforms.kiteFoamAges.value as Float32Array
    const foamStrengths = uniforms.kiteFoamStrengths.value as Float32Array
    for (let index = 0; index < KITE_FOAM_COUNT; index += 1) {
      const foam = foamEvents.current[index]
      foamCenters[index].copy(foam.center)
      foamAges[index] = foam.age
      foamStrengths[index] = foam.active ? foam.strength : 0
    }
    previousSubmersion.current = kiteMotion.submersion

  })

  return <primitive ref={waterRef} object={water} />
}
