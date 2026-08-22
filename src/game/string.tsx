import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import type { Line2, LineSegments2 } from 'three-stdlib'
import {
  handStringAnchor,
  kiteStringAnchor,
  WATER_LEVEL,
} from './kiteAnchors'
import { setDiscoColor } from './discoPalette'

const STRING_SEGMENTS = 20
const up = new Vector3(0, 1, 0)
const stringDirection = new Vector3()
const sideways = new Vector3()
const point = new Vector3()
const underwaterStart = new Vector3()
const underwaterEnd = new Vector3()
const hiddenUnderwaterPoint = new Vector3(0, -2000, 0)

const initialPoints = Array.from(
  { length: STRING_SEGMENTS + 1 },
  (_, index) =>
    new Vector3().lerpVectors(
      handStringAnchor,
      kiteStringAnchor,
      index / STRING_SEGMENTS
    )
)
const initialUnderwaterPoints = Array.from(
  { length: STRING_SEGMENTS * 2 },
  () => hiddenUnderwaterPoint.clone()
)
const underwaterStringColors = Array.from(
  { length: STRING_SEGMENTS * 2 },
  () => [1, 1, 1, 0.3] as [number, number, number, number]
)

function addUnderwaterWave(target: Vector3, elapsed: number) {
  const depthStrength = MathUtils.clamp(
    (WATER_LEVEL - target.y) / 1.4,
    0,
    1
  )
  target.x +=
    Math.sin(target.y * 7.5 + target.z * 0.6 + elapsed * 3.3) *
    0.045 *
    depthStrength
  target.z +=
    Math.sin(target.y * 11 - target.x * 0.8 - elapsed * 2.4) *
    0.024 *
    depthStrength
}

type KiteStringProps = {
  discoMode: boolean
  underwaterEffect: boolean
}

export function KiteString({
  discoMode,
  underwaterEffect,
}: KiteStringProps) {
  const lineRef = useRef<Line2>(null)
  const underwaterLineRef = useRef<LineSegments2>(null)
  const positionsRef = useRef(
    new Float32Array((STRING_SEGMENTS + 1) * 3)
  )
  const underwaterPositionsRef = useRef(
    new Float32Array(STRING_SEGMENTS * 2 * 3)
  )

  useFrame((state) => {
    if (!lineRef.current) return
    const positions = positionsRef.current
    const underwaterPositions = underwaterPositionsRef.current

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
    if (underwaterLineRef.current) {
      if (discoMode) {
        setDiscoColor(
          underwaterLineRef.current.material.color,
          state.clock.elapsedTime,
          0.36,
          0.82,
          0.72
        )
      } else {
        underwaterLineRef.current.material.color.set('#bcecff')
      }
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

    if (!underwaterLineRef.current) return

    for (let index = 0; index < STRING_SEGMENTS; index += 1) {
      underwaterStart.fromArray(positions, index * 3)
      underwaterEnd.fromArray(positions, (index + 1) * 3)

      if (
        underwaterStart.y >= WATER_LEVEL &&
        underwaterEnd.y >= WATER_LEVEL
      ) {
        underwaterStart.copy(hiddenUnderwaterPoint)
        underwaterEnd.copy(hiddenUnderwaterPoint)
      } else {
        if (underwaterStart.y >= WATER_LEVEL) {
          const crossing =
            (WATER_LEVEL - underwaterStart.y) /
            (underwaterEnd.y - underwaterStart.y)
          underwaterStart.lerp(underwaterEnd, crossing)
          underwaterStart.y = WATER_LEVEL - 0.006
        } else if (underwaterEnd.y >= WATER_LEVEL) {
          const crossing =
            (WATER_LEVEL - underwaterEnd.y) /
            (underwaterStart.y - underwaterEnd.y)
          underwaterEnd.lerp(underwaterStart, crossing)
          underwaterEnd.y = WATER_LEVEL - 0.006
        }

        addUnderwaterWave(underwaterStart, state.clock.elapsedTime)
        addUnderwaterWave(underwaterEnd, state.clock.elapsedTime)
      }

      underwaterStart.toArray(underwaterPositions, index * 6)
      underwaterEnd.toArray(underwaterPositions, index * 6 + 3)
    }

    underwaterLineRef.current.geometry.setPositions(underwaterPositions)
  })

  return (
    <>
      <Line
        ref={lineRef}
        points={initialPoints}
        color="#f4f0df"
        lineWidth={1.25}
        transparent
        opacity={0.9}
      />

      <Line
        ref={underwaterLineRef}
        points={initialUnderwaterPoints}
        vertexColors={underwaterStringColors}
        segments
        color="#bcecff"
        depthTest={false}
        depthWrite={false}
        frustumCulled={false}
        lineWidth={1.5}
        opacity={1}
        renderOrder={850}
        visible={underwaterEffect}
      />
    </>
  )
}
