import type { BlendMode, ColorMode, GradientDocument, GradientOverrides, Method, Mood, MotionMode, NoiseType, RampStop } from './types'

type CompactOverrides = {
  g?: GradientOverrides['generator']
  c?: GradientOverrides['color']
  a?: [number, number]
  sp?: number
  lr?: 1
  l?: GradientOverrides['layers']
  ramp?: [number, string][]
}

const METHODS: Method[] = ['radial', 'heightmap']
const MOTIONS: MotionMode[] = ['ambient', 'static', 'interactive']
const COLOR_MODES: ColorMode[] = ['random', 'mood', 'seeded', 'edit']
const MOODS: Mood[] = ['dusk', 'ember', 'sea', 'bloom', 'monochrome', 'acid']
const BLENDS: BlendMode[] = ['normal', 'screen', 'multiply']
const NOISE_TYPES: NoiseType[] = ['fractalNoise', 'turbulence']
const HEX = /^#[0-9a-fA-F]{6}$/

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): string {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}

function compact(overrides: GradientOverrides): CompactOverrides {
  return {
    ...(overrides.generator && Object.keys(overrides.generator).length ? { g: overrides.generator } : {}),
    ...(overrides.color && (overrides.color.mode !== 'random' || overrides.color.mood || overrides.color.inputColors) ? { c: overrides.color } : {}),
    ...(overrides.aspect ? { a: overrides.aspect } : {}),
    ...(overrides.speed !== undefined && overrides.speed !== 1 ? { sp: overrides.speed } : {}),
    ...(overrides.lockRamp ? { lr: 1 as const } : {}),
    ...(overrides.layers && Object.keys(overrides.layers).length ? { l: overrides.layers } : {}),
    ...(overrides.ramp?.length ? { ramp: overrides.ramp.map((stop) => [stop.position, stop.color] as [number, string]) } : {}),
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function finite(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined
}

function validateOverrides(value: unknown): GradientOverrides {
  const raw = record(value)
  if (!raw) return {}
  const overrides: GradientOverrides = {}
  const generator = record(raw.g)
  if (generator) {
    const clean: NonNullable<GradientOverrides['generator']> = {}
    const layerCount = finite(generator.layerCount, 5, 7)
    const radiusScale = finite(generator.radiusScale, 0.65, 1.35)
    const opacitySpread = finite(generator.opacitySpread, 0, 0.4)
    const frequency = finite(generator.frequency, 0.0015, 0.008)
    const octaves = finite(generator.octaves, 2, 4)
    const blur = finite(generator.blur, 2, 8)
    const contrast = finite(generator.contrast, 0.5, 2)
    if (layerCount !== undefined) clean.layerCount = Math.round(layerCount)
    if (radiusScale !== undefined) clean.radiusScale = radiusScale
    if (opacitySpread !== undefined) clean.opacitySpread = opacitySpread
    if (frequency !== undefined) clean.frequency = frequency
    if (octaves !== undefined) clean.octaves = Math.round(octaves)
    if (blur !== undefined) clean.blur = blur
    if (contrast !== undefined) clean.contrast = contrast
    if (typeof generator.blend === 'string' && BLENDS.includes(generator.blend as BlendMode)) clean.blend = generator.blend as BlendMode
    if (typeof generator.noiseType === 'string' && NOISE_TYPES.includes(generator.noiseType as NoiseType)) clean.noiseType = generator.noiseType as NoiseType
    if (typeof generator.posterize === 'boolean') clean.posterize = generator.posterize
    if (Object.keys(clean).length) overrides.generator = clean
  }
  const color = record(raw.c)
  if (color && typeof color.mode === 'string' && COLOR_MODES.includes(color.mode as ColorMode)) {
    const clean = { mode: color.mode as ColorMode }
    if (typeof color.mood === 'string' && MOODS.includes(color.mood as Mood)) Object.assign(clean, { mood: color.mood as Mood })
    if (Array.isArray(color.inputColors) && color.inputColors.length >= 2 && color.inputColors.length <= 4 && color.inputColors.every((item) => typeof item === 'string' && HEX.test(item))) Object.assign(clean, { inputColors: color.inputColors.map((item) => (item as string).toLowerCase()) })
    overrides.color = clean
  }
  if (Array.isArray(raw.a) && raw.a.length === 2) {
    const width = finite(raw.a[0], 1, 10000)
    const height = finite(raw.a[1], 1, 10000)
    if (width !== undefined && height !== undefined) overrides.aspect = [width, height]
  }
  const speed = finite(raw.sp, 0.5, 2)
  if (speed !== undefined) overrides.speed = speed
  if (raw.lr === 1) overrides.lockRamp = true
  const layers = record(raw.l)
  if (layers) {
    const cleanLayers: NonNullable<GradientOverrides['layers']> = {}
    for (const [key, layerValue] of Object.entries(layers)) {
      if (!/^[0-6]$/.test(key)) continue
      const layer = record(layerValue)
      if (!layer) continue
      const clean: NonNullable<GradientOverrides['layers']>[string] = {}
      const cx = finite(layer.cx, -0.2, 1.2)
      const cy = finite(layer.cy, -0.2, 1.2)
      const radius = finite(layer.radius, 0.28, 1.3)
      const rotation = finite(layer.rotation, 0, 180)
      const opacity = finite(layer.opacity, 0.6, 1)
      if (cx !== undefined) clean.cx = cx
      if (cy !== undefined) clean.cy = cy
      if (radius !== undefined) clean.radius = radius
      if (rotation !== undefined) clean.rotation = rotation
      if (opacity !== undefined) clean.opacity = opacity
      if (Object.keys(clean).length) cleanLayers[key] = clean
    }
    if (Object.keys(cleanLayers).length) overrides.layers = cleanLayers
  }
  if (Array.isArray(raw.ramp) && raw.ramp.length >= 2 && raw.ramp.length <= 6) {
    const ramp: RampStop[] = []
    for (const item of raw.ramp) {
      if (!Array.isArray(item) || item.length !== 2) { ramp.length = 0; break }
      const position = finite(item[0], 0, 1)
      const color = item[1]
      if (position === undefined || typeof color !== 'string' || !HEX.test(color)) { ramp.length = 0; break }
      ramp.push({ position, color: color.toLowerCase() })
    }
    if (ramp.length) overrides.ramp = ramp.sort((a, b) => a.position - b.position)
  }
  return overrides
}

export function serializeDocument(document: GradientDocument): string {
  const params = new URLSearchParams()
  params.set('m', document.method === 'radial' ? 'r' : 'h')
  params.set('v', String(document.version))
  params.set('s', document.seed.toString(16).padStart(8, '0'))
  if (document.motion !== 'ambient') params.set('mo', document.motion === 'static' ? 's' : 'i')
  const value = compact(document.overrides)
  if (Object.keys(value).length) params.set('o', encodeBase64Url(JSON.stringify(canonicalize(value))))
  return `?${params.toString()}`
}

export function parseDocument(search: string, fallbackSeed: number): { document: GradientDocument; warning?: string } {
  try {
    const params = new URLSearchParams(search)
    const version = params.get('v')
    if (version && version !== '1') throw new Error(`Version ${version} is not available in this build.`)
    const seedValue = params.get('s')
    if (seedValue && !/^[0-9a-fA-F]{8}$/.test(seedValue)) throw new Error('The shared seed is malformed.')
    const methodCode = params.get('m')
    if (methodCode && methodCode !== 'r' && methodCode !== 'h') throw new Error('The shared method is not supported.')
    const method: Method = methodCode === 'h' ? 'heightmap' : 'radial'
    if (!METHODS.includes(method)) throw new Error('The shared method is not supported.')
    const motionCode = params.get('mo')
    if (motionCode && motionCode !== 's' && motionCode !== 'i' && motionCode !== 'a') throw new Error('The shared motion mode is not supported.')
    const motion: MotionMode = motionCode === 's' ? 'static' : motionCode === 'i' ? 'interactive' : 'ambient'
    if (!MOTIONS.includes(motion)) throw new Error('The shared motion mode is not supported.')
    const encoded = params.get('o')
    const overrides = encoded ? validateOverrides(JSON.parse(decodeBase64Url(encoded))) : {}
    return {
      document: {
        version: 1,
        seed: seedValue ? Number.parseInt(seedValue, 16) >>> 0 : fallbackSeed >>> 0,
        method,
        motion,
        overrides,
      },
    }
  } catch (error) {
    return {
      document: { version: 1, seed: fallbackSeed >>> 0, method: 'radial', motion: 'ambient', overrides: {} },
      warning: error instanceof Error ? error.message : 'This shared gradient could not be read.',
    }
  }
}
