# 2026-05-14 — React best-practices 기준 IMPLEMENTATION_PLAN.md 리뷰·일괄 반영

## 목표

`docs/IMPLEMENTATION_PLAN.md` (52 Task / 6일 일정)를 Vercel `react-best-practices` 70 규칙 기준으로 검토하고, React 관점에서 사고가 날 만한 항목을 *구현 전에* 수정. 일정·기능 변경 없이 *구조 보강*만.

## 만든 것

- `docs/IMPLEMENTATION_PLAN.md` — +210줄/-90줄 (912줄 → 1031줄, +13%)
  - **§3.5 React 코드 가이드라인 (신규 8조)** — 페이지 ≤120줄·셀렉터·AbortController·effect→event·인라인 컴포넌트 금지·메모이즈·번들 위생
  - **부록 D vercel-react-best-practices 회귀 체크리스트 (신규 8항목)** — Profiler·번들·StrictMode·셀렉터·코드 스플릿·barrel·effect→event·페이지 크기
- `docs/tasks/2026-05-14-react-best-practices-review.md` — 이 작업 로그

## 한 일

### 검토 (vercel-react-best-practices 스킬 로딩 → 기획·디자인 6 문서 + design-bundle 시안 3 파일 분석)

검토 기준 12개로 평가 후 문제 항목 24개 식별:
- **반드시 수정 (R1~R7)** — 60초 폴링·DogTag useEffect·메모이즈·이벤트 핸들러·페이지 크기·셀렉터·StrictMode
- **수정 권장 (G1~G10)** — 코드 스플릿·Framer Motion·axe dev-only·Clipboard fallback·order 글로벌 X 등

### 일괄 반영 (Edit 15회)

1. **§0.2** Framer Motion *도입 X 단정* (CSS animation만)
2. **§0.3** window.MENUS·CATEGORIES·STATE_LABEL 변환 경로 표 3행 추가
3. **§3.5 신규** React 가이드라인 8조 + DoD 2 항목 추가
4. **Task 0.3** React.lazy + Suspense (관리자 6 페이지 split)
5. **Task 0.4** axe-core dev-only 동적 import + production 회귀
6. **Task 1.3** lucide-react named import 강제
7. **Task 2.3** DogTag useState 초기화 함수 패턴 — useEffect 후행 setState 금지 (rerender-derived-state-no-effect)
8. **Task 2.7** AdminCardColumn React.memo + 안정 key + memo 회귀 테스트
9. **Task 3.1** Zustand 셀렉터 강제 / scroll 제거 / order slice 만들지 X
10. **Task 3.2** AbortController + StrictMode 호환 + 423 단일 reactive
11. **Task 3.3** useOrderStream StrictMode + `onStatusChange(prev, next)` 콜백
12. **Task 4.1** **60초 영업 상태 폴링 완전 제거** → 423 reactive 단일 진입점
13. **Task 4.2~4.7** 사용자 페이지 6개 — ≤120줄 + Loading/Error/Empty 3분기 + 셀렉터
14. **Task 4.5** Clipboard API 3단계 fallback (HTTP 와이파이 환경 대비)
15. **Task 4.7** StatusPage 진동·깜박은 onStatusChange 이벤트 핸들러 + aria-live
16. **Task 5.2** DashboardPage React.memo + tick 패턴 + 시맨틱 button
17. **Task 7.4** 회귀 매트릭스에 부록 D 8항목 점검 추가
18. **부록 B** Phase별 §3.5 cross-reference
19. **부록 C** 변환 체크리스트 5행 추가 (window.* + DogTag 패턴 + 페이지 분리)
20. **부록 D 신규** vercel-react-best-practices 회귀 체크리스트

### 일정 영향

**+0일.** 구조 정리·테스트 케이스 추가만, 새 기능 X. 6일 일정 (D-day 5/20) 유지.

### 테스트 케이스 증가

기존 회귀 68 케이스 → 약 +15 (StrictMode·셀렉터·memo·onStatusChange·페이지 3분기·Clipboard fallback·watch 조건부 필드). Phase 7.4에서 통합 검증.

## 테스트 결과

문서 변경이므로 자동 테스트 없음. 검증:
- `wc -l docs/IMPLEMENTATION_PLAN.md` → 1031줄 (목표 +119줄 달성)
- `grep "§3\.5"` → 49회 등장 — 모든 관련 Task에 cross-reference 연결
- `grep "^## Task |^### 3\.5 |^# 부록 D"` → 신규 섹션 2개·기존 Task 52개 모두 보존

## 결정 근거 (검토 결과 핵심 7가지)

1. **R1 폴링 제거** — Task 6.8 middleware가 모든 POST를 423으로 거부하므로 별도 폴링은 *중복 비용*. 200명 동시 접속 시 분당 200req 의미 없는 트래픽 회피.
2. **R2 DogTag useState** — useEffect 후행 setState는 첫 렌더 깜박 유발. `useState(() => ...)`로 첫 렌더부터 결정.
3. **R3 AdminCardColumn memo** — 5초 폴링 × 30카드 = 매 5초 30 commit. memo 적용 시 변하지 않은 카드 0 commit.
4. **R4 onStatusChange 이벤트** — useEffect deps에 status 두면 StrictMode 2회 mount + 새로고침 후 직진입 시 진동 재발화. 이벤트 핸들러로 1회 보장.
5. **R5 페이지 ≤120줄** — design-bundle screens-customer.jsx의 ScreenMenu 함수가 이미 100줄. 변환 시 Organisms로 쪼개지 않으면 200줄+ → 테스트·유지보수 부담.
6. **R6 Zustand 셀렉터** — `const { totalQty } = useCartStore()` 패턴은 *전체 객체 구독*. items 배열 변경에 sticky bar 매번 리렌더. `useCartStore(s => s.totalQty)`로 차단.
7. **R7 StrictMode SSE** — useEffect 2회 mount 시 EventSource 2개 open 후 1개만 close. ref counter로 회귀.

## 다음에 할 것

- 사용자 "구현 시작" 신호 시 Task 0.1부터 진행 (vite 부트스트랩)
- Phase 0 진행 중 §3.5 8조와 부록 D를 모든 Task DoD에서 참조
- 구현 중 새로운 React 함정 발견 시 §3.5에 추가
