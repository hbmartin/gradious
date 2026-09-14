import { useEffect, useMemo, useRef } from 'react'
import { renderSvg } from '../core/svg'
import type { LayerOverride, ResolvedGradient } from '../core/types'

interface GradientCanvasProps {
  gradient: ResolvedGradient
  animated: boolean
  interactive: boolean
  onLayerEdit?: (index: number, change: LayerOverride) => void
}

export function GradientCanvas({ gradient, animated, interactive, onLayerEdit }: GradientCanvasProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef({ targetX: 0, targetY: 0, currentX: 0, currentY: 0, frame: 0 })
  const svg = useMemo(() => renderSvg(gradient, animated), [gradient, animated])

  useEffect(() => () => cancelAnimationFrame(pointerRef.current.frame), [])

  const animatePointer = () => {
    const surface = surfaceRef.current
    const pointer = pointerRef.current
    if (!surface) return
    pointer.currentX += (pointer.targetX - pointer.currentX) * 0.14
    pointer.currentY += (pointer.targetY - pointer.currentY) * 0.14
    surface.style.setProperty('--pointer-x', String(pointer.currentX))
    surface.style.setProperty('--pointer-y', String(pointer.currentY))
    if (gradient.document.method === 'radial') {
      surface.querySelectorAll('radialGradient').forEach((node, index) => {
        if (index > 2) return
        const depth = (3 - index) * 0.035
        node.setAttribute('fx', String(gradient.radial.layers[index].fx + pointer.currentX * depth))
        node.setAttribute('fy', String(gradient.radial.layers[index].fy + pointer.currentY * depth))
      })
    }
    if (Math.abs(pointer.targetX - pointer.currentX) > 0.001 || Math.abs(pointer.targetY - pointer.currentY) > 0.001) {
      pointer.frame = requestAnimationFrame(animatePointer)
    } else {
      pointer.frame = 0
    }
  }

  const targetPointer = (x: number, y: number) => {
    pointerRef.current.targetX = x
    pointerRef.current.targetY = y
    if (!pointerRef.current.frame) pointerRef.current.frame = requestAnimationFrame(animatePointer)
  }

  const setPointer = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current
    if (!surface || !interactive) return
    const bounds = surface.getBoundingClientRect()
    targetPointer((clientX - bounds.left) / bounds.width - 0.5, (clientY - bounds.top) / bounds.height - 0.5)
  }

  return (
    <div
      ref={surfaceRef}
      className={`gradient-surface ${interactive ? 'is-interactive' : ''}`}
      onPointerMove={(event) => setPointer(event.clientX, event.clientY)}
      onPointerLeave={() => targetPointer(0, 0)}
      aria-label={`${gradient.document.method === 'radial' ? 'Layered radial' : 'Heightmap'} gradient canvas`}
      role="img"
    >
      <div className="gradient-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      {interactive && gradient.document.method === 'radial' && (
        <div className="layer-handles" aria-label="Gradient layer positions">
          {gradient.radial.layers.map((layer, index) => (
            <button
              key={index}
              className="layer-handle"
              type="button"
              aria-label={`Move layer ${index + 1}`}
              style={{ left: `${Math.min(98, Math.max(2, layer.cx * 100))}%`, top: `${Math.min(98, Math.max(2, layer.cy * 100))}%` }}
              onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                const bounds = surfaceRef.current?.getBoundingClientRect()
                if (!bounds) return
                onLayerEdit?.(index, {
                  cx: Number(((event.clientX - bounds.left) / bounds.width).toFixed(5)),
                  cy: Number(((event.clientY - bounds.top) / bounds.height).toFixed(5)),
                })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
