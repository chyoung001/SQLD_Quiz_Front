# SQLD Quiz Platform

> SQLD(SQL 개발자) 자격증 시험 대비 AI 기반 문제 풀이 플랫폼.
> 기출 297문제 풀이부터 모의고사, RAG 기반 AI 변형 문제 생성, 이중 LLM 품질 검증까지 자격증 준비의 전 과정을 자동화합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **챕터별 문제 풀이** | 12개 챕터 × 297문제 무작위 출제, 즉시 채점 + 해설 |
| **모의고사 모드** | 실제 시험과 동일한 50문제 구성 (1과목 10 + 2과목 40), 시간 제한, 과목별 과락 채점 |
| **AI 변형 문제 생성** | 틀린 문제를 입력하면 같은 개념의 변형 문제 5개를 LLM이 자동 생성 |
| **RAG 유사 기출 주입** | 임베딩 벡터 검색으로 같은 챕터의 유사 기출을 프롬프트 컨텍스트로 자동 주입 → 중복 출제 방지 |
| **이중 LLM 품질 검증** | Gemini 생성 → Claude Opus 검증 + 품질 점수 + 자동 수정 |
| **취약 챕터 시각화** | 모의고사 결과에서 챕터별 오답률 한눈에 파악 |
| **17종 Asset 렌더러** | text/SQL/data_table/ERD(mermaid)/execution_plan 등 시험 문제의 다양한 콘텐츠 타입 지원 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **프론트엔드** | React 19, React Router 7, Zustand 5, TailwindCSS 4, Vite 8 |
| **시각화** | react-syntax-highlighter (SQL), mermaid (ERD) |
| **백엔드** | FastAPI 0.136, Uvicorn 0.48, Beanie ODM 1.28, Motor 3.7 |
| **데이터베이스** | MongoDB Atlas + Vector Search (`$vectorSearch`) |
| **LLM — 문제 생성** | Google Gemini 2.5 Flash (`response_schema` 강제 JSON 출력) |
| **LLM — 품질 검증** | Claude Opus 4.7 (prompt caching 적용) |
| **LLM — 임베딩** | Gemini Embedding 001 (3072차원, 다국어) |

---

## 시스템 아키텍처

```
┌──────────────────────────────────────────────────────┐
│ Frontend (Vercel)                                    │
│ React 19 + Vite — Zustand 상태관리, sessionStorage   │
└─────────────────────┬────────────────────────────────┘
                      │ REST API (axios)
┌─────────────────────▼────────────────────────────────┐
│ Backend (Railway)                                    │
│ FastAPI                                              │
│   ├── /api/chapters       — 챕터 목록                │
│   ├── /api/questions      — 챕터별 문제 출제         │
│   ├── /api/exam/*         — 모의고사 출제·채점       │
│   ├── /api/llm/generate   — AI 변형 문제 생성        │
│   └── /api/admin/*        — 임베딩 관리 (운영자)     │
└─────────────────────┬────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────┐
        ▼             ▼             ▼              ▼
┌──────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│ MongoDB      │ │ Gemini  │ │ Claude   │ │ Gemini       │
│ Atlas        │ │ 2.5     │ │ Opus 4.7 │ │ Embedding001 │
│ (문제+벡터)  │ │ (생성)  │ │ (검증)   │ │ (RAG)        │
└──────────────┘ └─────────┘ └──────────┘ └──────────────┘
```

### AI 문제 생성 파이프라인

상세 설계 명세는 [`backend/Sqld aqg architecture.md`](backend/Sqld%20aqg%20architecture.md)를 참조하세요.

```
[입력] 사용자가 틀린 문제 1~10개
   │
   ▼
[Step 1] 챕터 결정 — Counter로 최빈 chapter_id 채택
   │
   ▼
[Step 2] RAG 컨텍스트 구축
   ├─ 틀린 문제 텍스트 → Gemini Embedding (3072d)
   ├─ 임베딩 평균 → Atlas Vector Search ($vectorSearch)
   └─ 같은 챕터에서 유사도 top-3 기출 추출
   │
   ▼
[Step 3] Gemini 생성 (최대 2회 재시도)
   ├─ 챕터별 few-shot 예시 자동 선택 (modeling/sql/advanced)
   ├─ RAG 컨텍스트 + 출제 지침 + 제약 규칙 주입
   └─ response_schema로 JSON 출력 강제
   │
   ▼
[Step 4] Claude Opus 일괄 검증 (1회 API 호출)
   ├─ 전체 문제를 한 번에 평가 (prompt caching)
   ├─ valid / score(1-10) / feedback / corrected 반환
   ├─ valid=false면 corrected 채택, 수정 불가면 제외
   └─ API 장애 시 fallback (모두 valid:true / score:5)
   │
   ▼
[출력] 검증된 변형 문제 N개 (UUID + 품질 점수 포함)
```

### 설계 vs 현재 구현

[`backend/Sqld aqg architecture.md`](backend/Sqld%20aqg%20architecture.md)는 다중 에이전트 검증 + VHG 독립 검증자까지 포함한 풀 스펙입니다. 현재 구현은 단순화된 버전:

| 설계 | 현재 구현 |
|------|----------|
| L1 규칙 기반 필터 (스키마/매핑 검증) | ❌ 미구현 — Gemini `response_schema`가 부분적으로 대체 |
| L2 경량 LLM 충실도 판정 | ❌ 미구현 |
| L3 G-Eval 정밀 검증 (4차원 채점) | ✅ Claude Opus 단일 검증으로 단순화 |
| VHG 독립 검증자 (이기종 모델) | ✅ Gemini(생성) + Claude(검증) 이기종 사용 |
| Circuit Breaker (재생성 3회) | ❌ — Gemini 2회만 재시도 |
| 문항 진화 엔진 (수평/수직) | ❌ 미구현 |
| 평가 결과 영구화 | ❌ — UUID로 응답만, DB 저장 안 됨 |

---

## 데이터 구조

### Question Document (MongoDB)

```json
{
  "_id": "ObjectId",
  "chapter_id": 3,
  "question_number": 7,
  "book_section": "II",
  "question_type": "best_choice",
  "assets": [
    {
      "asset_type": "text_block",
      "payload": { "text": "다음 SQL의 실행 결과는?" }
    },
    {
      "asset_type": "sql_query",
      "payload": { "dialect": "oracle", "code": "SELECT ..." }
    }
  ],
  "choices": [
    {
      "choice_number": 1,
      "choice_kind": "value",
      "choice_text": "4행",
      "is_correct": true
    }
  ],
  "answer": { "explanation": "..." },
  "embedding": [0.123, ...]  // 3072차원, RAG용
}
```

### 분류 체계

- **question_type 16종**: `best_choice`, `worst_choice`, `predict_result`, `fill_blank`, `identify_sql`, `derive_count` 등
- **asset_type 17종**: `text_block`, `sql_query`, `data_table`, `erd`, `execution_plan`, `entity_schema` 등
- **choice_kind 9종**: `text`, `sql_query`, `keyword`, `value`, `result_table`, `index_definition` 등

각 타입의 분포와 매핑 규칙은 [`backend/Sqld aqg architecture.md`](backend/Sqld%20aqg%20architecture.md) §1 참조.

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 헬스 체크 |
| GET | `/api/chapters` | 챕터 목록 + 문제 수 |
| GET | `/api/questions?chapter_id=N&count=10` | 챕터별 무작위 문제 (정답 제거) |
| GET | `/api/questions/{id}` | 단일 문제 조회 (정답 포함) |
| GET | `/api/exam/questions` | 모의고사 50문제 (1과목 10 + 2과목 40) |
| POST | `/api/exam/grade` | 모의고사 채점 (question_ids 배열) |
| POST | `/api/llm/generate` | AI 변형 문제 생성 (question_ids 1~10개, count 1~5) |
| POST | `/api/admin/vectorize?force=false` | 전체 문제 임베딩 생성 |
| GET | `/api/admin/rag-status` | RAG 임베딩 현황 + 벡터 검색 동작 확인 |

> ⚠️ `/api/admin/*` 엔드포인트는 현재 인증 보호가 없습니다. 배포 시 IP 제한 또는 API 키 인증을 권장합니다.

---

## 시험 구조

| 과목 | 챕터 | 문제 수 | 배점 | 과락 기준 |
|------|------|---------|------|---------|
| 1과목 데이터 모델링의 이해 | 1~2 | 10문제 | 20점 | 8점 미만 |
| 2과목 SQL 기본 및 활용 | 3~12 | 40문제 | 80점 | 32점 미만 |
| **합계** | — | **50문제** | **100점** | **60점 이상 + 과락 없음** |

### 챕터 구성

| 챕터 | 과목 | 내용 | 문제 수 |
|------|------|------|--------|
| 1 | 1과목 | 데이터 모델링의 이해 | 33 |
| 2 | 1과목 | 데이터 모델과 SQL | 17 |
| 3 | 2과목 | SQL 기본 | 50 |
| 4 | 2과목 | SQL 활용 | 48 |
| 5 | 2과목 | 관리 구문 | 28 |
| 6 | 2과목 | SQL 수행 구조 | 19 |
| 7 | 2과목 | SQL 분석 도구 | 11 |
| 8 | 2과목 | 인덱스 튜닝 | 23 |
| 9 | 2과목 | 조인 튜닝 | 14 |
| 10 | 2과목 | SQL 옵티마이저 | 17 |
| 11 | 2과목 | 고급 SQL 튜닝 | 25 |
| 12 | 2과목 | Lock과 트랜잭션 동시성 제어 | 12 |

---

## 디렉토리 구조

```
SQLD/
├── backend/
│   ├── main.py                       # FastAPI 앱 + 5개 라우터 등록
│   ├── config.py                     # 환경변수 (CORS는 쉼표 구분 문자열 지원)
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/
│   │   ├── chapters.py               # GET /chapters
│   │   ├── questions.py              # 문제 조회
│   │   ├── exam.py                   # 모의고사 출제/채점
│   │   ├── llm.py                    # AI 변형 문제 생성
│   │   └── admin.py                  # 임베딩 관리
│   ├── models/
│   │   ├── database.py               # Motor + Beanie 초기화
│   │   └── question.py               # Question Document (assets/choices/embedding)
│   ├── services/
│   │   ├── question_service.py       # 챕터/랜덤 출제 비즈니스 로직
│   │   ├── llm_service.py            # Gemini 생성 + Claude 검증 파이프라인
│   │   └── rag_service.py            # 임베딩 + Atlas Vector Search
│   ├── data/
│   │   └── loader.py                 # JSON → MongoDB 적재 (1회성)
│   └── Sqld aqg architecture.md      # 다중 에이전트 시스템 설계 명세 (목표 아키텍처)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # React Router 6개 라우트
│   │   ├── pages/
│   │   │   ├── ChapterSelectPage     # 홈 — 챕터 선택
│   │   │   ├── QuizPage              # 문제 풀이
│   │   │   ├── ResultPage            # 결과 + 해설
│   │   │   ├── GeneratedQuizReviewPage  # AI 변형 문제 풀이/리뷰
│   │   │   ├── ExamPage              # 모의고사
│   │   │   └── ExamResultPage        # 모의고사 결과 + 챕터별 오답률
│   │   ├── components/quiz/
│   │   │   ├── AssetRenderer.jsx     # 17종 asset_type 분기 렌더링
│   │   │   ├── ChoiceList.jsx        # 9종 choice_kind 분기 렌더링
│   │   │   ├── ErdDiagram.jsx        # mermaid ERD
│   │   │   └── Erd2x2.jsx
│   │   ├── stores/
│   │   │   ├── quizStore.js          # Zustand + sessionStorage persist
│   │   │   ├── examStore.js
│   │   │   └── historyStore.js
│   │   └── api/                      # axios 래퍼
│   └── package.json
│
├── SQLD_data/                        # 원본 데이터 (gitignored)
│   ├── *.pdf                         # 12개 교재 PDF (배포 불필요)
│   └── json/*.json                   # 12개 문제 JSON (DB 적재 후 불필요)
│
├── .gitignore
├── PLAN.md                           # 초기 구현 계획 (Phase 1~4)
├── Project structure.md              # 초기 설계 문서
└── README.md
```

---

## 로컬 실행

### 사전 요구사항

- Python 3.11+
- Node.js 18+
- MongoDB Atlas 계정 (Vector Search 인덱스 생성 가능한 M0 무료 티어로 충분)
- [Google AI Studio API Key](https://aistudio.google.com/apikey)
- [Anthropic API Key](https://console.anthropic.com/)

### 1. 백엔드 설정

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

`.env` 파일 생성 ([backend/.env.example](backend/.env.example) 참고):

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/sqld_quiz
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
# CORS_ORIGINS=http://localhost:5173  (기본값이라 생략 가능)
```

### 2. 문제 데이터 적재 (최초 1회)

```bash
cd backend
python -m data.loader              # 297문제 적재
python -m data.loader --force      # 기존 데이터 삭제 후 재적재
```

### 3. Atlas Vector Search 인덱스 생성

MongoDB Atlas UI → Database → Atlas Search → **Vector Search Index** 생성:

- **Index name**: `embedding_index` (코드에 하드코딩되어 있음)
- **Database**: `sqld_quiz`
- **Collection**: `questions`

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 3072, "similarity": "cosine" },
    { "type": "filter", "path": "chapter_id" }
  ]
}
```

### 4. 임베딩 생성 (최초 1회, 약 1~2분 소요)

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 다른 터미널에서
curl -X POST http://localhost:8000/api/admin/vectorize
curl http://localhost:8000/api/admin/rag-status   # 결과 확인
```

### 5. 백엔드 실행

```bash
cd backend
# Windows
run.bat
# macOS/Linux
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local`:
```env
VITE_API_BASE_URL=http://localhost:8000
```

브라우저에서 http://localhost:5173 접속.

---

## 배포

### 백엔드 — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. **Root Directory**: `backend`
3. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **환경변수**:
   - `MONGODB_URI`
   - `ANTHROPIC_API_KEY`
   - `GEMINI_API_KEY`
   - `CORS_ORIGINS` = `https://your-app.vercel.app` (쉼표 구분으로 여러 개 가능)

### 프론트엔드 — Vercel

1. [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. **Root Directory**: `frontend`
3. **Framework Preset**: Vite (자동 감지)
4. **환경변수**:
   - `VITE_API_BASE_URL` = `https://your-backend.up.railway.app`

---

## 보안 체크리스트

- [x] `.env` gitignore 처리
- [x] CORS 환경변수 분리 (배포 시 도메인 화이트리스트)
- [ ] `/api/admin/*` 엔드포인트 인증 (현재 미구현)
- [ ] LLM 엔드포인트 rate limit (비용 제어)
- [ ] 노출된 시크릿 회수 — 개발 중 노출됐다면 키 재발급

---

## 향후 작업 (Roadmap)

### 단기

- [ ] `/api/admin/*` API 키 인증
- [ ] AI 생성 문제 영구 저장 (`generated_questions` 컬렉션)
- [ ] LLM 호출 rate limiting

### 중기 — 학습 기록 시스템

- [ ] `UserProgress` / `StudySession` 모델 추가
- [ ] 풀이 기록 저장 API
- [ ] 오답 노트 페이지
- [ ] 챕터별 정답률 대시보드 (Recharts)

### 장기 — 검증 파이프라인 고도화

[`backend/Sqld aqg architecture.md`](backend/Sqld%20aqg%20architecture.md)의 풀 스펙으로 진화:

- [ ] L1 규칙 기반 필터 (스키마/매핑 검증)
- [ ] L2 경량 LLM 충실도 판정
- [ ] L3 G-Eval 정밀 검증
- [ ] VHG 독립 검증자
- [ ] 문항 진화 엔진 (수평/수직)
- [ ] 한국어 용어 일관성 강제 (`주식별자` vs `기본키` 등)
- [ ] Oracle vs ANSI 방언 분리

---

## 참고 문서

- [`backend/Sqld aqg architecture.md`](backend/Sqld%20aqg%20architecture.md) — 다중 에이전트 시스템 설계 명세 (목표 아키텍처)
- [`PLAN.md`](PLAN.md) — Phase별 상세 구현 계획
- [`Project structure.md`](Project%20structure.md) — 초기 설계 결정 사항 (DB 선정 근거, ERD)

---

## 라이선스

개인 학습 / 자격증 대비 목적의 비영리 프로젝트입니다.
