import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useQuizStore from '../stores/quizStore'
import AssetRenderer from '../components/quiz/AssetRenderer'
import ChoiceList from '../components/quiz/ChoiceList'

const QUESTION_TYPE_LABEL = {
  best_choice: '가장 적절한 것',
  worst_choice: '가장 적절하지 않은 것',
}

function QualityBadge({ score, feedback }) {
  if (!score) return null
  const color = score >= 8
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 5
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-600 border-rose-200'
  return (
    <span
      title={feedback || ''}
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border tabular-nums ${color}`}
    >
      ✦ {score}/10
    </span>
  )
}

function GeneratedQuestionCard({ question, adopted, onToggle }) {
  const [showAnswer, setShowAnswer] = useState(false)
  const correctChoice = question.correct_choice

  return (
    <div className={`rounded-xl border bg-white overflow-hidden transition-all
      ${adopted ? 'border-zinc-900 shadow-md' : 'border-zinc-200'}`}>
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-zinc-400 flex-shrink-0">{question.question_number}</span>
          <span className="text-[11px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full flex-shrink-0">
            {QUESTION_TYPE_LABEL[question.question_type] || question.question_type}
          </span>
          <QualityBadge score={question.quality_score} feedback={question.quality_feedback} />
        </div>
        <button
          onClick={() => onToggle(question.id)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex-shrink-0 ml-2
            ${adopted
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
        >
          {adopted ? '채택됨 ✓' : '채택'}
        </button>
      </div>

      {/* 피드백 코멘트 */}
      {question.quality_feedback && (
        <div className="px-4 py-2 bg-zinc-50/60 border-b border-zinc-100 text-[11px] text-zinc-500 italic">
          <span className="text-zinc-400 not-italic mr-1">검수 의견:</span>
          {question.quality_feedback}
        </div>
      )}

      {/* 문제 본문 */}
      <div className="px-4 py-5 space-y-4">
        <div className="space-y-3">
          {question.assets.map((asset, i) => (
            <AssetRenderer key={i} asset={asset} />
          ))}
        </div>
        <ChoiceList
          choices={question.choices}
          selected={showAnswer ? correctChoice : null}
          onSelect={() => {}}
          showResult={showAnswer}
          correctChoice={correctChoice}
        />
      </div>

      {/* 정답/해설 토글 */}
      <div className="border-t border-zinc-100">
        <button
          onClick={() => setShowAnswer(v => !v)}
          className="w-full px-4 py-2.5 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 text-left flex items-center justify-between"
        >
          <span>{showAnswer ? '정답 숨기기' : '정답 미리보기'}</span>
          <span className="text-zinc-300">{showAnswer ? '▴' : '▾'}</span>
        </button>
        {showAnswer && (
          <div className="px-4 pb-4">
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              <div className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">해설</div>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {question.explanation}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GeneratedQuizReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const startQuiz = useQuizStore(s => s.startQuiz)

  const generated = location.state?.generated

  const [adopted, setAdopted] = useState(() => {
    if (!generated) return {}
    return Object.fromEntries(generated.map(q => [q.id, true]))
  })

  if (!generated?.length) {
    navigate('/')
    return null
  }

  const toggleAdopt = (id) => setAdopted(prev => ({ ...prev, [id]: !prev[id] }))
  const adoptedQuestions = generated.filter(q => adopted[q.id])

  const handleStartQuiz = () => {
    if (!adoptedQuestions.length) return
    const generatedAnswers = Object.fromEntries(
      adoptedQuestions.map(q => [q.id, { correctChoice: q.correct_choice, explanation: q.explanation }])
    )
    const quizQuestions = adoptedQuestions.map(({ correct_choice, explanation, ...q }) => q)
    startQuiz(quizQuestions, quizQuestions[0]?.chapter_id ?? null, generatedAnswers)
    navigate('/quiz')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
            AI 생성 문제
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-400 font-normal text-xs">감수 후 채택</span>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-medium"
          >
            돌아가기
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-4">
        <div className="flex items-baseline justify-between px-1 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-700">생성된 연습문제</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">정답을 미리 확인하고 채택할 문제를 선택하세요</p>
          </div>
          <span className="text-[11px] text-zinc-400 tabular-nums">{generated.length}문제</span>
        </div>

        {generated.map(q => (
          <GeneratedQuestionCard
            key={q.id}
            question={q}
            adopted={!!adopted[q.id]}
            onToggle={toggleAdopt}
          />
        ))}
      </main>

      {/* 하단 액션바 */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.08)] z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            채택된 문제 <span className="text-zinc-900 font-semibold tabular-nums">{adoptedQuestions.length}</span>
            <span className="text-zinc-300 mx-1.5">·</span>
            전체 <span className="tabular-nums">{generated.length}</span>
          </div>
          <button
            onClick={handleStartQuiz}
            disabled={adoptedQuestions.length === 0}
            className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-semibold"
          >
            채택 문제 풀기 →
          </button>
        </div>
      </div>
    </div>
  )
}
