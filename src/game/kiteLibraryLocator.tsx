import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import { Frustum, Matrix4, Sphere, Vector3 } from 'three'
import { kiteLibraryCubeMotion } from './kiteLibraryCubeMotion'

const SCREEN_EDGE_MARGIN = 44
const projectionViewMatrix = new Matrix4()
const cameraSpacePosition = new Vector3()
const cubeBounds = new Sphere()
const cameraFrustum = new Frustum()

type KiteLibraryLocatorTrackerProps = {
  indicatorRef: RefObject<HTMLDivElement | null>
}

export function KiteLibraryLocatorTracker({
  indicatorRef,
}: KiteLibraryLocatorTrackerProps) {
  useFrame(({ camera, size }) => {
    const indicator = indicatorRef.current
    if (!indicator) return

    camera.updateMatrixWorld()
    projectionViewMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
    cameraFrustum.setFromProjectionMatrix(projectionViewMatrix)
    cubeBounds.center.copy(kiteLibraryCubeMotion.position)
    cubeBounds.radius = kiteLibraryCubeMotion.collisionRadius

    const cubeIsOnScreen =
      kiteLibraryCubeMotion.active &&
      cameraFrustum.intersectsSphere(cubeBounds)
    const shouldShow = kiteLibraryCubeMotion.active && !cubeIsOnScreen

    if (!shouldShow) {
      indicator.hidden = true
      return
    }

    cameraSpacePosition
      .copy(kiteLibraryCubeMotion.position)
      .applyMatrix4(camera.matrixWorldInverse)

    // Use the camera projection scale to preserve the cube's visual bearing,
    // including when the target is behind the player.
    let directionX =
      cameraSpacePosition.x * camera.projectionMatrix.elements[0]
    let directionY =
      -cameraSpacePosition.y * camera.projectionMatrix.elements[5]

    if (
      !Number.isFinite(directionX) ||
      !Number.isFinite(directionY) ||
      Math.abs(directionX) + Math.abs(directionY) < 0.0001
    ) {
      directionX = 0
      directionY = 1
    }

    const halfWidth = size.width / 2
    const halfHeight = size.height / 2
    const availableHalfWidth = Math.max(1, halfWidth - SCREEN_EDGE_MARGIN)
    const availableHalfHeight = Math.max(1, halfHeight - SCREEN_EDGE_MARGIN)
    const edgeScale = Math.min(
      Math.abs(directionX) > 0.0001
        ? availableHalfWidth / Math.abs(directionX)
        : Number.POSITIVE_INFINITY,
      Math.abs(directionY) > 0.0001
        ? availableHalfHeight / Math.abs(directionY)
        : Number.POSITIVE_INFINITY
    )

    indicator.style.setProperty(
      '--locator-x',
      `${halfWidth + directionX * edgeScale}px`
    )
    indicator.style.setProperty(
      '--locator-y',
      `${halfHeight + directionY * edgeScale}px`
    )
    indicator.style.setProperty(
      '--locator-angle',
      `${Math.atan2(directionY, directionX)}rad`
    )
    indicator.hidden = false
  })

  return null
}
