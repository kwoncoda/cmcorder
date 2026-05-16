# 프로젝트 작업 규칙

학교 축제 부스용 모바일 웹 주문 시스템 ("오늘 저녁은 치킨이닭!"). D-day 2026-05-20.

**현재 단계:** 구현 완료 (2026-05-14). React 18 + Vite + Express 4 + SQLite. 835/835 tests passing, main 49 커밋 ahead. **D-1 리허설 5/19 → D-day 5/20 16:30 운영 시작**. 이후 작업은 *수정·패치·운영 가이드 보강* 단계.

## 명령

- `npm run dev` — 프론트엔드 dev server (http://localhost:5173)
- `npm run server` — Express 백엔드 (http://localhost:3000, /healthz)
- `npm run server:watch` — 백엔드 자동 재시작
- `npm test` — 단위·통합 (Vitest, 단위 ~85 files / 835 케이스)
- `npm run test:e2e` — Playwright smoke (사용자 수동 검증은 `docs/operations/d1-rehearsal.md` 사용)
- `npm run build` — 프론트엔드 production 빌드 (`dist/`)
- `docker compose up -d` — 운영 컨테이너 / `docker compose logs -f` / `docker compose restart`

## 규칙

- 자연어·주석·커밋 메시지·UI 카피는 **한국어**. 코드·명령어·고유명사는 원문.
- 모든 기획 문서는 `docs/`. 중요 결정은 `docs/DECISIONS.md`에 ADR로.
- 추가 기능·수정은 *작업 절차 3단계* (아래) 준수
- `server/domain/*`(백엔드 도메인)은 **TDD strict + 회귀 테스트 필수**. 다른 영역은 권장.
- 핵심 회귀 매트릭스(아래 "절대 깨지면 안 되는 것")는 *언제든 `npm test`로 검증 가능*해야 함.

## 작업 절차 (필수)

작업(task) 단위마다 *반드시* 다음 4단계 흐름을 지킨다:

1.**작업 실행** — 사용자가 지정한 기능·수정 작업을 수행

2.**테스트 검증** — 해당 작업이 의도대로 동작하는지 확인 (단위·통합·E2E·수동 — 작업 성격에 맞게)

3.**작업 로그 기록** — `docs/tasks/YYYY-MM-DD-<작업명>.md`에 다음 항목 작성:

   -**목표** — 이 작업으로 달성하려 한 것

   -**만든 것** — 추가한 기능·파일 목록

   -**한 일** — 구체 변경 사항 (파일·라인·결정 근거)

   -**테스트 결과** — 통과·실패·수동 검증 내용

   -**다음에 할 것** (선택) — 후속 작업 메모

## 절대 깨지면 안 되는 것

- **ADR-020 Pattern B (★★★)**: 서버가 `menu_id`·`quantity`·`coupon`만 받아 가격 *자체* 계산. 클라가 total 보내도 무시 후 재계산. 회귀: `server/domain/__tests__/pricing.test.js` 13 케이스 (★★★ 4 + 추가 9).
- **ADR-019 변경 (2026-05-14)**: 쿠폰 학번 정규식 = `^\d{2}\d{2}37\d{3}$` (9자리, 5–6번째 자리가 `37` = 컴퓨터모바일융합과). *옛 표기 `prefix 202637`은 폐기* — 2026년 입학생 외 동학과 다른 학년도 통과. 회귀: `server/domain/__tests__/coupon.test.js` 12 케이스.
- **ADR-021**: 모든 주문에 학번+이름 필수. 외부인은 "학번 없음" 체크박스 + 이름만 + external_token. used_coupons UNIQUE(student_id, name).
- **ADR-025**: 주문 상태 13 합법 전이 + 5 불법 거부. 회귀: `server/domain/__tests__/order-state.test.js` 18 케이스.
- **G13 영업 상태 머신**: business_state OPEN/CLOSED 2-state, 단일 행 (CHECK id=1). 정산 마감 시 자동 CLOSED. 회귀: `server/domain/__tests__/business-state.test.js` 11 케이스.
- **ADR-012**: 정산 마감은 *진행 주문 0건일 때만* (강제 마감 X). 회귀: `server/domain/__tests__/settlement.test.js`.
- **ADR-023**: 운영은 Docker compose + named volume `chickenedak-data`. PIN은 첫 부팅 시 stdout 출력.
- **ADR-024 변경 (2026-05-14)**: 프론트엔드는 *React 18 SPA*. EJS+Alpine 후보 폐기.
- **§3.5 React 가이드 8조**: 페이지 ≤120줄 · Zustand 셀렉터 강제 · `useState(() => ...)` 초기화 패턴 · barrel import 차단 · axe-core dev-only. 회귀: `src/__tests__/appendix-d.test.js` 5 케이스.

## 도구

| 단계              | skill                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| 기획 검토         | gstack `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`   |
| 구현 계획         | `superpowers:writing-plans`                                                                   |
| 구현 실행         | `superpowers:subagent-driven-development` (권장) 또는 `:executing-plans`                    |
| TDD·디버깅·리뷰 | `superpowers:test-driven-development`, `:systematic-debugging`, `:requesting-code-review` |

## 상세는 docs/

### 구현 산출물 (완료)

- `IMPLEMENTATION_PLAN.md` — 8 Phase / 52 task (모두 ✅ 2026-05-14 완료)
- `IMPLEMENTATION_PROGRESS.md` — 31 작업 로그 매트릭스 (커밋 SHA 포함)
- `tasks/2026-05-14-task-*.md` — 작업별 상세 (31개)

### 결정·기획

- `DECISIONS.md` — ADR 1~26 + 누적 결정 12+건 (ADR-019/022/024 변경 포함)
- `ARCHITECTURE.md` / `API_DRAFT.md` / `DB_DRAFT.md` / `TEST_PLAN.md`
- `DESIGN.md` / `UX_STRATEGY.md` / `SCREEN_STRUCTURE.md` / `COMPONENT_GUIDE.md` / `DESIGN_REVIEW.md`
- `order-system-plan.md` — 7차 기획서 (전체 SoT)
- `design-bundle/` — Claude Design React JSX 시안 (변환 베이스, 보존)

### 운영 자산 ★ (D-1 / 운영 당일 필독)

- `operations/admin-card.md` — 본부 한 장 인쇄 운영 카드 (가동·운영·정산·비상)
- `operations/d1-rehearsal.md` — 5/19 리허설 10 섹션 체크리스트

**우선순위:** 사용자 지시 > 이 CLAUDE.md > skill > 기본 시스템 동작.

# 개발 필수 지침

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

[](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md#1-think-before-coding)

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

* State your assumptions explicitly. If uncertain, ask.
* If multiple interpretations exist, present them - don't pick silently.
* If a simpler approach exists, say so. Push back when warranted.
* If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

[](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md#2-simplicity-first)

**Minimum code that solves the problem. Nothing speculative.**

* No features beyond what was asked.
* No abstractions for single-use code.
* No "flexibility" or "configurability" that wasn't requested.
* No error handling for impossible scenarios.
* If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

[](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md#3-surgical-changes)

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

* Don't "improve" adjacent code, comments, or formatting.
* Don't refactor things that aren't broken.
* Match existing style, even if you'd do it differently.
* If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

* Remove imports/variables/functions that YOUR changes made unused.
* Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

[](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md#4-goal-driven-execution)

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

* "Add validation" → "Write tests for invalid inputs, then make them pass"
* "Fix the bug" → "Write a test that reproduces it, then make it pass"
* "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
