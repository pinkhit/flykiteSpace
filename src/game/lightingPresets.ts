export type LightingPresetId =
  | 'sunny-day'
  | 'dusk-glow'
  | 'moonlit'
  | 'blood-moon'
  | 'acid-wash'

export type LightingPresetValues = {
  bubbleColor?: string
  cloudColor: string
  cloudCoverage: number
  cloudSeed: number
  horizonColor: string
  lightColor: string
  reflectionClarity?: number
  skyBrightness: number
  skyColor: string
  waterColor?: string
  windSpeed?: number
}

export type LightingPreset = {
  id: LightingPresetId
  label: string
  values: LightingPresetValues
}

export const ACID_WASH_LIGHTING: LightingPresetValues = {
  bubbleColor: '#58de16',
  cloudColor: '#3700ff',
  cloudCoverage: 0.8,
  cloudSeed: 88,
  horizonColor: '#dede43',
  lightColor: '#43a758',
  reflectionClarity: 0.67,
  skyBrightness: 1.1,
  skyColor: '#a7de7a',
  waterColor: '#4069c9',
}

export const DUSK_GLOW_LIGHTING = {
  bubbleColor: '#fd5f4d',
  cloudColor: '#f9dcdc',
  cloudCoverage: 0.75,
  cloudSeed: 228,
  horizonColor: '#f6e5ff',
  lightColor: '#ffb3b3',
  reflectionClarity: 0.45,
  skyBrightness: 0.7,
  skyColor: '#adbbff',
  waterColor: '#00238a',
  windSpeed: 4.4,
} satisfies LightingPresetValues

export const LIGHTING_PRESETS: readonly LightingPreset[] = [
  {
    id: 'sunny-day',
    label: 'Sunny Day',
    values: {
      bubbleColor: '#49e4fc',
      cloudColor: '#ffffff',
      cloudCoverage: 0.25,
      cloudSeed: 34,
      horizonColor: '#02e6e6',
      lightColor: '#fff8d6',
      skyBrightness: 1.2,
      skyColor: '#70bcff',
      waterColor: '#00497a',
    },
  },
  {
    id: 'dusk-glow',
    label: 'Dusk Glow',
    values: DUSK_GLOW_LIGHTING,
  },
  {
    id: 'moonlit',
    label: 'Moonlit',
    values: {
      bubbleColor: '#d9ecff',
      cloudColor: '#354362',
      cloudCoverage: 0.5,
      cloudSeed: 211,
      horizonColor: '#536b9f',
      lightColor: '#c5dcff',
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
      bubbleColor: '#444141',
      cloudColor: '#443c3c',
      cloudCoverage: 0.55,
      cloudSeed: 126,
      horizonColor: '#764747',
      lightColor: '#ff3624',
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
    values: ACID_WASH_LIGHTING,
  },
]
