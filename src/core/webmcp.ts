import type { ColorMode, GradientDocument, Method, MotionMode, ResolvedGradient } from './types'

interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
}

interface ModelContext {
  registerTool(tool: ToolDefinition, options?: { signal?: AbortSignal }): void | Promise<void>
}

declare global {
  interface Document { readonly modelContext?: ModelContext }
}

interface WebMcpActions {
  getDocument: () => GradientDocument
  getGradient: () => ResolvedGradient
  regenerate: () => GradientDocument
  configure: (input: { method?: Method; motion?: MotionMode; speed?: number; colorMode?: ColorMode; aspect?: [number, number] }) => GradientDocument
  exportGradient: (format: 'svg' | 'react' | 'css', animated: boolean) => { filename: string; content: string }
}

export function registerWebMcp(actions: WebMcpActions): () => void {
  const context = globalThis.document.modelContext
  if (!context?.registerTool) return () => undefined
  const lifecycle = new AbortController()
  const register = (tool: ToolDefinition) => {
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined) } catch { /* progressive enhancement */ }
  }

  register({ name: 'get_gradient_state', title: 'Get gradient state', description: 'Read the current Gradious method, seed, motion, colors, and aspect ratio.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => { const doc = actions.getDocument(); const gradient = actions.getGradient(); return { version: doc.version, seed: doc.seed.toString(16).padStart(8, '0'), method: doc.method, motion: doc.motion, aspect: [gradient.width, gradient.height], ramp: gradient.ramp } } })
  register({ name: 'regenerate_gradient', title: 'Regenerate gradient', description: 'Create a new seeded gradient while honoring the visible ramp lock.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => actions.regenerate() })
  register({ name: 'configure_gradient', title: 'Configure gradient', description: 'Update one or more visible Gradious options.', inputSchema: { type: 'object', properties: { method: { enum: ['radial','heightmap'] }, motion: { enum: ['ambient','static','interactive'] }, speed: { type: 'number', minimum: 0.5, maximum: 2 }, colorMode: { enum: ['random','mood','seeded','edit'] }, aspect: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 1, maximum: 10000 } } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => actions.configure(input as Parameters<WebMcpActions['configure']>[0]) })
  register({ name: 'export_gradient', title: 'Export gradient', description: 'Return the current gradient as SVG, a React component, or CSS data URI.', inputSchema: { type: 'object', properties: { format: { enum: ['svg','react','css'] }, animated: { type: 'boolean' } }, required: ['format'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: (input) => actions.exportGradient(input.format as 'svg' | 'react' | 'css', input.animated === true) })
  return () => lifecycle.abort()
}
