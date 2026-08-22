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

import { useState } from 'react'
import { GameCanvas } from './game/scene'
import { Hud } from './components/HUD'
import { CameraBackground } from './components/passThroughCam'
import { useDeviceOrientation } from './hooks/useDeviceGyro'
import { resetCameraOrientationCalibration } from './game/camera'
import {
  DUSK_GLOW_LIGHTING,
  LIGHTING_PRESETS,
  type LightingPresetId,
} from './game/lightingPresets'
import './index.css'

export default function App() {
  const [cameraMode, setCameraMode] = useState(false)
  const [discoMode, setDiscoMode] = useState(false)
  const [hudCollapsed, setHudCollapsed] = useState(false)
  const [showHands, setShowHands] = useState(false)
  const [stringLength, setStringLength] = useState(8)
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
    resetCameraOrientationCalibration()
  }

  function handleToggleCameraMode() {
    resetCameraOrientationCalibration()
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
        onToggleCollapsed={() => setHudCollapsed((value) => !value)}
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
    </main>
  )
}
