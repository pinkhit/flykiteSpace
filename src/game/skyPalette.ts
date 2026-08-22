import { Color } from 'three'

const horizonTint = new Color('#e0f2ff')

export function getSkyHorizonColor(skyColor: string) {
  return new Color(skyColor).lerp(horizonTint, 0.68)
}
