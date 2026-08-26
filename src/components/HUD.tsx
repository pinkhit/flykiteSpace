import { Crosshair } from './xhair'
import {
  LIGHTING_PRESETS,
  type LightingPresetId,
} from '../game/lightingPresets'
import {
  KITE_STRING_LENGTH_STEP,
  MAX_KITE_STRING_LENGTH,
  MIN_KITE_STRING_LENGTH,
} from '../game/kiteAnchors'

type HudProps = {
  bubbleColor: string
  cameraMode: boolean
  collapsed: boolean
  discoMode: boolean
  cloudColor: string
  cloudCoverage: number
  cloudSeed: number
  windSpeed: number
  horizonColor: string
  lightColor: string
  lightingPreset: LightingPresetId | null
  motionPermission: 'unknown' | 'granted' | 'denied'
  onBubbleColorChange: (value: string) => void
  onCloudColorChange: (value: string) => void
  onCloudCoverageChange: (value: number) => void
  onCloudSeedChange: (value: number) => void
  onWindSpeedChange: (value: number) => void
  onHorizonColorChange: (value: string) => void
  onLightColorChange: (value: string) => void
  onLightingPresetChange: (value: LightingPresetId) => void
  onOpenKiteStudio: () => void
  onToggleDiscoMode: () => void
  onToggleCameraMode: () => void
  onEnableMotion: () => void
  onPulseSpeedChange: (value: number) => void
  onPulseWidthChange: (value: number) => void
  onReflectionClarityChange: (value: number) => void
  onSkyColorChange: (value: string) => void
  onSkyBrightnessChange: (value: number) => void
  onStringLengthChange: (value: number) => void
  onToggleBirds: () => void
  onToggleCollapsed: () => void
  onToggleCrosshair: () => void
  onToggleHands: () => void
  onWaterColorChange: (value: string) => void
  pulseSpeed: number
  pulseWidth: number
  reflectionClarity: number
  showBirds: boolean
  showCrosshair: boolean
  showHands: boolean
  skyColor: string
  skyBrightness: number
  stringLength: number
  waterColor: string
}

export function Hud({
  bubbleColor,
  cameraMode,
  collapsed,
  discoMode,
  cloudColor,
  cloudCoverage,
  cloudSeed,
  windSpeed,
  horizonColor,
  lightColor,
  lightingPreset,
  motionPermission,
  onBubbleColorChange,
  onCloudColorChange,
  onCloudCoverageChange,
  onCloudSeedChange,
  onWindSpeedChange,
  onHorizonColorChange,
  onLightColorChange,
  onLightingPresetChange,
  onOpenKiteStudio,
  onToggleDiscoMode,
  onToggleCameraMode,
  onEnableMotion,
  onPulseSpeedChange,
  onPulseWidthChange,
  onReflectionClarityChange,
  onSkyColorChange,
  onSkyBrightnessChange,
  onStringLengthChange,
  onToggleBirds,
  onToggleCollapsed,
  onToggleCrosshair,
  onToggleHands,
  onWaterColorChange,
  pulseSpeed,
  pulseWidth,
  reflectionClarity,
  showBirds,
  showCrosshair,
  showHands,
  skyColor,
  skyBrightness,
  stringLength,
  waterColor,
}: HudProps) {
  return (
    <div className={`hud ${collapsed ? 'is-collapsed' : ''}`}>
      {!collapsed && (
        <>
          <div className="title">
            <h1>flykite.space</h1>

            <a
              className="portfolio-link"
              href="https://khitgoh.com"
              target="_blank"
              rel="noreferrer"
            >
              see more of my stuff :)
            </a>

            <small className="title-copyright">© Khit Goh 2026</small>

            <div className="kite-studio-callout">
              <button
                className="kite-studio-toggle"
                type="button"
                onClick={onOpenKiteStudio}
              >
                Kite Studio
              </button>
            </div>
          </div>
        </>
      )}

      {showCrosshair && <Crosshair />}

      <div className="hud-controls">
        <button
          className="hud-collapse-toggle"
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          Settings
        </button>

        {!collapsed && (
          <button
            className="birds-toggle"
            type="button"
            aria-pressed={showBirds}
            onClick={onToggleBirds}
          >
            Birds: {showBirds ? 'On' : 'Off'}
          </button>
        )}

        {!collapsed && (
          <button
            className="crosshair-toggle"
            type="button"
            aria-pressed={showCrosshair}
            onClick={onToggleCrosshair}
          >
            Crosshair: {showCrosshair ? 'On' : 'Off'}
          </button>
        )}

        {!collapsed && (
          <button
            className="camera-toggle"
            type="button"
            onClick={onToggleCameraMode}
          >
            Camera: {cameraMode ? 'On' : 'Off'}
          </button>
        )}

        {!collapsed && (
          <button
            className="disco-toggle"
            type="button"
            onClick={onToggleDiscoMode}
          >
            Disco: {discoMode ? 'On' : 'Off'}
          </button>
        )}

        {!collapsed && (
          <button
            className="hands-toggle"
            type="button"
            onClick={onToggleHands}
          >
            Hands: {showHands ? 'On' : 'Off'}
          </button>
        )}

        {!collapsed && cameraMode && motionPermission !== 'granted' && (
          <button
            className="motion-toggle"
            type="button"
            onClick={onEnableMotion}
          >
            Enable Motion
          </button>
        )}

        {!collapsed && <details className="settings-panel presets-controls">
          <summary>Presets</summary>

          <div className="settings-panel-content preset-list">
            {LIGHTING_PRESETS.map((preset) => (
              <button
                className="preset-option"
                type="button"
                aria-pressed={lightingPreset === preset.id}
                key={preset.id}
                onClick={() => onLightingPresetChange(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </details>}

        {!collapsed && <details className="settings-panel water-controls">
          <summary>Water</summary>

          <div className="settings-panel-content">
            <label className="color-control">
              <span>
                Water color
                <input
                  type="color"
                  aria-label="Water color"
                  value={waterColor}
                  onChange={(event) =>
                    onWaterColorChange(event.currentTarget.value)
                  }
                />
              </span>
            </label>

            <label className="color-control">
              <span>
                Bubble color
                <input
                  type="color"
                  aria-label="Bubble color"
                  value={bubbleColor}
                  onChange={(event) =>
                    onBubbleColorChange(event.currentTarget.value)
                  }
                />
              </span>
            </label>

            <label>
              <span>
                Reflection clarity{' '}
                <output>{reflectionClarity.toFixed(2)}</output>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={reflectionClarity}
                onChange={(event) =>
                  onReflectionClarityChange(Number(event.currentTarget.value))
                }
              />
            </label>

            <label>
              <span>
                Pulse speed <output>{pulseSpeed.toFixed(1)}</output>
              </span>
              <input
                type="range"
                min="0.2"
                max="10"
                step="0.1"
                value={pulseSpeed}
                onChange={(event) =>
                  onPulseSpeedChange(Number(event.currentTarget.value))
                }
              />
            </label>

            <label>
              <span>
                Pulse width <output>{pulseWidth.toFixed(1)}</output>
              </span>
              <input
                type="range"
                min="0.3"
                max="3"
                step="0.1"
                value={pulseWidth}
                onChange={(event) =>
                  onPulseWidthChange(Number(event.currentTarget.value))
                }
              />
            </label>
          </div>
        </details>}

        {!collapsed && <details className="settings-panel sky-controls">
          <summary>Sky</summary>

          <div className="settings-panel-content">
            <label className="color-control">
              <span>
                Sky color
                <input
                  type="color"
                  aria-label="Sky color"
                  value={skyColor}
                  onChange={(event) =>
                    onSkyColorChange(event.currentTarget.value)
                  }
                />
              </span>
            </label>

            <label className="color-control">
              <span>
                Cloud color
                <input
                  type="color"
                  aria-label="Cloud color"
                  value={cloudColor}
                  onChange={(event) =>
                    onCloudColorChange(event.currentTarget.value)
                  }
                />
              </span>
            </label>

            <label className="color-control">
              <span>
                Horizon color
                <input
                  type="color"
                  aria-label="Horizon color"
                  value={horizonColor}
                  onChange={(event) =>
                    onHorizonColorChange(event.currentTarget.value)
                  }
                />
              </span>
            </label>

            <label className="color-control">
              <span>
                Light color
                <input
                  type="color"
                  aria-label="Light color"
                  value={lightColor}
                  onChange={(event) =>
                    onLightColorChange(event.currentTarget.value)
                  }
                />
              </span>
            </label>

            <label>
              <span>
                Cloud seed
                <output>{cloudSeed}</output>
              </span>
              <input
                type="range"
                aria-label="Cloud seed"
                min="0"
                max="255"
                step="1"
                value={cloudSeed}
                onChange={(event) =>
                  onCloudSeedChange(Number(event.currentTarget.value))
                }
              />
            </label>

            <label>
              <span>
                Cloud coverage <output>{cloudCoverage.toFixed(2)}</output>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={cloudCoverage}
                onChange={(event) =>
                  onCloudCoverageChange(Number(event.currentTarget.value))
                }
              />
            </label>

            <label>
              <span>
                Brightness <output>{skyBrightness.toFixed(1)}</output>
              </span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={skyBrightness}
                onChange={(event) =>
                  onSkyBrightnessChange(Number(event.currentTarget.value))
                }
              />
            </label>
          </div>
        </details>}
      </div>

      <div className="lower-left-controls">
        {!collapsed && (
          <details className="wind-speed-panel">
            <summary>
              <span>Wind speed</span>
              <output>{windSpeed.toFixed(1)}</output>
            </summary>

            <div className="wind-speed-panel-content">
              <label className="wind-speed-scale">
                <span>10</span>
                <input
                  className="wind-speed-slider"
                  type="range"
                  aria-label="Wind speed"
                  min="0"
                  max="10"
                  step="0.1"
                  value={windSpeed}
                  onChange={(event) =>
                    onWindSpeedChange(Number(event.currentTarget.value))
                  }
                />
                <span>0</span>
              </label>
            </div>
          </details>
        )}

        <details className="string-length-panel">
          <summary>
            <span className="string-length-title">String</span>
            <output>{stringLength.toFixed(1)} m</output>
          </summary>

          <div className="string-length-panel-content">
            <label className="string-length-scale">
              <span>{MAX_KITE_STRING_LENGTH} m</span>
              <input
                className="string-length-slider"
                type="range"
                aria-label="String length"
                min={MIN_KITE_STRING_LENGTH}
                max={MAX_KITE_STRING_LENGTH}
                step={KITE_STRING_LENGTH_STEP}
                value={stringLength}
                onChange={(event) =>
                  onStringLengthChange(Number(event.currentTarget.value))
                }
              />
              <span>{MIN_KITE_STRING_LENGTH} m</span>
            </label>
          </div>
        </details>
      </div>

      {!collapsed && (
        <div className="instructions">
          {cameraMode
            ? 'Move your phone to fly · Swipe fallback enabled'
            : 'Desktop: drag to steer · W/S: adjust string · Mobile: swipe to fly'}
        </div>
      )}
    </div>
  )
}
