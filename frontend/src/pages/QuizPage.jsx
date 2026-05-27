import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useQuizStore from '../stores/quizStore'
import AssetRenderer from '../components/quiz/AssetRenderer'
import ChoiceList from '../components/quiz/ChoiceList'
import { getQuestionById } from '../api/questionApi'

const TABLE_TYPES = new Set(['data_table', 'result_table'])

function groupAssets(assets) {
  const result = []
  let i = 0
  while (i < assets.length) {
    if (TABLE_TYPES.has(assets[i].asset_type)) {
      const run = []
      while (i < assets.length && TABLE_TYPES.has(assets[i].asset_type)) {
        run.push(assets[i++])
      }
      result.push(run.length > 1 ? { _group: true, assets: run } : run[0])
    } else {
      result.push(assets[i++])
    }
  }
  return result
}

const QUESTION_TYPE_LABEL = {
  best_choice: '가장 적절한 것',
  worst_choice: '가장 적절하지 않은 것',
  fill_blank: '빈칸 채우기',
  fill_blanks_multi: '빈칸 채우기 (복수)',
  predict_result: '결과 예측',
  identify_sql: 'SQL 식별',
  different_result: '다른 결과',
  derive_count: '건수 도출',
  identify_normal_form: '정규형 식별',
}

function QuestionNavGrid({ questions, currentIndex, answers, onSelect }) {
  const answeredCount = Object.keys(answers).length
  const remaining = questions.length - answeredCount
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>남은 문제 <span className="text-zinc-700 font-semibold tabular-nums">{remaining}</span>개</span>
        <span className="tabular-nums">{answeredCount}/{questions.length}</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {questions.map((q, i) => {
          const isAnswered = answers[q.id] !== undefined
          const isCurrent = i === currentIndex
          let style = 'border border-zinc-200 text-zinc-400 bg-white hover:border-zinc-400'
          if (isCurrent) style = 'border border-zinc-900 bg-zinc-900 text-white font-semibold'
          else if (isAnswered) style = 'border border-blue-300 bg-blue-50 text-blue-600 font-medium'
          return (
            <button
              key={q.id}
              onClick={() => onSelect(i)}
              className={`rounded-md py-2 text-xs tabular-nums ${style}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-1.5 pt-1 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-zinc-900 flex-shrink-0" /> 현재 문제
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-50 border border-blue-300 flex-shrink-0" /> 답변 완료
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-white border border-zinc-200 flex-shrink-0" /> 미답변
        </span>
      </div>
    </div>
  )
}

function QuestionNavDrawer({ questions, currentIndex, answers, onSelect, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-sm z-20" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <span className="text-sm font-semibold text-zinc-900">문제 이동</span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 w-7 h-7 flex items-center justify-center rounded-md text-sm"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {questions.map((q, i) => {
              const isAnswered = answers[q.id] !== undefined
              const isCurrent = i === currentIndex
              let style = 'border border-zinc-200 text-zinc-500 bg-white hover:border-zinc-400'
              if (isCurrent) style = 'border border-zinc-900 bg-zinc-900 text-white font-semibold'
              else if (isAnswered) style = 'border border-zinc-300 bg-zinc-100 text-zinc-700'
              return (
                <button
                  key={q.id}
                  onClick={() => { onSelect(i); onClose() }}
                  className={`rounded-lg py-2.5 text-sm tabular-nums ${style}`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div className="flex gap-5 mt-5 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-900" /> 현재
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-100 border border-zinc-300" /> 답변 완료
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-white border border-zinc-200" /> 미답변
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

export default function QuizPage() {
  const navigate = useNavigate()
  const [showNav, setShowNav] = useState(false)
  const [grading, setGrading] = useState(false)
  const {
    questions, currentIndex, answers, generatedAnswers,
    getCurrentQuestion, selectAnswer, nextQuestion, prevQuestion,
    goToIndex, setSessionResult, reset,
  } = useQuizStore()

  useEffect(() => {
    if (questions.length === 0) navigate('/')
  }, [questions, navigate])

  const question = getCurrentQuestion()
  if (!question) return null

  const selected = answers[question.id]
  const isLast = currentIndex === questions.length - 1
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === questions.length

  const handleFinish = async () => {
    setGrading(true)
    try {
      const results = await Promise.all(
        questions.map(async (q) => {
          const gen = generatedAnswers[q.id]
          if (gen) {
            const fullQuestion = {
              ...q,
              choices: q.choices.map(c => ({ ...c, is_correct: c.choice_number === gen.correctChoice })),
              answer: { explanation: gen.explanation },
            }
            return {
              question: q,
              fullQuestion,
              selected: answers[q.id],
              correctChoice: gen.correctChoice,
              isCorrect: answers[q.id] === gen.correctChoice,
              explanation: gen.explanation,
            }
          }
          const full = await getQuestionById(q.id)
          const correctChoice = full.choices.find(c => c.is_correct)
          return {
            question: q,
            fullQuestion: full,
            selected: answers[q.id],
            correctChoice: correctChoice?.choice_number,
            isCorrect: answers[q.id] === correctChoice?.choice_number,
            explanation: full.answer?.explanation,
          }
        })
      )
      setSessionResult(results)
      navigate('/result')
    } finally {
      setGrading(false)
    }
  }

  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-sm border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => { reset(); navigate('/') }}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-medium flex items-center gap-1"
          >
            <span className="text-zinc-300">←</span> 나가기
          </button>
          <button
            onClick={() => setShowNav(true)}
            className="text-sm font-medium text-zinc-900 tabular-nums hover:bg-zinc-100 px-2.5 py-1 rounded-md flex items-center gap-1.5"
          >
            <span>{currentIndex + 1}</span>
            <span className="text-zinc-300">/</span>
            <span className="text-zinc-500">{questions.length}</span>
          </button>
          {allAnswered ? (
            <button
              onClick={handleFinish}
              disabled={grading}
              className="text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white px-3 py-1.5 rounded-md"
            >
              {grading ? '채점 중…' : '채점하기'}
            </button>
          ) : (
            <span className="text-xs text-zinc-400 tabular-nums">
              <span className="text-zinc-700">{answeredCount}</span>
              <span className="text-zinc-300 mx-0.5">/</span>
              {questions.length}
            </span>
          )}
        </div>
        <div className="h-px bg-zinc-100">
          <div
            className="h-full bg-zinc-900 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 flex gap-6 items-stretch">
        {/* 문제 영역 */}
        <div className="flex-1 min-w-0">
          {/* 문제 유형 뱃지 */}
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center text-[11px] font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full tracking-wide">
              {QUESTION_TYPE_LABEL[question.question_type] || question.question_type}
            </span>
          </div>

          {/* 문제 assets */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-6 mb-6 space-y-4">
            {groupAssets(question.assets
              .filter(a => !(question.question_type === 'find_erroneous' && ['sql_query', 'sql_ddl', 'sql_dml'].includes(a.asset_type)))
            ).map((item, i) =>
              item._group
                ? <div key={i} className="flex flex-wrap gap-4 items-start">
                    {item.assets.map((a, j) => <AssetRenderer key={j} asset={a} />)}
                  </div>
                : <AssetRenderer key={i} asset={item} />
            )}
          </div>

          {/* 선택지 */}
          <ChoiceList
            choices={question.choices}
            selected={selected}
            onSelect={(num) => selectAnswer(question.id, num)}
            showResult={false}
          />
        </div>

        {/* 오른쪽 사이드바 — lg 이상에서만 표시 */}
        <aside className="hidden lg:block w-64 flex-shrink-0 relative">
          <div className="sticky top-[4.5rem] bg-white rounded-xl border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">문제 목록</div>
            <QuestionNavGrid
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              onSelect={goToIndex}
            />
          </div>
        </aside>
      </main>

      {/* 하단 액션바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex gap-6 items-center">
          <div className="flex-1 flex gap-2.5">
            <button
              onClick={prevQuestion}
              disabled={currentIndex === 0}
              className="flex-1 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 text-sm font-medium
                disabled:opacity-30 hover:bg-zinc-50 hover:border-zinc-300"
            >
              이전
            </button>
            {!isLast ? (
              <button
                onClick={nextQuestion}
                className="flex-1 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold"
              >
                다음
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!allAnswered || grading}
                className="flex-1 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold
                  disabled:bg-zinc-300"
              >
                {grading ? '채점 중…' : '채점하기'}
              </button>
            )}
          </div>
          {/* 사이드바 너비만큼 spacer — 버튼을 문제 영역에 정렬 */}
          <div className="hidden lg:block w-64 flex-shrink-0" />
        </div>
      </div>

      {showNav && (
        <QuestionNavDrawer
          questions={questions}
          currentIndex={currentIndex}
          answers={answers}
          onSelect={goToIndex}
          onClose={() => setShowNav(false)}
        />
      )}
    </div>
  )
}
