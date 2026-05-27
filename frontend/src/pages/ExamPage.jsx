import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useExamStore, { SUBJECT1_COUNT } from '../stores/examStore'
import AssetRenderer from '../components/quiz/AssetRenderer'
import ChoiceList from '../components/quiz/ChoiceList'
import { gradeExam } from '../api/examApi'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function ExamNavSidebar({ questions, currentIndex, answers, onSelect }) {
  const sub1 = questions.slice(0, SUBJECT1_COUNT)
  const sub2 = questions.slice(SUBJECT1_COUNT)
  const answeredCount = Object.keys(answers).length

  const renderBtn = (q, globalIdx) => {
    const isAnswered = answers[q.id] !== undefined
    const isCurrent = globalIdx === currentIndex
    let style = 'border border-zinc-200 text-zinc-400 bg-white hover:border-zinc-400'
    if (isCurrent) style = 'border border-zinc-900 bg-zinc-900 text-white font-semibold'
    else if (isAnswered) style = 'border border-blue-300 bg-blue-50 text-blue-600 font-medium'
    return (
      <button
        key={q.id}
        onClick={() => onSelect(globalIdx)}
        className={`rounded-md py-1.5 text-xs tabular-nums ${style}`}
      >
        {globalIdx + 1}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] text-zinc-400 flex justify-between">
        <span>답변 <span className="text-zinc-700 font-semibold tabular-nums">{answeredCount}</span>/50</span>
        <span>남은 <span className="text-zinc-700 font-semibold tabular-nums">{50 - answeredCount}</span></span>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1.5">
          1과목 (1–10)
        </div>
        <div className="grid grid-cols-5 gap-1">
          {sub1.map((q, i) => renderBtn(q, i))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">
          2과목 (11–50)
        </div>
        <div className="grid grid-cols-5 gap-1">
          {sub2.map((q, i) => renderBtn(q, i + SUBJECT1_COUNT))}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
        <span className="flex items-center gap-1.5 mt-2">
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

export default function ExamPage() {
  const navigate = useNavigate()
  const [grading, setGrading] = useState(false)
  const timerRef = useRef(null)
  const autoSubmittedRef = useRef(false)

  const {
    questions, currentIndex, answers, timeRemaining, status,
    selectAnswer, nextQuestion, prevQuestion, goToIndex,
    tick, setExamResult, reset,
  } = useExamStore()

  // idle 상태(시험 미시작)일 때만 홈으로 리다이렉트 — finished 상태는 여기서 처리하지 않음
  useEffect(() => {
    if (status === 'idle' || questions.length === 0) navigate('/')
  }, [status, questions, navigate])

  // 타이머
  useEffect(() => {
    if (status !== 'active') return
    timerRef.current = setInterval(() => tick(), 1000)
    return () => clearInterval(timerRef.current)
  }, [status, tick])

  // 시간 종료 → 자동 제출
  useEffect(() => {
    if (timeRemaining === 0 && status === 'active' && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      handleFinish()
    }
  }, [timeRemaining])

  if (questions.length === 0) return null

  const question = questions[currentIndex]
  if (!question) return null

  const selected = answers[question.id]
  const isLast = currentIndex === questions.length - 1
  const answeredCount = Object.keys(answers).length
  const isWarning = timeRemaining <= 300  // 5분 이하 경고
  const isSubject1 = currentIndex < SUBJECT1_COUNT

  const handleFinish = async () => {
    if (grading) return
    clearInterval(timerRef.current)
    setGrading(true)
    try {
      const questionIds = questions.map(q => q.id)
      const gradeData = await gradeExam(questionIds)
      const gradeMap = Object.fromEntries(gradeData.map(g => [g.question_id, g]))

      const results = questions.map((q) => {
        const grade = gradeMap[q.id]
        return {
          question: q,
          fullChoices: grade?.choices ?? q.choices,
          selected: answers[q.id],
          correctChoice: grade?.correct_choice,
          isCorrect: answers[q.id] === grade?.correct_choice,
          explanation: grade?.explanation ?? '',
        }
      })

      setExamResult(results)
      navigate('/exam-result')
    } finally {
      setGrading(false)
    }
  }

  const handleExit = () => {
    if (window.confirm('시험을 종료하면 진행 상황이 사라집니다. 나가시겠습니까?')) {
      clearInterval(timerRef.current)
      reset()
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-sm border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={handleExit}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-medium flex items-center gap-1"
          >
            <span className="text-zinc-300">←</span> 나가기
          </button>

          {/* 타이머 */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-sm font-semibold tabular-nums
            ${isWarning
              ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse'
              : 'bg-zinc-100 text-zinc-700'}`}>
            ⏱ {formatTime(timeRemaining)}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 tabular-nums">
              <span className="text-zinc-700 font-medium">{answeredCount}</span>/50
            </span>
            <button
              onClick={handleFinish}
              disabled={grading}
              className="text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white px-3 py-1.5 rounded-md"
            >
              {grading ? '채점 중…' : '제출하기'}
            </button>
          </div>
        </div>
        <div className="h-px bg-zinc-100">
          <div
            className="h-full bg-zinc-900 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 flex gap-6 items-stretch">
        {/* 문제 영역 */}
        <div className="flex-1 min-w-0">
          <div className="mb-4 flex items-center gap-2">
            <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border
              ${isSubject1
                ? 'text-blue-600 bg-blue-50 border-blue-200'
                : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
              {isSubject1 ? '1과목 · 데이터 모델링의 이해' : '2과목 · SQL 기본 및 활용'}
            </span>
            <span className="text-[11px] text-zinc-400 tabular-nums">{currentIndex + 1}번</span>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-6 mb-6 space-y-4">
            {question.assets.map((asset, i) => (
              <AssetRenderer key={i} asset={asset} />
            ))}
          </div>

          <ChoiceList
            choices={question.choices}
            selected={selected}
            onSelect={(num) => selectAnswer(question.id, num)}
            showResult={false}
          />
        </div>

        {/* 오른쪽 사이드바 */}
        <aside className="hidden lg:block w-64 flex-shrink-0 relative">
          <div className="sticky top-[4.5rem] bg-white rounded-xl border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">문제 목록</div>
            <ExamNavSidebar
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              onSelect={goToIndex}
            />
          </div>
        </aside>
      </main>

      {/* 하단 네비게이션 */}
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
                disabled={grading}
                className="flex-1 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold disabled:bg-zinc-300"
              >
                {grading ? '채점 중…' : '시험 종료 및 채점'}
              </button>
            )}
          </div>
          <div className="hidden lg:block w-64 flex-shrink-0" />
        </div>
      </div>
    </div>
  )
}
