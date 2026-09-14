import { useEffect, useMemo, useRef, useState } from 'react'
import { renderCssSnippet, renderReactSnippet, renderSvg, svgFilename } from '../core/svg'
import type { ResolvedGradient } from '../core/types'

type ExportFormat = 'svg' | 'react' | 'css'

interface ExportDialogProps {
  gradient: ResolvedGradient
  open: boolean
  onClose: () => void
  onMessage: (message: string) => void
}

function contentFor(gradient: ResolvedGradient, format: ExportFormat, animated: boolean): string {
  if (format === 'react') return renderReactSnippet(gradient, animated)
  if (format === 'css') return renderCssSnippet(gradient, animated)
  return renderSvg(gradient, animated)
}

export function ExportDialog({ gradient, open, onClose, onMessage }: ExportDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [format, setFormat] = useState<ExportFormat>('svg')
  const [animated, setAnimated] = useState(false)
  const content = useMemo(() => contentFor(gradient, format, animated), [gradient, format, animated])
  const size = new TextEncoder().encode(format === 'svg' ? content : renderSvg(gradient, animated)).length

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      onMessage(`${format === 'svg' ? 'SVG' : format === 'react' ? 'React component' : 'CSS'} copied`)
    } catch {
      onMessage('Copy failed. Select the code and copy it manually.')
    }
  }

  const download = () => {
    const svg = renderSvg(gradient, animated)
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = svgFilename(gradient)
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    onMessage(`${animated ? 'Animated' : 'Static'} SVG downloaded`)
  }

  return (
    <dialog ref={ref} className="export-dialog" onClose={onClose} onCancel={onClose}>
      <div className="dialog-heading">
        <div><p className="eyebrow">Take it with you</p><h2>Export gradient</h2></div>
        <button className="round-button" type="button" aria-label="Close export" onClick={onClose}>×</button>
      </div>
      <div className="dialog-row">
        <div className="segmented wide" aria-label="Export format">
          {(['svg', 'react', 'css'] as ExportFormat[]).map((value) => (
            <button key={value} className={format === value ? 'active' : ''} type="button" onClick={() => setFormat(value)}>
              {value === 'svg' ? 'Raw SVG' : value === 'react' ? 'React' : 'CSS URI'}
            </button>
          ))}
        </div>
        <label className="switch-row compact"><input type="checkbox" checked={animated} onChange={(event) => setAnimated(event.target.checked)} /><span>Animated</span></label>
      </div>
      <textarea className="code-output" aria-label="Generated code" readOnly value={content} spellCheck={false} />
      <div className="export-meta">
        <span>{(size / 1024).toFixed(1)}KB SVG payload</span>
        <span>{animated ? 'Animation uses the current ambient speed and cannot be paused by the consumer.' : 'No scripts or external references.'}</span>
      </div>
      {gradient.radial.blend !== 'normal' && <p className="warning-text">Experimental blend modes may render differently in design tools and server-side rasterizers.</p>}
      <div className="dialog-actions">
        <button className="secondary-button" type="button" onClick={copy}>Copy {format === 'svg' ? 'markup' : 'snippet'}</button>
        <button className="primary-button" type="button" onClick={download}>Download SVG</button>
      </div>
    </dialog>
  )
}
