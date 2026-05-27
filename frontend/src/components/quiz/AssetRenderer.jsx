import { useRef, useEffect, useState } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql'
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import ErdDiagram from './ErdDiagram'
import Erd2x2 from './Erd2x2'

SyntaxHighlighter.registerLanguage('sql', sql)

const BOX_LABEL_RE = /^\[(아래|보기|예시|조건|참고|정보|SQL|쿼리|테이블|다음)\]/
// [엔터티명] — 대괄호 안에 한글/영문 텍스트 (아래/보기 등 예약어 제외)
const ENTITY_LABEL_RE = /^\[([^\]]+)\]$/

function EntitySchemaBlock({ entityName, lines }) {
  // 컬럼 목록과 FD 구분
  const fdIdx = lines.findIndex(l => /함수종속성|FD/i.test(l))
  const colLines = (fdIdx === -1 ? lines : lines.slice(0, fdIdx))
    .map(l => l.trim()).filter(Boolean)
  const fdLines = fdIdx !== -1
    ? lines.slice(fdIdx).map(l => l.trim()).filter(Boolean)
    : []

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden text-sm">
      {/* 엔터티명 헤더 */}
      <div className="bg-slate-600 text-white px-3 py-1.5 font-medium text-center text-xs tracking-wide">
        {entityName}
      </div>
      {/* 컬럼 목록 */}
      <div className="divide-y divide-slate-100 bg-white">
        {colLines.map((col, i) => (
          <div key={i} className="px-4 py-1 text-slate-700 text-xs">{col}</div>
        ))}
      </div>
      {/* 함수종속성 */}
      {fdLines.length > 0 && (
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 space-y-1">
          {fdLines.map((line, i) => (
            <div key={i} className="text-xs text-slate-600 font-mono whitespace-pre-wrap">{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function TextBlock({ text }) {
  const lines = text.split('\n')
  const segments = []
  let current = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (BOX_LABEL_RE.test(trimmed)) {
      if (current) segments.push(current)
      const label = trimmed.match(BOX_LABEL_RE)[0]
      const rest = trimmed.slice(label.length).trim()
      current = { type: 'box', label, lines: rest ? [rest] : [] }

    } else if (ENTITY_LABEL_RE.test(trimmed) && !BOX_LABEL_RE.test(trimmed)) {
      if (current) segments.push(current)
      const entityName = trimmed.slice(1, -1)
      current = { type: 'entity', entityName, lines: [] }

    } else {
      if (!current) current = { type: 'text', lines: [] }
      current.lines.push(line)
    }
  }
  if (current) segments.push(current)

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        if (seg.type === 'box') return (
          <div key={i} className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
              {seg.label.replace(/\[|\]/g, '')}
            </div>
            <div className="px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-white">
              {seg.lines.join('\n').trim()}
            </div>
          </div>
        )
        if (seg.type === 'entity') return (
          <EntitySchemaBlock key={i} entityName={seg.entityName} lines={seg.lines} />
        )
        return (
          <div key={i} className="whitespace-pre-wrap text-slate-700 leading-relaxed text-sm">
            {seg.lines.join('\n')}
          </div>
        )
      })}
    </div>
  )
}

function SqlCodeBlock({ code, label }) {
  const block = (
    <div className="rounded-lg overflow-hidden text-sm border border-slate-200">
      <SyntaxHighlighter language="sql" style={githubGist} wrapLongLines customStyle={{ margin: 0, padding: '12px 16px' }}>
        {code || ''}
      </SyntaxHighlighter>
    </div>
  )
  if (!label) return block
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
        {label}
      </div>
      <div className="bg-white">
        <SyntaxHighlighter language="sql" style={githubGist} wrapLongLines customStyle={{ margin: 0, padding: '12px 16px', fontSize: '13px' }}>
          {code || ''}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

function DataTableView({ payload }) {
  const { columns = [], rows = [], name } = payload
  const table = (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr className="bg-slate-100">
            {columns.map((col, i) => (
              <th key={i} className="border border-slate-300 px-3 py-1.5 text-left font-medium text-slate-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-slate-50">
              {columns.map((col, j) => (
                <td key={j} className="border border-slate-300 px-3 py-1.5 text-slate-600 whitespace-pre">
                  {row[col] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  if (!name) return table
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
        {name}
      </div>
      <div className="bg-white p-2">{table}</div>
    </div>
  )
}

function ListItems({ items = [] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        // 순수 문자열
        if (typeof item === 'string') {
          return (
            <div key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="shrink-0 text-slate-400">•</span>
              <span className="whitespace-pre-wrap">{item}</span>
            </div>
          )
        }
        // { label, code } — SQL 코드
        if (item.code != null) {
          return (
            <div key={i} className="space-y-1">
              {item.label && (
                <span className="text-xs font-semibold text-slate-500">{item.label}</span>
              )}
              <SyntaxHighlighter language="sql" style={githubGist}
                customStyle={{ margin: 0, padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                {item.code}
              </SyntaxHighlighter>
            </div>
          )
        }
        // { label, text }
        return (
          <div key={i} className="flex gap-2 text-sm text-slate-700">
            {item.label && (
              <span className="shrink-0 font-medium text-slate-500">{item.label}</span>
            )}
            <span className="whitespace-pre-wrap">{item.text ?? ''}</span>
          </div>
        )
      })}
    </div>
  )
}

function CodeCompare({ payload }) {
  const { blocks = [] } = payload
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div key={i} className="border border-slate-300 rounded-lg overflow-hidden">
          {block.label && (
            <div className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1.5 border-b border-slate-300">
              {block.label}
            </div>
          )}
          <SyntaxHighlighter language="sql" style={githubGist} wrapLongLines
            customStyle={{ margin: 0, padding: '12px 16px', fontSize: '13px' }}>
            {block.code || ''}
          </SyntaxHighlighter>
        </div>
      ))}
    </div>
  )
}

function FunctionalDependency({ payload }) {
  const { table, columns = [], pk = [], dependencies = [] } = payload
  const pkSet = new Set(pk)

  return (
    <div className="flex gap-6 items-start">
      {/* 왼쪽: 엔터티 박스 */}
      <div className="border border-slate-400 rounded text-sm min-w-[120px]">
        <div className="bg-slate-200 text-slate-700 px-3 py-1 font-medium text-center text-xs border-b border-slate-400">
          [{table}]
        </div>
        {/* PK 컬럼 */}
        {columns.filter(c => pkSet.has(c)).map((col, i) => (
          <div key={i} className="px-3 py-0.5 text-slate-700 text-xs border-b border-slate-200 last:border-0">
            {col}
          </div>
        ))}
        {/* 구분선 */}
        {columns.some(c => pkSet.has(c)) && columns.some(c => !pkSet.has(c)) && (
          <div className="border-t border-slate-400" />
        )}
        {/* 일반 컬럼 */}
        {columns.filter(c => !pkSet.has(c)).map((col, i) => (
          <div key={i} className="px-3 py-0.5 text-slate-700 text-xs border-b border-slate-200 last:border-0">
            {col}
          </div>
        ))}
      </div>

      {/* 오른쪽: 함수종속성 */}
      <div className="text-sm text-slate-700">
        <div className="font-medium mb-2 text-slate-600">함수종속성(FD)</div>
        <ol className="space-y-1 list-decimal list-inside">
          {dependencies.map((dep, i) => (
            <li key={i} className="text-xs text-slate-700">
              {dep.determinants.join(' ∥ ')} → {dep.dependents.join(', ')}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function AwrReport({ payload }) {
  const { label, title, headers = [], rows = [] } = payload

  const table = (
    <div className="overflow-x-auto">
      {title && (
        <div className="text-xs font-semibold text-slate-700 mb-2 px-1">{title}</div>
      )}
      <table className="text-xs border-collapse w-full font-mono">
        <thead>
          <tr className="border-b border-slate-400">
            {headers.map((h, i) => (
              <th key={i} className={`px-2 py-1 font-medium text-slate-600 whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className={`px-2 py-1 text-slate-700 whitespace-nowrap ${j === 0 ? 'text-left' : 'text-right'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (!label) return table
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
        {label}
      </div>
      <div className="bg-white p-3">{table}</div>
    </div>
  )
}

function SqlTrace({ payload }) {
  const { label, headers = [], rows = [] } = payload
  const totalIdx = rows.findIndex(r => r[0]?.toLowerCase() === 'total')
  const bodyRows = totalIdx >= 0 ? rows.slice(0, totalIdx) : rows
  const totalRow = totalIdx >= 0 ? rows[totalIdx] : null

  const table = (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full font-mono">
        <thead>
          <tr className="border-b-2 border-slate-400">
            {headers.map((h, i) => (
              <th key={i} className="px-2 py-1 text-left font-medium text-slate-600 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 text-slate-700 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {totalRow && (
            <tr className="border-t-2 border-slate-400 font-semibold">
              {totalRow.map((cell, j) => (
                <td key={j} className="px-2 py-1 text-slate-700 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  if (!label) return table
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
        {label}
      </div>
      <div className="bg-white p-2">{table}</div>
    </div>
  )
}

function ConcurrentTimeline({ payload }) {
  const { title, headers = [], rows = [] } = payload
  const table = (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr className="bg-slate-100">
            {headers.map((h, i) => (
              <th key={i} className="border border-slate-300 px-3 py-1.5 text-left font-medium text-slate-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className="border border-slate-300 px-3 py-1.5 text-slate-600 font-mono text-xs whitespace-pre-wrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  if (!title) return table
  const label = title.replace(/^\[|\]$/g, '')
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
        {label}
      </div>
      <div className="bg-white p-2">{table}</div>
    </div>
  )
}

function TransactionSteps({ steps = [] }) {
  const lines = steps.map((step) => {
    if (step.kind === 'DML')       return step.code || ''
    if (step.kind === 'SAVEPOINT') return `SAVEPOINT ${step.name};`
    if (step.kind === 'ROLLBACK')  return step.to_savepoint ? `ROLLBACK TO SAVEPOINT ${step.to_savepoint};` : 'ROLLBACK;'
    if (step.kind === 'COMMIT')    return 'COMMIT;'
    return ''
  })

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-mono text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
      {lines.join('\n')}
    </div>
  )
}

function EntityTable({ entity }) {
  const columns = entity.columns || []
  const pkCols = columns.filter(c => (c.key || '').split(',').map(k => k.trim()).includes('PK'))
  const otherCols = columns.filter(c => !(c.key || '').split(',').map(k => k.trim()).includes('PK'))

  const renderCol = (col, j) => {
    const keys = (col.key || '').split(',').map(k => k.trim()).filter(Boolean)
    const isFK = keys.includes('FK')
    return (
      <div key={j} className="px-3 py-1 text-slate-600 flex items-center gap-1.5 text-xs">
        {isFK && <span className="text-blue-600 font-bold">FK</span>}
        <span>{col.name || col}</span>
        {col.type && <span className="text-slate-400">{col.type}</span>}
      </div>
    )
  }

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden text-sm">
      <div className="bg-slate-700 text-white px-3 py-1.5 font-medium text-xs">{entity.table}</div>
      {pkCols.length > 0 && (
        <div className="divide-y divide-slate-200 border-b-2 border-slate-400">
          {pkCols.map(renderCol)}
        </div>
      )}
      {otherCols.length > 0 && (
        <div className="divide-y divide-slate-200">
          {otherCols.map(renderCol)}
        </div>
      )}
    </div>
  )
}

function EntitySchemaTextNotation({ entities = [] }) {
  return (
    <div className="space-y-1 text-sm text-slate-700 font-mono">
      {entities.map((entity, i) => {
        const cols = (entity.columns || []).map(col => {
          const keys = (col.key || '').split(',').map(k => k.trim()).filter(Boolean)
          const isPK = keys.includes('PK')
          return isPK
            ? <u key={col.name} className="decoration-slate-700">{col.name}</u>
            : <span key={col.name}>{col.name}</span>
        })
        const joined = cols.flatMap((el, j) => j === 0 ? [el] : [<span key={`sep-${j}`}>, </span>, el])
        return (
          <div key={i}>
            <span className="font-semibold">{entity.table}</span>
            <span>(</span>
            {joined}
            <span>)</span>
          </div>
        )
      })}
    </div>
  )
}

function EntitySchema({ entities = [], relation, display }) {
  if (display === 'text_notation') {
    return <EntitySchemaTextNotation entities={entities} />
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      {entities.map((entity, i) => (
        <div key={i} className="flex items-center gap-2">
          <EntityTable entity={entity} />
          {relation && i < entities.length - 1 && (
            <div className="flex flex-col items-center text-slate-500 text-xs gap-0.5">
              <span className="font-medium whitespace-nowrap">{relation}</span>
              <span className="text-base leading-none">→</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function entitiesToMermaid(entities, prefix = '') {
  const tName = (name) => prefix + name.replace(/\s/g, '_')

  // 테이블명 → PK 컬럼명 목록
  const pkMap = {}
  for (const entity of entities) {
    pkMap[tName(entity.table)] = (entity.columns || [])
      .filter(c => (c.key || '').includes('PK'))
      .map(c => c.name)
  }

  const lines = ['erDiagram']

  // 엔터티 정의
  for (const entity of entities) {
    if (!entity.table) continue
    lines.push(`  ${tName(entity.table)} {`)
    for (const col of entity.columns || []) {
      const keys = (col.key || '').split(',').map(k => k.trim()).filter(Boolean)
      const tag = keys.length ? keys.join(',') : ''
      lines.push(`    t ${col.name.replace(/\s/g, '_')}${tag ? ' ' + tag : ''}`)
    }
    lines.push('  }')
  }

  // FK 컬럼 기준으로 관계 자동 추론
  const drawn = new Set()
  for (const entity of entities) {
    const fkCols = (entity.columns || []).filter(c => (c.key || '').includes('FK'))
    for (const fkCol of fkCols) {
      for (const [targetTable, pks] of Object.entries(pkMap)) {
        if (targetTable === tName(entity.table)) continue
        if (pks.some(pk => pk === fkCol.name || fkCol.name.startsWith(pk))) {
          const key = `${targetTable}-${tName(entity.table)}`
          if (!drawn.has(key)) {
            drawn.add(key)
            lines.push(`  ${targetTable} ||--o{ ${tName(entity.table)} : ""`)
          }
        }
      }
    }
  }

  return lines.join('\n')
}

function SideEntities({ side }) {
  const hasRows = side.entities?.some(e => e.rows?.length > 0)
  const hasRelations = side.entities?.some(e =>
    e.columns?.some(c => (c.key || '').includes('FK'))
  )

  return (
    <div>
      {side.label && (
        <div className="text-xs font-semibold text-slate-600 mb-2 bg-slate-100 rounded px-2 py-1 inline-block">
          {side.label}
        </div>
      )}
      {hasRows ? (
        <div className="flex flex-wrap gap-3">
          {(side.entities || []).map((entity, j) => (
            <DataTableView key={j} payload={{ columns: entity.columns.map(c => c.name), rows: entity.rows || [] }} />
          ))}
        </div>
      ) : (
        <ErdDiagram code={entitiesToMermaid(side.entities || [])} />
      )}
    </div>
  )
}

function SchemaVariantPair({ payload }) {
  const { left, right, variant_kind } = payload
  const hasRows = left.entities?.some(e => e.rows?.length > 0)
    || right.entities?.some(e => e.rows?.length > 0)
  const isBeforeAfter = variant_kind === 'before_after'

  if (hasRows) {
    return (
      <div className="flex items-start gap-2">
        <SideEntities side={left} />
        {isBeforeAfter && (
          <div className="text-slate-400 text-xl font-bold self-center px-1">→</div>
        )}
        {!isBeforeAfter && <div className="w-4" />}
        <SideEntities side={right} />
      </div>
    )
  }

  // 좌우를 하나의 mermaid 다이어그램으로 합침
  const leftMermaid = entitiesToMermaid(left.entities || [], 'L_')
  const rightMermaid = entitiesToMermaid(right.entities || [], 'R_')

  // 두 섹션을 합쳐서 단일 erDiagram으로
  const leftBody = leftMermaid.replace('erDiagram\n', '')
  const rightBody = rightMermaid.replace('erDiagram\n', '')
  const combined = `erDiagram\n${leftBody}\n${rightBody}`

  // 레이블을 다이어그램 위에 별도 표시
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-1">
        <div className="text-xs font-semibold text-slate-600 bg-slate-100 rounded px-2 py-1 text-center">
          {left.label}
        </div>
        <div className="text-xs font-semibold text-slate-600 bg-slate-100 rounded px-2 py-1 text-center">
          {right.label}
        </div>
      </div>
      <ErdDiagram code={combined} />
    </div>
  )
}

const SECTION_LABEL_RE = /^\[([^\]]+)\]$/

function LabeledGroup({ payload }) {
  const { label, layout = 'stack', items = [] } = payload
  const innerClass = layout === 'side_by_side'
    ? 'flex flex-wrap items-start gap-4'
    : 'space-y-3'

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      {label && (
        <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
          {label}
        </div>
      )}
      <div className={`bg-white p-3 ${innerClass}`}>
        {items.map((item, i) => {
          // text_block이 "[xxx]" 단일 라인이면 섹션 헤더로 렌더링
          if (item.asset_type === 'text_block') {
            const text = item.payload?.text?.trim() ?? ''
            const m = text.match(SECTION_LABEL_RE)
            if (m) {
              return (
                <div key={i} className="text-xs font-bold text-slate-600 border-b border-slate-200 pb-1">
                  {m[1]}
                </div>
              )
            }
          }
          return <AssetRenderer key={i} asset={item} />
        })}
      </div>
    </div>
  )
}

export default function AssetRenderer({ asset }) {
  const { asset_type, payload } = asset

  switch (asset_type) {
    case 'text_block':
      return <TextBlock text={payload.text} />
    case 'sql_query':
    case 'sql_ddl':
    case 'sql_dml':
      return <SqlCodeBlock code={payload.code || payload.sql} label={payload.label} />
    case 'data_table':
    case 'result_table':
      return <DataTableView payload={payload} />
    case 'list_items':
      return <ListItems items={payload.items} />
    case 'entity_schema':
      return <EntitySchema entities={payload.entities} relation={payload.relation} display={payload.display} />
    case 'schema_variant_pair':
      return <SchemaVariantPair payload={payload} />
    case 'erd': {
      const erdCode = typeof payload === 'string' ? payload : payload?.code ?? ''
      const erdDir = typeof payload === 'string' ? 'LR' : (payload?.direction ?? 'LR')
      const erdLabel = typeof payload === 'object' ? payload?.label : null
      const diagram = <ErdDiagram code={erdCode} direction={erdDir} />
      if (!erdLabel) return diagram
      return (
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 text-center tracking-widest">
            {erdLabel}
          </div>
          <div className="bg-white">{diagram}</div>
        </div>
      )
    }
    case 'erd2x2':
      return <Erd2x2 entities={payload.entities} relations={payload.relations} />
    case 'code_compare':
      return <CodeCompare payload={payload} />
    case 'functional_dependency':
      return <FunctionalDependency payload={payload} />
    case 'labeled_group':
      return <LabeledGroup payload={payload} />
    case 'awr_report':
      return <AwrReport payload={payload} />
    case 'sql_trace':
      return <SqlTrace payload={payload} />
    case 'concurrent_timeline':
      return <ConcurrentTimeline payload={payload} />
    case 'transaction_steps':
      return <TransactionSteps steps={payload.steps} />
    case 'execution_plan':
      return (
        <pre className="bg-slate-100 rounded-lg p-3 text-sm text-slate-700 overflow-x-auto">
          {payload.text}
        </pre>
      )
    default:
      return (
        <pre className="bg-slate-100 rounded p-2 text-xs text-slate-500 overflow-x-auto">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )
  }
}
