import { Vector3 } from 'three'

export const WATER_LEVEL = -0.12
export const MIN_KITE_STRING_LENGTH = 3
export const MAX_KITE_STRING_LENGTH = 50
export const KITE_STRING_LENGTH_STEP = 0.5
export const KITE_STRING_KEYBOARD_STEP = 1.5
export const DEFAULT_KITE_STRING_LENGTH = 8
export const kiteStringAnchor = new Vector3(0, 2, -8)
export const handStringAnchor = new Vector3(0.35, -0.35, -1.2)

export const kiteMotion = {
  position: new Vector3(0, 2.5, -8),
  bubbleOrigin: new Vector3(0, 2, -8),
  bubbleRight: new Vector3(1, 0, 0),
  bubbleUp: new Vector3(0, 1, 0),
  velocity: new Vector3(),
  submersion: 0,
}
