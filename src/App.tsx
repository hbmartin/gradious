import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { ExportDialog } from './components/ExportDialog'
import { GradientCanvas } from './components/GradientCanvas'
import { resolveGradient } from './core/generators/v1'
import { randomSeed } from './core/prng'
import { renderCssSnippet, renderReactSnippet, renderSvg, svgFilename } from './core/svg'
import type { ColorMode, ColorOptions, GeneratorOverrides, GradientDocument, GradientOverrides, LayerOverride, Method, MotionMode, RampStop } from './core/types'
import { parseDocument, serializeDocument } from './core/url'
import { registerWebMcp } from './core/webmcp'
import './App.css'

const initial = parseDocument(window.location.search, randomSeed())

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

function App() {
  const [gradientDoc, setGradientDoc] = useState<GradientDocument>(initial.document)
  const [expanded, setExpanded] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [warning, setWarning] = useState<string | undefined>(initial.warning)
  const [message, setMessage] = useState<string>()
  const [performanceFallback, setPerformanceFallback] = useState<Record<Method, boolean>>(() => ({
    radial: Number(sessionStorage.getItem('gradious-fps-radial')) > 0 && Number(sessionStorage.getItem('gradious-fps-radial')) < 24,
    heightmap: Number(sessionStorage.getItem('gradious-fps-heightmap')) > 0 && Number(sessionStorage.getItem('gradious-fps-heightmap')) < 24,
  }))
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const desktopInteractive = useMedia('(hover: hover) and (pointer: fine)')
  const gradient = useMemo(() => resolveGradient(gradientDoc), [gradientDoc])
  const documentRef = useRef(gradientDoc)
  const gradientRef = useRef(gradient)

  useEffect(() => {
    documentRef.current = gradientDoc
    gradientRef.current = gradient
  }, [gradient, gradientDoc])

  const showMessage = useCallback((value: string) => {
    setMessage(value)
    window.setTimeout(() => setMessage((current) => current === value ? undefined : current), 2600)
  }, [])

  const commit = useCallback((next: GradientDocument, push = false) => {
    const url = serializeDocument(next)
    window.history[push ? 'pushState' : 'replaceState'](null, '', url)
    documentRef.current = next
    setGradientDoc(next)
    return next
  }, [])

  const updateOverrides = useCallback((updater: (value: GradientOverrides) => GradientOverrides) => {
    const current = documentRef.current
    return commit({ ...current, overrides: updater(current.overrides) })
  }, [commit])

  const regenerate = useCallback(() => {
    const current = documentRef.current
    const overrides: GradientOverrides = { ...current.overrides }
    if (!overrides.lockRamp) delete overrides.ramp
    const next: GradientDocument = { ...current, seed: randomSeed(), overrides }
    if (overrides.color?.mode === 'edit' && !overrides.lockRamp) next.overrides = { ...overrides, ramp: resolveGradient(next).ramp }
    commit(next, true)
    return next
  }, [commit])

  const setMethod = useCallback((method: Method) => commit({ ...documentRef.current, method }), [commit])
  const setMotion = useCallback((motion: MotionMode) => commit({ ...documentRef.current, motion }), [commit])
  const setGenerator = useCallback((change: Partial<GeneratorOverrides>) => updateOverrides((value) => ({ ...value, generator: { ...value.generator, ...change } })), [updateOverrides])
  const setAspect = useCallback((aspect: [number, number] | undefined) => updateOverrides((value) => {
    const next = { ...value }
    if (!aspect || (aspect[0] === 16 && aspect[1] === 9)) delete next.aspect
    else next.aspect = aspect
    return next
  }), [updateOverrides])

  const setColorMode = useCallback((mode: ColorMode) => updateOverrides((value) => {
    if (mode === 'random') {
      const next = { ...value }
      delete next.color
      if (!next.lockRamp) delete next.ramp
      return next
    }
    const color: ColorOptions = { ...(value.color ?? { mode: 'random' }), mode }
    const next: GradientOverrides = { ...value, color }
    if (mode === 'mood' && !color.mood) color.mood = 'dusk'
    if (mode === 'seeded' && !color.inputColors?.length) color.inputColors = gradientRef.current.palette.slice(0, 2)
    if (mode === 'edit') next.ramp = gradientRef.current.ramp.map((stop) => ({ ...stop }))
    return next
  }), [updateOverrides])

  const setRamp = useCallback((ramp: RampStop[]) => updateOverrides((value) => ({ ...value, ramp, color: { ...(value.color ?? { mode: 'edit' }), mode: 'edit' } })), [updateOverrides])
  const setLockRamp = useCallback((locked: boolean) => updateOverrides((value) => ({ ...value, lockRamp: locked || undefined, ramp: locked ? gradientRef.current.ramp.map((stop) => ({ ...stop })) : value.ramp })), [updateOverrides])
  const setLayer = useCallback((index: number, change: LayerOverride) => updateOverrides((value) => ({ ...value, layers: { ...value.layers, [String(index)]: { ...value.layers?.[String(index)], ...change } } })), [updateOverrides])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showMessage('Share link copied')
    } catch { showMessage('Copy failed. Copy the address from your browser.') }
  }, [showMessage])

  const configureFromTool = useCallback((input: { method?: Method; motion?: MotionMode; speed?: number; colorMode?: ColorMode; aspect?: [number, number] }) => {
    const current = documentRef.current
    if (input.speed !== undefined && (input.speed < 0.5 || input.speed > 2)) throw new Error('speed must be between 0.5 and 2')
    if (input.aspect && (!input.aspect.every((value) => Number.isFinite(value) && value >= 1 && value <= 10000))) throw new Error('aspect values must be between 1 and 10000')
    const overrides = { ...current.overrides }
    if (input.speed !== undefined) overrides.speed = input.speed === 1 ? undefined : input.speed
    if (input.aspect) overrides.aspect = input.aspect[0] === 16 && input.aspect[1] === 9 ? undefined : input.aspect
    if (input.colorMode) overrides.color = { ...(overrides.color ?? { mode: 'random' }), mode: input.colorMode }
    return commit({ ...current, method: input.method ?? current.method, motion: input.motion ?? current.motion, overrides })
  }, [commit])

  useEffect(() => {
    window.history.replaceState(null, '', serializeDocument(documentRef.current))
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseDocument(window.location.search, randomSeed())
      setGradientDoc(parsed.document)
      documentRef.current = parsed.document
      setWarning(parsed.warning)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => registerWebMcp({
    getDocument: () => documentRef.current,
    getGradient: () => gradientRef.current,
    regenerate,
    configure: configureFromTool,
    exportGradient: (format, animated) => ({
      filename: format === 'svg' ? svgFilename(gradientRef.current) : `gradient-${gradientRef.current.document.seed.toString(16).padStart(8, '0')}.${format === 'react' ? 'tsx' : 'css'}`,
      content: format === 'svg' ? renderSvg(gradientRef.current, animated) : format === 'react' ? renderReactSnippet(gradientRef.current, animated) : renderCssSnippet(gradientRef.current, animated),
    }),
  }), [configureFromTool, regenerate])

  useEffect(() => {
    if (gradientDoc.motion !== 'ambient' || reducedMotion || document.visibilityState !== 'visible') return
    const key = `gradious-fps-${gradientDoc.method}`
    if (sessionStorage.getItem(key)) return
    let frames = 0
    let handle = 0
    const started = performance.now()
    const frame = (time: number) => {
      frames += 1
      if (time - started < 2000) handle = requestAnimationFrame(frame)
      else {
        const fps = frames / ((time - started) / 1000)
        sessionStorage.setItem(key, String(Math.round(fps)))
        if (fps < 24) { setPerformanceFallback((current) => ({ ...current, [gradientDoc.method]: true })); setWarning('Ambient motion was paused because this device could not sustain it.') }
      }
    }
    handle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(handle)
  }, [gradientDoc.method, gradientDoc.motion, reducedMotion])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT','TEXTAREA','SELECT'].includes(target.tagName) || target.isContentEditable) return
      if (event.key === ' ') { event.preventDefault(); regenerate() }
      else if (event.key === '1') setMethod('radial')
      else if (event.key === '2') setMethod('heightmap')
      else if (event.key.toLowerCase() === 'e') setExportOpen(true)
      else if (event.key.toLowerCase() === 'c') void copyLink()
      else if (event.key === 'Escape') { setPanelOpen(false); setExpanded(false); setShortcutsOpen(false) }
      else if (event.key === '?') setShortcutsOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [copyLink, regenerate, setMethod])

  const effectiveMotion: MotionMode = reducedMotion || performanceFallback[gradientDoc.method] ? 'static' : gradientDoc.motion === 'interactive' && !desktopInteractive ? 'ambient' : gradientDoc.motion

  return (
    <main className="app-shell">
      <GradientCanvas gradient={gradient} animated={effectiveMotion === 'ambient'} interactive={effectiveMotion === 'interactive'} onLayerEdit={setLayer} />
      <a className="source-credit" href="https://justinjay.wang/methods-for-random-gradients/" target="_blank" rel="noreferrer">Methods by Justin Jay Wang ↗</a>

      <div className="control-dock">
        {!expanded ? <button className="dock-trigger" type="button" onClick={() => setExpanded(true)} aria-expanded="false"><span className="mark" aria-hidden="true">G</span><span>Shape this gradient</span><span aria-hidden="true">⌃</span></button> :
          <div className="quick-controls">
            <button className="primary-button" type="button" onClick={regenerate}>Regenerate</button>
            <div className="segmented" aria-label="Gradient method"><button className={gradientDoc.method === 'radial' ? 'active' : ''} type="button" onClick={() => setMethod('radial')}>Radial</button><button className={gradientDoc.method === 'heightmap' ? 'active' : ''} type="button" onClick={() => setMethod('heightmap')}>Heightmap</button></div>
            <label className="quick-select"><span className="sr-only">Color mode</span><select value={gradientDoc.overrides.color?.mode ?? 'random'} onChange={(event) => setColorMode(event.target.value as ColorMode)}><option value="random">Random color</option><option value="mood">Mood</option><option value="seeded">Seeded color</option><option value="edit">Edit stops</option></select></label>
            <label className="quick-select motion-select"><span className="sr-only">Motion mode</span><select value={gradientDoc.motion} onChange={(event) => setMotion(event.target.value as MotionMode)}><option value="ambient" disabled={reducedMotion}>Ambient</option><option value="static">Static</option>{desktopInteractive && <option value="interactive">Interactive</option>}</select></label>
            <button className="icon-button" type="button" aria-label="More controls" onClick={() => setPanelOpen(true)}>•••</button>
            <button className="icon-button" type="button" aria-label="Collapse controls" onClick={() => setExpanded(false)}>⌄</button>
          </div>}
      </div>

      <ControlPanel document={gradientDoc} gradient={gradient} open={panelOpen} desktopInteractive={desktopInteractive} reducedMotion={reducedMotion} onClose={() => setPanelOpen(false)} onMethod={setMethod} onMotion={setMotion} onGenerator={setGenerator} onColorMode={setColorMode} onColorOptions={(change) => updateOverrides((value) => ({ ...value, color: { ...(value.color ?? { mode: 'random' }), ...change } as ColorOptions }))} onRamp={setRamp} onLockRamp={setLockRamp} onAspect={setAspect} onSpeed={(speed) => updateOverrides((value) => ({ ...value, speed: speed === 1 ? undefined : speed }))} onExport={() => setExportOpen(true)} onCopyLink={() => void copyLink()} />
      <ExportDialog gradient={gradient} open={exportOpen} onClose={() => setExportOpen(false)} onMessage={showMessage} />

      {shortcutsOpen && <dialog className="shortcuts-dialog" open aria-label="Keyboard shortcuts"><div className="dialog-heading"><div><p className="eyebrow">Keyboard</p><h2>Shortcuts</h2></div><button className="round-button" type="button" aria-label="Close shortcuts" onClick={() => setShortcutsOpen(false)}>×</button></div><dl><div><dt>Space</dt><dd>Regenerate</dd></div><div><dt>1 / 2</dt><dd>Switch method</dd></div><div><dt>E</dt><dd>Export</dd></div><div><dt>C</dt><dd>Copy link</dd></div><div><dt>Esc</dt><dd>Collapse</dd></div><div><dt>?</dt><dd>Shortcuts</dd></div></dl></dialog>}
      {warning && <div className="notice" role="status"><span>{warning}</span><button type="button" aria-label="Dismiss notice" onClick={() => setWarning(undefined)}>×</button></div>}
      {message && <div className="toast" role="status">{message}</div>}
    </main>
  )
}

export default App
