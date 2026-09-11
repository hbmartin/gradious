export type Method = 'radial' | 'heightmap'
export type MotionMode = 'ambient' | 'static' | 'interactive'
export type ColorMode = 'random' | 'mood' | 'seeded' | 'edit'
export type Mood = 'dusk' | 'ember' | 'sea' | 'bloom' | 'monochrome' | 'acid'
export type BlendMode = 'normal' | 'screen' | 'multiply'
export type NoiseType = 'fractalNoise' | 'turbulence'

export interface RampStop {
  position: number
  color: string
}

export interface ColorOptions {
  mode: ColorMode
  mood?: Mood
  inputColors?: string[]
}

export interface LayerOverride {
  cx?: number
  cy?: number
  radius?: number
  rotation?: number
  opacity?: number
}

export interface GeneratorOverrides {
  layerCount?: number
  radiusScale?: number
  opacitySpread?: number
  blend?: BlendMode
  frequency?: number
  octaves?: number
  blur?: number
  contrast?: number
  posterize?: boolean
  noiseType?: NoiseType
}

export interface GradientOverrides {
  generator?: GeneratorOverrides
  color?: ColorOptions
  aspect?: [number, number]
  speed?: number
  lockRamp?: boolean
  layers?: Record<string, LayerOverride>
  ramp?: RampStop[]
}

export interface GradientDocument {
  version: 1
  seed: number
  method: Method
  motion: MotionMode
  overrides: GradientOverrides
}

export interface RadialLayer {
  cx: number
  cy: number
  radius: number
  fx: number
  fy: number
  scaleX: number
  scaleY: number
  rotation: number
  skewX: number
  midpoint: number
  opacity: number
  colorIndex: number
  duration: number
  phase: number
  driftX: number
  driftY: number
}

export interface RadialParams {
  layers: RadialLayer[]
  blend: BlendMode
}

export interface HeightmapParams {
  frequencyX: number
  frequencyY: number
  octaves: number
  blur: number
  contrast: number
  posterize: boolean
  noiseType: NoiseType
  noiseSeed: number
  duration: number
  panX: number
  panY: number
}

export interface ResolvedGradient {
  document: GradientDocument
  width: number
  height: number
  ramp: RampStop[]
  palette: string[]
  radial: RadialParams
  heightmap: HeightmapParams
}
