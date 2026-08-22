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
import './index.css'

export default function App() {
  const [cameraMode, setCameraMode] = useState(false)
  const [discoMode, setDiscoMode] = useState(false)
  const [hudCollapsed, setHudCollapsed] = useState(false)
  const [showHands, setShowHands] = useState(false)
  const [stringLength, setStringLength] = useState(8)
  const [pulseSpeed, setPulseSpeed] = useState(3.8)
  const [pulseWidth, setPulseWidth] = useState(2.6)
  const [waterColor, setWaterColor] = useState('#4069c9')
  const [bubbleColor, setBubbleColor] = useState('#58de16')
  const [reflectionClarity, setReflectionClarity] = useState(0.67)
  const [windSpeed, setWindSpeed] = useState(2.2)
  const [cloudCoverage, setCloudCoverage] = useState(0.8)
  const [cloudColor, setCloudColor] = useState('#3700ff')
  const [cloudSeed, setCloudSeed] = useState(88)
  const [skyColor, setSkyColor] = useState('#a7de7a')
  const [horizonColor, setHorizonColor] = useState('#dede43')
  const [lightColor, setLightColor] = useState('#43a758')
  const [skyBrightness, setSkyBrightness] = useState(1.1)
  const orientation = useDeviceOrientation(cameraMode)

  async function handleEnableMotion() {
    await orientation.requestPermission()
    resetCameraOrientationCalibration()
  }

  function handleToggleCameraMode() {
    resetCameraOrientationCalibration()
    setCameraMode((value) => !value)
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
