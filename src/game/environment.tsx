import { FlowmapSky } from './flowmapSky'
import { WaterGround } from './waterGround'

type EnvironmentProps = {
  cloudColor: string
  cloudCoverage: number
  cloudSeed: number
  discoMode: boolean
  windSpeed: number
  horizonColor: string
  lightColor: string
  pulseSpeed: number
  pulseWidth: number
  reflectionClarity: number
  skyColor: string
  skyBrightness: number
  waterColor: string
}

export function Environment({
  cloudColor,
  cloudCoverage,
  cloudSeed,
  discoMode,
  windSpeed,
  horizonColor,
  lightColor,
  pulseSpeed,
  pulseWidth,
  reflectionClarity,
  skyColor,
  skyBrightness,
  waterColor,
}: EnvironmentProps) {
  return (
    <>
      <FlowmapSky
        cloudColor={cloudColor}
        cloudCoverage={cloudCoverage}
        cloudSeed={cloudSeed}
        discoMode={discoMode}
        windSpeed={windSpeed}
        horizonColor={horizonColor}
        lightColor={lightColor}
        skyColor={skyColor}
        skyBrightness={skyBrightness}
      />
      <WaterGround
        discoMode={discoMode}
        pulseSpeed={pulseSpeed}
        pulseWidth={pulseWidth}
        reflectionClarity={reflectionClarity}
        lightColor={lightColor}
        waterColor={waterColor}
      />
    </>
  )
}
