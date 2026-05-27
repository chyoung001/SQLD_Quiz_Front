import client from './client'

export const generatePracticeQuestions = (questionIds, count = 3) =>
  client.post('/llm/generate', { question_ids: questionIds, count }, { timeout: 120000 }).then(r => r.data)
