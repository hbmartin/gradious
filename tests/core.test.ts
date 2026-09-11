import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { generateRamp, hexToOklch, interpolateColor, paletteFromRamp } from '../src/core/color'
import { resolveGradient } from '../src/core/generators/v1'
import { SeededRandom } from '../src/core/prng'
import { renderSvg } from '../src/core/svg'
import type { GradientDocument } from '../src/core/types'
import { parseDocument, serializeDocument } from '../src/core/url'

const makeDocument = (seed = 0x8f3a2b1c, method: GradientDocument['method'] = 'radial'): GradientDocument => ({ version: 1, seed, method, motion: 'ambient', overrides: {} })

describe('seeded generation', () => {
  it('produces stable random streams', () => {
    const first = new SeededRandom(42)
    const second = new SeededRandom(42)
    expect(Array.from({ length: 16 }, () => first.next())).toEqual(Array.from({ length: 16 }, () => second.next()))
  })

  it('pins representative v1 output', () => {
    const gradient = resolveGradient(makeDocument())
    expect({ ramp: gradient.ramp, firstLayer: gradient.radial.layers[0], noiseSeed: gradient.heightmap.noiseSeed }).toMatchSnapshot()
  })

  it('keeps generated color ramps in the declared shape', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const ramp = generateRamp(seed, { mode: 'random' })
      expect(ramp.length).toBeGreaterThanOrEqual(3)
      expect(ramp.length).toBeLessThanOrEqual(6)
      expect(ramp[0].position).toBe(0)
      expect(ramp.at(-1)?.position).toBe(1)
      expect(paletteFromRamp(ramp)).toHaveLength(4)
      for (const stop of ramp) expect(stop.color).toMatch(/^#[0-9a-f]{6}$/)
      const colors = ramp.map((stop) => hexToOklch(stop.color))
      const lightness = colors.map((color) => color.l)
      expect(Math.max(...lightness) - Math.min(...lightness)).toBeGreaterThanOrEqual(0.34)
      expect(Math.max(...lightness) - Math.min(...lightness)).toBeLessThanOrEqual(0.86)
    }
  })

  it('interpolates seeded colors through OKLCH', () => {
    expect(hexToOklch(interpolateColor('#ff0000', '#0000ff', 0.5)).c).toBeGreaterThan(0.1)
  })
})

describe('URL codec', () => {
  it('round-trips canonical documents exactly', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 0xffffffff }),
      fc.constantFrom<'radial' | 'heightmap'>('radial', 'heightmap'),
      fc.constantFrom<'ambient' | 'static' | 'interactive'>('ambient', 'static', 'interactive'),
      fc.option(fc.double({ min: 0.5, max: 2, noNaN: true }), { nil: undefined }),
      (seed, method, motion, speed) => {
        const document: GradientDocument = { version: 1, seed: seed >>> 0, method, motion, overrides: speed === undefined || speed === 1 ? {} : { speed } }
        expect(parseDocument(serializeDocument(document), 0).document).toEqual(document)
      },
    ), { numRuns: 500 })
  })

  it('falls back safely for malformed links', () => {
    const parsed = parseDocument('?v=99&s=oops&o=!', 123)
    expect(parsed.warning).toBeTruthy()
    expect(parsed.document.seed).toBe(123)
  })

  it('round-trips compact materialized ramps exactly', () => {
    const document: GradientDocument = {
      ...makeDocument(),
      overrides: { lockRamp: true, ramp: [{ position: 0, color: '#112233' }, { position: 0.47, color: '#abcdef' }, { position: 1, color: '#ffffff' }] },
    }
    const encoded = serializeDocument(document)
    expect(encoded.length).toBeLessThan(190)
    expect(parseDocument(encoded, 0).document).toEqual(document)
  })

  it('drops unsafe override fields before rendering', () => {
    const payload = btoa(JSON.stringify({ g: { blend: '"><script>alert(1)</script>', frequency: 99 }, ramp: [[0, '"><script>'], [1, '#ffffff']] }))
    const parsed = parseDocument(`?m=r&v=1&s=8f3a2b1c&o=${payload}`, 0)
    expect(parsed.document.overrides).toEqual({})
    expect(renderSvg(resolveGradient(parsed.document), false)).not.toContain('<script>')
  })
})

describe('durability budget', () => {
  it('keeps the retained v1 core below 25KB gzip', () => {
    const files = ['src/core/prng.ts', 'src/core/color.ts', 'src/core/generators/v1/index.ts', 'src/core/url.ts', 'src/core/svg.ts']
    const source = files.map((file) => readFileSync(file)).join('\n')
    expect(gzipSync(source).byteLength).toBeLessThan(25 * 1024)
  })
})

describe('SVG export', () => {
  it.each(['radial', 'heightmap'] as const)('exports self-contained %s SVG within budget', (method) => {
    const gradient = resolveGradient(makeDocument(0x8f3a2b1c, method))
    const staticSvg = renderSvg(gradient, false)
    const animatedSvg = renderSvg(gradient, true)
    expect(staticSvg).toMatch(/^<svg[^>]+xmlns=/)
    expect(staticSvg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/<script|https?:\/\//)
    expect(new TextEncoder().encode(staticSvg).length).toBeLessThan(8192)
    expect(new TextEncoder().encode(animatedSvg).length).toBeLessThan(10240)
  })
})
