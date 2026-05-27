import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChapters, getQuestions } from '../api/questionApi'
import { getExamQuestions } from '../api/examApi'
import useQuizStore from '../stores/quizStore'
import useExamStore from '../stores/examStore'
import useHistoryStore, { computeStats, computeChapterStats } from '../stores/historyStore'

const COUNT_OPTIONS = [5, 10, 20, 30, 50]

function rateTextColor(rate, total) {
  if (total === 0) return 'text-zinc-300'
  if (rate >= 80) return 'text-emerald-600'
  if (rate >= 60) return 'text-amber-600'
  return 'text-rose-500'
}

function rateBarColor(rate, total) {
  if (total === 0) return 'bg-zinc-100'
  if (rate >= 80) return 'bg-emerald-500'
  if (rate >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

export default function ChapterSelectPage() {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [count, setCount] = useState(null)
  const [starting, setStarting] = useState(false)
  const [examStarting, setExamStarting] = useState(false)
  const startQuiz = useQuizStore(s => s.startQuiz)
  const startExam = useExamStore(s => s.startExam)
  const sessions = useHistoryStore(s => s.sessions)
  const overallStats = useMemo(() => computeStats(sessions), [sessions])
  const chapterStats = useMemo(() => computeChapterStats(sessions), [sessions])
  const navigate = useNavigate()

  useEffect(() => {
    getChapters().then(setChapters).finally(() => setLoading(false))
  }, [])

  const statsMap = useMemo(() => {
    const map = {}
    for (const s of chapterStats) map[s.chapter_id] = s
    return map
  }, [chapterStats])

  const handleSelect = (ch) => {
    setSelected(prev => prev?.chapter_id === ch.chapter_id ? null : ch)
    setCount(null)
  }

  const handleStart = async () => {
    if (!selected) return
    setStarting(true)
    const actualCount = count ?? selected.count
    try {
      const questions = await getQuestions(selected.chapter_id, actualCount)
      startQuiz(questions, selected.chapter_id)
      navigate('/quiz')
    } finally {
      setStarting(false)
    }
  }

  const handleStartExam = async () => {
    setExamStarting(true)
    try {
      const questions = await getExamQuestions()
      startExam(questions)
      navigate('/exam')
    } finally {
      setExamStarting(false)
    }
  }

  const availableCounts = selected ? COUNT_OPTIONS.filter(n => n < selected.count) : []

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-zinc-400 text-sm">불러오는 중…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <header className="border-b border-zinc-200 bg-white/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-base font-semibold tracking-tight text-zinc-900">SQLD</h1>
            <span className="text-xs text-zinc-400 font-mono">study</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-5 text-xs text-zinc-500">
              <div>
                누적 <span className="text-zinc-900 font-medium tabular-nums">{overallStats.total}</span>문제
              </div>
              <div className="w-px h-3 bg-zinc-200" />
              <div>
                정답률 <span className="text-zinc-900 font-medium tabular-nums">{overallStats.rate}%</span>
              </div>
            </div>
            <button
              onClick={handleStartExam}
              disabled={examStarting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-xs font-semibold"
            >
              {examStarting ? (
                <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> 준비 중…</>
              ) : (
                <>✦ 모의고사</>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 pb-32">
        <div className="mb-10">
          <h2 className="text-[28px] font-semibold tracking-tight text-zinc-900 mb-2 leading-tight">
            챕터 선택
          </h2>
          <p className="text-sm text-zinc-500">
            학습할 챕터를 선택하면 문제 수를 고른 뒤 시작할 수 있어요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {chapters.map(ch => {
            const stats = statsMap[ch.chapter_id] || { total: 0, correct: 0, rate: 0 }
            const isSelected = selected?.chapter_id === ch.chapter_id
            const hasHistory = stats.total > 0
            return (
              <button
                key={ch.chapter_id}
                onClick={() => handleSelect(ch)}
                className={`group relative text-left p-5 rounded-xl border bg-white transition-all
                  ${isSelected
                    ? 'border-zinc-900 shadow-md ring-1 ring-zinc-900/5'
                    : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm hover:-translate-y-0.5'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums tracking-wider">
                    {String(ch.chapter_id).padStart(2, '0')}
                  </span>
                  {hasHistory && (
                    <span className={`text-xs font-semibold tabular-nums ${rateTextColor(stats.rate, stats.total)}`}>
                      {stats.rate}%
                    </span>
                  )}
                </div>
                <h3 className="text-[15px] font-medium text-zinc-900 mb-6 leading-snug min-h-[44px]">
                  {ch.name}
                </h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {ch.count}문제
                  </span>
                  {hasHistory ? (
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {stats.correct}/{stats.total}
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-300">미학습</span>
                  )}
                </div>
                <div className="h-0.5 bg-zinc-100 rounded-full overflow-hidden">
                  {hasHistory && (
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${rateBarColor(stats.rate, stats.total)}`}
                      style={{ width: `${stats.rate}%` }}
                    />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </main>

      {/* sticky 하단 액션바 */}
      {selected && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.08)] z-20">
          <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider mb-0.5">선택됨</div>
              <div className="text-sm font-medium text-zinc-900 truncate">
                <span className="font-mono text-zinc-400 mr-2">{String(selected.chapter_id).padStart(2, '0')}</span>
                {selected.name}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              {availableCounts.map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium tabular-nums
                    ${count === n
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setCount(null)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium tabular-nums
                  ${count === null
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                전체 {selected.count}
              </button>
              <button
                onClick={handleStart}
                disabled={starting}
                className="ml-1 px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                {starting ? '시작 중…' : (<>시작 <span className="text-zinc-400">→</span></>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
