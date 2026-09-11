import { SeededRandom, mixSeed } from './prng'
import type { ColorOptions, Mood, RampStop } from './types'

interface Oklch {
  l: number
  c: number
  h: number
}

const MOODS: Record<Mood, { hue: [number, number]; chroma: [number, number]; lightness: [number, number] }> = {
  dusk: { hue: [225, 315], chroma: [0.05, 0.16], lightness: [0.22, 0.78] },
  ember: { hue: [5, 72], chroma: [0.08, 0.2], lightness: [0.2, 0.82] },
  sea: { hue: [150, 245], chroma: [0.05, 0.17], lightness: [0.24, 0.86] },
  bloom: { hue: [305, 390], chroma: [0.07, 0.19], lightness: [0.3, 0.9] },
  monochrome: { hue: [0, 360], chroma: [0.015, 0.055], lightness: [0.12, 0.9] },
  acid: { hue: [72, 176], chroma: [0.14, 0.22], lightness: [0.34, 0.9] },
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const radians = (degrees: number) => (degrees * Math.PI) / 180
const degrees = (radiansValue: number) => (radiansValue * 180) / Math.PI
const normalizeHue = (hue: number) => ((hue % 360) + 360) % 360

function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function oklchToRawRgb(color: Oklch): [number, number, number] {
  const a = color.c * Math.cos(radians(color.h))
  const b = color.c * Math.sin(radians(color.h))
  const l_ = color.l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = color.l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = color.l - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

function inGamut(rgb: [number, number, number]): boolean {
  return rgb.every((channel) => channel >= 0 && channel <= 1)
}

export function oklchToHex(color: Oklch): string {
  let candidate = { ...color, h: normalizeHue(color.h) }
  if (!inGamut(oklchToRawRgb(candidate))) {
    let low = 0
    let high = candidate.c
    for (let index = 0; index < 18; index += 1) {
      const middle = (low + high) / 2
      if (inGamut(oklchToRawRgb({ ...candidate, c: middle }))) low = middle
      else high = middle
    }
    candidate = { ...candidate, c: low }
  }
  return `#${oklchToRawRgb(candidate)
    .map((channel) => Math.round(clamp(channel) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

export function hexToOklch(hex: string): Oklch {
  const normalized = hex.replace('#', '').padEnd(6, '0').slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((index) => srgbToLinear(Number.parseInt(normalized.slice(index, index + 2), 16) / 255))
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  const labL = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const labA = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const labB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  return { l: labL, c: Math.hypot(labA, labB), h: normalizeHue(degrees(Math.atan2(labB, labA))) }
}

function interpolateHue(from: number, to: number, amount: number): number {
  const delta = ((to - from + 540) % 360) - 180
  return normalizeHue(from + delta * amount)
}

export function interpolateColor(from: string, to: string, amount: number): string {
  const a = hexToOklch(from)
  const b = hexToOklch(to)
  return oklchToHex({
    l: a.l + (b.l - a.l) * amount,
    c: a.c + (b.c - a.c) * amount,
    h: interpolateHue(a.h, b.h, amount),
  })
}

export function sampleRamp(stops: RampStop[], amount: number): string {
  const value = clamp(amount)
  const rightIndex = stops.findIndex((stop) => stop.position >= value)
  if (rightIndex <= 0) return stops[0]?.color ?? '#000000'
  const right = stops[rightIndex]
  const left = stops[rightIndex - 1]
  if (!right || !left) return stops.at(-1)?.color ?? '#ffffff'
  const span = right.position - left.position
  return interpolateColor(left.color, right.color, span === 0 ? 0 : (value - left.position) / span)
}

function stopPositions(count: number, random: SeededRandom): number[] {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const values = Array.from({ length: count - 2 }, () => 0.08 + random.next() * 0.84).sort((a, b) => a - b)
    const positions = [0, ...values, 1]
    if (positions.every((value, index) => index === 0 || value - positions[index - 1] >= 0.08)) return positions
  }
  return Array.from({ length: count }, (_, index) => index / (count - 1))
}

function hueOffsets(random: SeededRandom, count: number, scheme: number): number[] {
  if (scheme < 0.5) return Array.from({ length: count }, () => random.between(-40, 40))
  if (scheme < 0.7) return Array.from({ length: count }, (_, index) => (index % 2 ? 150 : -150) + random.between(-18, 18))
  if (scheme < 0.9) return Array.from({ length: count }, (_, index) => ((index % 3) - 1) * random.between(100, 140))
  return Array.from({ length: count }, () => random.between(-6, 6))
}

function deltaOk(a: Oklch, b: Oklch): number {
  const ah = radians(a.h)
  const bh = radians(b.h)
  return Math.hypot(a.l - b.l, a.c * Math.cos(ah) - b.c * Math.cos(bh), a.c * Math.sin(ah) - b.c * Math.sin(bh))
}

function validRamp(colors: Oklch[]): boolean {
  const lightness = colors.map((color) => color.l)
  const range = Math.max(...lightness) - Math.min(...lightness)
  if (range < 0.35 || range > 0.85) return false
  return colors.every((color, index) => {
    if (index === 0) return true
    const previous = colors[index - 1]
    const midpoint = hexToOklch(interpolateColor(oklchToHex(previous), oklchToHex(color), 0.5))
    const midpointValid = previous.c <= 0.02 || color.c <= 0.02 || midpoint.c >= 0.02
    return midpointValid && deltaOk(previous, color) >= 0.08 && (Math.abs(previous.l - color.l) >= 0.06 || Math.abs(((previous.h - color.h + 540) % 360) - 180) > 40)
  })
}

export function generateRamp(seed: number, options: ColorOptions = { mode: 'random' }): RampStop[] {
  const random = new SeededRandom(mixSeed(seed, 0xc0104a))
  const count = random.int(3, 6)
  const positions = stopPositions(count, random)
  const mood = options.mode === 'mood' && options.mood ? MOODS[options.mood] : undefined
  const baseHue = mood ? random.between(...mood.hue) : random.between(0, 360)

  if (options.mode === 'seeded' && options.inputColors && options.inputColors.length >= 2) {
    const anchors = options.inputColors.slice(0, 4)
    const targetCount = Math.max(count, anchors.length)
    return Array.from({ length: targetCount }, (_, index) => {
      const position = index / (targetCount - 1)
      const anchorPosition = position * (anchors.length - 1)
      const left = Math.floor(anchorPosition)
      const right = Math.min(anchors.length - 1, left + 1)
      return { position, color: interpolateColor(anchors[left], anchors[right], anchorPosition - left) }
    })
  }

  let result: Oklch[] = []
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const offsets = hueOffsets(random, count, mood ? 0.25 : random.next())
    const minC = mood?.chroma[0] ?? 0.04
    const maxC = mood?.chroma[1] ?? 0.22
    const minL = mood?.lightness[0] ?? 0.16
    const maxL = mood?.lightness[1] ?? 0.91
    const lowFirst = random.next() > 0.5
    result = positions.map((position, index) => ({
      l: lowFirst ? minL + (maxL - minL) * position : maxL - (maxL - minL) * position,
      c: random.between(minC, maxC),
      h: normalizeHue(baseHue + offsets[index]),
    }))
    if (validRamp(result)) break
  }
  if (!validRamp(result)) {
    result = positions.map((position, index) => ({
      l: 0.2 + 0.65 * (index % 2 ? 1 - position : position),
      c: mood?.chroma[0] ?? 0.09,
      h: normalizeHue(baseHue + index * 36),
    }))
  }
  return positions.map((position, index) => ({ position, color: oklchToHex(result[index]) }))
}

export function paletteFromRamp(ramp: RampStop[]): string[] {
  return [0, 1 / 3, 2 / 3, 1].map((position) => sampleRamp(ramp, position))
}

export const moodNames: { value: Mood; label: string }[] = [
  { value: 'dusk', label: 'Dusk' },
  { value: 'ember', label: 'Ember' },
  { value: 'sea', label: 'Sea' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'acid', label: 'Acid' },
]
