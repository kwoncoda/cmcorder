# IMPLEMENTATION_PLAN — React 기준 (2026-05-14 재작성)

> **For agentic workers:** Use `superpowers:subagent-driven-development` (권장) 또는 `superpowers:executing-plans`로 Task 단위로 진행. 각 Task는 `- [ ]` 체크박스로 트래킹.

**Goal:** 컴퓨터모바일융합과 학교 축제(5/20-21) 부스 모바일 웹 주문 시스템을 D-day 5/20 16:30 운영 시작까지 완성.

**Architecture (2026-05-14 변경):** **React 18 SPA (Vite) + Express API + SQLite + Docker compose**. 이전 ADR-024(EJS+Alpine)에서 *React로 변경*. 백엔드는 Express + SQLite 유지.

**입력 자료:**
- 기획: `PRD.md`·`MVP_SCOPE.md`·`FEATURE_LIST.md`·`USER_FLOW.md`·`order-system-plan.md`
- 엔지니어링: `ARCHITECTURE.md`·`API_DRAFT.md`·`DB_DRAFT.md`·`TEST_PLAN.md`
- 디자인: `DESIGN.md`·`UX_STRATEGY.md`·`SCREEN_STRUCTURE.md`·`COMPONENT_GUIDE.md`·`DESIGN_REVIEW.md`
- 결정: `DECISIONS.md` (ADR-001~026 + 누적 결정 12+건)
- **시안:** `docs/design-bundle/` (Claude Design React JSX — *변환 베이스*)

---

## 0. 기술 스택 — *ADR-024 변경 권장*

### 0.1 변경 사유

ADR-024는 EJS + Alpine.js 채택했으나, 2026-05-14 사용자 결정으로 React 프로젝트 기준 재작성. `docs/design-bundle/`에 *완성된 React 18 시안*이 있어 *변환 베이스*로 활용 가능 → React 학습 비용 < 시안 → 프로덕션 전환 이득.

### 0.2 최종 스택

| Layer | 선택 | 근거 |
|---|---|---|
| **Frontend** | React 18.3.1 + Vite 5 | design-bundle 시안 그대로 활용. Vite는 dev server 빠름 (~100ms HMR) |
| Language | JavaScript + JSDoc + zod (런타임 검증) | TS 학습 비용 회피, 6일 일정. JSDoc + zod로 부분 타입 안전 |
| Routing | React Router 6 | SPA 표준, 데이터 라우팅 |
| State | Zustand 4 | 가벼움(2KB), Context 보다 단순. 카트·UI·영업 상태 |
| Forms | react-hook-form 7 + zod | 학번·이체 등 입력 검증 |
| Styling | Tailwind 3 + `tokens.css` 변수 직접 import | design-bundle tokens.css 그대로 |
| HTTP | fetch (browser native) + custom hook | axios 학습 회피 |
| SSE | EventSource (browser native) + custom hook `useOrderStream` | ADR-015 |
| 모션 | Framer Motion 11 (선택) 또는 CSS animation | 도그태그·미니맵 펄스·StartBusinessCTA |
| **Backend** | Express 4 + better-sqlite3 11 | ADR-024 그대로 유지 |
| API | REST (`/api/*`, `/admin/api/*`) + SSE (`/api/orders/:id/stream`) | API_DRAFT.md 그대로 |
| DB | SQLite WAL + Docker named volume | ADR-023 유지 |
| Init | `init.sql` + `bootstrap.js` (어드민 자동 생성) | 사용자 요구 (2026-05-13) |
| **Test** | Vitest 2 + React Testing Library 16 + Playwright 1 + axe-core 4 | TDD 인프라 |
| **Build** | Vite (frontend) + Node 20 (backend) | 단일 모노레포 |
| **Deploy** | Docker compose (frontend dist + backend 단일 컨테이너) | ADR-023 유지 |

### 0.3 design-bundle 변환 정책

| design-bundle 파일 | React 프로덕션 변환 |
|---|---|
| `tokens.css` | `src/styles/tokens.css` (그대로) |
| `app.css` | `src/styles/app.css` (분리 권장 — components.css·layouts.css) |
| `data.js` (mock) | `src/api/client.js` (실 API 호출로 대체) + zod 스키마 |
| `components.jsx` | `src/components/atoms/` + `src/components/molecules/` 분리 |
| `screens-customer.jsx` | `src/pages/customer/*.jsx` (라우트별 분리) |
| `screens-admin.jsx` | `src/pages/admin/*.jsx` |
| `app.jsx` (tweaks panel 포함) | `src/App.jsx` (라우터만, tweaks 제거 — Phase 2 후보) |
| `assets/items/*` | `public/items/*` 또는 `src/assets/items/*` |

---

## 1. 디렉터리 구조

```
chickenedak/
├── package.json, vite.config.js, vitest.config.js, playwright.config.js, tailwind.config.js
├── Dockerfile, docker-compose.yml, .env.example, .gitignore
├── public/
│   ├── items/                       ← PUBG 회복 아이템 일러스트 8종 (D-3 수령)
│   ├── mascot/                      ← 마스코트 5종 (D-3, fallback 🪖)
│   ├── map/                         ← 부스 약도 PNG (D-1, fallback CSS 그리드)
│   └── 웹 로고.png
├── src/
│   ├── main.jsx                     ← Vite 진입점
│   ├── App.jsx                      ← React Router + ErrorBoundary
│   ├── styles/
│   │   ├── tokens.css               ← DESIGN §3~§9 토큰 (design-bundle 이식)
│   │   ├── globals.css              ← reset + body
│   │   └── components.css           ← 컴포넌트별 클래스
│   ├── pages/
│   │   ├── customer/
│   │   │   ├── MenuPage.jsx         ← C-1
│   │   │   ├── CartPage.jsx         ← C-2 (인벤토리)
│   │   │   ├── CheckoutPage.jsx     ← C-3
│   │   │   ├── CompletePage.jsx     ← C-4 (도그태그 절정)
│   │   │   ├── TransferPage.jsx     ← C-5
│   │   │   ├── StatusPage.jsx       ← C-6 (SSE)
│   │   │   ├── ClosedPage.jsx       ← C-9 (G13)
│   │   │   ├── MapPage.jsx          ← C-7 미니맵 (G12)
│   │   │   └── ErrorPage.jsx        ← C-8 404/500
│   │   └── admin/
│   │       ├── LoginPage.jsx        ← A-1
│   │       ├── DashboardPage.jsx    ← A-2 (Kanban 6col + G13)
│   │       ├── OrderDetailPage.jsx  ← A-3
│   │       ├── TransfersPage.jsx    ← A-4
│   │       ├── MenuAdminPage.jsx    ← A-5
│   │       └── SettlementPage.jsx   ← A-6/A-7
│   ├── components/
│   │   ├── atoms/                   ← Button, Input, Select, Checkbox, Label, Icon, Spinner, Divider
│   │   ├── molecules/               ← StampBadge, PriceTag, DogTagFrame, StatusChip, CountBadge, IconLabel, MenuFallback
│   │   ├── organisms/               ← MenuCard, CartItem, OrderTimeline, MascotState, TransferReportForm, AdminCardColumn, BusinessStateBadge, StartBusinessCTA, ClosedScreen, BoothMinimapModal
│   │   ├── state/                   ← EmptyState, LoadingState, ErrorState
│   │   └── layouts/                 ← CustomerLayout, AdminLayout, ErrorLayout
│   ├── hooks/
│   │   ├── useApi.js                ← fetch wrapper + retry
│   │   ├── useOrderStream.js        ← SSE EventSource
│   │   ├── useSession.js            ← sessionStorage (도그태그 단발)
│   │   └── useBusinessState.js      ← 영업 상태 폴링
│   ├── store/                       ← Zustand
│   │   ├── cart.js
│   │   ├── ui.js
│   │   └── businessState.js
│   ├── api/
│   │   ├── client.js                ← fetch wrapper
│   │   ├── schemas.js               ← zod 스키마 (Order, Menu, Coupon)
│   │   └── routes.js                ← API 경로 상수
│   ├── lib/
│   │   ├── format.js                ← 천 단위 콤마, 시각 KST
│   │   └── ax.js                    ← axe-core 개발 모드 (a11y 자동 검증)
│   └── __tests__/                   ← Vitest + RTL
├── server/                          ← Express 백엔드 (모노레포)
│   ├── server.js
│   ├── app.js
│   ├── db/
│   │   ├── init.sql                 ← ★ 신규 DB 전체 스키마 + 시드
│   │   ├── bootstrap.js             ← init.sql 또는 마이그레이션 결정 + seedAdmin
│   │   ├── connection.js
│   │   └── migrations/
│   ├── domain/                      ← pricing·coupon·order-state·settlement·popularity·transfer-matching·business-state
│   ├── repositories/                ← menu·order·coupon·admin·settlement·backup·businessState
│   ├── routes/                      ← customer + admin REST + SSE
│   ├── middleware/                  ← admin-auth·business-state·error
│   └── jobs/                        ← 자동 ZIP 2시간 스냅샷
└── tests/                           ← Playwright E2E
```

---

## 2. Phase 개요 + 일정 (오늘 5/14, D-day 5/20 = 6일)

| Phase | 범위 | 추정 | 의존성 |
|---|---|---:|---|
| **0** | 부트스트랩 (Vite + 백엔드 셸 + 인프라) | 0.5일 | — |
| **1** | 디자인 토큰 + Atoms 8종 | 0.5일 | 0 |
| **2** | Molecules + Organisms 12종 | 1.5일 | 1 |
| **3** | 상태·API·SSE·에러 처리 | 0.5일 | 1 (병렬) |
| **4** | 사용자 페이지 9종 | 1일 | 2·3 |
| **5** | 관리자 페이지 6종 | 1일 | 2·3 |
| **6** | 백엔드 (도메인·API·미들웨어·init.sql·자동 ZIP) | 1.5일 | 3 (병렬 가능) |
| **7** | 접근성·E2E·운영 준비 | 0.5일 | 4·5·6 |

**총 ~6일.** 백엔드(Phase 6)와 프론트(Phase 4·5)는 *병렬 가능* (API 모의 → 실 API 교체).

---

## 3. TDD 워크플로 + Definition of Done

### 3.1 TDD 흐름 (모든 Task 공통)

```
1. RED:    테스트 작성 → 실패 확인
2. GREEN:  최소 구현 → 테스트 통과
3. REFACTOR: 토큰화·a11y·reduced motion·에러 처리 추가
4. COMMIT: 한국어 메시지 1 Task = 1 커밋 (CLAUDE.md 규칙)
5. LOG:    docs/tasks/YYYY-MM-DD-task-N.M-<이름>.md
```

### 3.2 Definition of Done (DoD)

각 Task 완료 기준:
- [ ] **단위 테스트 통과** (Vitest, `npm test`)
- [ ] **a11y 자동 검증 통과** (axe-core, 시각·키보드·스크린리더)
- [ ] **디자인 토큰만 사용** (하드코딩 hex·px 0)
- [ ] **DESIGN §11 AI 슬롭 26개 회피 검증** (대상 컴포넌트만)
- [ ] **reduced motion 시 정적 표시** (모션 있는 컴포넌트만)
- [ ] **타입 안전** (zod 스키마 또는 JSDoc — 입력·출력 둘 다)
- [ ] **회귀 케이스 추가** (해당 시 — ADR-020 4 / 쿠폰 / 상태 머신 등)

---

# Phase 0 — 프로젝트 부트스트랩 (0.5일)

## Task 0.1: Vite + React 18 프로젝트 초기화

- [ ] **목적:** `npm create vite@latest` + React + JS 템플릿. 디렉터리 구조 §1 생성.
- **우선순위:** P0
- **의존성:** —
- **TDD 흐름:**
  1. RED: `tests/smoke.test.js` "환영합니다" 컴포넌트 렌더 테스트
  2. GREEN: Vite 셸 + 기본 App.jsx
  3. REFACTOR: 디렉터리 구조 §1로 배치
- **완료 기준:**
  - `npm run dev` 실행 → http://localhost:5173 응답
  - `npm test` → smoke 통과
  - design-bundle 11개 파일 `src/` 적절한 위치로 이동 (변환은 다음 Task)
- **필요 테스트:**
  - 단위: `__tests__/smoke.test.jsx` 1 케이스
- **관련 결정:** ADR-024 변경

## Task 0.2: 디자인 토큰 + Tailwind + 기본 스타일

- [ ] **목적:** design-bundle `tokens.css` 이식, Tailwind config에서 토큰 매핑.
- **TDD 흐름:**
  1. RED: `tokens.test.js` `--color-bg` 가 `#2E3A26`인지 (computed style)
  2. GREEN: `src/styles/tokens.css` import + Tailwind theme extend
  3. REFACTOR: `app.css` 분리 (components.css·layouts.css)
- **완료 기준:**
  - 9 컬러 조합 회귀 (DESIGN §4.3 실측 표 일치)
  - `--color-card-muted: #48402C` (2026-05-14 조정값)
  - reduced motion 미디어 쿼리 (DESIGN §9.5) 적용
- **필요 테스트:**
  - 단위: `tokens.test.js` — 모든 CSS 변수 hex 매칭 9 케이스 (회귀: 군복 톤 + 카드 + 형광 옐로 + danger)
- **관련 결정:** DESIGN §3.3·§4.1·§4.3·§9.5

## Task 0.3: 라우팅 셸 (React Router 6 + ErrorBoundary)

- [ ] **목적:** 사용자/관리자 라우트 구분 + 영업 외 redirect 가드 + 에러 경계.
- **TDD 흐름:**
  1. RED: `App.test.jsx` `/menu` 진입 → MenuPage 렌더, `/admin/dashboard` → DashboardPage
  2. GREEN: React Router 6 + 라우트 14개 placeholder
  3. REFACTOR: ErrorBoundary로 감싸기 + 404 catch-all
- **완료 기준:**
  - 모든 라우트(C-1~C-9, A-1~A-7) placeholder 렌더
  - ErrorBoundary 작동 (의도 throw → ErrorPage)
- **필요 테스트:**
  - 단위: `App.test.jsx` — 라우트 매칭 14 케이스 + ErrorBoundary 1
- **관련 결정:** USER_FLOW §10 라우팅 다이어그램

## Task 0.4: 테스트 인프라 (Vitest + RTL + axe + Playwright)

- [ ] **목적:** 모든 테스트 도구 설정. `npm test`·`npm run test:e2e` 명령.
- **완료 기준:**
  - `vitest.config.js` jsdom 환경
  - `@testing-library/react` + `@testing-library/jest-dom`
  - `vitest-axe` 통합 (axe-core)
  - `playwright.config.js` baseURL 5173·timeout 10s
  - sample E2E 통과 (홈페이지 진입)
- **필요 테스트:**
  - E2E: `e2e/smoke.spec.js` 1 케이스

## Task 0.5: 백엔드 Express 셸

- [ ] **목적:** `server/server.js` + `app.js` 부트스트랩. `/healthz` 1 라우트.
- **완료 기준:**
  - `node server/server.js` → 3000 포트 응답
  - `GET /healthz` → `200 {ok:true}`
  - helmet·pino 적용
- **필요 테스트:**
  - 통합: `server/__tests__/healthz.test.js` supertest 1 케이스
- **관련 결정:** ADR-024 (백엔드 유지)

## Task 0.6: Docker compose + named volume

- [ ] **목적:** `docker-compose.yml` 작성. Vite build + Express 통합 컨테이너.
- **완료 기준:**
  - `docker compose up -d` → 3000 응답
  - `restart: always` + named volume `chickenedak-data`
  - `.env` 예시 (`SESSION_SECRET`·`DEFAULT_ADMIN_PIN`·`AUTO_SNAPSHOT_INTERVAL_MIN=120`)
- **관련 결정:** ADR-023 + 사용자 요구 (2026-05-13)

---

# Phase 1 — 디자인 토큰 + Atoms (0.5일)

## Task 1.1: Button (5 variant + a11y)

- [ ] **목적:** primary(형광 옐로)·secondary(외곽)·ghost·danger·disabled 5 변형. 56px+ 터치 hitbox.
- **TDD 흐름:**
  1. RED: `Button.test.jsx` 5 variant 렌더 + click 콜백 + disabled 비활성
  2. GREEN: `<button>` + Tailwind class + tokens
  3. REFACTOR: forwardRef + ariaProps
- **완료 기준:**
  - 5 variant + 3 size (sm·md·lg)
  - 키보드 focus-visible 토큰 (DESIGN §12.3)
  - axe-core 통과
- **필요 테스트:**
  - 단위: `Button.test.jsx` 12 케이스 (5 variant × 3 size 일부 + a11y)
- **관련 결정:** COMPONENT_GUIDE §2.1

## Task 1.2: Input + Select + Checkbox/Radio + Label

- [ ] **TDD 흐름:**
  1. RED: 각 컴포넌트 값 변경·검증·에러 표시·라벨 연결
  2. GREEN: 기본 구현
  3. REFACTOR: react-hook-form 연동 인터페이스 (Phase 3 준비)
- **완료 기준:**
  - 학번 input `inputmode="numeric"` + pattern (DESIGN §12.5)
  - 라벨 명시적 연결 (placeholder 라벨화 X — AI 슬롭 #15)
  - 에러 메시지 `aria-describedby`
- **필요 테스트:**
  - 단위: 각 컴포넌트 5-8 케이스 = 총 25+ 케이스
  - a11y: axe + 키보드 시나리오
- **관련 결정:** COMPONENT_GUIDE §2.2~§2.5

## Task 1.3: Icon + Spinner + Divider

- [ ] **완료 기준:** lucide-react 또는 SVG inline. spinner는 reduced motion 시 정적 점.
- **필요 테스트:**
  - 단위: 각 3-4 케이스 = 10 케이스

---

# Phase 2 — Molecules + Organisms (1.5일)

## Task 2.1: StampBadge (CSS stamp, 5 variant)

- [ ] **목적:** `recommended·sold-out·paid·done·canceled` 5 종. CSS rotate + Black Ops One + border + box-shadow.
- **TDD 흐름:**
  1. RED: 5 variant 렌더 + 회전 각도 -3~+3 deg 랜덤
  2. GREEN: `<span className="stamp stamp-X">` + CSS
  3. REFACTOR: 도장 찍힘 모션 150ms (등장 시 1회 — reduced motion 정적)
- **완료 기준:**
  - SVG 사용 X (CSS 기본 — 2026-05-13 C 결정)
  - axe + alt 텍스트 또는 aria-label
- **필요 테스트:**
  - 단위: `StampBadge.test.jsx` 7 케이스 (5 variant + 회전 + reduced motion)
- **관련 결정:** ADR-026 §8.1 + COMPONENT §3.1 + 결정 C

## Task 2.2: PriceTag + StatusChip + CountBadge + IconLabel + MenuFallback

- [ ] **TDD:** 각 컴포넌트 5-8 케이스. 가격 천 단위 콤마 (JetBrains Mono tabular-nums).
- **관련 결정:** DESIGN §5.4 카피 + COMPONENT §3.2~§3.7

## Task 2.3: DogTagFrame ★ Memorable thing

- [ ] **목적:** 절정 컴포넌트. 떨어지는 모션 600ms + sessionStorage 단발 (DESIGN §9.6 + 결정 h).
- **TDD 흐름:**
  1. RED: 첫 진입 시 모션 재생 + sessionStorage 키 저장 / 재방문 시 정적 표시
  2. GREEN: `useSession('dogtag-shown-{orderId}')` hook + Framer Motion or CSS
  3. REFACTOR: reduced motion 시 정적 + 진동(Vibration API) 조건부
- **완료 기준:**
  - sessionStorage 키 = `dogtag-shown-{orderId}` (DESIGN §9.6)
  - reduced motion 시 모션 X
  - Pretendard Black 주문번호 + JetBrains Mono 일자 (DESIGN §5.1)
- **필요 테스트:**
  - 단위: `DogTagFrame.test.jsx` 8 케이스 (첫/재방문·reduced motion·진동 API·키보드 포커스)
  - E2E: E2E-01 학생 주문 흐름의 일부
- **관련 결정:** DESIGN §1·§9.3·§9.6·ADR-026 §1·결정 h

## Task 2.4: MascotState (5 variant + idle)

- [ ] **목적:** 기본·출동·조리·도착·취소 5종. fallback = 🪖 헬멧 이모지 (결정 c).
- **TDD 흐름:**
  1. RED: state prop 변경 시 cross-fade 200ms · idle 흔들 (조리 중만)
  2. GREEN: state → `<img src={mascotSrc[state]}>` + 이미지 실패 시 🪖
  3. REFACTOR: reduced motion 시 cross-fade·idle 정적
- **완료 기준:**
  - 자산 미수령 시 🪖 헬멧 이모지 fallback (운영 중 교체 가능)
  - `<img alt="치킨이닭 마스코트 — {state}">`
- **필요 테스트:**
  - 단위: 7 케이스 (5 state + fallback + reduced motion)
- **관련 결정:** DESIGN §10 + 결정 c

## Task 2.5: MenuCard (PUBG 매핑 + "줍기" 버튼만)

- [ ] **목적:** PUBG 회복 아이템 일러스트 + 본명 + 가격 + "줍기" 버튼. 카드 영역 흙색 톤(`--color-card-bg`).
- **TDD 흐름:**
  1. RED: 8 메뉴 데이터 매핑 + RECOMMENDED·SOLD OUT 도장 + "줍기" 버튼 클릭
  2. GREEN: MenuCard + props {menu, onAdd, recommended, soldOut}
  3. REFACTOR: 이미지 fallback 분류 이모지 (🍗·🍟·🥤) + sold-out 흐림
- **완료 기준:**
  - **"줍기" 버튼만 클릭 영역** (결정 f) — 카드 전체 클릭 X
  - 본명 표시 (G10) — 콜라/사이다 등 이름 리스킨 X
  - PUBG 일러스트 미수령 시 분류 이모지 fallback (ADR-006)
  - 카드 내 *형광 옐로 텍스트 금지* (AI 슬롭 #26 — 결정 d 실측)
- **필요 테스트:**
  - 단위: `MenuCard.test.jsx` 14 케이스 (8 메뉴 + 4 상태 + 2 클릭 영역 회귀)
- **관련 결정:** G10·G11·결정 b·결정 f·DESIGN §10.5·AI 슬롭 #26

## Task 2.6: CartItem + OrderTimeline (5단계 + timeline 미니뷰)

- [ ] **목적:** 인벤토리 라벨 + 수량 변경 + OrderTimeline 5단계 + *단계 진입 시각 timeline 미니뷰* (UX §5.1 보강).
- **완료 기준:**
  - CartItem: 수량 +/- · 합계 즉시 반영
  - OrderTimeline: 5단계 progress (접수→입금→조리→마무리→수령)
  - **timeline 미니뷰**: 각 단계 시각 표시 (✅ 17:30 / 🔄 17:38 / ⏳) — 분 단위 추정 X (ADR-010 보존)
- **필요 테스트:**
  - 단위: CartItem 6 케이스 + OrderTimeline 8 케이스
- **관련 결정:** G11 인벤토리·UX §5.1 보강·ADR-010

## Task 2.7: TransferReportForm + AdminCardColumn

- [ ] **목적:** 이체 확인 폼 (은행 콤보 + "다른 이름 이체" 체크박스) + 본부 대시보드 칸반 컬럼.
- **완료 기준:**
  - 은행 6개 옵션 + "기타" 직접 입력
  - "다른 이름 이체" 체크 시 추가 이름 input 활성
  - AdminCardColumn: 5분/10분 경과 노란/빨간 강조
- **필요 테스트:**
  - 단위: 12+ 케이스
- **관련 결정:** ADR-021 + USER_FLOW §4.2

## Task 2.8: BusinessStateBadge + StartBusinessCTA (G13)

- [ ] **목적:** 본부 대시보드 헤더 영업 상태 배지 + CLOSED 시 큰 형광 옐로 "장사 시작" CTA.
- **TDD 흐름:**
  1. RED: `status='OPEN'` 배지 🟢 · `status='CLOSED'` + `shouldBeOpen=false` 배지 🔴 + CTA · `shouldBeOpen=true` 빨간 깜박
  2. GREEN: 컴포넌트 + zustand 영업 상태 구독
  3. REFACTOR: 클릭 → API 호출 + 낙관적 업데이트
- **완료 기준:**
  - 빨간 깜박은 *세션 X, 매번 재생* (결정 h)
  - reduced motion 시 정적 border만
  - 클릭 후 200ms scale(0.96) → 1
- **필요 테스트:**
  - 단위: 10 케이스 (3 상태 + 클릭 + 깜박 + reduced motion + API 실패)
- **관련 결정:** G13·ADR-026·결정 h

## Task 2.9: ClosedScreen (G13 C-9)

- [ ] **목적:** 영업 외 풀스크린 안내 + 운영 일정 + 새로고침.
- **완료 기준:**
  - 마스코트 기본 변형 (DESIGN §10.2)
  - 상태별 변형: 16:30 이전·이후·정산 후·양일 종료
  - `aria-live="polite"` 운영 일정 자동 announce (UX §8.8)
- **필요 테스트:**
  - 단위: 8 케이스 (4 상태 + a11y + 새로고침)
- **관련 결정:** G13·UX §8.8

## Task 2.10: BoothMinimapModal (G12 + 하단 닫기)

- [ ] **목적:** PUBG 미니맵 풀스크린 모달 + 본인 테이블 펄스 + 하단 닫기 버튼.
- **TDD 흐름:**
  1. RED: 진입 시 포커스 트랩 + 본인 테이블 펄스 + 4가지 닫기 (하단·상단X·외부·Esc)
  2. GREEN: 모달 + props {open, myTableNo, mapImage, gridSize}
  3. REFACTOR: 이미지 미수령 시 CSS 그리드 fallback + 닫힘 시 포커스 복귀
- **완료 기준:**
  - **하단 큰 닫기 버튼** (sticky bottom, ≥ 56px hitbox) — 결정 e
  - 펄스는 매번 재생 (결정 h)
  - reduced motion 시 펄스 → static box-shadow
  - `role="dialog" aria-modal="true"` + `aria-labelledby`
- **필요 테스트:**
  - 단위: 14 케이스 (4 닫기 방식 + 포커스 트랩·복귀 + fallback + 펄스 + reduced motion + a11y)
  - E2E: E2E-13 미니맵 모달 흐름
- **관련 결정:** G12·결정 e·결정 h·UX §8.7

## Task 2.11: EmptyState + LoadingState + ErrorState

- [ ] **목적:** 빈/로딩/오류 상태 공통 컴포넌트 (UX §6).
- **완료 기준:**
  - EmptyState: 마스코트 + 카피 + 다음 액션 CTA
  - LoadingState: spinner + 라벨 + 500ms 이상만 표시
  - ErrorState: 사실 + 회복 경로 (사용자 책임 카피 X)
  - 토스트 알림 X (인라인만 — UX-1)
- **필요 테스트:**
  - 단위: 각 5 케이스 = 15
- **관련 결정:** UX §6.1·§6.2·§6.3·COMPONENT §5

---

# Phase 3 — 상태 관리 + API 클라이언트 + 에러 처리 (0.5일, Phase 4-6과 병렬)

## Task 3.1: Zustand store 설계

- [ ] **목적:** `cart`·`ui`·`businessState` 3 slice.
- **완료 기준:**
  - `cart`: items[] · totalQty · totalPrice (memo) · addItem · removeItem · clear
  - `ui`: 미니맵 open · 모달 stack · scroll position
  - `businessState`: status · operating_date · shouldBeOpen (computed)
  - DevTools middleware (개발 모드)
- **필요 테스트:**
  - 단위: `cart.store.test.js` 8 케이스 (add·remove·중복·합계·clear)
  - 단위: `businessState.store.test.js` 5 케이스 (status 전이·shouldBeOpen)
- **관련 결정:** USER_FLOW §7.5 영업 머신

## Task 3.2: API client (fetch wrapper + retry + zod)

- [ ] **목적:** `src/api/client.js` + `schemas.js` (zod) + `routes.js` 상수.
- **TDD 흐름:**
  1. RED: `getMenus()` 200 응답 파싱 + 423 BUSINESS_CLOSED 거부 + 5xx 재시도
  2. GREEN: fetch + zod 검증 + 에러 throw
  3. REFACTOR: AbortController + timeout 10s
- **완료 기준:**
  - 모든 API 응답 zod 스키마 검증 (런타임 타입 안전)
  - HTTP 423 (G13) 시 `BusinessClosedError` 별도 처리 → /closed redirect
  - 5xx 재시도 (최대 2회, exponential backoff)
- **필요 테스트:**
  - 단위: 15 케이스 (200·400·423·500·timeout·재시도·zod 실패)
- **관련 결정:** API_DRAFT §0.3·G13

## Task 3.3: useOrderStream SSE hook

- [ ] **목적:** EventSource 래핑 + 자동 재연결 + cleanup.
- **TDD 흐름:**
  1. RED: 단계 변경 이벤트 수신 + 컴포넌트 언마운트 시 close
  2. GREEN: EventSource + addEventListener + return cleanup
  3. REFACTOR: 인증 분기 (학생 학번 vs 외부인 토큰) + 재연결 backoff
- **완료 기준:**
  - 메모리 누수 0 (cleanup 검증)
  - 재연결 (브라우저 기본) 후 snapshot 재push
  - reduced motion 시 카드 깜박 정적
- **필요 테스트:**
  - 단위: 10 케이스 (snapshot·status 이벤트·언마운트 cleanup·재연결·인증 분기)
  - 통합: 백엔드 SSE 엔드포인트와 (Phase 6 후)
- **관련 결정:** ADR-015·ADR-021

## Task 3.4: ErrorBoundary + 전역 에러 처리

- [ ] **목적:** React ErrorBoundary + API 에러 → toast X 인라인 ErrorState.
- **완료 기준:**
  - 컴포넌트 렌더 에러 catch → ErrorState 표시 (UX-9)
  - 처리되지 않은 promise rejection → pino log to console + ErrorState
- **필요 테스트:**
  - 단위: 5 케이스 (의도 throw·promise rejection·복구)

---

# Phase 4 — 사용자 페이지 9종 (1일)

## Task 4.1: CustomerLayout + 영업 외 가드

- [ ] **목적:** 공통 레이아웃 (헤더·로고·🗺️ 아이콘) + 영업 상태 폴링 + CLOSED 시 /closed redirect.
- **완료 기준:**
  - GET `/admin/api/business/state` 60초마다 폴링 (Phase 6 후 실 API)
  - CLOSED 감지 시 **200ms fade + 컨텍스트 카피** → /closed redirect (결정 i)
  - 진행 중 주문(/orders/:id/*) 보고 있으면 redirect X
- **필요 테스트:**
  - 단위: 6 케이스 (CLOSED 감지·fade·redirect·예외 경로)
- **관련 결정:** G13·결정 i·USER_FLOW §4.6

## Task 4.2: MenuPage (C-1)

- [ ] **목적:** 메뉴 목록 + 분류 탭 + 인기 TOP 3 (정적 BEST) + 🗺️ 진입.
- **TDD 흐름:**
  1. RED: GET /api/menus·/api/popular 모의 → MenuCard 8개 + TOP 3 영역
  2. GREEN: useQuery 또는 useEffect + fetch
  3. REFACTOR: 분류 탭 (전체·🔥인기·⭐추천·치킨·사이드·음료)
- **완료 기준:**
  - 정적 BEST 카피 ("🔥 학생회 추천 BEST") — 결정 E
  - sticky 카트 바 (하단 sticky bar)
  - 품절 메뉴 흐림 + SOLD OUT 도장
- **필요 테스트:**
  - 단위: 12 케이스
  - E2E: E2E-01 학생 주문 흐름 일부
- **관련 결정:** ADR-017 변경·G11·UX §6.1

## Task 4.3: CartPage (C-2 인벤토리)

- [ ] **목적:** 카트 화면 (인벤토리 라벨) + 수량 변경 + sticky CTA.
- **완료 기준:**
  - 헤더 "인벤토리 (N개)" (G11)
  - 합계 즉시 반영 (Zustand 구독)
  - 비어있을 때 마스코트 fallback (UX §6.1)
- **필요 테스트:**
  - 단위: 10 케이스

## Task 4.4: CheckoutPage (C-3)

- [ ] **목적:** 학번·이름·"학번 없음"·수령·테이블·쿠폰 입력 폼.
- **TDD 흐름:**
  1. RED: 모든 필드 검증·"학번 없음" 체크 시 학번 input 비활성·서버 재계산
  2. GREEN: react-hook-form + zod (학번 `^\d{2}\d{2}37\d{3}$` 또는 외부인)
  3. REFACTOR: 매장 식사 시 테이블 input 활성 + 쿠폰 체크
- **완료 기준:**
  - "학번 없음" 체크박스 큰 hitbox + 형광 옐로 외곽 (UX-7)
  - 쿠폰 거부 인라인 에러 (학과 코드 37 미일치 시) — 결정 ADR-019 변경
  - sticky "주문 접수" CTA
- **필요 테스트:**
  - 단위: 18 케이스 (학번 정규식 6 + 외부인 + 쿠폰 + 테이블 분기 + 폼 제출)
  - E2E: E2E-02 외부인 흐름
- **관련 결정:** ADR-019 변경·ADR-021·UX-7

## Task 4.5: CompletePage (C-4 절정)

- [ ] **목적:** 도그태그 + WINNER WINNER + 계좌 안내 + 확인 요청 CTA.
- **완료 기준:**
  - **계좌: 국민은행 233001-04-403536 박동빈** (G9)
  - 도그태그 sessionStorage 단발 (결정 h)
  - "WINNER WINNER" 2줄 강제 (DESIGN §5.2) — Black Ops One + Pretendard 한글 부 카피 (결정 g)
  - 계좌번호 복사 버튼 (Clipboard API)
- **필요 테스트:**
  - 단위: 14 케이스
  - E2E: E2E-01 종착점
- **관련 결정:** G9·결정 g·결정 h·DESIGN §5.2

## Task 4.6: TransferPage (C-5)

- [ ] **목적:** 은행 입력 폼 + 자동 redirect to StatusPage.
- **완료 기준:**
  - POST `/api/orders/:id/transfer-report` 호출 → status='TRANSFER_REPORTED'
  - 즉시 redirect `/orders/:id/status`
- **필요 테스트:**
  - 단위: 8 케이스

## Task 4.7: StatusPage (C-6 SSE + timeline)

- [ ] **목적:** 조리 현황판 + SSE + timeline 미니뷰 + READY 진동·깜박.
- **TDD 흐름:**
  1. RED: useOrderStream → status 변경 시 카피 갱신 + timeline 시각 추가 + READY 시 진동
  2. GREEN: SSE hook + state 매핑 + Vibration API
  3. REFACTOR: 외부인 토큰 인증 분기 + reduced motion
- **완료 기준:**
  - **timeline 미니뷰** (UX §5.1 보강): ✅ 17:30 주문→17:33 입금→...→🔄 17:38 조리 시작
  - 시각만 표시 (분 단위 추정 X, ADR-010 보존)
  - READY 시 화면 형광 옐로 깜박 1초 + 진동 (`navigator.vibrate(200)`)
- **필요 테스트:**
  - 단위: 18 케이스 (SSE 8 상태 + timeline + 진동 + reduced motion)
  - E2E: E2E-05 SSE 갱신
- **관련 결정:** ADR-015·ADR-010·UX §5.1

## Task 4.8: MapPage (C-7 미니맵 모달)

- [ ] **목적:** `/map` 라우트 → BoothMinimapModal 컴포넌트 표시.
- **완료 기준:**
  - 쿼리 `?order_id=17` 시 본인 테이블 강조
  - 직접 진입 시 (메뉴 화면 우상단 🗺️) `?from=menu`
  - 닫기 시 history back (이전 페이지)
- **필요 테스트:**
  - 단위: 6 케이스
  - E2E: E2E-13 미니맵
- **관련 결정:** G12·결정 e

## Task 4.9: ClosedPage (C-9) + ErrorPage (C-8)

- [ ] **목적:** /closed 영업 외 안내 + /error/{404,500} 에러.
- **완료 기준:**
  - ClosedScreen 컴포넌트 (Task 2.9) 사용
  - ErrorPage: 마스코트 (취소 변형) + "임무에서 사라졌어요" + 홈 CTA
- **필요 테스트:**
  - 단위: 각 5 케이스

---

# Phase 5 — 관리자 페이지 6종 (1일)

## Task 5.1: LoginPage (A-1)

- [ ] **목적:** PIN 로그인 폼 + 세션 쿠키 + redirect to /admin/dashboard.
- **완료 기준:**
  - POST /admin/login → 세션 생성
  - 실패 시 "PIN이 일치하지 않습니다" 인라인
  - 보호된 라우트 가드 (세션 없으면 /admin/login redirect)
- **필요 테스트:**
  - 단위: 8 케이스
  - E2E: E2E-09 로그인·세션·로그아웃
- **관련 결정:** ADR-024·ADR-021

## Task 5.2: DashboardPage (A-2 Kanban + G13 영업 토글)

- [ ] **목적:** 본부 대시보드 6 컬럼 Kanban + BusinessStateBadge + StartBusinessCTA + 5초 폴링.
- **TDD 흐름:**
  1. RED: 6 컬럼 (주문중·이체확인요청·이체완료·조리중·수령대기·보류) + 영업 상태 분기 (CLOSED 시 CTA)
  2. GREEN: GET /admin/api/orders 5초 폴링 + AdminCardColumn
  3. REFACTOR: 5분/10분 경고 + 키보드 4종 (Enter·Esc·Tab·?)
- **완료 기준:**
  - **CLOSED 상태:** Kanban 숨김 + 큰 형광 옐로 "🚀 장사 시작" CTA prominent (Task 2.8)
  - **OPEN 상태:** Kanban 6 컬럼 + 영업 배지 🟢 OPEN
  - 좌측 사이드 5단계 카운터 (SCREEN §5.2)
  - 5초 폴링 (SSE는 Phase 2 후보)
- **필요 테스트:**
  - 단위: 16 케이스
  - E2E: E2E-11 장사 시작 흐름·E2E-12 자동 CLOSED
- **관련 결정:** G13·결정 D 단축키 4종·SCREEN §3.7

## Task 5.3: OrderDetailPage (A-3) + TransfersPage (A-4)

- [ ] **목적:** 주문 상세 + 상태 전이 액션 + 이체 확인 인라인 화면.
- **완료 기준:**
  - 이체 확인·보류·취소·조리 시작·조리 완료·전달 완료 6 액션
  - 13 합법 전이 (ADR-025 회귀)
  - 상태 이력 timeline
- **필요 테스트:**
  - 단위: 14 케이스 + 13 상태 전이 회귀
  - E2E: E2E-05·E2E-06

## Task 5.4: MenuAdminPage (A-5)

- [ ] **목적:** 메뉴 CRUD + 품절 토글 + 사장님 추천 토글.
- **완료 기준:**
  - 8 메뉴 표 + 가격 인라인 편집
  - 품절·추천 토글 즉시 반영 (낙관적 업데이트)
- **필요 테스트:**
  - 단위: 10 케이스

## Task 5.5: SettlementPage (A-6 + A-7 ZIP)

- [ ] **목적:** 정산 화면 + 마감 버튼 + 통장 입력 + ZIP 다운로드.
- **완료 기준:**
  - 일자별 정산 + 합산 보기
  - "오늘 정산 마감" 클릭 → ADR-012 가드 (진행 주문 0건) + 자동 영업 CLOSED (G13)
  - ZIP 다운로드 (수동 + 자동 스냅샷 이력)
- **필요 테스트:**
  - 단위: 12 케이스
  - E2E: E2E-07 정산 마감·E2E-08 ZIP·E2E-12 자동 CLOSED
- **관련 결정:** ADR-012·ADR-016·ADR-022 변경·G13

---

# Phase 6 — 백엔드 (도메인·API·미들웨어·init.sql·자동 ZIP, 1.5일, Phase 4-5 병렬 가능)

## Task 6.1: init.sql + bootstrap.js + seedAdmin

- [ ] **목적:** 신규 DB 첫 부팅 시 init.sql 실행 + 어드민 자동 생성.
- **완료 기준:**
  - `_migrations` 없으면 init.sql 일괄 실행 (DB_DRAFT §5.5)
  - 모든 테이블 + 인덱스 + 메뉴 8개 (PUBG 매핑 코멘트) + business_state CLOSED + system_settings 시드
  - seedAdmin(): `DEFAULT_ADMIN_PIN` env 또는 6자리 랜덤 + stdout 출력 1회
- **필요 테스트:**
  - 단위: `bootstrap.test.js` 7 케이스 (신규 DB·기존 DB·env 명시·env 없음·재부팅 skip·SQL 실패 ROLLBACK)
  - 통합: E2E-14 init.sql 첫 부팅
- **관련 결정:** 사용자 요구 2026-05-13·DB_DRAFT §5

## Task 6.2: 도메인 — pricing (Pattern B 4 회귀 ★)

- [ ] **목적:** ADR-020 가격 자체 계산. 4 회귀 케이스 강제.
- **TDD 흐름:**
  1. RED: ① 정상 ② 클라가 다른 total 보내도 거부 ③ 존재 X menu_id ④ 쿠폰 적용
  2. GREEN: `calculatePrice({menu_ids, qty, coupon})` 서버 lookup + 계산
  3. REFACTOR: 트랜잭션 시점 가격 lock
- **완료 기준:**
  - 4 회귀 케이스 회귀 (절대 깨지면 안 됨 — CLAUDE.md)
- **필요 테스트:**
  - 단위: `pricing.test.js` 12 케이스 (4 회귀 + 8 추가)
- **관련 결정:** ADR-020 ★★★

## Task 6.3: 도메인 — coupon-validation (학과 코드 37)

- [ ] **목적:** 학번 검증 정규식 `^\d{2}\d{2}37\d{3}$` (ADR-019 변경).
- **완료 기준:**
  - 4단계 검증: format·department(37)·name·duplicate
  - 12 회귀 케이스 (TEST_PLAN §5.2 갱신)
- **필요 테스트:**
  - 단위: `coupon.test.js` 12 케이스
- **관련 결정:** ADR-019 변경

## Task 6.4: 도메인 — order-state · settlement · popularity · transfer-matching · business-state

- [ ] **목적:** 5 도메인 모듈 + 회귀 케이스 매트릭스.
- **완료 기준:**
  - order-state: 13 합법 전이 + 5 불법 거부
  - settlement: canClose 가드 + business_state CLOSED 자동 트랜잭션 (G13)
  - popularity: 정적 BEST + TOP 3 (E 결정)
  - transfer-matching: 4요소 일치 (이름·은행·금액·시각 ±5분)
  - **business-state ★ G13 신규**: 2-state 머신 + 11 단위 케이스 (TEST_PLAN §5.7)
- **필요 테스트:**
  - 단위: 각 5-12 케이스 = 총 40+
- **관련 결정:** ADR-006·ADR-012·ADR-017 변경·G13

## Task 6.5: Repositories — menu·order·coupon·admin·settlement·backup·businessState

- [ ] **목적:** SQLite repository pattern. 트랜잭션 + UNIQUE 제약 활용.
- **완료 기준:**
  - order-repo: daily_no 일자별 시퀀스 + 트랜잭션 ROLLBACK
  - coupon-repo: UNIQUE student_id race 차단
  - businessState-repo: 단일 행 강제 (CHECK id=1) + 트랜잭션 통합 UPDATE
- **필요 테스트:**
  - 단위: 각 5-8 케이스
  - 통합: race condition 케이스 (coupon UNIQUE Promise.all 5 동시)

## Task 6.6: API — 사용자 (12 엔드포인트)

- [ ] **목적:** GET /api/menus·popular, POST /api/orders·/api/orders/:id/transfer-report, GET /api/orders/:id/stream(SSE)·summary.
- **완료 기준:**
  - 모든 응답 zod 검증
  - 423 BUSINESS_CLOSED (G13) middleware 일관 적용
  - SSE 30 동시 연결 + 메모리 누수 회귀 (TEST_PLAN §7)
- **필요 테스트:**
  - 통합: supertest 25+ 케이스
- **관련 결정:** API_DRAFT §1·ADR-015·ADR-021·G13

## Task 6.7: API — 관리자 (26 엔드포인트)

- [ ] **목적:** PIN 로그인·orders 검색·transition·business/open·state·settlement/close·ZIP.
- **완료 기준:**
  - **POST /admin/api/business/open** (G13 신규) — 트랜잭션 멱등
  - **POST /admin/api/settlement/close** — ADR-012 가드 + business_state 자동 CLOSED 같은 트랜잭션
  - CSRF 토큰 미들웨어
- **필요 테스트:**
  - 통합: 35+ 케이스
- **관련 결정:** API_DRAFT §2·G13·ADR-012

## Task 6.8: Middleware — business-state + admin-auth + error

- [ ] **목적:** 영업 외 사용자 경로 redirect (G13) + PIN 세션 검증 + 전역 에러 핸들러.
- **완료 기준:**
  - 사용자 GET 경로 `/`·`/menu`·`/cart`·`/checkout`·`/orders/:id/*` → CLOSED 시 302 /closed
  - 사용자 POST API → HTTP 423 `BUSINESS_CLOSED`
  - /admin/* 경로 영향 X (관리자 영업 외에도 작업)
  - 200ms fade 클라 처리는 Task 4.1
- **필요 테스트:**
  - 통합: 12 케이스 (CLOSED·OPEN·관리자 분기)

## Task 6.9: 자동 ZIP 2시간 스냅샷

- [ ] **목적:** setInterval 2시간 + 6개 회전 + Docker volume backups/.
- **완료 기준:**
  - 30분 → 2시간 (결정 A)
  - 데이터 손실 ≤ 2시간 (KPI 변경)
  - 트랜잭션 시점 스냅샷
- **필요 테스트:**
  - 단위: `auto-snapshot.test.js` 5 케이스 (timer mock + 회전)
- **관련 결정:** ADR-022 변경

---

# Phase 7 — 접근성·E2E·운영 준비 (0.5일)

## Task 7.1: E2E 14 시나리오 (Playwright)

- [ ] **목적:** TEST_PLAN §8.2 14 시나리오 모두 작성·실행.
- **완료 기준:**
  - E2E-01~14 통과 (mobile + desktop viewport)
  - 운영일자 + business_state mock 설정
- **필요 테스트:**
  - E2E: 14 케이스
- **관련 결정:** TEST_PLAN §8

## Task 7.2: a11y 자동화 (axe-core)

- [ ] **목적:** 모든 컴포넌트 + 페이지에 axe 검증 자동 실행.
- **완료 기준:**
  - Vitest 환경에 `vitest-axe` 통합
  - 모든 페이지 렌더 시 axe violations 0
  - 키보드 시나리오 (UX §8.2) + 미니맵 (§8.7) + 영업 외 (§8.8)
- **필요 테스트:**
  - 통합: a11y suite

## Task 7.3: reduced motion + 단축키 + 운영 가이드

- [ ] **목적:** prefers-reduced-motion 시각 검증 + 키보드 4종 + 운영진 D-1 리허설 카드.
- **완료 기준:**
  - 모션 컴포넌트 5종 (도그태그·미니맵 펄스·CTA 깜박·마스코트·도장) reduced 시 정적
  - 단축키 Enter·Esc·Tab·? (결정 D — 4종만)
  - 운영진 1장 인쇄 카드 (`docs/operations/admin-card.md` 신규)
- **필요 테스트:**
  - E2E: reduced motion 시뮬레이션 1 케이스

## Task 7.4: 회귀 테스트 매트릭스 최종 검증

- [ ] **목적:** 핵심 회귀 모두 실행 → 통과.
- **회귀:**
  - ADR-020 4 케이스 (pricing) ★★★
  - 쿠폰 12 케이스 (학과 코드 37)
  - 상태 머신 13 합법 + 5 불법
  - business-state 11 단위 (G13)
  - bootstrap 7 단위 (init.sql)
  - 정산 마감 4 가드
  - SSE 누수
- **완료 기준:**
  - `npm test` 모든 회귀 통과 5초 내

## Task 7.5: D-1 리허설 (5/19)

- [ ] **목적:** 호스트 노트북에서 실 운영 시뮬레이션.
- **체크리스트 (운영 가이드 자산):**
  - [ ] `docker compose up -d` 가동
  - [ ] 첫 부팅 시 stdout `[INIT] Generated admin PIN: XXXXXX` 확인
  - [ ] 본부 대시보드 `/admin/login` PIN 로그인 → CLOSED 상태 + "🚀 장사 시작" CTA 확인
  - [ ] "장사 시작" 클릭 → OPEN 전환
  - [ ] 모바일 폰에서 QR or URL 진입 → /menu 정상
  - [ ] 메뉴 1개 "줍기" → /cart → /checkout → 학번 입력 → /orders/:id/complete (도그태그 모션 확인)
  - [ ] 이체 신고 → /orders/:id/transfer-report 제출 → /orders/:id/status (SSE 연결)
  - [ ] 본부에서 "이체 확인" 클릭 → 사용자 화면 SSE 갱신 (PAID)
  - [ ] 조리 시작·완료·수령 단계별 토글 → SSE 갱신
  - [ ] 정산 마감 → ZIP 다운로드 → 사용자 화면 /closed redirect (200ms fade)
  - [ ] 다음날 (시뮬레이션) "장사 시작" 다시 클릭 → OPEN

---

# 부록 A: 회귀 테스트 매트릭스 (필수)

| 영역 | 케이스 수 | 위치 | 절대 깨지면 안 됨? |
|---|---:|---|:---:|
| ADR-020 가격 무결성 | 4 | `pricing.test.js` | ★★★ YES |
| 쿠폰 학과 코드 37 | 12 | `coupon.test.js` | ★★ YES |
| 상태 머신 13 합법 + 5 불법 | 18 | `order-state.test.js` | ★★ YES |
| business-state 머신 (G13) | 11 | `business-state.test.js` | ★★ YES |
| bootstrap init.sql + seedAdmin | 7 | `bootstrap.test.js` | ★★ YES |
| 정산 마감 가드 | 4 | `settlement.test.js` | ★ YES |
| transfer-matching 4요소 | 6 | `transfer-matching.test.js` | ★ |
| popularity 정적 BEST | 5 | `popularity.test.js` | — |
| SSE 메모리 누수 | 1 | `sse.test.js` | ★ |
| **합계** | **68** | | |

# 부록 B: Phase별 결정 cross-reference

| Phase | 관련 ADR/결정 |
|---|---|
| 0 부트스트랩 | ADR-023 (Docker)·**ADR-024 변경** (React 채택) |
| 1 토큰·Atoms | DESIGN §3·§4 군복 톤·결정 d 대비 실측·결정 b 메뉴 매핑 |
| 2 Components | DESIGN §10·§11·결정 c·d·e·f·h·G12·G13 |
| 3 상태·API | API_DRAFT 전체·G13 423·ADR-021 인증 |
| 4 사용자 페이지 | USER_FLOW §2~§3·SCREEN_STRUCTURE §3·결정 i·g·G9 계좌 |
| 5 관리자 페이지 | G13 영업 토글·ADR-012·결정 D 단축키 4종 |
| 6 백엔드 | ADR-019 변경·ADR-020·ADR-022 변경·G13·init.sql 사용자 요구 |
| 7 접근성·E2E | DESIGN §12·§9.5·UX §8·TEST_PLAN §8 |

# 부록 C: design-bundle 변환 체크리스트

design-bundle 파일을 React 프로덕션으로 이식 시 *반드시* 확인:

- [ ] `data.js` 8 메뉴 PUBG 매핑 (BANDAGE·FIRST_AID·MED_KIT·SYRINGE·DEFIB·ADRENALINE·PAINKILLER·ENERGY) 보존
- [ ] `tokens.css` `--color-card-muted: #48402C` (2026-05-14 명도 조정값)
- [ ] DogTagFrame sessionStorage 단발 모션 (`dogtag-shown-{orderId}`)
- [ ] MenuCard "줍기" 버튼만 클릭 영역 (카드 전체 X)
- [ ] BoothMinimapModal 하단 큰 닫기 버튼 + 상단 X 둘 다
- [ ] StartBusinessCTA 빨간 깜박 매번 재생 (sessionStorage X)
- [ ] ClosedScreen aria-live 운영 일정 자동 announce
- [ ] AI 슬롭 #26 카드 내 형광 옐로 텍스트 검출 (린트 또는 회귀)
- [ ] `react-tweaks-panel.jsx` *프로덕션 제외* (Phase 2 후보)

---

## 진행 트래킹

각 Task 완료 시:
1. `- [ ]` → `- [x]` 갱신 (이 파일)
2. `docs/IMPLEMENTATION_PROGRESS.md` 표 갱신 (Task 이름·상태·커밋·테스트 결과)
3. `docs/tasks/2026-MM-DD-task-N.M-<이름>.md` 작업 로그
4. `git commit -m "feat/chore/fix: <한국어 설명>"` (CLAUDE.md 규칙)

**일정 압박 시 우선순위 (P0만):**
- Phase 0·1·2·3·4·6.1·6.2·6.6·6.8·7.1·7.4·7.5
- Phase 5 일부 (5.1·5.2·5.5 필수)
- 5.3·5.4·6.3·6.4·6.5·6.7·6.9·7.2·7.3은 *시간 남으면*
