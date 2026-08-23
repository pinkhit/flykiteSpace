import { BoxGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type VoxelParticleShape = 'cross' | 'cube'

export function createVoxelCrossGeometry() {
  // Three hard-edged voxel bars form the six-armed 3D asterisk used by both
  // splash and impact particles.
  const bars = [
    new BoxGeometry(2, 0.32, 0.32),
    new BoxGeometry(0.32, 2, 0.32),
    new BoxGeometry(0.32, 0.32, 2),
  ]
  const geometry = mergeGeometries(bars, false)
  bars.forEach((bar) => bar.dispose())

  if (!geometry) {
    throw new Error('Unable to create voxel cross geometry')
  }

  return geometry
}
