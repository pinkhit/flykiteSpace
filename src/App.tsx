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
import './index.css'

export default function App() {
  const [cameraMode, setCameraMode] = useState(false)

  return (
    <main className={`app ${cameraMode ? 'camera-mode' : ''}`}>
      <CameraBackground enabled={cameraMode} />
      <GameCanvas cameraMode={cameraMode} />
      <Hud
        cameraMode={cameraMode}
        onToggleCameraMode={() => setCameraMode((value) => !value)}
      />
    </main>
  )
}