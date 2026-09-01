import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { LoadingScreen } from './components/LoadingScreen'
import type {
  KiteSelection,
  KiteStudioTab,
} from './components/KiteStudio'
import { GameCanvas } from './game/scene'
import { Hud } from './components/HUD'
import { CameraBackground } from './components/passThroughCam'
import { useDeviceOrientation } from './hooks/useDeviceGyro'
import {
  DEFAULT_LIGHTING_PRESET_ID,
  getLightingPreset,
  LIGHTING_PRESETS,
  type LightingPresetId,
} from './game/lightingPresets'
import {
  DEFAULT_KITE_STRING_LENGTH,
  KITE_STRING_KEYBOARD_STEP,
  MAX_KITE_STRING_LENGTH,
  MIN_KITE_STRING_LENGTH,
} from './game/kiteAnchors'
import type { ImpactFeedback } from './game/impactFeedback'
import './index.css'

const BIRD_HIT_SESSION_KEY = 'flykite:bird-hits'
const DEFAULT_LIGHTING = getLightingPreset(DEFAULT_LIGHTING_PRESET_ID).values
const DEFAULT_KITE: KiteSelection = {
  artistName: 'admin',
  textureUrl: '/kite.png',
  title: 'Frank',
}

const KiteStudio = lazy(() =>
  import('./components/KiteStudio').then((module) => ({
    default: module.KiteStudio,
  }))
)

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target.matches(
      'input:not([type]), input[type="text"], input[type="number"], ' +
        'input[type="search"], input[type="email"], input[type="url"], ' +
        'input[type="password"], textarea, select'
    )
  )
}

function readSessionBirdHits() {
  try {
    const storedHits = Number.parseInt(
      window.sessionStorage.getItem(BIRD_HIT_SESSION_KEY) ?? '0',
      10
    )
    return Number.isFinite(storedHits) && storedHits > 0 ? storedHits : 0
  } catch {
    return 0
  }
}

export default function App() {
  const [cameraMode, setCameraMode] = useState(false)
  const [discoMode, setDiscoMode] = useState(false)
  const [hudCollapsed, setHudCollapsed] = useState(true)
  const [kiteStudioOpen, setKiteStudioOpen] = useState(false)
  const [kiteStudioTab, setKiteStudioTab] = useState<KiteStudioTab>('draw')
  const [kiteSelection, setKiteSelection] = useState(DEFAULT_KITE)
  const [gameLoaded, setGameLoaded] = useState(false)
  const [kiteAttributionVisible, setKiteAttributionVisible] = useState(false)
  const kiteAttributionIdleTimer = useRef<number | null>(null)
  const kiteAttributionVisibleTimer = useRef<number | null>(null)
  const [showBirds, setShowBirds] = useState(true)
  const [showCrosshair, setShowCrosshair] = useState(false)
  const [hitmarker, setHitmarker] = useState({
    emphasized: false,
    sequence: 0,
  })
  const [birdHitCount, setBirdHitCount] = useState(readSessionBirdHits)
  const [birdHitSequence, setBirdHitSequence] = useState(0)
  const [showHands, setShowHands] = useState(false)
  const [stringLength, setStringLength] = useState(
    DEFAULT_KITE_STRING_LENGTH
  )
  const [pulseSpeed, setPulseSpeed] = useState(DEFAULT_LIGHTING.pulseSpeed)
  const [pulseWidth, setPulseWidth] = useState(DEFAULT_LIGHTING.pulseWidth)
  const [birdBloomColor, setBirdBloomColor] = useState(
    DEFAULT_LIGHTING.birdBloomColor
  )
  const [birdBloomIntensity, setBirdBloomIntensity] = useState(
    DEFAULT_LIGHTING.birdBloomIntensity
  )
  const [waterColor, setWaterColor] = useState(DEFAULT_LIGHTING.waterColor)
  const [bubbleColor, setBubbleColor] = useState(
    DEFAULT_LIGHTING.bubbleColor
  )
  const [reflectionClarity, setReflectionClarity] = useState(
    DEFAULT_LIGHTING.reflectionClarity
  )
  const [windSpeed, setWindSpeed] = useState(DEFAULT_LIGHTING.windSpeed)
  const [cloudCoverage, setCloudCoverage] = useState(
    DEFAULT_LIGHTING.cloudCoverage
  )
  const [cloudColor, setCloudColor] = useState(DEFAULT_LIGHTING.cloudColor)
  const [cloudSeed, setCloudSeed] = useState(DEFAULT_LIGHTING.cloudSeed)
  const [skyColor, setSkyColor] = useState(DEFAULT_LIGHTING.skyColor)
  const [horizonColor, setHorizonColor] = useState(
    DEFAULT_LIGHTING.horizonColor
  )
  const [lightColor, setLightColor] = useState(DEFAULT_LIGHTING.lightColor)
  const [skyBrightness, setSkyBrightness] = useState(
    DEFAULT_LIGHTING.skyBrightness
  )
  const orientation = useDeviceOrientation(cameraMode)

  useEffect(() => {
    function handleStringLengthKey(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTextEntryTarget(event.target)
      ) {
        return
      }

      const adjustment =
        event.code === 'KeyW'
          ? KITE_STRING_KEYBOARD_STEP
          : event.code === 'KeyS'
            ? -KITE_STRING_KEYBOARD_STEP
            : 0
      if (adjustment === 0) return

      event.preventDefault()
      setStringLength((currentLength) =>
        Math.round(
          Math.min(
            MAX_KITE_STRING_LENGTH,
            Math.max(MIN_KITE_STRING_LENGTH, currentLength + adjustment)
          ) * 100
        ) / 100
      )
    }

    window.addEventListener('keydown', handleStringLengthKey)
    return () => window.removeEventListener('keydown', handleStringLengthKey)
  }, [])

  useEffect(() => {
    if (!gameLoaded) return

    function clearVisibleTimer() {
      if (kiteAttributionVisibleTimer.current === null) return

      window.clearTimeout(kiteAttributionVisibleTimer.current)
      kiteAttributionVisibleTimer.current = null
    }

    function showAttributionForFiveSeconds() {
      setKiteAttributionVisible(true)
      clearVisibleTimer()
      kiteAttributionVisibleTimer.current = window.setTimeout(() => {
        setKiteAttributionVisible(false)
        kiteAttributionVisibleTimer.current = null
      }, 5000)
    }

    function handlePointerMove(event: PointerEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest('.kite-attribution')
      ) {
        showAttributionForFiveSeconds()
        if (kiteAttributionIdleTimer.current !== null) {
          window.clearTimeout(kiteAttributionIdleTimer.current)
          kiteAttributionIdleTimer.current = null
        }
        return
      }

      setKiteAttributionVisible(false)
      clearVisibleTimer()

      if (kiteAttributionIdleTimer.current !== null) {
        window.clearTimeout(kiteAttributionIdleTimer.current)
      }
      kiteAttributionIdleTimer.current = window.setTimeout(() => {
        showAttributionForFiveSeconds()
        kiteAttributionIdleTimer.current = null
      }, 2000)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (kiteAttributionIdleTimer.current !== null) {
        window.clearTimeout(kiteAttributionIdleTimer.current)
      }
      clearVisibleTimer()
    }
  }, [gameLoaded])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        BIRD_HIT_SESSION_KEY,
        String(birdHitCount)
      )
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }
  }, [birdHitCount])

  const activeLightingPreset =
    LIGHTING_PRESETS.find(({ values }) =>
      values.birdBloomColor === birdBloomColor &&
      values.birdBloomIntensity === birdBloomIntensity &&
      values.bubbleColor === bubbleColor &&
      values.cloudColor === cloudColor &&
      values.cloudCoverage === cloudCoverage &&
      values.cloudSeed === cloudSeed &&
      values.horizonColor === horizonColor &&
      values.lightColor === lightColor &&
      values.pulseSpeed === pulseSpeed &&
      values.pulseWidth === pulseWidth &&
      values.reflectionClarity === reflectionClarity &&
      values.skyBrightness === skyBrightness &&
      values.skyColor === skyColor &&
      values.waterColor === waterColor &&
      values.windSpeed === windSpeed
    )?.id ?? null
  const kiteAttributionLabel = kiteSelection.artistName
    ? `${kiteSelection.title ?? 'Kite'} by ${kiteSelection.artistName}`
    : null
  const motionControlsActive =
    cameraMode &&
    orientation.permission === 'granted' &&
    orientation.active

  async function handleEnableMotion() {
    await orientation.requestPermission()
  }

  const handleKiteImpact = useCallback((feedback: ImpactFeedback = {}) => {
    if (feedback.showHitmarker !== false) {
      setHitmarker((current) => ({
        emphasized: feedback.emphasized ?? false,
        sequence: current.sequence + 1,
      }))
    }

    if (feedback.birdHit) {
      setBirdHitCount((count) => count + (feedback.birdHitValue ?? 1))
      setBirdHitSequence((sequence) => sequence + 1)
    }
  }, [])

  const handleGameLoaded = useCallback(() => {
    setGameLoaded(true)
    setKiteAttributionVisible(true)
  }, [])

  function handleToggleCameraMode() {
    setCameraMode((value) => !value)
  }

  function handleOpenKiteStudio(tab: KiteStudioTab) {
    setKiteStudioTab(tab)
    setKiteStudioOpen(true)
  }

  function handleLightingPresetChange(presetId: LightingPresetId) {
    const preset = getLightingPreset(presetId)

    setBirdBloomColor(preset.values.birdBloomColor)
    setBirdBloomIntensity(preset.values.birdBloomIntensity)
    setBubbleColor(preset.values.bubbleColor)
    setCloudColor(preset.values.cloudColor)
    setCloudCoverage(preset.values.cloudCoverage)
    setCloudSeed(preset.values.cloudSeed)
    setHorizonColor(preset.values.horizonColor)
    setLightColor(preset.values.lightColor)
    setPulseSpeed(preset.values.pulseSpeed)
    setPulseWidth(preset.values.pulseWidth)
    setReflectionClarity(preset.values.reflectionClarity)
    setSkyBrightness(preset.values.skyBrightness)
    setSkyColor(preset.values.skyColor)
    setWaterColor(preset.values.waterColor)
    setWindSpeed(preset.values.windSpeed)
  }

  return (
    <main className={`app ${cameraMode ? 'camera-mode' : ''}`}>
      <CameraBackground enabled={cameraMode} />

      <GameCanvas
        birdBloomColor={birdBloomColor}
        birdBloomIntensity={birdBloomIntensity}
        bubbleColor={bubbleColor}
        cameraMode={cameraMode}
        discoMode={discoMode}
        cloudColor={cloudColor}
        cloudCoverage={cloudCoverage}
        cloudSeed={cloudSeed}
        windSpeed={windSpeed}
        horizonColor={horizonColor}
        lightColor={lightColor}
        kiteTextureUrl={kiteSelection.textureUrl}
        onKiteImpact={handleKiteImpact}
        onOpenKiteLibrary={() => handleOpenKiteStudio('library')}
        orientation={orientation}
        pulseSpeed={pulseSpeed}
        pulseWidth={pulseWidth}
        reflectionClarity={reflectionClarity}
        showBirds={showBirds}
        showHands={showHands}
        skyColor={skyColor}
        skyBrightness={skyBrightness}
        stringLength={stringLength}
        waterColor={waterColor}
      />

      <Hud
        birdHitCount={birdHitCount}
        birdHitSequence={birdHitSequence}
        birdBloomColor={birdBloomColor}
        birdBloomIntensity={birdBloomIntensity}
        bubbleColor={bubbleColor}
        cameraMode={cameraMode}
        discoMode={discoMode}
        cloudColor={cloudColor}
        cloudCoverage={cloudCoverage}
        cloudSeed={cloudSeed}
        windSpeed={windSpeed}
        horizonColor={horizonColor}
        hitmarkerEmphasized={hitmarker.emphasized}
        hitmarkerSequence={hitmarker.sequence}
        lightColor={lightColor}
        lightingPreset={activeLightingPreset}
        motionPermission={orientation.permission}
        collapsed={hudCollapsed}
        showBirds={showBirds}
        showCrosshair={showCrosshair}
        showHands={showHands}
        onBirdBloomColorChange={setBirdBloomColor}
        onBirdBloomIntensityChange={setBirdBloomIntensity}
        onToggleCameraMode={handleToggleCameraMode}
        onToggleDiscoMode={() => setDiscoMode((value) => !value)}
        onEnableMotion={handleEnableMotion}
        onPulseSpeedChange={setPulseSpeed}
        onPulseWidthChange={setPulseWidth}
        onReflectionClarityChange={setReflectionClarity}
        onCloudColorChange={setCloudColor}
        onCloudCoverageChange={setCloudCoverage}
        onCloudSeedChange={setCloudSeed}
        onWindSpeedChange={setWindSpeed}
        onHorizonColorChange={setHorizonColor}
        onLightColorChange={setLightColor}
        onLightingPresetChange={handleLightingPresetChange}
        onOpenKiteStudio={() => handleOpenKiteStudio('draw')}
        onSkyColorChange={setSkyColor}
        onSkyBrightnessChange={setSkyBrightness}
        onStringLengthChange={setStringLength}
        onToggleBirds={() => setShowBirds((value) => !value)}
        onToggleCollapsed={() => setHudCollapsed((value) => !value)}
        onToggleCrosshair={() => setShowCrosshair((value) => !value)}
        onToggleHands={() => setShowHands((value) => !value)}
        onBubbleColorChange={setBubbleColor}
        onWaterColorChange={setWaterColor}
        pulseSpeed={pulseSpeed}
        pulseWidth={pulseWidth}
        reflectionClarity={reflectionClarity}
        skyColor={skyColor}
        skyBrightness={skyBrightness}
        stringLength={stringLength}
        waterColor={waterColor}
      />

      {kiteAttributionLabel && !motionControlsActive && (
        <button
          aria-hidden={!kiteAttributionVisible}
          aria-label={`${kiteAttributionLabel}. View in Kite Library`}
          className={`kite-attribution ${
            kiteAttributionVisible ? 'is-visible' : ''
          }`}
          onClick={() => handleOpenKiteStudio('library')}
          tabIndex={kiteAttributionVisible ? 0 : -1}
          type="button"
        >
          <span className="kite-attribution-marquee">
            <span aria-hidden="true" className="kite-attribution-marquee-track">
              {Array.from({ length: 3 }).map((_, copy) => (
                <span className="kite-attribution-marquee-item" key={copy}>
                  {kiteAttributionLabel}
                  <span className="kite-attribution-separator">::</span>
                </span>
              ))}
            </span>
          </span>
          <small>View in Kite Library</small>
        </button>
      )}

      {kiteStudioOpen && (
        <Suspense
          fallback={
            <div className="kite-studio-backdrop kite-studio-loading">
              Opening Kite Studio…
            </div>
          }
        >
          <KiteStudio
            currentTextureUrl={kiteSelection.textureUrl}
            initialTab={kiteStudioTab}
            onClose={() => setKiteStudioOpen(false)}
            onUseDesign={setKiteSelection}
          />
        </Suspense>
      )}

      <LoadingScreen onLoaded={handleGameLoaded} />
      {hudCollapsed && (
        <small className="copyright-notice">© Khit Goh 2026</small>
      )}
    </main>
  )
}
