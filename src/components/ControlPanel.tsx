import { moodNames } from '../core/color'
import type { ColorMode, GradientDocument, GeneratorOverrides, Method, MotionMode, RampStop, ResolvedGradient } from '../core/types'

const ASPECTS = [
  ['16:9', 16, 9], ['3:2', 3, 2], ['4:3', 4, 3], ['1:1', 1, 1], ['3:4', 3, 4], ['4:5', 4, 5], ['2:3', 2, 3], ['9:16', 9, 16],
] as const

interface ControlPanelProps {
  document: GradientDocument
  gradient: ResolvedGradient
  open: boolean
  desktopInteractive: boolean
  reducedMotion: boolean
  onClose: () => void
  onMethod: (method: Method) => void
  onMotion: (motion: MotionMode) => void
  onGenerator: (change: Partial<GeneratorOverrides>) => void
  onColorMode: (mode: ColorMode) => void
  onColorOptions: (change: Record<string, unknown>) => void
  onRamp: (ramp: RampStop[]) => void
  onLockRamp: (locked: boolean) => void
  onAspect: (aspect: [number, number] | undefined) => void
  onSpeed: (speed: number) => void
  onExport: () => void
  onCopyLink: () => void
}

function Range({ label, value, min, max, step, onChange, display }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; display?: string }) {
  return <label className="range-control"><span><b>{label}</b><output>{display ?? value}</output></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

export function ControlPanel(props: ControlPanelProps) {
  const { document, gradient, open } = props
  const generator = document.overrides.generator ?? {}
  const color = document.overrides.color ?? { mode: 'random' as const }
  const aspect = document.overrides.aspect ?? [16, 9]
  const preset = ASPECTS.find(([, width, height]) => width === aspect[0] && height === aspect[1])?.[0] ?? 'custom'

  return (
    <aside className={`control-panel ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="panel-heading"><div><p className="eyebrow">Gradient studio</p><h2>Shape the field</h2></div><button className="round-button" type="button" aria-label="Close full controls" onClick={props.onClose}>×</button></div>
      <section className="panel-section"><div className="section-heading"><h3>Generator</h3><span>{document.seed.toString(16).padStart(8, '0')}</span></div>
        <div className="segmented wide" aria-label="Generator method"><button className={document.method === 'radial' ? 'active' : ''} type="button" onClick={() => props.onMethod('radial')}>Radial</button><button className={document.method === 'heightmap' ? 'active' : ''} type="button" onClick={() => props.onMethod('heightmap')}>Heightmap</button></div>
        {document.method === 'radial' ? <>
          <Range label="Layers" value={gradient.radial.layers.length} min={5} max={7} step={1} onChange={(layerCount) => props.onGenerator({ layerCount })} />
          <Range label="Radius" value={generator.radiusScale ?? 1} min={0.65} max={1.35} step={0.01} display={`${Math.round((generator.radiusScale ?? 1) * 100)}%`} onChange={(radiusScale) => props.onGenerator({ radiusScale })} />
          <Range label="Opacity spread" value={generator.opacitySpread ?? 0.2} min={0} max={0.4} step={0.01} onChange={(opacitySpread) => props.onGenerator({ opacitySpread })} />
          <label className="field"><span>Blend <small>experimental</small></span><select value={generator.blend ?? 'normal'} onChange={(event) => props.onGenerator({ blend: event.target.value as GeneratorOverrides['blend'] })}><option value="normal">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option></select></label>
        </> : <>
          <Range label="Frequency" value={generator.frequency ?? Number(Math.sqrt(gradient.heightmap.frequencyX * gradient.heightmap.frequencyY).toFixed(5))} min={0.0015} max={0.008} step={0.0001} onChange={(frequency) => props.onGenerator({ frequency })} />
          <Range label="Octaves" value={gradient.heightmap.octaves} min={2} max={4} step={1} onChange={(octaves) => props.onGenerator({ octaves })} />
          <Range label="Softness" value={gradient.heightmap.blur} min={2} max={8} step={0.1} onChange={(blur) => props.onGenerator({ blur })} />
          <Range label="Contrast" value={gradient.heightmap.contrast} min={0.5} max={2} step={0.05} onChange={(contrast) => props.onGenerator({ contrast })} />
          <label className="field"><span>Noise</span><select value={generator.noiseType ?? 'fractalNoise'} onChange={(event) => props.onGenerator({ noiseType: event.target.value as GeneratorOverrides['noiseType'] })}><option value="fractalNoise">Fractal</option><option value="turbulence">Turbulence</option></select></label>
          <label className="switch-row"><input type="checkbox" checked={generator.posterize ?? false} onChange={(event) => props.onGenerator({ posterize: event.target.checked })} /><span>Posterize color bands</span></label>
        </>}
      </section>

      <section className="panel-section"><div className="section-heading"><h3>Color</h3><span>{gradient.ramp.length} stops</span></div>
        <div className="mode-grid" aria-label="Color mode">
          {([['random','Random'],['mood','Mood'],['seeded','Seeded'],['edit','Edit stops']] as [ColorMode,string][]).map(([value,label]) => <button key={value} className={color.mode === value ? 'active' : ''} type="button" onClick={() => props.onColorMode(value)}>{label}</button>)}
        </div>
        {color.mode === 'mood' && <label className="field"><span>Mood</span><select value={color.mood ?? 'dusk'} onChange={(event) => props.onColorOptions({ mood: event.target.value })}>{moodNames.map((mood) => <option key={mood.value} value={mood.value}>{mood.label}</option>)}</select></label>}
        {color.mode === 'seeded' && <div className="seed-colors"><span className="field-label">Anchor colors</span><div className="color-row">{(color.inputColors ?? gradient.palette.slice(0, 2)).map((value, index, values) => <input key={index} aria-label={`Anchor color ${index + 1}`} type="color" value={value} onChange={(event) => { const next = [...values]; next[index] = event.target.value; props.onColorOptions({ inputColors: next }) }} />)}{(color.inputColors?.length ?? 2) < 4 && <button type="button" onClick={() => props.onColorOptions({ inputColors: [...(color.inputColors ?? gradient.palette.slice(0, 2)), gradient.palette[2]] })}>+</button>}{(color.inputColors?.length ?? 2) > 2 && <button type="button" onClick={() => props.onColorOptions({ inputColors: (color.inputColors ?? gradient.palette.slice(0, 2)).slice(0, -1) })}>−</button>}</div></div>}
        <div className="ramp-preview" style={{ background: `linear-gradient(90deg, ${gradient.ramp.map((stop) => `${stop.color} ${stop.position * 100}%`).join(',')})` }} />
        {color.mode === 'edit' && <div className="stop-editor">{gradient.ramp.map((stop, index) => <div className="stop-row" key={index}><input aria-label={`Stop ${index + 1} color`} type="color" value={stop.color} onChange={(event) => { const next = gradient.ramp.map((item) => ({ ...item })); next[index].color = event.target.value; props.onRamp(next) }} /><input aria-label={`Stop ${index + 1} position`} type="range" min={0} max={1} step={0.01} value={stop.position} disabled={index === 0 || index === gradient.ramp.length - 1} onChange={(event) => { const next = gradient.ramp.map((item) => ({ ...item })); next[index].position = Number(event.target.value); props.onRamp(next.sort((a,b) => a.position - b.position)) }} /><output>{Math.round(stop.position * 100)}%</output></div>)}</div>}
        <label className="switch-row"><input type="checkbox" checked={document.overrides.lockRamp ?? false} onChange={(event) => props.onLockRamp(event.target.checked)} /><span>Lock ramp when regenerating</span></label>
      </section>

      <section className="panel-section"><div className="section-heading"><h3>Composition</h3></div>
        <label className="field"><span>Aspect ratio</span><select value={preset} onChange={(event) => { const selected = ASPECTS.find(([name]) => name === event.target.value); props.onAspect(selected ? [selected[1], selected[2]] : [5, 3]) }}>{ASPECTS.map(([name]) => <option key={name}>{name}</option>)}<option value="custom">Custom</option></select></label>
        {preset === 'custom' && <div className="custom-aspect"><label>Width<input type="number" min="1" max="10000" value={aspect[0]} onChange={(event) => props.onAspect([Math.max(1, Number(event.target.value)), aspect[1]])} /></label><span>×</span><label>Height<input type="number" min="1" max="10000" value={aspect[1]} onChange={(event) => props.onAspect([aspect[0], Math.max(1, Number(event.target.value))])} /></label></div>}
      </section>

      <section className="panel-section"><div className="section-heading"><h3>Motion</h3></div>
        <div className="segmented wide" aria-label="Motion mode">{(['ambient','static',...(props.desktopInteractive ? ['interactive'] : [])] as MotionMode[]).map((value) => <button key={value} type="button" className={document.motion === value ? 'active' : ''} disabled={value === 'ambient' && props.reducedMotion} onClick={() => props.onMotion(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        {props.reducedMotion && <p className="hint">Ambient motion is disabled by your reduced-motion preference.</p>}
        <Range label="Speed" value={document.overrides.speed ?? 1} min={0.5} max={2} step={0.05} display={`${(document.overrides.speed ?? 1).toFixed(2)}×`} onChange={props.onSpeed} />
      </section>

      <section className="panel-section last"><div className="section-heading"><h3>Share & export</h3></div><div className="panel-actions"><button className="secondary-button" type="button" onClick={props.onCopyLink}>Copy link</button><button className="primary-button" type="button" onClick={props.onExport}>Export</button></div></section>
    </aside>
  )
}
