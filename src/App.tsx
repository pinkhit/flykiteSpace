// import { GameCanvas } from './game/scene'
// import { Hud } from './components/HUD'
// import './index.css'

// export default function App() {
//   return (
//     <main className="app">
//       <GameCanvas />
//       <Hud />
//     </main>
//   )
// }

import { useEffect, useState } from 'react'
import { LoadingScreen } from './components/LoadingScreen'
import { GameCanvas } from './game/scene'
import { Hud } from './components/HUD'
import { CameraBackground } from './components/passThroughCam'
import { useDeviceOrientation } from './hooks/useDeviceGyro'
import {
  DUSK_GLOW_LIGHTING,
  LIGHTING_PRESETS,
  type LightingPresetId,
} from './game/lightingPresets'
import {
  DEFAULT_KITE_STRING_LENGTH,
  KITE_STRING_LENGTH_STEP,
  MAX_KITE_STRING_LENGTH,
  MIN_KITE_STRING_LENGTH,
} from './game/kiteAnchors'
import './index.css'

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

export default function App() {
  const [cameraMode, setCameraMode] = useState(false)
  const [discoMode, setDiscoMode] = useState(false)
  const [hudCollapsed, setHudCollapsed] = useState(true)
  const [showBirds, setShowBirds] = useState(true)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [showHands, setShowHands] = useState(false)
  const [stringLength, setStringLength] = useState(
    DEFAULT_KITE_STRING_LENGTH
  )
  const [pulseSpeed, setPulseSpeed] = useState(3.8)
  const [pulseWidth, setPulseWidth] = useState(2.6)
  const [waterColor, setWaterColor] = useState(DUSK_GLOW_LIGHTING.waterColor)
  const [bubbleColor, setBubbleColor] = useState(
    DUSK_GLOW_LIGHTING.bubbleColor
  )
  const [reflectionClarity, setReflectionClarity] = useState(
    DUSK_GLOW_LIGHTING.reflectionClarity
  )
  const [windSpeed, setWindSpeed] = useState(DUSK_GLOW_LIGHTING.windSpeed)
  const [cloudCoverage, setCloudCoverage] = useState(
    DUSK_GLOW_LIGHTING.cloudCoverage
  )
  const [cloudColor, setCloudColor] = useState(DUSK_GLOW_LIGHTING.cloudColor)
  const [cloudSeed, setCloudSeed] = useState(DUSK_GLOW_LIGHTING.cloudSeed)
  const [skyColor, setSkyColor] = useState(DUSK_GLOW_LIGHTING.skyColor)
  const [horizonColor, setHorizonColor] = useState(
    DUSK_GLOW_LIGHTING.horizonColor
  )
  const [lightColor, setLightColor] = useState(DUSK_GLOW_LIGHTING.lightColor)
  const [skyBrightness, setSkyBrightness] = useState(
    DUSK_GLOW_LIGHTING.skyBrightness
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
          ? KITE_STRING_LENGTH_STEP
          : event.code === 'KeyS'
            ? -KITE_STRING_LENGTH_STEP
            : 0
      if (adjustment === 0) return

      event.preventDefault()
      setStringLength((currentLength) =>
        Math.min(
          MAX_KITE_STRING_LENGTH,
          Math.max(MIN_KITE_STRING_LENGTH, currentLength + adjustment)
        )
      )
    }

    window.addEventListener('keydown', handleStringLengthKey)
    return () => window.removeEventListener('keydown', handleStringLengthKey)
  }, [])

  const activeLightingPreset =
    LIGHTING_PRESETS.find(({ values }) =>
      (values.bubbleColor === undefined ||
        values.bubbleColor === bubbleColor) &&
      values.cloudColor === cloudColor &&
      values.cloudCoverage === cloudCoverage &&
      values.cloudSeed === cloudSeed &&
      values.horizonColor === horizonColor &&
      values.lightColor === lightColor &&
      (values.reflectionClarity === undefined ||
        values.reflectionClarity === reflectionClarity) &&
      values.skyBrightness === skyBrightness &&
      values.skyColor === skyColor &&
      (values.waterColor === undefined || values.waterColor === waterColor) &&
      (values.windSpeed === undefined || values.windSpeed === windSpeed)
    )?.id ?? null

  async function handleEnableMotion() {
    await orientation.requestPermission()
  }

  function handleToggleCameraMode() {
    setCameraMode((value) => !value)
  }

  function handleLightingPresetChange(presetId: LightingPresetId) {
    const preset = LIGHTING_PRESETS.find(({ id }) => id === presetId)

    if (!preset) return

    if (preset.values.bubbleColor !== undefined) {
      setBubbleColor(preset.values.bubbleColor)
    }
    setCloudColor(preset.values.cloudColor)
    setCloudCoverage(preset.values.cloudCoverage)
    setCloudSeed(preset.values.cloudSeed)
    setHorizonColor(preset.values.horizonColor)
    setLightColor(preset.values.lightColor)
    if (preset.values.reflectionClarity !== undefined) {
      setReflectionClarity(preset.values.reflectionClarity)
    }
    setSkyBrightness(preset.values.skyBrightness)
    setSkyColor(preset.values.skyColor)
    if (preset.values.waterColor !== undefined) {
      setWaterColor(preset.values.waterColor)
    }
    if (preset.values.windSpeed !== undefined) {
      setWindSpeed(preset.values.windSpeed)
    }
  }

  return (
    <main className={`app ${cameraMode ? 'camera-mode' : ''}`}>
      <CameraBackground enabled={cameraMode} />

      <GameCanvas
        bubbleColor={bubbleColor}
        cameraMode={cameraMode}
        discoMode={discoMode}
        cloudColor={cloudColor}
        cloudCoverage={cloudCoverage}
        cloudSeed={cloudSeed}
        windSpeed={windSpeed}
        horizonColor={horizonColor}
        lightColor={lightColor}
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
        bubbleColor={bubbleColor}
        cameraMode={cameraMode}
        discoMode={discoMode}
        cloudColor={cloudColor}
        cloudCoverage={cloudCoverage}
        cloudSeed={cloudSeed}
        windSpeed={windSpeed}
        horizonColor={horizonColor}
        lightColor={lightColor}
        lightingPreset={activeLightingPreset}
        motionPermission={orientation.permission}
        collapsed={hudCollapsed}
        showBirds={showBirds}
        showCrosshair={showCrosshair}
        showHands={showHands}
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

      <LoadingScreen />
      {hudCollapsed && (
        <small className="copyright-notice">© Khit Goh 2026</small>
      )}
    </main>
  )
}
