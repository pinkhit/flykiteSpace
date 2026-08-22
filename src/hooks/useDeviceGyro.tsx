import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type OrientationState = {
  supported: boolean
  permission: 'unknown' | 'granted' | 'denied'
  active: boolean
  alpha: number
  beta: number
  gamma: number
  requestPermission: () => Promise<boolean>
}

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function supportsDeviceOrientation() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

function getInitialPermission(): OrientationState['permission'] {
  if (!supportsDeviceOrientation()) return 'unknown'

  const DeviceOrientation =
    window.DeviceOrientationEvent as DeviceOrientationEventWithPermission

  // iOS requires a user gesture. Other browsers can begin listening directly.
  return typeof DeviceOrientation.requestPermission === 'function'
    ? 'unknown'
    : 'granted'
}

export function useDeviceOrientation(enabled: boolean): OrientationState {
  const supported = supportsDeviceOrientation()
  const [permission, setPermission] =
    useState<OrientationState['permission']>(getInitialPermission)

  const activeRef = useRef(false)
  const alphaRef = useRef(0)
  const betaRef = useRef(0)
  const gammaRef = useRef(0)

  const requestPermission = useCallback(async () => {
    if (!window.isSecureContext) {
      console.warn('Device orientation requires HTTPS.')
      setPermission('denied')
      return false
    }

    if (!('DeviceOrientationEvent' in window)) {
      setPermission('denied')
      return false
    }

    const DeviceOrientation =
      DeviceOrientationEvent as DeviceOrientationEventWithPermission

    // iOS Safari-style permission path.
    if (typeof DeviceOrientation.requestPermission === 'function') {
      try {
        const result = await DeviceOrientation.requestPermission()
        setPermission(result)
        return result === 'granted'
      } catch (error) {
        console.warn('Unable to request device orientation permission.', error)
        setPermission('denied')
        return false
      }
    }

    // Android Chrome-style path usually does not need explicit requestPermission.
    setPermission('granted')
    return true
  }, [])

  useEffect(() => {
    activeRef.current = false

    if (!enabled || permission !== 'granted') {
      return
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      if (event.alpha === null && event.beta === null && event.gamma === null) {
        return
      }

      alphaRef.current = event.alpha ?? 0
      betaRef.current = event.beta ?? 0
      gammaRef.current = event.gamma ?? 0
      activeRef.current = true
    }

    window.addEventListener('deviceorientation', handleOrientation, true)

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
      activeRef.current = false
    }
  }, [enabled, permission])

  return useMemo(
    () => ({
      supported,
      permission,
      get active() {
        return activeRef.current
      },
      get alpha() {
        return alphaRef.current
      },
      get beta() {
        return betaRef.current
      },
      get gamma() {
        return gammaRef.current
      },
      requestPermission,
    }),
    [permission, requestPermission, supported]
  )
}
