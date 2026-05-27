# SQLD Quiz — Frontend

SQLD(SQL 개발자) 자격증 시험 대비 플랫폼의 프론트엔드.
React 19 SPA로, 챕터별 문제 풀이·모의고사·AI 변형 문제 풀이 UI를 제공합니다.

> 백엔드 저장소: [→ backend repo 링크]

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **프레임워크** | React 19.2 + Vite 8.0 |
| **라우팅** | React Router 7.15 |
| **상태관리** | Zustand 5 (+ `persist` + `sessionStorage`) |
| **스타일링** | TailwindCSS 4 (`@tailwindcss/vite` 플러그인) |
| **HTTP 클라이언트** | axios 1.16 |
| **시각화** | react-syntax-highlighter 16 (SQL 코드), mermaid 11 (ERD 다이어그램) |
| **린터** | ESLint 10 + `eslint-plugin-react-hooks` |

---

## 주요 기능

- **챕터 선택 화면** — 12개 챕터 카드 + 문제 수 표시
- **문제 풀이 화면** — 17종 asset_type 및 9종 choice_kind 모두 대응하는 동적 렌더링
- **모의고사 모드** — 50문제 시험 형식 + 시간 제한 + 챕터별 오답률 시각화
- **AI 변형 문제 풀이** — 틀린 문제 기반 변형 문제 5개 풀이 및 리뷰
- **세션 영속성** — Zustand `persist`로 새로고침해도 진행 상태 유지

---

## 페이지 / 라우트

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | `ChapterSelectPage` | 홈 — 12개 챕터 선택 |
| `/quiz` | `QuizPage` | 챕터별 문제 풀이 |
| `/result` | `ResultPage` | 풀이 결과 + 해설 + AI 변형 문제 요청 |
| `/ai-review` | `GeneratedQuizReviewPage` | AI 변형 문제 풀이/리뷰 |
| `/exam` | `ExamPage` | 모의고사 (50문제) |
| `/exam-result` | `ExamResultPage` | 모의고사 결과 + 챕터별 오답률 |

---

## 디렉토리 구조

```
frontend/
├── index.html
├── vite.config.js              # @tailwindcss/vite 플러그인 + dev proxy 설정
├── package.json
├── eslint.config.js
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
└── src/
    ├── main.jsx                # 엔트리 (React 19 root)
    ├── App.jsx                 # React Router 6개 라우트
    ├── App.css
    │
    ├── pages/
    │   ├── ChapterSelectPage.jsx     # 홈 — 챕터 선택
    │   ├── QuizPage.jsx              # 문제 풀이
    │   ├── ResultPage.jsx            # 결과 + 해설
    │   ├── GeneratedQuizReviewPage.jsx  # AI 변형 문제 풀이/리뷰
    │   ├── ExamPage.jsx              # 모의고사
    │   └── ExamResultPage.jsx        # 모의고사 결과 + 챕터별 오답률
    │
    ├── components/quiz/
    │   ├── AssetRenderer.jsx         # 17종 asset_type 분기 렌더링
    │   ├── ChoiceList.jsx            # 9종 choice_kind 분기 렌더링
    │   ├── ErdDiagram.jsx            # mermaid ERD 단일
    │   └── Erd2x2.jsx                # mermaid ERD 2x2 비교
    │
    ├── stores/
    │   ├── quizStore.js              # 현재 풀이 세션 (sessionStorage persist)
    │   ├── examStore.js              # 모의고사 세션
    │   └── historyStore.js           # 풀이 이력
    │
    ├── api/
    │   ├── client.js                 # axios 인스턴스 (baseURL: '/api')
    │   ├── questionApi.js            # 챕터/문제 API
    │   ├── examApi.js                # 모의고사 API
    │   └── llmApi.js                 # AI 생성 API
    │
    └── assets/                       # 이미지 자산
```

---

## 백엔드 연결 방식 (중요)

[`src/api/client.js`](src/api/client.js)는 `baseURL: '/api'`로 **상대 경로**를 사용합니다.
이는 환경별로 다음과 같이 라우팅됩니다:

| 환경 | 처리 방식 |
|------|----------|
| **로컬 개발** | [`vite.config.js`](vite.config.js)의 `server.proxy`가 `/api` → `http://localhost:8000`으로 프록시 |
| **Vercel 배포** | `vercel.json`의 `rewrites`가 `/api/:path*` → Railway 백엔드로 프록시 (아래 참조) |

> 이 방식은 CORS를 회피하고 동일 출처 정책을 유지합니다.
> 단, **Vercel 배포 시 반드시 `vercel.json`을 추가**해야 합니다 (아래 배포 섹션 참조).

---

## 로컬 실행

### 사전 요구사항

- Node.js 18+ (권장: 20+)
- 백엔드 서버가 `http://localhost:8000`에서 실행 중이어야 함

### 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속.

### 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (HMR 활성) |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 로컬 프리뷰 |
| `npm run lint` | ESLint 검사 |

---

## 배포 — Vercel

### 1. `vercel.json` 작성 (필수)

배포 전 프로젝트 루트에 `vercel.json`을 생성해 백엔드 프록시 설정을 추가하세요:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.up.railway.app/api/:path*"
    }
  ]
}
```

> `destination` URL은 배포한 백엔드 Railway 도메인으로 변경하세요.
> 이 설정이 없으면 프로덕션에서 `/api/*` 요청이 Vercel 자체로 404 응답합니다.

### 2. Vercel 배포

1. [vercel.com](https://vercel.com) → **New Project** → Import from GitHub
2. **Repository**: 이 frontend 저장소 선택
3. **Settings**:
   - **Root Directory**: `/` (이 저장소가 프론트엔드 단독이므로)
   - **Framework Preset**: Vite (자동 감지)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `dist` (기본값)
4. **Deploy** 클릭

### 3. 백엔드 CORS 허용

Railway 백엔드 환경변수에서 `CORS_ORIGINS`에 Vercel 도메인 추가:

```
CORS_ORIGINS=https://your-app.vercel.app
```

> 참고: rewrites를 사용하면 백엔드 입장에서 모든 요청이 Vercel 서버에서 오는 것처럼 보이므로
> CORS 헤더가 엄밀히는 불필요할 수 있지만, 안전을 위해 명시하는 것을 권장합니다.

---

## 컴포넌트 설계 — 동적 렌더링

### AssetRenderer — 17종 asset_type 분기

[`src/components/quiz/AssetRenderer.jsx`](src/components/quiz/AssetRenderer.jsx)는 문제의 `asset_type`에 따라 다음을 렌더링합니다:

| Asset 타입 | 렌더링 방식 |
|-----------|------------|
| `text_block` | 일반 텍스트 (줄바꿈 보존) |
| `sql_query`, `sql_ddl`, `sql_dml` | SQL 구문 하이라이팅 (react-syntax-highlighter) |
| `data_table`, `result_table` | HTML `<table>` 동적 생성 |
| `erd` | mermaid 다이어그램 ([`ErdDiagram.jsx`](src/components/quiz/ErdDiagram.jsx)) |
| `entity_schema` | 엔터티 카드 (테이블명 + 속성) |
| `execution_plan` | preformatted 코드 블록 |
| `list_items` | 번호 목록 |
| 기타 | raw JSON fallback |

### ChoiceList — 9종 choice_kind 분기

[`src/components/quiz/ChoiceList.jsx`](src/components/quiz/ChoiceList.jsx):

| Choice 종류 | 렌더링 방식 |
|------------|------------|
| `text`, `description` | 일반 텍스트 |
| `sql_query`, `sql_fragment` | SQL 코드 블록 |
| `keyword`, `value`, `index_definition` | 인라인 monospace |
| `tuple` | 쉼표 구분 키워드 |
| `result_table` | 마크다운 테이블 파싱 |

---

## 상태관리 — Zustand

세 개의 store가 역할별로 분리되어 있습니다:

### `quizStore.js` — 현재 풀이 세션

```javascript
{
  sessionId, startedAt, mode, chapterId,
  questions, currentIndex, answers,    // 풀이 중 상태
  sessionResult,                        // 채점 결과
  generatedAnswers,                     // AI 생성 문제용 정답 (별도 보관)
}
```

`persist` 미들웨어로 **sessionStorage**에 저장 → 새로고침해도 진행 유지, 탭 종료 시 자동 클리어.

### `examStore.js` — 모의고사 세션

50문제 + 타이머 + 챕터별 결과 집계.

### `historyStore.js` — 풀이 이력

이전 풀이 기록 (현재는 로컬 전용, 백엔드 API 미구현).

---

## 환경변수

이 프로젝트는 **환경변수를 사용하지 않습니다**.
백엔드 URL은 빌드 시점에 결정되지 않고, 런타임에 `/api` 상대 경로 + Vercel rewrites로 동적 라우팅합니다.

> 향후 다중 환경(prod/staging) 지원이 필요하면 `VITE_API_BASE_URL` 도입을 고려하세요.

---

## 향후 작업

- [ ] 풀이 이력 백엔드 영속화 (현재 sessionStorage만)
- [ ] 챕터별 정답률 대시보드 (Recharts)
- [ ] 오답 노트 페이지
- [ ] 다크 모드
- [ ] 모바일 반응형 개선
- [ ] PWA 변환
