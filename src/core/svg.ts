import { sampleRamp } from './color'
import type { ResolvedGradient } from './types'

const n = (value: number) => Number(value.toFixed(5)).toString()
const escapeText = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function motionStyle(resolved: ResolvedGradient, animated: boolean): string {
  if (!animated) return ''
  const speed = resolved.document.overrides.speed ?? 1
  if (resolved.document.method === 'heightmap') {
    const { duration, panX, panY } = resolved.heightmap
    return `<style>.height-field{transform-box:fill-box;transform-origin:center;animation:h-${resolved.document.seed} ${n(duration / speed)}s ease-in-out infinite alternate}@keyframes h-${resolved.document.seed}{to{transform:translate(${n(panX)}px,${n(panY)}px) scale(1.02)}}</style>`
  }
  const rules = resolved.radial.layers
    .map((layer, index) => `.layer-${index}{transform-origin:center;animation:r-${resolved.document.seed}-${index} ${n(layer.duration / speed)}s ease-in-out ${n(layer.phase)}s infinite alternate}@keyframes r-${resolved.document.seed}-${index}{to{transform:translate(${n(layer.driftX)}%,${n(layer.driftY)}%) rotate(${n(layer.driftX * 0.65)}deg)}}`)
    .join('')
  return `<style>${rules}</style>`
}

function radialMarkup(resolved: ResolvedGradient): string {
  const id = `g${resolved.document.seed.toString(16)}`
  const defs = resolved.radial.layers
    .map((layer, index) => {
      const color = resolved.palette[layer.colorIndex]
      const transform = `rotate(${n(layer.rotation)} .5 .5) skewX(${n(layer.skewX)}) scale(${n(layer.scaleX)} ${n(layer.scaleY)})`
      return `<radialGradient id="${id}-${index}" cx="${n(layer.cx)}" cy="${n(layer.cy)}" r="${n(layer.radius)}" fx="${n(layer.fx)}" fy="${n(layer.fy)}" gradientTransform="${transform}" gradientUnits="objectBoundingBox"><stop stop-color="${color}"/><stop offset="${n(layer.midpoint)}" stop-color="${color}" stop-opacity=".72"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
    })
    .join('')
  const blend = resolved.radial.blend === 'normal' ? '' : ` style="mix-blend-mode:${resolved.radial.blend}"`
  const layers = resolved.radial.layers
    .map((layer, index) => `<g class="layer-${index}" opacity="${n(layer.opacity)}"${blend}><rect width="${n(resolved.width)}" height="${n(resolved.height)}" fill="url(#${id}-${index})"/></g>`)
    .join('')
  return `<defs>${defs}</defs><rect width="${n(resolved.width)}" height="${n(resolved.height)}" fill="${resolved.palette[0]}"/>${layers}`
}

function heightmapMarkup(resolved: ResolvedGradient): string {
  const id = `f${resolved.document.seed.toString(16)}`
  const params = resolved.heightmap
  const samples = Array.from({ length: 24 }, (_, index) => sampleRamp(resolved.ramp, index / 23))
  const channels = [0, 1, 2].map((channel) => samples.map((color) => Number.parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16) / 255).map(n).join(' '))
  const transferType = params.posterize ? 'discrete' : 'table'
  const intercept = 0.5 - 0.5 * params.contrast
  return `<defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feTurbulence type="${params.noiseType}" baseFrequency="${n(params.frequencyX)} ${n(params.frequencyY)}" numOctaves="${params.octaves}" seed="${params.noiseSeed}" result="noise"/><feColorMatrix in="noise" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1" result="height"/><feGaussianBlur in="height" stdDeviation="${n(params.blur)}" result="soft"/><feComponentTransfer in="soft" result="contrast"><feFuncR type="linear" slope="${n(params.contrast)}" intercept="${n(intercept)}"/><feFuncG type="linear" slope="${n(params.contrast)}" intercept="${n(intercept)}"/><feFuncB type="linear" slope="${n(params.contrast)}" intercept="${n(intercept)}"/><feFuncA type="identity"/></feComponentTransfer><feComponentTransfer in="contrast"><feFuncR type="${transferType}" tableValues="${channels[0]}"/><feFuncG type="${transferType}" tableValues="${channels[1]}"/><feFuncB type="${transferType}" tableValues="${channels[2]}"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter></defs><rect width="${n(resolved.width)}" height="${n(resolved.height)}" fill="${resolved.palette[0]}"/><g class="height-field"><rect x="-${n(resolved.width * 0.3)}" y="-${n(resolved.height * 0.3)}" width="${n(resolved.width * 1.6)}" height="${n(resolved.height * 1.6)}" filter="url(#${id})"/></g>`
}

export function renderSvg(resolved: ResolvedGradient, animated: boolean): string {
  const inner = `${motionStyle(resolved, animated)}${resolved.document.method === 'radial' ? radialMarkup(resolved) : heightmapMarkup(resolved)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(resolved.width)} ${n(resolved.height)}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${inner}</svg>`
}

export function renderReactSnippet(resolved: ResolvedGradient, animated: boolean): string {
  const svg = renderSvg(resolved, animated)
  const inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')).replaceAll('`', '\\`').replaceAll('${', '\\${')
  return `type GradientProps = {\n  className?: string\n  width?: number | string\n  height?: number | string\n}\n\nexport default function Gradient({ className, width = '100%', height = '100%' }: GradientProps) {\n  return (\n    <svg className={className} width={width} height={height} viewBox="0 0 ${n(resolved.width)} ${n(resolved.height)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" dangerouslySetInnerHTML={{ __html: \`${inner}\` }} />\n  )\n}\n`
}

export function renderCssSnippet(resolved: ResolvedGradient, animated: boolean): string {
  const encoded = encodeURIComponent(renderSvg(resolved, animated)).replaceAll('%20', ' ').replaceAll('%23', '#')
  return `background-image: url("data:image/svg+xml,${encoded}");`
}

export function svgFilename(resolved: ResolvedGradient): string {
  return `gradient-${resolved.document.method}-${resolved.document.seed.toString(16).padStart(8, '0')}.svg`
}

export function escapedSvgForHtml(svg: string): string {
  return escapeText(svg)
}
