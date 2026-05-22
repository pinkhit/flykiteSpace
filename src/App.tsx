import { GameCanvas } from './game/scene'
import { Hud } from './components/HUD'
import './index.css'

export default function App() {
  return (
    <main className="app">
      <GameCanvas />
      <Hud />
    </main>
  )
}