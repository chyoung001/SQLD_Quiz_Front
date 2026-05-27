import { useRef, useEffect, useState } from 'react'

function EntityBox({ entityRef, entity }) {
  return (
    <div ref={entityRef} className="border border-slate-400 rounded overflow-hidden text-xs bg-white inline-block w-full">
      <div className="bg-slate-700 text-white px-3 py-1.5 font-medium text-center text-xs">
        {entity.table}
      </div>
      <div className="divide-y divide-slate-200">
        {(entity.columns || []).map((col, i) => {
          const keys = (col.key || '').split(',').map(k => k.trim()).filter(Boolean)
          const isPK = keys.includes('PK')
          const isFK = keys.includes('FK')
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1">
              <span className="w-10 text-slate-400 shrink-0">string</span>
              {isPK && <span className="text-yellow-600 font-bold shrink-0">PK</span>}
              {isFK && <span className="text-blue-500 font-bold shrink-0">FK</span>}
              <span className="text-slate-700">{col.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getEdgePoint(from, to) {
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  if (dx === 0 && dy === 0) return { x: from.cx, y: from.cy }
  const hw = from.w / 2
  const hh = from.h / 2
  const scale = Math.min(hw / Math.abs(dx), hh / Math.abs(dy))
  return { x: from.cx + dx * scale, y: from.cy + dy * scale }
}

export default function Erd2x2({ entities, relations = [] }) {
  const containerRef = useRef(null)
  const ref0 = useRef(null)
  const ref1 = useRef(null)
  const ref2 = useRef(null)
  const ref3 = useRef(null)
  const boxRefs = [ref0, ref1, ref2, ref3]

  const [lines, setLines] = useState([])
  const [svgDims, setSvgDims] = useState({ w: 0, h: 0 })

  const nameToIdx = {}
  entities.forEach((e, i) => { nameToIdx[e.table] = i })

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current
      if (!container) return
      const cb = container.getBoundingClientRect()
      if (cb.width === 0 || cb.height === 0) return

      setSvgDims({ w: cb.width, h: cb.height })

      const boxes = boxRefs.map(r => {
        if (!r.current) return null
        const b = r.current.getBoundingClientRect()
        return {
          cx: b.left - cb.left + b.width / 2,
          cy: b.top - cb.top + b.height / 2,
          w: b.width,
          h: b.height,
        }
      })

      const newLines = relations.map(rel => {
        const fi = nameToIdx[rel.from]
        const ti = nameToIdx[rel.to]
        if (fi === undefined || ti === undefined) return null
        const f = boxes[fi]; const t = boxes[ti]
        if (!f || !t) return null
        const p1 = getEdgePoint(f, t)
        const p2 = getEdgePoint(t, f)
        return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
      }).filter(Boolean)

      setLines(newLines)
    }

    // ResizeObserver로 컨테이너 크기가 확정된 시점에 측정
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    measure()

    return () => ro.disconnect()
  }, [])

  const [tl, tr, bl, br] = entities

  return (
    <div ref={containerRef} className="relative p-2">
      <div className="grid grid-cols-2 gap-6">
        <EntityBox entityRef={ref0} entity={tl} />
        <EntityBox entityRef={ref1} entity={tr} />
        <EntityBox entityRef={ref2} entity={bl} />
        <EntityBox entityRef={ref3} entity={br} />
      </div>
      {svgDims.w > 0 && (
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={svgDims.w}
          height={svgDims.h}
          style={{ zIndex: 10 }}
        >
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#64748b" strokeWidth="1.5" />
          ))}
        </svg>
      )}
    </div>
  )
}
