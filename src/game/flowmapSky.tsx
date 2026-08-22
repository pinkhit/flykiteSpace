import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  ShaderMaterial,
  UnsignedByteType,
} from 'three'
import { setDiscoColor } from './discoPalette'

const TAU = Math.PI * 2

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function hash(x: number, y: number, seed: number) {
  const value =
    Math.sin(x * 127.1 + y * 311.7 + seed * 74.713) * 43758.5453123
  return value - Math.floor(value)
}

function periodicNoise(x: number, y: number, period: number, seed: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = (x0 + 1) % period
  const y1 = (y0 + 1) % period
  const wrappedX0 = ((x0 % period) + period) % period
  const wrappedY0 = ((y0 % period) + period) % period
  const tx = smoothstep(x - x0)
  const ty = smoothstep(y - y0)

  const bottom =
    hash(wrappedX0, wrappedY0, seed) * (1 - tx) +
    hash(x1, wrappedY0, seed) * tx
  const top =
    hash(wrappedX0, y1, seed) * (1 - tx) +
    hash(x1, y1, seed) * tx

  return bottom * (1 - ty) + top * ty
}

function createCloudTexture(seed: number, size = 256) {
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      let noise = 0
      let amplitude = 0.55
      let totalAmplitude = 0

      for (const period of [4, 8, 16, 32, 64]) {
        noise +=
          periodicNoise(u * period, v * period, period, seed) * amplitude
        totalAmplitude += amplitude
        amplitude *= 0.52
      }

      const value = Math.round((noise / totalAmplitude) * 255)
      const index = (y * size + x) * 4
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
      data[index + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function createFlowTexture(size = 128) {
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size

      // A seamless curl-like field encoded as velocity in the red/green channels.
      const vx =
        Math.cos(TAU * (u + v * 2)) * 0.55 +
        Math.cos(TAU * (u * 3 - v)) * 0.25 +
        0.35
      const vy =
        -Math.sin(TAU * (u * 2 + v)) * 0.38 +
        Math.sin(TAU * (u - v * 3)) * 0.2
      const length = Math.max(Math.hypot(vx, vy), 0.001)
      const strength = Math.min(length, 1)
      const flowX = (vx / length) * strength
      const flowY = (vy / length) * strength
      const index = (y * size + x) * 4

      data[index] = Math.round((flowX * 0.5 + 0.5) * 255)
      data[index + 1] = Math.round((flowY * 0.5 + 0.5) * 255)
      data[index + 2] = 128
      data[index + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

const vertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = normalize(position);
    vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clipPosition.xyww;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uCloudCoverage;
  uniform float uSkyBrightness;
  uniform vec3 uCloudColor;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uLightColor;
  uniform sampler2D uCloudMap;
  uniform sampler2D uFlowMap;

  varying vec3 vDirection;

  float cloudSample(vec2 uv, vec2 flow, float phase) {
    return texture2D(uCloudMap, uv - flow * phase * 0.32).r;
  }

  float flowedCloudNoise(vec2 projectionUv, vec2 panOffset) {
    // A broad prevailing-wind pan carries the whole cloud layer while the
    // flow map adds smaller local curls and changes of direction on top.
    vec2 cloudUv = (projectionUv + panOffset) * 1.45;
    vec2 flowUv = projectionUv * 0.72;
    vec2 flow = texture2D(uFlowMap, flowUv).rg * 2.0 - 1.0;
    flow.x += 0.24;

    // Two offset phases cross-fade so the advection can loop without a jump.
    float phase0 = fract(uTime * 0.035 * uWindSpeed + 0.5);
    float phase1 = fract(uTime * 0.035 * uWindSpeed + 1.0);
    float flowBlend = abs(0.5 - phase0) * 2.0;
    float clouds0 = cloudSample(cloudUv, flow, phase0);
    float clouds1 = cloudSample(cloudUv, flow, phase1);
    return mix(clouds0, clouds1, flowBlend);
  }

  float triplanarCloudNoise(vec3 direction) {
    // Project from all three axes. Unlike equirectangular UVs, none of these
    // projections collapse an entire row of pixels into a single pole.
    vec3 weights = pow(abs(direction), vec3(4.0));
    weights /= weights.x + weights.y + weights.z;

    vec3 pan = vec3(0.011, 0.0025, 0.0045) * uTime * uWindSpeed;
    float fromX = flowedCloudNoise(direction.zy, pan.zy);
    float fromY = flowedCloudNoise(direction.xz, pan.xz);
    float fromZ = flowedCloudNoise(direction.xy, pan.xy);
    return dot(vec3(fromX, fromY, fromZ), weights);
  }

  void main() {
    vec3 direction = normalize(vDirection);

    float height = smoothstep(-0.12, 0.82, direction.y);
    vec3 sky = mix(uHorizonColor, uSkyColor, height);

    float clouds = triplanarCloudNoise(direction);

    float horizonFade = smoothstep(-0.04, 0.18, direction.y);
    float cloudThreshold = 0.51 + (0.5 - uCloudCoverage) * 0.28;
    float cloudMask = smoothstep(
      cloudThreshold,
      cloudThreshold + 0.17,
      clouds
    ) * horizonFade;
    vec3 cloudShadow = mix(uCloudColor * 0.72, uHorizonColor, 0.32);
    vec3 cloudLight = uCloudColor;
    vec3 cloudColor = mix(cloudShadow, cloudLight, smoothstep(0.55, 0.78, clouds));
    sky = mix(sky, cloudColor, cloudMask * 0.88);

    vec3 sunDirection = normalize(vec3(-0.35, 0.58, -0.72));
    float sunDot = max(dot(direction, sunDirection), 0.0);
    float sunGlow = pow(sunDot, 18.0) * 0.35;
    float sunDisc = smoothstep(0.99935, 0.99975, sunDot);
    sky += uLightColor * sunGlow;
    sky = mix(sky, uLightColor, sunDisc);

    float lowerHemisphere = 1.0 - smoothstep(-0.24, 0.03, direction.y);
    vec3 lowerSky = mix(uSkyColor, uHorizonColor, 0.72);
    sky = mix(sky, lowerSky, lowerHemisphere);
    sky *= uSkyBrightness;

    gl_FragColor = vec4(sky, 1.0);
  }
`

type FlowmapSkyProps = {
  cloudColor: string
  cloudCoverage: number
  cloudSeed: number
  discoMode: boolean
  windSpeed: number
  horizonColor: string
  lightColor: string
  skyColor: string
  skyBrightness: number
}

export function FlowmapSky({
  cloudColor,
  cloudCoverage,
  cloudSeed,
  discoMode,
  windSpeed,
  horizonColor,
  lightColor,
  skyColor,
  skyBrightness,
}: FlowmapSkyProps) {
  const materialRef = useRef<ShaderMaterial>(null)
  const textures = useMemo(
    () => ({ cloud: createCloudTexture(cloudSeed), flow: createFlowTexture() }),
    [cloudSeed]
  )
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWindSpeed: { value: 2.2 },
      uCloudCoverage: { value: 0.8 },
      uSkyBrightness: { value: 1.1 },
      uCloudColor: { value: new Color('#3700ff') },
      uSkyColor: { value: new Color('#a7de7a') },
      uHorizonColor: { value: new Color('#dede43') },
      uLightColor: { value: new Color('#43a758') },
      uCloudMap: { value: textures.cloud },
      uFlowMap: { value: textures.flow },
    }),
    [textures]
  )

  useEffect(() => {
    return () => {
      textures.cloud.dispose()
      textures.flow.dispose()
    }
  }, [textures])

  useEffect(() => {
    uniforms.uCloudColor.value.set(cloudColor)
  }, [cloudColor, uniforms])

  useEffect(() => {
    uniforms.uSkyColor.value.set(skyColor)
    uniforms.uHorizonColor.value.set(horizonColor)
  }, [horizonColor, skyColor, uniforms])

  useEffect(() => {
    uniforms.uLightColor.value.set(lightColor)
  }, [lightColor, uniforms])

  useFrame((state) => {
    if (materialRef.current) {
      if (discoMode) {
        setDiscoColor(
          uniforms.uSkyColor.value,
          state.clock.elapsedTime,
          0.58,
          0.9,
          0.48
        )
        setDiscoColor(
          uniforms.uHorizonColor.value,
          state.clock.elapsedTime,
          0.12,
          0.92,
          0.7
        )
        setDiscoColor(
          uniforms.uCloudColor.value,
          state.clock.elapsedTime,
          0.86,
          1,
          0.62
        )
        setDiscoColor(
          uniforms.uLightColor.value,
          state.clock.elapsedTime,
          0.2,
          1,
          0.68
        )
      } else {
        uniforms.uSkyColor.value.set(skyColor)
        uniforms.uHorizonColor.value.set(horizonColor)
        uniforms.uCloudColor.value.set(cloudColor)
        uniforms.uLightColor.value.set(lightColor)
      }
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uWindSpeed.value = windSpeed
      materialRef.current.uniforms.uCloudCoverage.value = cloudCoverage
      materialRef.current.uniforms.uSkyBrightness.value = skyBrightness
    }
  })

  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[120, 64, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={BackSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}
