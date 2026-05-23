// import { Crosshair } from './xhair'

// export function Hud() {
//   return (
//     <div className="hud">
//       <div className="title">
//         <h1>flykite.space</h1>
//             <a href="https://khitgoh.com" target="_blank" rel="noreferrer">
//             Made by Khit a.k.a. kite - come see my portfolio!
//             </a>
//       </div>

//       <Crosshair />

//       <div className="instructions">
//         Desktop: click and drag · Mobile: swipe ya finga
//       </div>
//     </div>
//   )
// }
import { Crosshair } from './xhair'

type HudProps = {
  cameraMode: boolean
  motionPermission: 'unknown' | 'granted' | 'denied'
  onToggleCameraMode: () => void
  onEnableMotion: () => void
}

export function Hud({
  cameraMode,
  motionPermission,
  onToggleCameraMode,
  onEnableMotion,
}: HudProps) {
  return (
    <div className="hud">
      <div className="title">
        <h1>flykite.space</h1>

        <a
          className="portfolio-link"
          href="https://khitgoh.com"
          target="_blank"
          rel="noreferrer"
        >
          come see more of my stuff :)
        </a>
      </div>

      <Crosshair />

      <button
        className="camera-toggle"
        type="button"
        onClick={onToggleCameraMode}
      >
        Camera BG: {cameraMode ? 'On' : 'Off'}
      </button>

      {cameraMode && motionPermission !== 'granted' && (
        <button
          className="motion-toggle"
          type="button"
          onClick={onEnableMotion}
        >
          Enable Motion
        </button>
      )}

      <div className="instructions">
        {cameraMode
          ? 'Move your phone to fly · Swipe fallback enabled'
          : 'Desktop: drag to steer · Mobile: swipe to fly'}
      </div>
    </div>
  )
}