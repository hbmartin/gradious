import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveGradient } from '../src/core/generators/v1'
import { renderSvg } from '../src/core/svg'
import type { GradientDocument, Method } from '../src/core/types'

const methods: Method[] = ['radial', 'heightmap']
const seedFor = (method: Method, index: number) =>
  (Math.imul(index + 1, 0x9e3779b1) ^ (method === 'radial' ? 0x7ad1a1 : 0x4e015e)) >>> 0

function card(method: Method, index: number): string {
  const seed = seedFor(method, index)
  const document: GradientDocument = { version: 1, seed, method, motion: 'static', overrides: {} }
  const seedHex = seed.toString(16).padStart(8, '0')
  return `<figure>${renderSvg(resolveGradient(document), false)}<figcaption>${method} · ${seedHex}</figcaption></figure>`
}

describe('manual aesthetic gallery', () => {
  it('materializes 100 deterministic seeds for each v1 method', () => {
    const sections = methods.map((method) =>
      `<section><h2>${method}</h2><div class="grid">${Array.from({ length: 100 }, (_, index) => card(method, index)).join('')}</div></section>`,
    ).join('')
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Gradious v1 gallery</title><style>body{margin:0;padding:32px;background:#09090b;color:#fafafa;font:14px system-ui}h1{margin:0 0 8px}h2{text-transform:capitalize;margin-top:48px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}figure{margin:0;border:1px solid #303036;border-radius:12px;overflow:hidden;background:#18181b}svg{display:block;width:100%;aspect-ratio:16/9}figcaption{padding:9px 11px;color:#d4d4d8;font:12px ui-monospace,monospace}</style><body><h1>Gradious v1 deterministic gallery</h1><p>100 fixed seeds per generator for manual aesthetic review.</p>${sections}</body></html>`
    mkdirSync('test-results', { recursive: true })
    writeFileSync('test-results/gradient-gallery.html', html)
    expect((html.match(/<figure>/g) ?? [])).toHaveLength(200)
  })
})
