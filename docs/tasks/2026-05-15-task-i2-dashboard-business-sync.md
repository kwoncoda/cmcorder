# Task I-2 — DashboardPage 마운트 시 서버 영업 상태 동기화

**작업일:** 2026-05-15
**커밋:** (이 작업으로 생성)

## 목표

본부 대시보드 새로고침 시 화면이 *실제 영업 상태*와 일치하도록 보정한다.

### 문제

`useBusinessStateStore` 기본값이 `status='CLOSED'` 라서, **이미 영업 중**인데 본부가 페이지를
새로고침하면 화면이 다시 "🚀 장사 시작" CTA 로 전환됨. 본부 운영자 혼란 — "장사가 끝났나?",
중복 클릭 시 서버는 `/admin/api/business/open` 을 idempotent 처리하지만 UX 는 어색.

### 해결

`DashboardPage` 마운트 시 `GET /admin/api/business/state` 호출 →
`syncFromServer({ status, operating_date })` 로 store 동기화.
서버는 단일 진실 출처(SSR-style 도구 X, store 는 캐시 역할).

## 만든 것

- `src/pages/admin/DashboardPage.jsx` — `businessQuery = useApi(...)` + sync useEffect 추가 (116 → 120줄, 한계치 유지)
- `src/pages/admin/__tests__/DashboardPage.test.jsx` — 회귀 2 케이스 추가 (23 케이스 전부 통과)

## 한 일

### 구현 (DashboardPage.jsx)

1. `BusinessStateSchema` import 추가 (`src/api/schemas.js` — 이미 존재).
2. `syncFromServer` action 을 store 셀렉터로 추가 — `useBusinessStateStore((s) => s.syncFromServer)`.
3. `businessQuery = useApi(({ signal }) => apiFetch(API.ADMIN_BUSINESS_STATE, { schema: BusinessStateSchema, signal }), [])` — 마운트 1회 호출.
4. `useEffect(() => { if (businessQuery.data?.status) syncFromServer(businessQuery.data); }, [businessQuery.data, syncFromServer])` — 데이터 도착 시 store sync. 외부 시스템(서버) → store 동기화이므로 §3.5 5조 위반 아님.
5. 줄 수 절약: 상단 banner 주석 3줄 → 2줄, 1-line useEffect 2개 인라인화. **120줄 (한계치)** 유지.

### 회귀 보호 (DashboardPage.test.jsx)

신규 ★ 케이스 2개:

1. **마운트 시 GET /admin/api/business/state 호출 + store sync** — `useApi.mockReturnValueOnce({ data: { status: 'OPEN', operating_date: '2026-05-20' } })` (businessQuery) → `mockReturnValueOnce({ data: [] })` (ordersQuery). store 가 `CLOSED → OPEN` 으로 전환되는지 `waitFor` 검증.

2. **새로고침 시뮬: store=CLOSED·서버=OPEN → 마운트 후 Kanban으로 전환** — 위와 같은 패턴. 검증 강조: `start-business-cta` 가 *사라지고* Kanban 헤더("📋 본부 대시보드") 가 나타남.

기존 21 케이스는 `mockReturnValue` (every-call) 패턴 그대로 유지 — businessQuery 의 data 가 그 mock 의 data 와 같은 shape 일 때 sync useEffect 가 어떻게 반응하는지 확인:
- `data: []` (empty orders) → `data.status` 가 `undefined` → sync 안 됨 (방어 가드 `?.status`).
- `data: SAMPLE_ORDERS` (array) → `array.status` 가 `undefined` → sync 안 됨.
- `data: null` (Loading) → guard 가 차단.

이 가드 덕에 기존 19+ 케이스 호환성 유지, 새 케이스만 `mockReturnValueOnce` 체인으로 분기.

## 테스트 결과

- `npm test -- --run src/pages/admin/__tests__/DashboardPage.test.jsx` — **23/23 통과** (기존 21 + 신규 2).
- `npm test -- --run` (전체) — **837/839 통과** (불안정 a11y 타임아웃 2건은 jsdom + axe-core 병렬 경합, I-2 무관; 격리 실행 시 정상 통과).
- `npm run build` — **6.11s** 성공.
- `wc -l src/pages/admin/DashboardPage.jsx` — **120줄** (페이지 ≤120 한계치).

## 절대 깨지면 안 되는 것 (점검)

- ADR-020 Pattern B: 본 작업은 가격 로직 무관.
- ADR-019/021: 회원/외부 인증 로직 무관.
- ADR-012: 정산 마감 로직 무관 (영업 *시작* 동기화만 다룸).
- ADR-023: Docker compose 무관.

## 다음에 할 것

- 본부가 *다른 탭* 에서 영업을 닫으면 현재 탭은 5초 polling 이 423 응답으로 받지만, 영업 *전환* 자체는 polling 외 통보 X. 필요 시 BroadcastChannel 또는 SSE 검토 — 단, MVP D-day 직전이므로 보류.
