# SQLD 퀴즈 웹 — 상세 구현 계획 (PLAN.md)

> 이 문서는 PROJECT_STRUCTURE.md의 설계를 기반으로
> 각 Phase별 구체적인 구현 순서, 파일 스펙, API 명세를 정의합니다.

---

## Phase 1: 기본 뼈대 (기존 문제 풀기)

### 1-1. 프로젝트 초기화

#### 1-1-A. 백엔드 초기화
```bash
mkdir -p backend/{api,models,services,langchain_module,data/questions,tests}
cd backend
python -m venv venv
pip install fastapi uvicorn[standard] motor beanie pydantic python-dotenv
pip freeze > requirements.txt
```

**파일 생성 순서:**
1. `backend/config.py`
2. `backend/models/database.py`
3. `backend/main.py`

##### config.py
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    db_name: str = "sqld_quiz"
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o"
    llm_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"

settings = Settings()
```

##### models/database.py
```python
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from config import settings

async def init_db():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(
        database=client[settings.db_name],
        document_models=[
            "models.question.Question",
            "models.user_progress.UserProgress",
            "models.study_session.StudySession",
            "models.generated_question.GeneratedQuestion",
        ]
    )
```

##### main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from models.database import init_db
from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="SQLD Quiz API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록 (1-3에서 구현)
# from api import questions, progress, generate, chapters
# app.include_router(questions.router, prefix="/api")
# ...
```

#### 1-1-B. 프론트엔드 초기화
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom zustand recharts axios react-syntax-highlighter
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**파일 생성 순서:**
1. `tailwind.config.js` (content 경로 설정)
2. `src/index.css` (Tailwind directives)
3. `src/App.jsx` (React Router 설정)
4. `src/api/client.js` (Axios 인스턴스)

---

### 1-2. Beanie Document 모델 정의

> **의존성**: 1-1-A 완료 후
> **산출물**: `models/` 디렉토리 4개 파일

#### models/question.py
```python
from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, Any

class Asset(BaseModel):
    asset_type: str                    # 17종 중 하나
    payload: Any                       # 타입별로 다른 구조 (dict 또는 str)

class Choice(BaseModel):
    choice_number: int
    choice_kind: str                   # 9종: text, sql_query, keyword, tuple, ...
    choice_text: str
    is_correct: bool

class Answer(BaseModel):
    explanation: str

class Question(Document):
    chapter_id: int
    question_number: int
    book_section: str
    question_type: str                 # 16종
    assets: list[Asset] = []
    choices: list[Choice] = []
    answer: Answer

    class Settings:
        name = "questions"             # MongoDB 컬렉션명
        indexes = [
            "chapter_id",
            "question_type",
            [("chapter_id", 1), ("question_number", 1)],  # 복합 유니크
        ]
```

#### models/user_progress.py
```python
from beanie import Document, PydanticObjectId
from datetime import datetime

class UserProgress(Document):
    question_id: PydanticObjectId            # ref: questions
    session_id: PydanticObjectId             # ref: study_sessions
    is_correct: bool
    selected_choice: int
    time_spent_sec: int = 0
    attempted_at: datetime = Field(default_factory=datetime.utcnow)
    is_generated: bool = False               # AI 생성 문제 여부
    gen_question_id: PydanticObjectId | None = None  # ref: generated_questions

    class Settings:
        name = "user_progress"
        indexes = [
            "question_id",
            "session_id",
            [("is_correct", 1), ("question_id", 1)],
        ]
```

#### models/study_session.py
```python
from beanie import Document
from datetime import datetime
from typing import Optional

class StudySession(Document):
    mode: str                          # "practice" | "exam" | "review"
    chapter_id: int
    total_questions: int = 0
    correct_count: int = 0
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None

    class Settings:
        name = "study_sessions"
        indexes = [
            [("started_at", -1)],
            "mode",
        ]
```

#### models/generated_question.py
```python
from beanie import Document, PydanticObjectId
from datetime import datetime
from models.question import Choice, Answer

class GeneratedQuestion(Document):
    source_question_id: PydanticObjectId     # ref: questions (원본)
    generation_type: str                     # "similar" | "trap" | "harder"
    difficulty: str = "medium"               # "easy" | "medium" | "hard"
    question_text: str
    choices: list[Choice] = []
    answer: Answer
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "generated_questions"
        indexes = [
            "source_question_id",
        ]
```

---

### 1-3. JSON → MongoDB 로더

> **의존성**: 1-2 완료 후
> **산출물**: `data/loader.py`

```python
"""
실행: python -m data.loader
12개 JSON 파일을 읽어 MongoDB questions 컬렉션에 적재
"""
import asyncio, json, glob
from models.database import init_db
from models.question import Question

CHAPTER_MAP = {
    1: "데이터 모델링의 이해",
    2: "데이터 모델과 SQL",
    3: "SQL 기본",
    4: "SQL 활용",
    5: "관리 구문",
    6: "SQL 수행 구조",
    7: "SQL 분석 도구",
    8: "인덱스 튜닝",
    9: "조인 튜닝",
    10: "SQL 옵티마이저",
    11: "고급 SQL 튜닝",
    12: "Lock과 트랜잭션 동시성 제어",
}

async def load_all():
    await init_db()
    existing = await Question.count()
    if existing > 0:
        print(f"이미 {existing}건 존재. 스킵.")
        return

    total = 0
    for filepath in sorted(glob.glob("data/questions/*.json")):
        with open(filepath, "r") as f:
            data = json.load(f)

        questions = []
        for q in data["questions"]:
            doc = Question(
                chapter_id=data["chapter_id"],
                question_number=q["question_number"],
                book_section=q["book_section"],
                question_type=q["question_type"],
                assets=q.get("assets", []),
                choices=q.get("choices", []),
                answer=q["answer"],
            )
            questions.append(doc)

        await Question.insert_many(questions)
        total += len(questions)
        ch = data["chapter_id"]
        print(f"  ch{ch:2d} {CHAPTER_MAP.get(ch, ''):20s} → {len(questions)}건")

    print(f"완료: 총 {total}건 적재")

if __name__ == "__main__":
    asyncio.run(load_all())
```

**검증 체크리스트:**
- [ ] 총 297건이 삽입되었는지 확인
- [ ] `chapter_id` + `question_number` 유니크 제약 확인
- [ ] asset payload가 원본 JSON과 동일한지 샘플 검증

---

### 1-4. API 라우터 구현 (문제 조회)

> **의존성**: 1-3 완료 후
> **산출물**: `api/chapters.py`, `api/questions.py`, `services/question_service.py`

#### API 엔드포인트 명세

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| GET | `/api/chapters` | 챕터 목록 | - | `[{chapter_id, name, count}]` |
| GET | `/api/questions` | 문제 조회 | `?chapter_id=3&count=10&random=true` | `[Question]` |
| GET | `/api/questions/{id}` | 단일 문제 | - | `Question` |

#### services/question_service.py
```python
from models.question import Question

class QuestionService:
    async def get_chapters(self) -> list[dict]:
        """챕터 목록 + 문제 수 반환"""
        pipeline = [
            {"$group": {"_id": "$chapter_id", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        results = await Question.aggregate(pipeline).to_list()
        return [
            {"chapter_id": r["_id"], "name": CHAPTER_MAP[r["_id"]], "count": r["count"]}
            for r in results
        ]

    async def get_random_questions(
        self, chapter_id: int, count: int = 10
    ) -> list[Question]:
        """챕터에서 랜덤 N문제 추출"""
        pipeline = [
            {"$match": {"chapter_id": chapter_id}},
            {"$sample": {"size": count}},
        ]
        return await Question.aggregate(pipeline).to_list()

    async def get_by_id(self, question_id: str) -> Question | None:
        return await Question.get(question_id)
```

#### api/questions.py
```python
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter(tags=["questions"])

@router.get("/chapters")
async def list_chapters(svc: QuestionService = Depends()):
    return await svc.get_chapters()

@router.get("/questions")
async def list_questions(
    chapter_id: int = Query(...),
    count: int = Query(default=10, le=50),
):
    svc = QuestionService()
    questions = await svc.get_random_questions(chapter_id, count)
    # 정답 정보 제거하여 반환 (프론트에서 채점은 별도 API)
    return [strip_answer(q) for q in questions]
```

---

### 1-5. 프론트엔드 핵심 페이지 구현

> **의존성**: 1-4 완료 후 (API가 동작해야 함)
> **산출물**: pages/ 5개, components/ 핵심 컴포넌트

#### 페이지 라우팅 구조
```jsx
// App.jsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/chapter" element={<ChapterSelectPage />} />
  <Route path="/quiz/:chapterId" element={<QuizPage />} />
  <Route path="/result/:sessionId" element={<ResultPage />} />
  <Route path="/review" element={<ReviewPage />} />
</Routes>
```

#### 페이지별 구현 스펙

| 페이지 | 핵심 기능 | 사용 컴포넌트 | API 호출 |
|--------|----------|--------------|----------|
| HomePage | 대시보드, 학습 시작 버튼 | StatsOverview, ChapterProgress | GET /chapters, GET /stats |
| ChapterSelectPage | 12개 챕터 카드, 문제 수 표시 | Badge | GET /chapters |
| QuizPage | 문제 풀기 메인 | QuestionCard, ChoiceList, AssetRenderer, QuizTimer, ProgressBar | GET /questions |
| ResultPage | 세션 결과, 문제별 해설 | ExplanationPanel, StatsOverview | GET /progress/:session |
| ReviewPage | 오답 노트, AI 변형 요청 | QuestionCard, ExplanationPanel | GET /wrong |

#### Zustand Store 설계

##### stores/quizStore.js
```javascript
import { create } from 'zustand'

const useQuizStore = create((set, get) => ({
  // 상태
  questions: [],           // 현재 세션의 문제 목록
  currentIndex: 0,         // 현재 문제 인덱스
  answers: {},             // { questionId: selectedChoice }
  sessionId: null,
  mode: 'practice',        // practice | exam | review
  startedAt: null,
  questionStartedAt: null, // 개별 문제 시작 시간

  // 액션
  startQuiz: (questions, mode) => set({
    questions,
    currentIndex: 0,
    answers: {},
    mode,
    startedAt: Date.now(),
    questionStartedAt: Date.now(),
  }),

  selectAnswer: (questionId, choiceNumber) => set(state => ({
    answers: { ...state.answers, [questionId]: choiceNumber },
  })),

  nextQuestion: () => set(state => ({
    currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1),
    questionStartedAt: Date.now(),
  })),

  prevQuestion: () => set(state => ({
    currentIndex: Math.max(state.currentIndex - 1, 0),
    questionStartedAt: Date.now(),
  })),

  getCurrentQuestion: () => {
    const { questions, currentIndex } = get()
    return questions[currentIndex] || null
  },

  getTimeSpent: () => {
    const { questionStartedAt } = get()
    return Math.floor((Date.now() - questionStartedAt) / 1000)
  },

  reset: () => set({
    questions: [], currentIndex: 0, answers: {},
    sessionId: null, startedAt: null,
  }),
}))
```

---

### 1-6. Asset 렌더러 구현 (17종)

> **의존성**: 1-5 페이지 구조 완료 후
> **산출물**: `components/quiz/AssetRenderer.jsx` + 개별 렌더러

#### 구현 우선순위 (사용빈도 기반 3단계)

##### Tier 1: 필수 (전체의 86%, 505건) — Phase 1에서 반드시 구현
| Asset 타입 | 건수 | 렌더링 방식 |
|-----------|------|------------|
| `text_block` | 349 | 일반 텍스트, `\n` → 줄바꿈, `[아래]` 등 키워드 강조 |
| `sql_query` | 92 | `react-syntax-highlighter` SQL 하이라이팅 |
| `data_table` | 64 | HTML `<table>`, 컬럼/행 동적 렌더링 |

##### Tier 2: 중요 (전체의 12%, 72건) — Phase 1 후반에 구현
| Asset 타입 | 건수 | 렌더링 방식 |
|-----------|------|------------|
| `list_items` | 16 | `<ul>` 또는 `<ol>` 번호 목록 |
| `sql_ddl` | 16 | SQL 하이라이팅 (sql_query와 동일 컴포넌트) |
| `result_table` | 14 | data_table과 동일 (`DataTableView` 재사용) |
| `entity_schema` | 12 | 테이블명 + 컬럼(PK/FK 표시) 카드 |
| `erd` | 7 | mermaid.js 렌더링 (`ErdDiagram` 컴포넌트) |
| `execution_plan` | 7 | 코드 블록 (preformatted text) |

##### Tier 3: 희귀 (전체의 2%, 11건) — Phase 2에서 구현
| Asset 타입 | 건수 | 렌더링 방식 |
|-----------|------|------------|
| `schema_variant_pair` | 2 | 좌/우 비교 레이아웃 (before/after) |
| `sql_dml` | 2 | SQL 하이라이팅 (재사용) |
| `sql_trace` | 2 | 테이블 형태 (headers + rows) |
| `functional_dependency` | 1 | 종속성 표기 텍스트 |
| `code_compare` | 1 | 좌/우 코드 비교 |
| `transaction_steps` | 1 | 스텝 목록 |
| `concurrent_timeline` | 1 | 타임라인 테이블 |
| `awr_report` | 1 | 테이블 형태 |

#### AssetRenderer.jsx (분기 로직)
```jsx
export default function AssetRenderer({ asset }) {
  const { asset_type, payload } = asset

  switch (asset_type) {
    // Tier 1
    case 'text_block':
      return <TextBlock text={payload.text} />
    case 'sql_query':
    case 'sql_ddl':
    case 'sql_dml':
      return <SqlCodeBlock code={payload.code || payload.sql} dialect={payload.dialect} />
    case 'data_table':
    case 'result_table':
      return <DataTableView data={payload} />

    // Tier 2
    case 'list_items':
      return <ListItems items={payload.items} />
    case 'entity_schema':
      return <EntitySchema entities={payload.entities} />
    case 'erd':
      return <ErdDiagram code={typeof payload === 'string' ? payload : ''} />
    case 'execution_plan':
      return <CodeBlock text={payload.text} />

    // Tier 3 (fallback → raw JSON)
    case 'schema_variant_pair':
      return <SchemaVariantPair data={payload} />
    case 'sql_trace':
    case 'awr_report':
    case 'concurrent_timeline':
      return <DataTableView data={payload} />
    case 'functional_dependency':
      return <FunctionalDep data={payload} />
    case 'code_compare':
      return <CodeCompare blocks={payload.blocks} />
    case 'transaction_steps':
      return <TransactionSteps steps={payload.steps} />

    default:
      return <pre className="text-xs">{JSON.stringify(payload, null, 2)}</pre>
  }
}
```

---

### 1-7. Choice 렌더러 구현 (9종)

> **의존성**: 1-5 페이지 구조와 병행
> **산출물**: `components/quiz/ChoiceList.jsx`

#### 선택지 종류별 렌더링 방식

| choice_kind | 건수 | 렌더링 | 비고 |
|-------------|------|--------|------|
| `text` | 569 | 일반 텍스트 라디오 버튼 | 가장 기본 |
| `sql_query` | 180 | SQL 하이라이팅 블록 + 라디오 | 코드 블록 형태 |
| `keyword` | 140 | 짧은 키워드 pill/badge 형태 | 한 줄 |
| `tuple` | 72 | 쉼표 구분 키워드 그룹 | "GROUP BY, DESC" |
| `value` | 63 | 숫자/값 표시 | 짧은 텍스트 |
| `sql_fragment` | 52 | 인라인 SQL 코드 | 짧은 코드 |
| `description` | 52 | 설명 텍스트 (text와 유사) | 긴 텍스트 |
| `result_table` | 48 | 마크다운 테이블 파싱 → HTML 테이블 | 파이프 구분 |
| `index_definition` | 12 | 인덱스 정의 텍스트 | "컬럼A + 컬럼B" |

#### ChoiceList.jsx
```jsx
export default function ChoiceList({ choices, selected, onSelect, showResult }) {
  return (
    <div className="space-y-3">
      {choices.map(choice => (
        <ChoiceItem
          key={choice.choice_number}
          choice={choice}
          isSelected={selected === choice.choice_number}
          showResult={showResult}
          onClick={() => onSelect(choice.choice_number)}
        />
      ))}
    </div>
  )
}

function ChoiceItem({ choice, isSelected, showResult, onClick }) {
  const { choice_number, choice_kind, choice_text, is_correct } = choice

  // 결과 표시 시 스타일
  const resultStyle = showResult
    ? is_correct
      ? 'border-green-500 bg-green-50'
      : isSelected
        ? 'border-red-500 bg-red-50'
        : 'border-gray-200'
    : isSelected
      ? 'border-blue-500 bg-blue-50'
      : 'border-gray-200 hover:border-gray-300'

  return (
    <button onClick={onClick} className={`w-full p-4 rounded-lg border-2 ${resultStyle}`}>
      <span className="font-medium mr-3">{choice_number}.</span>
      <ChoiceContent kind={choice_kind} text={choice_text} />
    </button>
  )
}

function ChoiceContent({ kind, text }) {
  switch (kind) {
    case 'sql_query':
    case 'sql_fragment':
      return <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{text}</code>
    case 'result_table':
      return <MarkdownTable markdown={text} />
    case 'keyword':
    case 'value':
    case 'index_definition':
      return <span className="font-mono">{text}</span>
    case 'tuple':
      return <span className="font-mono text-sm">{text}</span>
    case 'text':
    case 'description':
    default:
      return <span>{text}</span>
  }
}
```

---

### 1-8. Phase 1 완료 체크리스트

- [ ] MongoDB Atlas 연결 + Beanie 초기화 성공
- [ ] 297건 문제 데이터 적재 완료
- [ ] GET /api/chapters → 12개 챕터 반환
- [ ] GET /api/questions?chapter_id=1&count=5 → 5문제 반환
- [ ] 챕터 선택 → 문제 풀기 → 결과 확인 전체 플로우 동작
- [ ] Tier 1 asset 렌더러 (text_block, sql_query, data_table) 동작
- [ ] 9종 choice kind 모두 올바르게 렌더링
- [ ] 문제 풀기 시 정답/오답 시각적 피드백

---

## Phase 2: 학습 기록 시스템

### 2-1. 진도 관리 API

> **의존성**: Phase 1 완료
> **산출물**: `api/progress.py`, `services/progress_service.py`

#### API 엔드포인트 명세

| Method | Path | 설명 | Request Body | Response |
|--------|------|------|-------------|----------|
| POST | `/api/sessions` | 세션 시작 | `{mode, chapter_id, total_questions}` | `{session_id}` |
| PATCH | `/api/sessions/{id}` | 세션 종료 | `{correct_count, finished_at}` | `Session` |
| POST | `/api/progress` | 풀이 기록 저장 | `{question_id, session_id, selected_choice, time_spent_sec}` | `{is_correct, explanation}` |
| GET | `/api/progress/wrong` | 오답 목록 | `?chapter_id=3&limit=20` | `[{question, selected, correct}]` |
| GET | `/api/progress/stats` | 전체 통계 | - | `{total, correct, rate, by_chapter[]}` |
| GET | `/api/progress/stats/{chapter_id}` | 챕터별 통계 | - | `{total, correct, rate, by_type{}}` |

#### services/progress_service.py 핵심 메서드
```python
class ProgressService:

    async def record_answer(self, question_id, session_id, selected_choice, time_spent_sec):
        """풀이 기록 저장 + 정답 판정"""
        question = await Question.get(question_id)
        correct_choice = next(c for c in question.choices if c.is_correct)
        is_correct = correct_choice.choice_number == selected_choice

        progress = UserProgress(
            question_id=question_id,
            session_id=session_id,
            is_correct=is_correct,
            selected_choice=selected_choice,
            time_spent_sec=time_spent_sec,
        )
        await progress.insert()

        return {
            "is_correct": is_correct,
            "correct_answer": correct_choice.choice_number,
            "explanation": question.answer.explanation,
        }

    async def get_wrong_questions(self, chapter_id=None, limit=20):
        """오답 문제 목록 (최근 풀이 기준, 중복 제거)"""
        match = {"is_correct": False}
        if chapter_id:
            # question의 chapter_id로 필터 → lookup 필요
            pass

        pipeline = [
            {"$match": match},
            {"$sort": {"attempted_at": -1}},
            {"$group": {"_id": "$question_id", "latest": {"$first": "$$ROOT"}}},
            {"$limit": limit},
            {"$lookup": {
                "from": "questions",
                "localField": "_id",
                "foreignField": "_id",
                "as": "question"
            }},
            {"$unwind": "$question"},
        ]
        return await UserProgress.aggregate(pipeline).to_list()

    async def get_stats(self):
        """전체 통계"""
        pipeline = [
            {"$group": {
                "_id": None,
                "total": {"$sum": 1},
                "correct": {"$sum": {"$cond": ["$is_correct", 1, 0]}},
            }},
        ]
        result = await UserProgress.aggregate(pipeline).to_list()
        if not result:
            return {"total": 0, "correct": 0, "rate": 0}

        r = result[0]
        return {
            "total": r["total"],
            "correct": r["correct"],
            "rate": round(r["correct"] / r["total"] * 100, 1) if r["total"] > 0 else 0,
        }

    async def get_chapter_stats(self):
        """챕터별 정답률"""
        pipeline = [
            {"$lookup": {
                "from": "questions",
                "localField": "question_id",
                "foreignField": "_id",
                "as": "question"
            }},
            {"$unwind": "$question"},
            {"$group": {
                "_id": "$question.chapter_id",
                "total": {"$sum": 1},
                "correct": {"$sum": {"$cond": ["$is_correct", 1, 0]}},
            }},
            {"$sort": {"_id": 1}},
        ]
        results = await UserProgress.aggregate(pipeline).to_list()
        return [
            {
                "chapter_id": r["_id"],
                "total": r["total"],
                "correct": r["correct"],
                "rate": round(r["correct"] / r["total"] * 100, 1),
            }
            for r in results
        ]
```

### 2-2. 대시보드 구현

> **의존성**: 2-1 API 완료
> **산출물**: `pages/HomePage.jsx`, `components/dashboard/` 4개 파일

#### 대시보드 레이아웃
```
┌────────────────────────────────────────────┐
│  [전체 통계 카드 4개]                       │
│  총 풀이 수 │ 정답률 │ 오답 수 │ 학습일수   │
├────────────────────────────────────────────┤
│  [챕터별 정답률 바 차트]          Recharts  │
│  ch1 ████████░░ 80%                        │
│  ch2 ██████░░░░ 60%                        │
│  ...                                       │
├────────────────────────────────────────────┤
│  [취약 분야 Top 5]              정답률 낮은  │
│  1. SQL 활용 - predict_result    45%        │
│  2. 조인 튜닝 - fill_blank       50%        │
├────────────────────────────────────────────┤
│  [최근 세션 목록]                           │
│  2025-06-01 ch3 연습 8/10 (80%)            │
│  2025-05-31 ch1 시험 15/20 (75%)           │
└────────────────────────────────────────────┘
```

### 2-3. Tier 2 + Tier 3 Asset 렌더러

> **의존성**: Phase 1 Tier 1 완료
> **산출물**: 나머지 렌더러 컴포넌트 8개

구현 순서:
1. `EntitySchema.jsx` — 테이블 스키마 카드 (12건)
2. `ErdDiagram.jsx` — mermaid.js 연동 (7건)
3. `ListItems.jsx` — 단순 리스트 (16건)
4. `SchemaVariantPair.jsx` — before/after 비교 (2건)
5. `CodeCompare.jsx` — 코드 비교 (1건)
6. `TransactionSteps.jsx` — 트랜잭션 스텝 (1건)
7. `FunctionalDep.jsx` — 함수 종속성 (1건)
8. `ConcurrentTimeline.jsx` — 타임라인 (1건)

### 2-4. Phase 2 완료 체크리스트

- [ ] POST /api/progress 로 풀이 기록 저장 동작
- [ ] GET /api/progress/wrong 에서 오답 목록 반환
- [ ] GET /api/progress/stats 전체/챕터별 통계 정확
- [ ] 대시보드에 Recharts 차트 표시
- [ ] 오답 노트 페이지에서 틀린 문제 + 해설 확인
- [ ] Tier 2 + 3 렌더러 17종 전체 동작
- [ ] 세션 시작/종료 흐름 정상

---

## Phase 3: AI 변형 문제 생성

### 3-1. LangChain 모듈 구현

> **의존성**: Phase 2 완료 (오답 데이터 필요)
> **산출물**: `langchain_module/` 4개 파일

#### 구현 순서
1. `prompts.py` — 3가지 생성 유형별 프롬프트 템플릿
2. `output_parsers.py` — JSON 출력 파서 + 검증
3. `chains.py` — LLM 초기화 + 체인 구성
4. `question_generator.py` — 통합 생성 로직

#### prompts.py (핵심 프롬프트)
```python
SIMILAR_PROMPT = """
당신은 SQLD(SQL Developer) 자격증 문제 출제 전문가입니다.

아래 원본 문제를 분석한 후, 같은 개념을 다른 각도에서 묻는 유사 변형 문제를 생성하세요.

[원본 문제]
유형: {question_type}
문제: {question_text}
선택지:
{choices_text}
정답: {correct_answer}
해설: {explanation}

[생성 규칙]
1. 같은 SQL/데이터 모델링 개념을 테스트하되, 문제 표현과 선택지를 변경
2. 선택지 4개 중 정답은 반드시 1개
3. 오답 선택지는 그럴듯하지만 미묘하게 틀린 내용
4. 난이도: {difficulty}
5. 반드시 아래 JSON 형식으로만 응답

{format_instructions}
"""

TRAP_PROMPT = """
... (자주 틀리는 포인트를 강조한 함정 문제 생성)
사용자가 선택한 오답: {user_wrong_answer}
사용자가 틀린 이유를 분석하고, 그 오개념을 교정할 수 있는 문제를 생성하세요.
...
"""

HARDER_PROMPT = """
... (난이도를 높인 문제 생성)
원본보다 복합적인 시나리오를 제시하되, 동일한 핵심 개념을 테스트하세요.
...
"""
```

#### output_parsers.py
```python
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, field_validator

class GeneratedQuestionSchema(BaseModel):
    question_text: str
    question_type: str
    choices: list[dict]     # [{choice_number, choice_text, is_correct}]
    answer: dict            # {explanation, related_concept}
    difficulty: str

    @field_validator("choices")
    def validate_choices(cls, v):
        assert len(v) == 4, "선택지는 반드시 4개"
        correct = [c for c in v if c.get("is_correct")]
        assert len(correct) == 1, "정답은 반드시 1개"
        return v

parser = PydanticOutputParser(pydantic_object=GeneratedQuestionSchema)
```

### 3-2. 생성 API 구현

| Method | Path | 설명 | Request Body |
|--------|------|------|-------------|
| POST | `/api/generate` | 변형 문제 생성 | `{source_question_id, type, difficulty}` |
| GET | `/api/generated` | 생성된 문제 목록 | `?source_id=...` |
| GET | `/api/generated/{id}` | 생성 문제 상세 | - |

### 3-3. 생성 문제 캐싱 전략

```
요청: source_question_id + generation_type + difficulty
  │
  ▼
[캐시 확인] generated_questions에서 조건 매칭
  │
  ├─ 캐시 HIT (3건 이하) → 기존 생성 문제 반환
  │
  └─ 캐시 MISS 또는 3건 초과 필요 → LLM 호출 → 저장 → 반환
```

- 동일 원본 + 동일 타입으로 최대 3건까지 캐싱
- 3건 초과 요청 시 새로 생성
- 캐시 TTL 없음 (영구 보관, 수동 삭제 가능)

### 3-4. Phase 3 완료 체크리스트

- [ ] LLM API 키 설정 및 연결 확인
- [ ] POST /api/generate 로 변형 문제 생성 성공
- [ ] 생성된 문제가 QuestionCard로 정상 렌더링
- [ ] 생성 문제 풀이 기록이 gen_question_id로 저장
- [ ] 결과 화면에서 원본 vs 변형 비교 표시
- [ ] 캐싱 동작 확인 (중복 생성 방지)
- [ ] Output Parser 검증 실패 시 재시도 로직

---

## Phase 4: 고도화 + 배포

### 4-1. 추가 기능

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| 모의고사 모드 | 50문제 랜덤, 100분 타이머, 챕터 혼합 | 높음 |
| 취약 분야 분석 | 정답률 낮은 chapter × question_type 조합 Top 5 | 높음 |
| 학습 연속일 | 날짜별 풀이 기록 → 연속 일수 카운트 | 중간 |
| 문제 즐겨찾기 | 북마크 기능 | 낮음 |
| 오답 자동 복습 | 3회 연속 오답 시 자동으로 변형 문제 추천 | 낮음 |

### 4-2. 배포 절차

#### Step 1: MongoDB Atlas
```
1. atlas.mongodb.com 가입
2. Free M0 클러스터 생성 (AWS Seoul)
3. DB 유저 생성 + IP 허용 (0.0.0.0/0 for Render)
4. Connection String 복사
5. python -m data.loader 로 데이터 적재
```

#### Step 2: 백엔드 (Render)
```
1. render.com 가입
2. New Web Service → GitHub 레포 연결
3. Build: pip install -r requirements.txt
4. Start: uvicorn main:app --host 0.0.0.0 --port $PORT
5. 환경변수 설정: MONGODB_URI, LLM_API_KEY
```

#### Step 3: 프론트엔드 (Vercel)
```
1. vercel.com 가입
2. Import Git Repository → frontend/ 선택
3. Framework Preset: Vite
4. 환경변수: VITE_API_URL=https://xxx.onrender.com/api
5. 빌드 & 배포
```

### 4-3. Phase 4 완료 체크리스트

- [ ] 모의고사 모드 동작 (시간 제한 + 랜덤 출제)
- [ ] 취약 분야 차트 표시
- [ ] Atlas 데이터 적재 완료 (297건)
- [ ] Render 백엔드 헬스체크 응답
- [ ] Vercel 프론트 배포 + API 연결
- [ ] CORS 설정 정상
- [ ] 모바일 반응형 확인

---

## 부록: 파일별 구현 의존성 그래프

```
config.py
  └→ models/database.py
       └→ models/question.py
       └→ models/user_progress.py
       └→ models/study_session.py
       └→ models/generated_question.py
            └→ data/loader.py (1회성 스크립트)
            └→ services/question_service.py
            │    └→ api/questions.py
            │    └→ api/chapters.py
            └→ services/progress_service.py
            │    └→ api/progress.py
            └→ langchain_module/prompts.py
                 └→ langchain_module/output_parsers.py
                 └→ langchain_module/chains.py
                      └→ langchain_module/question_generator.py
                           └→ services/generator_service.py
                                └→ api/generate.py

main.py (모든 라우터 등록)

--- Frontend ---

api/client.js
  └→ api/questionApi.js
  └→ api/progressApi.js
  └→ api/generateApi.js

stores/quizStore.js
stores/progressStore.js

components/quiz/AssetRenderer.jsx
  └→ SqlCodeBlock.jsx
  └→ DataTableView.jsx
  └→ TextBlock.jsx
  └→ EntitySchema.jsx
  └→ ErdDiagram.jsx
  └→ (기타 14개 렌더러)

components/quiz/ChoiceList.jsx
  └→ MarkdownTable.jsx (result_table용)

components/quiz/QuestionCard.jsx
  └→ AssetRenderer.jsx
  └→ ChoiceList.jsx
  └→ ExplanationPanel.jsx

pages/QuizPage.jsx
  └→ QuestionCard.jsx
  └→ QuizTimer.jsx
  └→ ProgressBar.jsx
  └→ stores/quizStore.js
  └→ api/questionApi.js
```
