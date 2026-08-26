import type { Color } from 'three'

const HUE_CYCLES_PER_SECOND = 0.085

// Even samples from the same fully saturated HSL spectrum used by disco mode.
export const DISCO_PALETTE = [
  '#ff9090',
  '#ffdb90',
  '#eeff90',
  '#aeff90',
  '#90ffc7',
  '#90ffff',
  '#90c7ff',
  '#ae90ff',
  '#ee90ff',
  '#ff90db',
] as const

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
