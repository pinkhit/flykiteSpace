export function Environment() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.1, -8]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#6dbb5a" />
      </mesh>

      <mesh position={[0, 8, -20]}>
        <sphereGeometry args={[6, 24, 24]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </>
  )
}