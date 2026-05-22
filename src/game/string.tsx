import { Line } from '@react-three/drei'

export function KiteString() {
  return (
    <Line
      points={[
        [0.35, -0.35, -1.2],
        [0, 2.5, -8],
      ]}
      color="white"
      lineWidth={2}
    />
  )
}