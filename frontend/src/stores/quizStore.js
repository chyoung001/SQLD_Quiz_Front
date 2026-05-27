import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useQuizStore = create(
  persist(
    (set, get) => ({
      sessionId: null,
      startedAt: null,
      questions: [],
      currentIndex: 0,
      answers: {},       // { questionId: choiceNumber }
      sessionResult: [], // [{ question, selected, isCorrect, explanation }]
      mode: 'practice',
      chapterId: null,

      generatedAnswers: {}, // { questionId: { correctChoice, explanation } } for AI-generated questions

      startQuiz: (questions, chapterId, generatedAnswers = {}) => set({
        sessionId: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        questions,
        currentIndex: 0,
        answers: {},
        sessionResult: [],
        chapterId,
        generatedAnswers,
      }),

      selectAnswer: (questionId, choiceNumber) => set(state => ({
        answers: { ...state.answers, [questionId]: choiceNumber },
      })),

      nextQuestion: () => set(state => ({
        currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1),
      })),

      prevQuestion: () => set(state => ({
        currentIndex: Math.max(state.currentIndex - 1, 0),
      })),

      goToIndex: (index) => set(state => ({
        currentIndex: Math.max(0, Math.min(index, state.questions.length - 1)),
      })),

      setSessionResult: (result) => set({ sessionResult: result }),

      getCurrentQuestion: () => {
        const { questions, currentIndex } = get()
        return questions[currentIndex] || null
      },

      reset: () => set({
        sessionId: null,
        startedAt: null,
        questions: [], currentIndex: 0, answers: {}, sessionResult: [], chapterId: null,
        generatedAnswers: {},
      }),
    }),
    {
      name: 'sqld-quiz-current',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

export default useQuizStore
