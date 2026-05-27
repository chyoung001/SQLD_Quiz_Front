import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const EXAM_DURATION = 60 * 60  // 3600초
export const SUBJECT1_COUNT = 10
export const SUBJECT2_COUNT = 40

// 점수 계산 (각 문제 2점, 총 100점)
export function calcExamScore(results) {
  const sub1 = results.slice(0, SUBJECT1_COUNT)
  const sub2 = results.slice(SUBJECT1_COUNT)

  const sub1Correct = sub1.filter(r => r.isCorrect).length
  const sub2Correct = sub2.filter(r => r.isCorrect).length
  const totalCorrect = sub1Correct + sub2Correct

  const sub1Score = sub1Correct * 2   // /20
  const sub2Score = sub2Correct * 2   // /80
  const totalScore = totalCorrect * 2  // /100

  const sub1Pass = sub1Score >= 8     // 4문제 이상
  const sub2Pass = sub2Score >= 32    // 16문제 이상
  const totalPass = totalScore >= 60  // 30문제 이상
  const passed = sub1Pass && sub2Pass && totalPass

  return {
    sub1Correct, sub2Correct, totalCorrect,
    sub1Score, sub2Score, totalScore,
    sub1Pass, sub2Pass, totalPass,
    passed,
  }
}

const useExamStore = create(
  persist(
    (set) => ({
      examId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      timeRemaining: EXAM_DURATION,
      examResult: null,
      status: 'idle',  // 'idle' | 'active' | 'finished'

      startExam: (questions) => set({
        examId: Date.now().toString(),
        questions,
        currentIndex: 0,
        answers: {},
        timeRemaining: EXAM_DURATION,
        examResult: null,
        status: 'active',
      }),

      selectAnswer: (questionId, choiceNumber) =>
        set((s) => ({ answers: { ...s.answers, [questionId]: choiceNumber } })),

      nextQuestion: () =>
        set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),

      prevQuestion: () =>
        set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),

      goToIndex: (index) => set({ currentIndex: index }),

      tick: () =>
        set((s) => ({ timeRemaining: Math.max(0, s.timeRemaining - 1) })),

      setExamResult: (result) => set({ examResult: result, status: 'finished' }),

      reset: () => set({
        examId: null,
        questions: [],
        currentIndex: 0,
        answers: {},
        timeRemaining: EXAM_DURATION,
        examResult: null,
        status: 'idle',
      }),
    }),
    {
      name: 'sqld-exam',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

export default useExamStore
