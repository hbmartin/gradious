import { generateRamp, paletteFromRamp } from '../../color'
import { SeededRandom, mixSeed } from '../../prng'
import type {
  GradientDocument,
  HeightmapParams,
  RadialLayer,
  RadialParams,
  RampStop,
  ResolvedGradient,
} from '../../types'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number, places = 5) => Number(value.toFixed(places))

function resolveRamp(document: GradientDocument): RampStop[] {
  const materialized = document.overrides.ramp
  if (materialized?.length) {
    return materialized
      .map((stop) => ({ position: clamp(stop.position, 0, 1), color: stop.color.toLowerCase() }))
      .sort((a, b) => a.position - b.position)
  }
  return generateRamp(document.seed, document.overrides.color)
}

function generateRadial(document: GradientDocument): RadialParams {
  const random = new SeededRandom(mixSeed(document.seed, 0x7ad1a1))
  const controls = document.overrides.generator ?? {}
  const layerCount = clamp(Math.round(controls.layerCount ?? random.int(5, 7)), 5, 7)
  const radiusScale = clamp(controls.radiusScale ?? 1, 0.65, 1.35)
  const opacitySpread = clamp(controls.opacitySpread ?? 0.2, 0, 0.4)
  const layers: RadialLayer[] = []
  let previousColor = -1

  for (let index = 0; index < layerCount; index += 1) {
    let colorIndex = random.int(0, 3)
    if (colorIndex === previousColor) colorIndex = (colorIndex + 1 + random.int(0, 2)) % 4
    previousColor = colorIndex
    const cx = round(random.between(-0.2, 1.2))
    const cy = round(random.between(-0.2, 1.2))
    const radius = round(clamp(random.between(0.4, 1.1) * radiusScale, 0.28, 1.3))
    const focalAngle = random.between(0, Math.PI * 2)
    const focalDistance = random.between(0.06, 0.35) * radius
    const layer: RadialLayer = {
      cx,
      cy,
      radius,
      fx: round(cx + Math.cos(focalAngle) * focalDistance),
      fy: round(cy + Math.sin(focalAngle) * focalDistance),
      scaleX: round(random.between(0.6, 1.8)),
      scaleY: round(random.between(0.4, 1.4)),
      rotation: round(random.between(0, 180), 2),
      skewX: round(random.between(-25, 25), 2),
      midpoint: round(random.between(0.35, 0.65)),
      opacity: round(clamp(0.8 + random.between(-opacitySpread, opacitySpread), 0.6, 1)),
      colorIndex,
      duration: round(random.between(20, 60), 2),
      phase: round(-random.between(0, 60), 2),
      driftX: round(random.between(-6, 6), 2),
      driftY: round(random.between(-5, 5), 2),
    }
    const edited = document.overrides.layers?.[String(index)]
    if (edited) {
      const deltaX = edited.cx === undefined ? 0 : edited.cx - layer.cx
      const deltaY = edited.cy === undefined ? 0 : edited.cy - layer.cy
      Object.assign(layer, edited)
      layer.fx = round(layer.fx + deltaX)
      layer.fy = round(layer.fy + deltaY)
    }
    layers.push(layer)
  }

  return { layers, blend: controls.blend ?? 'normal' }
}

function generateHeightmap(document: GradientDocument): HeightmapParams {
  const random = new SeededRandom(mixSeed(document.seed, 0x4e015e))
  const controls = document.overrides.generator ?? {}
  const frequency = clamp(controls.frequency ?? random.between(0.0015, 0.008), 0.0015, 0.008)
  const stretch = random.between(0.62, 1.38)
  return {
    frequencyX: round(frequency * stretch, 6),
    frequencyY: round(frequency / stretch, 6),
    octaves: clamp(Math.round(controls.octaves ?? random.int(2, 4)), 2, 4),
    blur: round(clamp(controls.blur ?? random.between(2, 8), 2, 8), 2),
    contrast: round(clamp(controls.contrast ?? 1, 0.5, 2), 2),
    posterize: controls.posterize ?? false,
    noiseType: controls.noiseType ?? 'fractalNoise',
    noiseSeed: random.int(1, 9999),
    duration: round(random.between(40, 90), 2),
    panX: round(random.between(-125, 125), 2),
    panY: round(random.between(-80, 80), 2),
  }
}

export function resolveGradient(document: GradientDocument): ResolvedGradient {
  const [width, height] = document.overrides.aspect ?? [16, 9]
  const safeWidth = clamp(width, 1, 10000)
  const safeHeight = clamp(height, 1, 10000)
  const viewWidth = 1000
  const viewHeight = round((viewWidth * safeHeight) / safeWidth, 3)
  const ramp = resolveRamp(document)
  return {
    document,
    width: viewWidth,
    height: viewHeight,
    ramp,
    palette: paletteFromRamp(ramp),
    radial: generateRadial(document),
    heightmap: generateHeightmap(document),
  }
}
