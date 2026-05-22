export function Hand() {
  return (
    <mesh position={[0.55, -0.45, -1.2]} rotation={[0.2, -0.4, 0]}>
      <boxGeometry args={[0.25, 0.25, 0.8]} />
      <meshStandardMaterial color="#f2b28d" />
    </mesh>
  )
}