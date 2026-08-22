import type { Color } from 'three'

const HUE_CYCLES_PER_SECOND = 0.085

export function setDiscoColor(
  target: Color,
  elapsedTime: number,
  hueOffset: number,
  saturation: number,
  lightness: number
) {
  const hue = (elapsedTime * HUE_CYCLES_PER_SECOND + hueOffset) % 1
  target.setHSL(hue, saturation, lightness)
  return target
}
