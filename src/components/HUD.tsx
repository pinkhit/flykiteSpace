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
  onToggleCameraMode: () => void
}

export function Hud({ cameraMode, onToggleCameraMode }: HudProps) {
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

      <div className="instructions">
        Desktop: drag to steer · Mobile: swipe to fly
      </div>
    </div>
  )
}