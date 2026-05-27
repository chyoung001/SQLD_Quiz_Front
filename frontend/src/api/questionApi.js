import client from './client'

export const getChapters = () =>
  client.get('/chapters').then(r => r.data)

export const getQuestions = (chapterId, count = 10) =>
  client.get('/questions', { params: { chapter_id: chapterId, count } }).then(r => r.data)

export const getQuestionById = (id) =>
  client.get(`/questions/${id}`).then(r => r.data)
