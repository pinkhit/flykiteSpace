import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import type { Line2 } from 'three-stdlib'
import { handStringAnchor, kiteStringAnchor } from './kiteAnchors'
import { setDiscoColor } from './discoPalette'

const STRING_SEGMENTS = 20
const up = new Vector3(0, 1, 0)
const stringDirection = new Vector3()
const sideways = new Vector3()
const point = new Vector3()

const initialPoints = Array.from(
  { length: STRING_SEGMENTS + 1 },
  (_, index) =>
    new Vector3().lerpVectors(
      handStringAnchor,
      kiteStringAnchor,
      index / STRING_SEGMENTS
    )
)

type KiteStringProps = {
  discoMode: boolean
}

export function KiteString({ discoMode }: KiteStringProps) {
  const lineRef = useRef<Line2>(null)
  const positionsRef = useRef(
    new Float32Array((STRING_SEGMENTS + 1) * 3)
  )

  useFrame((state) => {
    if (!lineRef.current) return
    const positions = positionsRef.current

    if (discoMode) {
      setDiscoColor(
        lineRef.current.material.color,
        state.clock.elapsedTime,
        0.36,
        1,
        0.68
      )
    } else {
      lineRef.current.material.color.set('#f4f0df')
    }

    stringDirection.subVectors(kiteStringAnchor, handStringAnchor)
    const stringLength = stringDirection.length()
    stringDirection.normalize()

    sideways.crossVectors(stringDirection, up)
    if (sideways.lengthSq() < 0.0001) sideways.set(1, 0, 0)
    sideways.normalize()

    // A taut string under a distributed wind/gravity load is closely
    // approximated by a shallow parabola. Keep the bow restrained because a
    // flying kite maintains considerably more tension than a hanging cable.
    const gravitySag = MathUtils.clamp(stringLength * 0.014, 0.05, 0.16)
    const windBow = 0.035 + Math.sin(state.clock.elapsedTime * 0.75) * 0.01

    for (let index = 0; index <= STRING_SEGMENTS; index += 1) {
      const t = index / STRING_SEGMENTS
      const bow = 4 * t * (1 - t)
      const vibration =
        Math.sin(state.clock.elapsedTime * 5.2 + t * 17) * bow * 0.004

      point.lerpVectors(handStringAnchor, kiteStringAnchor, t)
      point.y -= gravitySag * bow
      point.addScaledVector(sideways, windBow * bow + vibration)

      const offset = index * 3
      positions[offset] = point.x
      positions[offset + 1] = point.y
      positions[offset + 2] = point.z
    }

    lineRef.current.geometry.setPositions(positions)
  })

  return (
    <Line
      ref={lineRef}
      points={initialPoints}
      color="#f4f0df"
      lineWidth={1.25}
      transparent
      opacity={0.9}
    />
  )
}
