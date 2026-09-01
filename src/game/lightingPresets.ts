export type LightingPresetValues = {
  birdBloomColor: string
  birdBloomIntensity: number
  bubbleColor: string
  cloudColor: string
  cloudCoverage: number
  cloudSeed: number
  horizonColor: string
  lightColor: string
  pulseSpeed: number
  pulseWidth: number
  reflectionClarity: number
  skyBrightness: number
  skyColor: string
  waterColor: string
  windSpeed: number
}

export const DEFAULT_BIRD_BLOOM_INTENSITY = 1.7 / 3

type LightingPreset = {
  id: string
  label: string
  values: LightingPresetValues
}

export const LIGHTING_PRESETS = [
  {
    id: 'sunny-day',
    label: 'Sunny Day',
    values: {
      birdBloomColor: '#ffffff',
      birdBloomIntensity: DEFAULT_BIRD_BLOOM_INTENSITY,
      bubbleColor: '#8fdaf2',
      cloudColor: '#fff5e8',
      cloudCoverage: 0.32,
      cloudSeed: 34,
      horizonColor: '#f6dec8',
      lightColor: '#ffe4ad',
      pulseSpeed: 3.8,
      pulseWidth: 2.6,
      reflectionClarity: 0.58,
      skyBrightness: 1.05,
      skyColor: '#8dbde0',
      waterColor: '#1d6380',
      windSpeed: 3.6,
    },
  },
  {
    id: 'dusk-glow',
    label: 'Dusk Glow',
    values: {
      birdBloomColor: '#ffffff',
      birdBloomIntensity: DEFAULT_BIRD_BLOOM_INTENSITY,
      bubbleColor: '#fd5f4d',
      cloudColor: '#f9dcdc',
      cloudCoverage: 0.75,
      cloudSeed: 228,
      horizonColor: '#f6e5ff',
      lightColor: '#ffb3b3',
      pulseSpeed: 3.8,
      pulseWidth: 2.6,
      reflectionClarity: 0.45,
      skyBrightness: 0.7,
      skyColor: '#adbbff',
      waterColor: '#00238a',
      windSpeed: 4.4,
    },
  },
  {
    id: 'moonlit',
    label: 'Moonlit',
    values: {
      birdBloomColor: '#ffffff',
      birdBloomIntensity: DEFAULT_BIRD_BLOOM_INTENSITY,
      bubbleColor: '#d9ecff',
      cloudColor: '#354362',
      cloudCoverage: 0.5,
      cloudSeed: 211,
      horizonColor: '#536b9f',
      lightColor: '#c5dcff',
      pulseSpeed: 3.8,
      pulseWidth: 2.6,
      reflectionClarity: 0.85,
      skyBrightness: 1.5,
      skyColor: '#0c1838',
      waterColor: '#092744',
      windSpeed: 3.2,
    },
  },
  {
    id: 'blood-moon',
    label: 'Blood Moon',
    values: {
      birdBloomColor: '#ffffff',
      birdBloomIntensity: DEFAULT_BIRD_BLOOM_INTENSITY,
      bubbleColor: '#444141',
      cloudColor: '#443c3c',
      cloudCoverage: 0.55,
      cloudSeed: 126,
      horizonColor: '#764747',
      lightColor: '#ff3624',
      pulseSpeed: 3.8,
      pulseWidth: 2.6,
      reflectionClarity: 0.22,
      skyBrightness: 1.5,
      skyColor: '#8b0404',
      waterColor: '#3b3c45',
      windSpeed: 6.6,
    },
  },
  {
    id: 'acid-wash',
    label: 'Acid Wash',
    values: {
      birdBloomColor: '#ffffff',
      birdBloomIntensity: DEFAULT_BIRD_BLOOM_INTENSITY,
      bubbleColor: '#58de16',
      cloudColor: '#3700ff',
      cloudCoverage: 0.8,
      cloudSeed: 88,
      horizonColor: '#dede43',
      lightColor: '#43a758',
      pulseSpeed: 3.8,
      pulseWidth: 2.6,
      reflectionClarity: 0.67,
      skyBrightness: 1.1,
      skyColor: '#a7de7a',
      waterColor: '#4069c9',
      windSpeed: 5.2,
    },
  },
  {
    id: 'chamber-of-reflection',
    label: 'Chamber of Reflection',
    values: {
      birdBloomColor: '#ffffff',
      birdBloomIntensity: DEFAULT_BIRD_BLOOM_INTENSITY,
      bubbleColor: '#16ff04',
      cloudColor: '#7ac0ff',
      cloudCoverage: 0.75,
      cloudSeed: 228,
      horizonColor: '#c800ff',
      lightColor: '#ffb3b3',
      pulseSpeed: 1.9,
      pulseWidth: 3,
      reflectionClarity: 1,
      skyBrightness: 1.4,
      skyColor: '#83e2b1',
      waterColor: '#996cc6',
      windSpeed: 2.2,
    },
  },
] as const satisfies readonly LightingPreset[]

export type LightingPresetId = (typeof LIGHTING_PRESETS)[number]['id']

export const DEFAULT_LIGHTING_PRESET_ID =
  'dusk-glow' satisfies LightingPresetId

export function getLightingPreset(id: LightingPresetId): LightingPreset {
  const preset = LIGHTING_PRESETS.find((candidate) => candidate.id === id)

  if (!preset) {
    throw new Error(`Unknown lighting preset: ${id}`)
  }

  return preset
}
