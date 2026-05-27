import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useQuizStore from '../stores/quizStore'
import useHistoryStore, { computeStats } from '../stores/historyStore'
import AssetRenderer from '../components/quiz/AssetRenderer'
import ChoiceList from '../components/quiz/ChoiceList'
import { generatePracticeQuestions } from '../api/llmApi'

function CircularProgress({ value, size = 96, strokeWidth = 6 }) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#f43f5e'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e4e4e7" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

export default function ResultPage() {
  const navigate = useNavigate()
  const { sessionId, startedAt, sessionResult, chapterId, reset } = useQuizStore()
  const addSession = useHistoryStore(s => s.addSession)
  const sessions = useHistoryStore(s => s.sessions)
  const overallStats = useMemo(() => computeStats(sessions), [sessions])
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  useEffect(() => {
    if (!sessionResult.length || !sessionId) return
    addSession({
      id: sessionId,
      chapterId,
      startedAt,
      finishedAt: new Date().toISOString(),
      total: sessionResult.length,
      correct: sessionResult.filter(r => r.isCorrect).length,
      results: sessionResult.map(r => ({
        questionId: r.question.id,
        selected: r.selected,
        correctChoice: r.correctChoice,
        isCorrect: r.isCorrect,
      })),
    })
  }, [sessionId, startedAt, sessionResult, chapterId, addSession])

  if (!sessionResult.length) {
    navigate('/')
    return null
  }

  const correct = sessionResult.filter(r => r.isCorrect).length
  const wrong = sessionResult.length - correct
  const total = sessionResult.length
  const rate = Math.round((correct / total) * 100)
  const rateColor = rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-600' : 'text-rose-500'

  const handleRestart = () => {
    reset()
    navigate('/')
  }

  const wrongQuestionIds = sessionResult.filter(r => !r.isCorrect).map(r => r.question.id)

  const handleGenerateAI = async () => {
    setGenError(null)
    setGenerating(true)
    try {
      const generated = await generatePracticeQuestions(wrongQuestionIds.slice(0, 5), 5)
      navigate('/ai-review', { state: { generated } })
    } catch (e) {
      setGenError('문제 생성에 실패했습니다. API 키를 확인해 주세요.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
            결과
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-400 font-normal text-xs">채점 완료</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-medium"
          >
            홈으로
          </button>
        </div>
      </header>

      {/* 점수 카드 */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <CircularProgress value={rate} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-[26px] font-semibold tabular-nums leading-none ${rateColor}`}>{rate}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">점</div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-zinc-500 text-xs mb-2 tabular-nums">총 {total}문제</div>
              <div className="flex items-baseline gap-5 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-zinc-900 tabular-nums">{correct}</span>
                  <span className="text-xs text-zinc-500">정답</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-zinc-400 tabular-nums">{wrong}</span>
                  <span className="text-xs text-zinc-500">오답</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleRestart}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-md"
                >
                  다시 풀기
                </button>
                {wrongQuestionIds.length > 0 && (
                  <button
                    onClick={handleGenerateAI}
                    disabled={generating}
                    className="px-3.5 py-1.5 border border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 text-xs font-semibold rounded-md inline-flex items-center gap-1.5"
                  >
                    {generating ? (
                      <>
                        <span className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        생성 중…
                      </>
                    ) : (
                      <>✦ AI 연습문제 생성</>
                    )}
                  </button>
                )}
                {genError && (
                  <span className="text-[11px] text-rose-500">{genError}</span>
                )}
                {overallStats.total > total && (
                  <div className="text-[11px] text-zinc-400">
                    누적 정답률 <span className="text-zinc-700 font-medium tabular-nums">{overallStats.rate}%</span>
                    <span className="mx-1.5 text-zinc-300">·</span>
                    누적 <span className="font-medium tabular-nums">{overallStats.total}</span>문제
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 문제별 결과 */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-zinc-700">문제별 결과</h2>
          <span className="text-[11px] text-zinc-400">탭하여 해설 보기</span>
        </div>
        <div className="space-y-2">
          {sessionResult.map((result, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <button
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-50"
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${result.isCorrect
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                    {result.isCorrect ? '○' : '✕'}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 tabular-nums flex-shrink-0">
                    문제 {idx + 1}
                  </span>
                  <span className="text-xs text-zinc-400 truncate">
                    {result.isCorrect
                      ? '정답'
                      : <>오답 <span className="text-zinc-300 mx-1">·</span> 정답 <span className="tabular-nums text-zinc-500">{result.correctChoice}</span>번</>}
                  </span>
                </div>
                <span className="text-zinc-300 text-xs flex-shrink-0 ml-2">
                  {expandedIdx === idx ? '▴' : '▾'}
                </span>
              </button>

              {expandedIdx === idx && (
                <div className="border-t border-zinc-100 px-4 py-5 space-y-5">
                  <div className="space-y-3">
                    {result.question.assets.map((asset, i) => (
                      <AssetRenderer key={i} asset={asset} />
                    ))}
                  </div>
                  <ChoiceList
                    choices={result.fullQuestion.choices}
                    selected={result.selected}
                    onSelect={() => {}}
                    showResult={true}
                    correctChoice={result.correctChoice}
                  />
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                    <div className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">해설</div>
                    <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                      {result.explanation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
