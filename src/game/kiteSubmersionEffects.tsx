import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BackSide,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Object3D,
  Vector3,
} from 'three'
import { kiteMotion, WATER_LEVEL } from './kiteAnchors'
import { setDiscoColor } from './discoPalette'

const BUBBLE_COUNT = 80
const BUBBLE_FADE_DURATION = 0.5
const SURFACE_LIFETIME = 0.6
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

type KiteSubmersionEffectsProps = {
  bubbleColor: string
  discoMode: boolean
  lightColor: string
  windSpeed: number
}

export function KiteSubmersionEffects({
  bubbleColor,
  discoMode,
  lightColor,
  windSpeed,
}: KiteSubmersionEffectsProps) {
  const bubbleMeshRef = useRef<InstancedMesh>(null)
  const outlineMeshRef = useRef<InstancedMesh>(null)
  const emissionBudget = useRef(0)
  const nextPatternPoint = useRef(0)
  const nextBubble = useRef(0)
  const opacityValues = useMemo(() => new Float32Array(BUBBLE_COUNT), [])
  const bubbleUniforms = useMemo(
    () => ({
      uBubbleColor: { value: new Color(bubbleColor) },
      uLightColor: { value: new Color(lightColor) },
      uWaterLevel: { value: WATER_LEVEL },
    }),
    [bubbleColor, lightColor]
  )
  const outlineUniforms = useMemo(
    () => ({ uWaterLevel: { value: WATER_LEVEL } }),
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

  useFrame((state, delta) => {
    const mesh = bubbleMeshRef.current
    const outlineMesh = outlineMeshRef.current
    if (!mesh || !outlineMesh) return
    const opacityAttribute = mesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute
    const outlineOpacityAttribute = outlineMesh.geometry.getAttribute(
      'instanceOpacity'
    ) as InstancedBufferAttribute

    const planarSpeed = Math.hypot(
      kiteMotion.velocity.x,
      kiteMotion.velocity.z
    )
    const bubbleStormBoost =
      Math.exp(Math.max(0, windSpeed - 5) * 0.18) - 1

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
    } else {
      bubbleUniforms.uBubbleColor.value.set(bubbleColor)
      bubbleUniforms.uLightColor.value.set(lightColor)
    }

    if (kiteMotion.submersion > 0.01) {
      const movementBubbles = MathUtils.clamp(planarSpeed * 0.18, 0, 2.5)
      const emissionRate =
        16 +
        kiteMotion.submersion * 6 +
        movementBubbles +
        bubbleStormBoost * 10
      emissionBudget.current += delta * emissionRate
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

    for (let index = 0; index < BUBBLE_COUNT; index += 1) {
      const bubble = bubbleState.current[index]

      if (bubble.active) {
        bubble.age += delta

        if (bubble.surfaceAge < 0) {
          const wobble =
            Math.sin(
              state.clock.elapsedTime *
                (4.5 + bubbleStormBoost * 1.2) +
                bubble.phase
            ) *
            (0.035 + bubbleStormBoost * 0.012)
          bubble.position.x += (bubble.velocity.x + wobble) * delta
          bubble.position.y += bubble.velocity.y * delta
          bubble.position.z +=
            (bubble.velocity.z + Math.cos(bubble.phase) * 0.025) * delta

          if (bubble.position.y >= WATER_LEVEL + 0.015) {
            bubble.position.y = WATER_LEVEL + 0.015
            bubble.surfaceAge = 0
            bubble.lifetime = bubble.age + SURFACE_LIFETIME
          }
        } else {
          bubble.surfaceAge += delta
          bubble.position.x += bubble.velocity.x * delta * 0.5
          bubble.position.z += bubble.velocity.z * delta * 0.5
        }

        if (bubble.age >= bubble.lifetime) {
          bubble.active = false
        }
      }

      instanceTransform.position.copy(
        bubble.active ? bubble.position : hiddenPosition
      )
      const surfaceGrowth =
        bubble.surfaceAge >= 0 ? 1 + bubble.surfaceAge : 1
      const depthBelowSurface = Math.max(0, WATER_LEVEL - bubble.position.y)
      const surfaceClarity = smoothstep(1 - depthBelowSurface / 2.2)
      const pressureGrowth = MathUtils.lerp(0.78, 1, surfaceClarity)
      const scale = bubble.active
        ? bubble.radius * surfaceGrowth * pressureGrowth
        : 0
      const remainingLifetime = bubble.lifetime - bubble.age
      const opacity = bubble.active
        ? smoothstep(remainingLifetime / BUBBLE_FADE_DURATION) * 0.66
        : 0
      instanceTransform.scale.setScalar(scale)
      instanceTransform.updateMatrix()
      mesh.setMatrixAt(index, instanceTransform.matrix)
      outlineMesh.setMatrixAt(index, instanceTransform.matrix)
      opacityAttribute.setX(index, opacity)
      outlineOpacityAttribute.setX(index, opacity)
    }

    mesh.instanceMatrix.needsUpdate = true
    outlineMesh.instanceMatrix.needsUpdate = true
    opacityAttribute.needsUpdate = true
    outlineOpacityAttribute.needsUpdate = true
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
    </>
  )
}
