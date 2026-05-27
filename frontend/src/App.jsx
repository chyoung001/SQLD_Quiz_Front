import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChapterSelectPage from './pages/ChapterSelectPage'
import QuizPage from './pages/QuizPage'
import ResultPage from './pages/ResultPage'
import GeneratedQuizReviewPage from './pages/GeneratedQuizReviewPage'
import ExamPage from './pages/ExamPage'
import ExamResultPage from './pages/ExamResultPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChapterSelectPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/ai-review" element={<GeneratedQuizReviewPage />} />
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/exam-result" element={<ExamResultPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
