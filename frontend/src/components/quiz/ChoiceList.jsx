import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql'
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs'

SyntaxHighlighter.registerLanguage('sql', sql)

function ResultTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="text-xs border-collapse">
        <thead>
          <tr>{columns.map((col, i) => (
            <th key={i} className="border border-zinc-300 px-2 py-1 bg-zinc-100 font-semibold text-zinc-700">
              {col.replace(/^[A-Za-z]\./, '')}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col, j) => (
                <td key={j} className="border border-zinc-300 px-2 py-1 text-center text-zinc-700">
                  {row[col] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChoiceContent({ kind, text, payload }) {
  switch (kind) {
    case 'sql_query':
    case 'sql_fragment':
      return <span className="font-mono text-sm whitespace-pre-wrap text-zinc-800">{text}</span>
    case 'result_table': {
      if (payload?.columns && payload?.rows) {
        return <ResultTable columns={payload.columns} rows={payload.rows} />
      }
      const lines = text.trim().split('\n').filter(l => l.includes('|'))
      if (lines.length < 2) return <span>{text}</span>
      const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean)
      const dataRows = lines.slice(1).filter(l => !l.match(/^[\s|:-]+$/))
      return (
        <div className="overflow-x-auto w-full">
          <table className="text-xs border-collapse">
            <thead>
              <tr>{headers.map((h, i) => (
                <th key={i} className="border border-zinc-300 px-2 py-1 bg-zinc-100">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {dataRows.map((row, i) => {
                const cells = row.split('|').map(c => c.trim()).filter(Boolean)
                return (
                  <tr key={i}>
                    {cells.map((c, j) => <td key={j} className="border border-zinc-300 px-2 py-1">{c}</td>)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }
    case 'keyword':
    case 'value':
    case 'index_definition':
      return <span className="font-mono text-sm text-zinc-800">{text}</span>
    case 'tuple': {
      if (!/:\s*(NUMBER|VARCHAR2|VARCHAR|CHAR|DATE|INTEGER|FLOAT|CLOB|BLOB|TIMESTAMP)/i.test(text)) {
        return <span className="text-sm leading-relaxed">{text}</span>
      }
      const match = text.match(/^(.+?)\s*\((.+)\)$/)
      if (!match) return <span className="font-mono text-sm">{text}</span>
      const tableName = match[1].trim()
      const colParts = match[2].split(',').map(s => s.trim())
      const columns = colParts.map(part => {
        const colMatch = part.match(/^(.+?)(?:\(([^)]+)\))?\s*:\s*(.+)$/)
        if (!colMatch) return { name: part, key: '', type: '' }
        return { name: colMatch[1].trim(), key: colMatch[2] || '', type: colMatch[3].trim() }
      })
      return (
        <div className="w-full border border-zinc-300 rounded-lg overflow-hidden text-sm">
          <div className="bg-zinc-700 text-white px-3 py-1 font-medium text-center text-xs">
            {tableName}
          </div>
          <div className="divide-y divide-zinc-200">
            {columns.map((col, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1 text-zinc-600 text-xs">
                {col.key && <span className="shrink-0 text-amber-600 font-bold">{col.key}</span>}
                <span className="flex-1">{col.name}</span>
                <span className="text-zinc-400 font-mono">{col.type}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    default:
      return <span className="text-sm leading-relaxed text-zinc-800">{text}</span>
  }
}

const SQL_TYPE_RE = /:\s*(NUMBER|VARCHAR2|VARCHAR|CHAR|DATE|INTEGER|FLOAT|CLOB|BLOB|TIMESTAMP)/i

function isTupleBox(choice) {
  if (choice.choice_kind !== 'tuple') return false
  return SQL_TYPE_RE.test(choice.choice_text)
}

function ChoiceItem({ choice, isSelected, isCorrect, showResult, onSelect }) {
  let borderStyle = 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm cursor-pointer'
  if (showResult) {
    if (isCorrect) borderStyle = 'border-emerald-400 bg-emerald-50/50 cursor-default'
    else if (isSelected) borderStyle = 'border-rose-300 bg-rose-50/40 cursor-default'
    else borderStyle = 'border-zinc-200 bg-white opacity-50 cursor-default'
  } else if (isSelected) {
    borderStyle = 'border-zinc-900 bg-zinc-50 cursor-pointer shadow-sm'
  }

  const numberStyle = showResult
    ? isCorrect
      ? 'bg-emerald-500 text-white'
      : isSelected
        ? 'bg-rose-400 text-white'
        : 'bg-zinc-100 text-zinc-400'
    : isSelected
      ? 'bg-zinc-900 text-white'
      : 'bg-zinc-100 text-zinc-600'

  return (
    <button
      onClick={() => !showResult && onSelect(choice.choice_number)}
      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${borderStyle}`}
    >
      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold tabular-nums ${numberStyle}`}>
        {choice.choice_number}
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        <ChoiceContent kind={choice.choice_kind} text={choice.choice_text} payload={choice.payload} />
      </div>
    </button>
  )
}

export default function ChoiceList({ choices, selected, onSelect, showResult, correctChoice }) {
  const allTupleBox = choices.every(isTupleBox)
  const allResultTable = choices.every(c => c.choice_kind === 'result_table' && c.payload?.columns && c.payload?.rows)

  if (allTupleBox || allResultTable) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {choices.map(choice => {
          const isSelected = selected === choice.choice_number
          const isCorrect = correctChoice === choice.choice_number
          return (
            <ChoiceItem
              key={choice.choice_number}
              choice={choice}
              isSelected={isSelected}
              isCorrect={isCorrect}
              showResult={showResult}
              onSelect={onSelect}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {choices.map(choice => {
        const isSelected = selected === choice.choice_number
        const isCorrect = correctChoice === choice.choice_number
        return (
          <ChoiceItem
            key={choice.choice_number}
            choice={choice}
            isSelected={isSelected}
            isCorrect={isCorrect}
            showResult={showResult}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}
