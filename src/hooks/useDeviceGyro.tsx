import { useCallback, useEffect, useRef, useState } from 'react'

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

export function useDeviceOrientation(enabled: boolean): OrientationState {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [active, setActive] = useState(false)

  const alphaRef = useRef(0)
  const betaRef = useRef(0)
  const gammaRef = useRef(0)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'DeviceOrientationEvent' in window)
  }, [])

  const requestPermission = useCallback(async () => {
    if (!window.isSecureContext) {
      console.warn('Device orientation requires HTTPS.')
      setPermission('denied')
      return false
    }

    if (!('DeviceOrientationEvent' in window)) {
      setSupported(false)
      setPermission('denied')
      return false
    }

    const DeviceOrientation =
      DeviceOrientationEvent as DeviceOrientationEventWithPermission

    // iOS Safari-style permission path.
    if (typeof DeviceOrientation.requestPermission === 'function') {
      const result = await DeviceOrientation.requestPermission()
      setPermission(result)
      return result === 'granted'
    }

    // Android Chrome-style path usually does not need explicit requestPermission.
    setPermission('granted')
    return true
  }, [])

  useEffect(() => {
    if (!enabled || permission !== 'granted') {
      setActive(false)
      return
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      alphaRef.current = event.alpha ?? 0
      betaRef.current = event.beta ?? 0
      gammaRef.current = event.gamma ?? 0
      setActive(true)
    }

    window.addEventListener('deviceorientation', handleOrientation, true)

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
      setActive(false)
    }
  }, [enabled, permission])

  return {
    supported,
    permission,
    active,
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
  }
}