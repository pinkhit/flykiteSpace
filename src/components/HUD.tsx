import { Crosshair } from './xhair'

export function Hud() {
  return (
    <div className="hud">
      <div className="title">
        <h1>flykite.space</h1>
        <p>Drag or swipe to fly the kite</p>
      </div>

      <Crosshair />

      <div className="instructions">
        Desktop: click and drag · Mobile: swipe ya finga
      </div>
    </div>
  )
}