import { DISCO_PALETTE } from '../game/discoPalette'

type CrosshairProps = {
  hitmarkerEmphasized: boolean
  hitmarkerSequence: number
}

export function Crosshair({
  hitmarkerEmphasized,
  hitmarkerSequence,
}: CrosshairProps) {
  const hitmarkerColor =
    DISCO_PALETTE[(hitmarkerSequence - 1) % DISCO_PALETTE.length]

  return (
    <div className="crosshair" aria-hidden="true">
      {hitmarkerSequence > 0 && (
        <span
          className={`crosshair-hitmarker ${
            hitmarkerEmphasized ? 'is-emphasized' : ''
          }`}
          key={hitmarkerSequence}
          style={{ color: hitmarkerColor }}
        />
      )}
    </div>
  )
}
