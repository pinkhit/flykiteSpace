import { Vector3 } from 'three'

export const WATER_LEVEL = -0.12
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
