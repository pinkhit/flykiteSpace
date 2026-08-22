import { FlowmapSky } from './flowmapSky'

export function Environment() {
  return (
    <>
      <FlowmapSky />

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.1, -8]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#6dbb5a" />
      </mesh>
    </>
  )
}
