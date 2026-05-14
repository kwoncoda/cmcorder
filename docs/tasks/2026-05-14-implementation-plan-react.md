# 2026-05-14 — IMPLEMENTATION_PLAN.md React 기준 재작성

## 목표

사용자 `/superpowers:writing-plans` 호출로 *React 프로젝트 기준* 구현 계획 재작성. 기존 IMPLEMENTATION_PLAN.md (5763줄, ADR-024 EJS+Alpine 기반)를 *Claude Design 결과 (`docs/design-bundle/` React JSX 시안)*를 변환 베이스로 활용하여 *React 18 + Vite + Express 백엔드*로 전환.

## 사용자 요구 7가지 (모두 반영)

1. ✅ React 프로젝트 기준
2. ✅ 한 번에 하나씩 구현 가능한 Task 단위
3. ✅ TDD 흐름 (RED → GREEN → REFACTOR)
4. ✅ 각 Task 완료 기준 (DoD)
5. ✅ 필요 테스트 (단위·통합·E2E·a11y)
6. ✅ 컴포넌트·상태관리·라우팅·API·에러·접근성 분리 (Phase 1·3·4·6·3·7)
7. ✅ 코드 X, IMPLEMENTATION_PLAN.md만 작성

## 핵심 결정 — ADR-024 변경 권장 ★

| 영역 | 이전 (ADR-024) | 변경 (2026-05-14) |
|---|---|---|
| Frontend | EJS + Alpine.js | **React 18.3.1 + Vite 5** |
| State | Alpine `x-data` | **Zustand 4** |
| Routing | Express 라우터 | **React Router 6** (SPA) |
| Forms | HTML5 + validation | **react-hook-form + zod** |
| Backend | Express + SQLite (변경 없음) | Express + SQLite (유지) |
| Build | Tailwind CLI | **Vite (Tailwind 통합)** |

**변경 사유:**
- `docs/design-bundle/`에 *완성된 React 18 시안* (screens-customer.jsx + screens-admin.jsx + components.jsx) 존재
- 시안을 *변환 베이스*로 활용 → React 학습 비용 < 시안 이식 이득
- D-day 6일 일정에서 *기존 시안 그대로 활용* = 가장 빠른 경로

**별도 작업 필요:** ADR-024 정식 개정 (Superseded by ADR-027 or 신규)

## 만든 것

| 파일 | 내용 |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | React 기준 완전 재작성 (~600줄, 기존 5763줄 대체) |
| `docs/tasks/2026-05-14-implementation-plan-react.md` | 이 작업 로그 |

## IMPLEMENTATION_PLAN.md 구조

```
0. 기술 스택 (ADR-024 변경 권장)
1. 디렉터리 구조 (모노레포: src/ + server/)
2. Phase 개요 + 일정 (6일)
3. TDD 워크플로 + Definition of Done

Phase 0 — 부트스트랩 (0.5일, Task 0.1~0.6)
Phase 1 — 디자인 토큰 + Atoms (0.5일, Task 1.1~1.3)
Phase 2 — Molecules + Organisms (1.5일, Task 2.1~2.11)
Phase 3 — 상태 + API + 에러 (0.5일, Task 3.1~3.4, 병렬)
Phase 4 — 사용자 페이지 9종 (1일, Task 4.1~4.9)
Phase 5 — 관리자 페이지 6종 (1일, Task 5.1~5.5)
Phase 6 — 백엔드 (1.5일, Task 6.1~6.9, 병렬 가능)
Phase 7 — 접근성·E2E·운영 (0.5일, Task 7.1~7.5)

부록 A: 회귀 테스트 매트릭스 (68 케이스)
부록 B: Phase별 ADR/결정 cross-ref
부록 C: design-bundle 변환 체크리스트
```

## 총 45 Task, 6일 일정

| Phase | Task 수 | 추정 | 컴포넌트·상태·라우팅·API·에러·a11y 분리 |
|---|---:|---:|---|
| 0 | 6 | 0.5일 | 인프라 |
| 1 | 3 | 0.5일 | **컴포넌트 (Atoms)** |
| 2 | 11 | 1.5일 | **컴포넌트 (Molecules + Organisms)** |
| 3 | 4 | 0.5일 | **상태 + API + 에러** (병렬) |
| 4 | 9 | 1일 | **라우팅 + 사용자 페이지** |
| 5 | 5 | 1일 | **라우팅 + 관리자 페이지** |
| 6 | 9 | 1.5일 | **API (백엔드) + 미들웨어** (병렬 가능) |
| 7 | 5 | 0.5일 | **접근성 + 통합** |
| **합계** | **52** | **~6일** | |

## TDD 흐름 + Definition of Done (모든 Task 공통)

**TDD 흐름:**
1. RED — 테스트 작성 → 실패 확인
2. GREEN — 최소 구현 → 테스트 통과
3. REFACTOR — 토큰화·a11y·reduced motion·에러 처리 추가
4. COMMIT — 한국어 메시지 1 Task = 1 커밋 (CLAUDE.md)
5. LOG — `docs/tasks/YYYY-MM-DD-task-N.M-<이름>.md`

**DoD 체크리스트:**
- [ ] 단위 테스트 통과 (Vitest)
- [ ] a11y 자동 검증 통과 (axe-core)
- [ ] 디자인 토큰만 사용 (하드코딩 0)
- [ ] DESIGN §11 AI 슬롭 26개 회피
- [ ] reduced motion 시 정적 표시 (모션 있는 컴포넌트만)
- [ ] zod 스키마 또는 JSDoc 타입 안전
- [ ] 회귀 케이스 추가 (해당 시)

## 핵심 회귀 테스트 매트릭스 (부록 A)

| 영역 | 케이스 | 절대 깨지면 안 됨 |
|---|---:|:---:|
| ADR-020 가격 무결성 | 4 | ★★★ |
| 쿠폰 학과 코드 37 | 12 | ★★ |
| 상태 머신 13 합법 + 5 불법 | 18 | ★★ |
| business-state 머신 (G13) | 11 | ★★ |
| bootstrap init.sql + seedAdmin | 7 | ★★ |
| 정산 마감 가드 | 4 | ★ |
| transfer-matching 4요소 | 6 | ★ |
| popularity 정적 BEST | 5 | — |
| SSE 메모리 누수 | 1 | ★ |
| **합계** | **68** | |

## design-bundle 변환 베이스 활용 (부록 C)

design-bundle 11 파일을 React 프로덕션으로 이식 시 *반드시 보존*:

- ✅ `data.js` 메뉴 PUBG 매핑 8종 (BANDAGE·FIRST_AID·MED_KIT·SYRINGE·DEFIB·ADRENALINE·PAINKILLER·ENERGY)
- ✅ `tokens.css` `--color-card-muted: #48402C` (2026-05-14 명도 조정값)
- ✅ DogTagFrame sessionStorage 단발 (`dogtag-shown-{orderId}`)
- ✅ MenuCard "줍기" 버튼만 클릭 영역 (카드 전체 X)
- ✅ BoothMinimapModal 하단 닫기 + 상단 X 둘 다
- ✅ StartBusinessCTA 빨간 깜박 매번 (sessionStorage X)
- ✅ ClosedScreen aria-live 운영 일정 자동 announce
- ✅ AI 슬롭 #26 카드 내 형광 옐로 텍스트 검출 (lint/회귀)
- ❌ `tweaks-panel.jsx` 프로덕션 제외 (Phase 2 후보)

## 분리 계획 (사용자 요구 #6)

| 영역 | Phase | 핵심 Task |
|---|---|---|
| **컴포넌트** | Phase 1·2 | Atoms 8 + Molecules 5 + Organisms 12 = 25 컴포넌트 |
| **상태 관리** | Phase 3 | Zustand 3 slice (cart·ui·businessState) |
| **라우팅** | Phase 0.3 + 4·5 | React Router 6, 15 라우트, 영업 외 가드 |
| **API 연동** | Phase 3 (클라) + 6 (서버) | fetch wrapper + zod + SSE hook |
| **에러 처리** | Phase 3.4 | ErrorBoundary + 인라인 ErrorState (토스트 X) |
| **접근성** | Phase 7.2·7.3 + 각 Task | axe-core 자동 + 키보드 + reduced motion + 시나리오 8종 |

## 사용자 메모리 정합성

- `feedback_no_scope_pressure.md` ✅ — 범위 압박 X, 사용자 명시 React 채택
- `project_one_time_service.md` ✅ — 일회성. Phase 7.3 운영 가이드는 "지금 운영" 가치만

## 일정 압박 시 우선순위 (P0만)

본 계획은 *모든 Task P0 가정*. 시간 부족 시:
- 필수: Phase 0·1·2·3·4·6.1·6.2·6.6·6.8·7.1·7.4·7.5
- 필수 운영진: Phase 5.1·5.2·5.5
- *시간 남으면*: 5.3·5.4·6.3·6.4·6.5·6.7·6.9·7.2·7.3

## 테스트 결과

문서 작성이라 자동 테스트 N/A. 수동 검증:

| 검증 항목 | 결과 |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` 재작성 (~600줄, EJS+Alpine 5763줄 대체) | ✅ |
| 사용자 요구 7가지 모두 반영 | ✅ |
| Phase 0~7 각 Task별 TDD·DoD·테스트 명세 | ✅ |
| design-bundle 11 파일 → React 프로덕션 변환 정책 명시 | ✅ |
| 누적 결정 12+건 (G9~G14·ADR 변경 5건·결정 a~i) 모두 Task에 반영 | ✅ |
| 회귀 매트릭스 68 케이스 | ✅ |
| 사용자 메모리 정합 (일회성·범위 압박 X) | ✅ |
| 구현 코드 변경 0 | ✅ |

## 다음에 할 것

### 즉시 (사용자 결정)

1. **ADR-024 정식 개정** — EJS+Alpine → React 명시 (변경 사유: design-bundle 시안 활용)
2. **`docs/IMPLEMENTATION_PROGRESS.md` 갱신** — Phase 0 진입 직전 상태로

### 자료 수령 (D-3, 5/17)

3. 메뉴 가격 8개
4. 메뉴 PUBG 일러스트 8종 (PNG/JPG) — `public/items/`
5. 마스코트 5종 (선택, fallback 🪖) — `public/mascot/`
6. 부스 약도 PNG (D-1, 5/19) — `public/map/`

### 구현 시작 (사용자 신호 시)

7. Phase 0.1부터 진행 — `/superpowers:subagent-driven-development` 또는 `/superpowers:executing-plans`
8. 각 Task 완료 시:
   - 본 IMPLEMENTATION_PLAN.md `- [ ]` → `- [x]`
   - `IMPLEMENTATION_PROGRESS.md` 표 갱신
   - `docs/tasks/2026-MM-DD-task-N.M-<이름>.md` 작업 로그
   - 한국어 커밋

### 누적 ADR 정식 개정 (별도 작업)

- ADR-024 변경 (EJS+Alpine → React)
- ADR-012 보강 (영업 자동 종료 트랜잭션)
- ADR-017 변경 (정적 BEST)
- ADR-019 변경 (학과 코드 37)
- ADR-022 변경 (ZIP 2시간)
- ADR-026 보강 (군복 톤·도장 CSS·카모 CSS·키보드 4종)
- ADR-027 신규 (메뉴 8개 + PUBG 매핑 G10)
- ADR-028 신규 (계좌 G9)
- ADR-029 신규 (부스 미니맵 G12)
- ADR-030 신규 (영업 토글 G13)
- ADR-031 신규 (일회성 G14)
