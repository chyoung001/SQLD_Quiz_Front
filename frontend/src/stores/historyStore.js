import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useHistoryStore = create(
  persist(
    (set) => ({
      sessions: [],
      // session: { id, chapterId, startedAt, finishedAt, total, correct,
      //   results: [{ questionId, selected, correctChoice, isCorrect }] }

      addSession: (session) => set(state => {
        if (state.sessions.some(s => s.id === session.id)) return state
        return { sessions: [...state.sessions, session] }
      }),

      removeSession: (sessionId) => set(state => ({
        sessions: state.sessions.filter(s => s.id !== sessionId),
      })),

      clear: () => set({ sessions: [] }),
    }),
    {
      name: 'sqld-history',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// 파생 셀렉터들 — 컴포넌트에서 useMemo와 함께 사용
// (store 안에서 직접 호출하면 매번 새 객체를 반환해 무한 렌더 유발)

export function computeStats(sessions) {
  const total = sessions.reduce((sum, s) => sum + (s.total || 0), 0)
  const correct = sessions.reduce((sum, s) => sum + (s.correct || 0), 0)
  return {
    total,
    correct,
    rate: total > 0 ? Math.round((correct / total) * 100) : 0,
    sessionCount: sessions.length,
  }
}

export function computeChapterStats(sessions) {
  const map = {}
  for (const s of sessions) {
    const cid = s.chapterId
    if (cid == null) continue
    if (!map[cid]) map[cid] = { total: 0, correct: 0 }
    map[cid].total += s.total || 0
    map[cid].correct += s.correct || 0
  }
  return Object.entries(map)
    .map(([cid, v]) => ({
      chapter_id: Number(cid),
      total: v.total,
      correct: v.correct,
      rate: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.chapter_id - b.chapter_id)
}

// 최근 풀이 기준 오답 questionId 목록 (같은 문제 중복 제거)
export function computeWrongQuestions(sessions) {
  const wrongMap = new Map()
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i]
    for (const r of s.results || []) {
      if (!r.isCorrect && !wrongMap.has(r.questionId)) {
        wrongMap.set(r.questionId, {
          questionId: r.questionId,
          selected: r.selected,
          correctChoice: r.correctChoice,
          sessionId: s.id,
          chapterId: s.chapterId,
          attemptedAt: s.finishedAt,
        })
      }
    }
  }
  return Array.from(wrongMap.values())
}

export default useHistoryStore
