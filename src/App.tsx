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
        cameraMode={cameraMode}
        orientation={orientation}
      />

      <Hud
        cameraMode={cameraMode}
        motionPermission={orientation.permission}
        onToggleCameraMode={handleToggleCameraMode}
        onEnableMotion={handleEnableMotion}
      />
    </main>
  )
}