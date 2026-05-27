import client from './client'

export const getExamQuestions = () =>
  client.get('/exam/questions').then(r => r.data)

export const gradeExam = (questionIds) =>
  client.post('/exam/grade', { question_ids: questionIds }).then(r => r.data)
