import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  er: { diagramPadding: 20, layoutDirection: 'LR' },
})

let idCounter = 0

export default function ErdDiagram({ code, direction = 'LR' }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!code) return
    setSvg('')
    setError(false)
    const id = `erd-${++idCounter}`
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      er: { diagramPadding: 20, layoutDirection: direction },
    })
    mermaid.render(id, code)
      .then(({ svg }) => setSvg(svg))
      .catch(() => setError(true))
  }, [code, direction])

  if (error) return (
    <pre className="bg-slate-100 rounded-lg p-3 text-xs text-slate-500 overflow-x-auto">
      {code}
    </pre>
  )

  if (!svg) return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-400">
      ERD 렌더링 중...
    </div>
  )

  return (
    <div
      className="overflow-x-auto bg-white border border-slate-200 rounded-lg p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
