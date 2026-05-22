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
        Desktop: drag to steer · Mobile: swipe in landscape
      </div>
    </div>
  )
}