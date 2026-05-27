import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useExamStore, { calcExamScore, SUBJECT1_COUNT } from '../stores/examStore'
import AssetRenderer from '../components/quiz/AssetRenderer'
import ChoiceList from '../components/quiz/ChoiceList'

const CHAPTER_NAMES = {
  1: '데이터 모델링의 이해',
  2: '데이터 모델과 SQL',
  3: 'SQL 기본',
  4: 'SQL 활용',
  5: '관리 구문',
  6: 'SQL 수행 구조',
  7: 'SQL 분석 도구',
  8: '인덱스 튜닝',
  9: '조인 튜닝',
  10: 'SQL 옵티마이저',
  11: '고급 SQL 튜닝',
  12: 'Lock과 트랜잭션',
}

function SubjectCard({ label, correct, total, score, maxScore, pass, passCriteria }) {
  const rate = Math.round((correct / total) * 100)
  return (
    <div className={`flex-1 rounded-xl border p-4 ${pass ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-600 leading-tight">{label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 flex-shrink-0
          ${pass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
          {pass ? '통과' : '과락'}
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-semibold tabular-nums text-zinc-900">{score}</span>
        <span className="text-sm text-zinc-400">/ {maxScore}점</span>
      </div>
      <div className="text-xs text-zinc-500 tabular-nums">
        {correct}/{total}문제 정답 · {rate}%
      </div>
      <div className="mt-2 text-[10px] text-zinc-400">
        과락 기준 {passCriteria}점 미만
      </div>
    </div>
  )
}

function ChapterChart({ examResult }) {
  const stats = useMemo(() => {
    const map = {}
    examResult.forEach((r) => {
      const cid = r.question.chapter_id
      if (!map[cid]) map[cid] = { chapter_id: cid, total: 0, wrong: 0 }
      map[cid].total++
      if (!r.isCorrect) map[cid].wrong++
    })
    return Object.values(map)
      .map(s => ({ ...s, wrongRate: s.total > 0 ? Math.round((s.wrong / s.total) * 100) : 0 }))
      .sort((a, b) => b.wrongRate - a.wrongRate)
  }, [examResult])

  return (
    <div className="space-y-2.5">
      {stats.map(s => {
        const correctRate = 100 - s.wrongRate
        const color = s.wrongRate >= 60 ? 'bg-rose-500' : s.wrongRate >= 30 ? 'bg-amber-400' : 'bg-emerald-500'
        const textColor = s.wrongRate >= 60 ? 'text-rose-600' : s.wrongRate >= 30 ? 'text-amber-600' : 'text-emerald-600'
        return (
          <div key={s.chapter_id}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-mono text-zinc-400 flex-shrink-0">
                  {String(s.chapter_id).padStart(2, '0')}
                </span>
                <span className="text-xs text-zinc-600 truncate">
                  {CHAPTER_NAMES[s.chapter_id] || `챕터 ${s.chapter_id}`}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  오답 {s.wrong}/{s.total}
                </span>
                <span className={`text-[11px] font-semibold tabular-nums w-9 text-right ${textColor}`}>
                  {s.wrongRate}%
                </span>
              </div>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${s.wrongRate}%` }}
              />
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-4 pt-1 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" /> 오답률 60% 이상</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 30~59%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> 30% 미만</span>
      </div>
    </div>
  )
}

export default function ExamResultPage() {
  const navigate = useNavigate()
  const { examResult, reset } = useExamStore()
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [subjectFilter, setSubjectFilter] = useState('all')

  // navigate는 render 중에 호출하면 안 되므로 useEffect로 처리
  useEffect(() => {
    if (!examResult || examResult.length === 0) navigate('/')
  }, [examResult, navigate])

  if (!examResult || examResult.length === 0) return null

  const score = calcExamScore(examResult)
  const { sub1Correct, sub2Correct, sub1Score, sub2Score, totalScore, sub1Pass, sub2Pass, passed } = score

  const filteredResults = examResult
    .map((r, i) => ({ ...r, globalIdx: i }))
    .filter(r => {
      if (subjectFilter === '1') return r.globalIdx < SUBJECT1_COUNT
      if (subjectFilter === '2') return r.globalIdx >= SUBJECT1_COUNT
      return true
    })

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-900">모의고사 결과</span>
          <button
            onClick={() => { reset(); navigate('/') }}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-medium"
          >
            홈으로
          </button>
        </div>
      </header>

      {/* 합격 판정 + 총점 */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-5
            ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
            {passed ? '🎉 합격' : '✕ 불합격'}
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-5xl font-bold tabular-nums text-zinc-900">{totalScore}</span>
            <span className="text-lg text-zinc-400">/ 100점</span>
          </div>
          <p className="text-sm text-zinc-500 mb-1">
            합격 기준: 60점 이상 + 각 과목 과락 없음
          </p>
          {!passed && (
            <p className="text-xs text-rose-500">
              {[
                !score.totalPass && '총점 미달',
                !sub1Pass && '1과목 과락',
                !sub2Pass && '2과목 과락',
              ].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* 과목별 카드 */}
          <div className="flex gap-3 mt-5">
            <SubjectCard
              label="1과목 · 데이터 모델링의 이해"
              correct={sub1Correct}
              total={SUBJECT1_COUNT}
              score={sub1Score}
              maxScore={20}
              pass={sub1Pass}
              passCriteria={8}
            />
            <SubjectCard
              label="2과목 · SQL 기본 및 활용"
              correct={sub2Correct}
              total={40}
              score={sub2Score}
              maxScore={80}
              pass={sub2Pass}
              passCriteria={32}
            />
          </div>
        </div>
      </section>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-8">
        {/* 챕터별 오답률 시각화 */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">챕터별 오답률</h2>
          <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <ChapterChart examResult={examResult} />
          </div>
        </section>

        {/* 문제별 결과 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-700">문제별 결과</h2>
            <div className="flex gap-1">
              {[['all', '전체'], ['1', '1과목'], ['2', '2과목']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setSubjectFilter(val); setExpandedIdx(null) }}
                  className={`text-[11px] px-2.5 py-1 rounded-md font-medium
                    ${subjectFilter === val ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredResults.map((result) => {
              const idx = result.globalIdx
              const isSubject1 = idx < SUBJECT1_COUNT
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <button
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-50"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${result.isCorrect
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                        {result.isCorrect ? '○' : '✕'}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0
                        ${isSubject1 ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-700'}`}>
                        {isSubject1 ? '1과목' : '2과목'}
                      </span>
                      <span className="text-sm font-medium text-zinc-900 tabular-nums flex-shrink-0">
                        {idx + 1}번
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
                        choices={result.fullChoices}
                        selected={result.selected}
                        onSelect={() => {}}
                        showResult={true}
                        correctChoice={result.correctChoice}
                      />
                      {result.explanation && (
                        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                          <div className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">해설</div>
                          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                            {result.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
