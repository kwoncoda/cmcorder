# 프로젝트 작업 규칙

학교 축제 부스용 모바일 웹 주문 시스템 ("오늘 저녁은 치킨이닭!"). D-day 2026-05-20.

**현재 단계:** 구현 완료 (2026-05-14). React 18 + Vite + Express 4 + SQLite. 1358/1358 tests passing (table_lock 라운드 2026-05-19 + Codex P1/P2 보완 + design_fix_v3 — minimap legend 삭제 + ALREADY_USED 가운데 모달). **D-1 리허설 5/19 → D-day 5/20 16:30 운영 시작**. 이후 작업은 *수정·패치·운영 가이드 보강* 단계.

## 명령 (★ docker 전용 — ADR-033)

**모든 dev·테스트·검증은 docker 컨테이너 안에서 실행한다. 호스트 `npm` 직접 호출 금지.**

배경: 2026-05-17 사고 — 호스트 `npm test` 1005/1005 통과 상태에서 prod 컨테이너만 CLOSED 가드가 정적 자산을 가로채는 거대 회귀가 들어감. host와 prod 환경 분리가 원인. 자세한 내용은 `docs/DECISIONS.md` ADR-033.

### dev/test 컨테이너 (`docker-compose.dev.yml`)
```bash
# 한 번만: dev 컨테이너 띄우기 (백그라운드 유지)
docker compose -f docker-compose.dev.yml up -d

# 이후 모든 명령은 exec 패턴
docker compose -f docker-compose.dev.yml exec dev npm test            # 단위·통합 (Vitest, 1009 케이스)
docker compose -f docker-compose.dev.yml exec dev npm run test:e2e    # Playwright smoke
docker compose -f docker-compose.dev.yml exec dev npm run dev         # Vite hot reload (호스트 :5173)
docker compose -f docker-compose.dev.yml exec dev npm run server:watch # Express 자동 재시작 (호스트 :3000)
docker compose -f docker-compose.dev.yml exec dev npm run build        # 프론트엔드 production 빌드 (dist/)
docker compose -f docker-compose.dev.yml exec dev npm run lint
docker compose -f docker-compose.dev.yml exec dev sh                   # 컨테이너 셸 진입

# 정리
docker compose -f docker-compose.dev.yml down
```

### 운영 컨테이너 (`docker-compose.yml`)
```bash
docker compose up -d                           # 운영 가동
docker compose build app && docker compose up -d  # 코드 변경 반영 (서버만 변경 시)
docker compose build --no-cache app && docker compose up -d  # 캐시 무시 풀빌드
docker compose logs -f                         # 로그 stream
docker compose restart                         # 재시작
docker compose exec app sh                     # prod 컨테이너 진입 (디버깅용)
```

## 규칙

- 자연어·주석·커밋 메시지·UI 카피는 **한국어**. 코드·명령어·고유명사는 원문.
- 모든 기획 문서는 `docs/`. 중요 결정은 `docs/DECISIONS.md`에 ADR로.
- 추가 기능·수정은 *작업 절차 4단계* (아래) 준수
- `server/domain/*`(백엔드 도메인)은 **TDD strict + 회귀 테스트 필수**. 다른 영역은 권장.
- 핵심 회귀 매트릭스(아래 "절대 깨지면 안 되는 것")는 *언제든 docker `npm test`로 검증 가능*해야 함.
- ★ **호스트 npm 직접 실행 금지** (ADR-033). `npm test`, `npm run dev` 등은 반드시 `docker compose -f docker-compose.dev.yml exec dev npm ...` 형태로.

## 작업 절차 (필수)

작업(task) 단위마다 *반드시* 다음 4단계 흐름을 지킨다:

1. **작업 실행** — 사용자가 지정한 기능·수정 작업을 수행

2. **테스트 검증 (★ docker 전용)** — 해당 작업이 의도대로 동작하는지 확인. 호스트 npm 직접 실행 금지 (ADR-033).
   - 단위·통합: `docker compose -f docker-compose.dev.yml exec dev npm test`
   - E2E: `docker compose -f docker-compose.dev.yml exec dev npm run test:e2e`
   - 운영 경로 HTTP 검증: `docker compose up -d --build` → `curl -sI http://localhost/<path>` (서버 미들웨어/nginx/정적 자산 회귀 캐치)
   - 수동 시각: `docker compose -f docker-compose.dev.yml exec dev npm run dev` → 브라우저 http://localhost:5173

3. **작업 로그 기록** — `docs/tasks/YYYY-MM-DD-<작업명>.md`에 다음 항목 작성:

   - **목표** — 이 작업으로 달성하려 한 것
   - **만든 것** — 추가한 기능·파일 목록
   - **한 일** — 구체 변경 사항 (파일·라인·결정 근거)
   - **테스트 결과** — 통과·실패·수동 검증 내용 (docker 명령 + 결과)
   - **다음에 할 것** (선택) — 후속 작업 메모

4. **운영 경로 사이드체크 (정적 자산·미들웨어·nginx 영향 시 필수)** — 단위 통과만으로 안전 가정 X. ADR-033 사고 재발 방지:
   - 서버 미들웨어 / 정적 자산 / nginx 설정 변경 시 → `docker compose build app && docker compose up -d` 후 운영 컨테이너에 직접 `curl -sI` 로 응답 코드·헤더 검증.
   - CLOSED 상태 가드는 정적 자산 화이트리스트(extension 기반)를 우회하므로 새 자산 prefix 추가 시 `business-state.test.js` 회귀 한 줄 추가.

## 절대 깨지면 안 되는 것

- **ADR-020 Pattern B (★★★)**: 서버가 `menu_id`·`quantity`·`coupon`만 받아 가격 *자체* 계산. 클라가 total 보내도 무시 후 재계산. 회귀: `server/domain/__tests__/pricing.test.js` 13 케이스 (★★★ 4 + 추가 9).
- **ADR-019 변경 (2026-05-14)**: 쿠폰 학번 정규식 = `^\d{2}\d{2}37\d{3}$` (9자리, 5–6번째 자리가 `37` = 컴퓨터모바일융합과). *옛 표기 `prefix 202637`은 폐기* — 2026년 입학생 외 동학과 다른 학년도 통과. 회귀: `server/domain/__tests__/coupon.test.js` 12 케이스.
- **ADR-021**: 모든 주문에 학번+이름 필수. 외부인은 "학번 없음" 체크박스 + 이름만 + external_token.
- **ADR-034 변경 (2026-05-18, find_error_v3)**: `used_coupons` UNIQUE는 **`(student_id)` 단일** (이전 `(student_id, name)` 은 같은 학번/다른 이름으로 쿠폰 재사용 가능했던 P0 결함). 이름 달라도 학번 같으면 거부. 에러 메시지 `이미 쿠폰을 사용한 학번이에요.` (`ALREADY_USED`). 쿠폰 없는 일반 주문은 계속 성공. 회귀: `server/domain/__tests__/coupon.test.js` find_error_v3 5건 + `server/routes/__tests__/customer.test.js` 4건.
- **ADR-025**: 주문 상태 13 합법 전이 + 5 불법 거부. 회귀: `server/domain/__tests__/order-state.test.js` 18 케이스.
- **G13 영업 상태 머신**: business_state OPEN/CLOSED 2-state, 단일 행 (CHECK id=1). 정산 마감 시 자동 CLOSED. 회귀: `server/domain/__tests__/business-state.test.js` 11 케이스.
- **ADR-012**: 정산 마감은 *진행 주문 0건일 때만* (강제 마감 X). 회귀: `server/domain/__tests__/settlement.test.js`.
- **ADR-023**: 운영은 Docker compose + named volume `chickenedak-data`. PIN은 첫 부팅 시 stdout 출력.
- **ADR-024 변경 (2026-05-14)**: 프론트엔드는 *React 18 SPA*. EJS+Alpine 후보 폐기.
- **§3.5 React 가이드 8조**: 페이지 ≤120줄 · Zustand 셀렉터 강제 · `useState(() => ...)` 초기화 패턴 · barrel import 차단 · axe-core dev-only. 회귀: `src/__tests__/appendix-d.test.js` 5 케이스.
- **ADR-033 (2026-05-18)**: 검증·테스트·dev는 docker 환경에서만 실행. 호스트 `npm` 직접 호출 금지. CLOSED 가드가 정적 자산을 가로채던 거대 회귀가 host vitest 1005/1005 통과 상태에서 prod에 들어간 사고가 직접 계기. 정적 자산 화이트리스트 회귀: `server/middleware/__tests__/business-state.test.js` 16 케이스 (4 신규).
- **ADR-034 (2026-05-18, find_error_v3)**: `admin_events` 테이블 신설 + `GET /admin/api/history?type=all|orders|menus|system` 통합 API. 메뉴 toggle / 장사 시작 / 관리자 로그인 / 자동 백업 모두 admin_events에 기록 — `operating_date`는 모든 기록 지점에서 채워야 system 탭에 노출됨(Codex P1-2). 메뉴 toggle은 로그 INSERT와 단일 트랜잭션. type allowlist 외 값은 400. 빌드는 cross-platform: `"build": "cross-env NODE_ENV=production vite build"` (dev 컨테이너 `NODE_ENV=development`가 prod 번들 오염시키던 잠재 회귀 차단). `bundle.test.js` 통과 — production 번들에 axe-core 흔적 0. 회귀: `server/repositories/__tests__/admin-events-repo.test.js` 7건 + `server/routes/__tests__/admin.test.js` find_error_v3 30건.
- **table_lock 라운드 (2026-05-19)**: 새 흐름 `READY → DINING → SETTLED`. DONE은 dead status — 어떤 전이로도 진입 X. `table_locks` 테이블 + 어드민 잠금 페이지 (`/admin/tables`). 마이그레이션 `006-table-lock` (dining_at/settled_at/table_locks). 회귀: `server/domain/__tests__/table-availability.test.js`, `server/domain/__tests__/order-state.test.js` (메타: DONE이 LEGAL_TRANSITIONS 우변에 없음), `server/routes/__tests__/admin.test.js` 테이블 잠금/해제 + history?type=system(TABLE_LOCK/TABLE_UNLOCK) + READY→DINING→SETTLED 전이 이벤트 로깅.
- **design_fix_v3 라운드 (2026-05-19, 사용자 요청)**: ① BoothMinimapModal `.minimap-legend` 두 줄(`내 테이블: -(포장 또는 일반)`, `총 N개 테이블`) 삭제 — `totalTables` prop 은 fallback 격자 cap 용도로 계속 유효. ② `ALREADY_USED` 에러는 폼 아래 inline-field 대신 화면 가운데 `role="alertdialog"` 모달 팝업으로 노출 (마스코트 + 메시지 + 안내 + `쿠폰 사용 해제` / `닫기` 두 버튼 + Escape · backdrop 닫기 + body 스크롤 잠금 + 자동 포커스 + cleanup). `submitError` state 를 `{ message, code? }` 객체로 격상하되 `CheckoutPage.jsx ≤ 120줄` 유지. 회귀: `src/components/molecules/__tests__/CheckoutSubmitError.test.jsx` 12건 + `src/pages/customer/__tests__/CheckoutPage.test.jsx` ALREADY_USED 모달 3건 + `BoothMinimapModal.test.jsx` / `MapPage.test.jsx` legend 부재 검증 2건 교체.
- **adjustment 정산 리디자인 라운드 (2026-05-20)**: 정산 탭 3-box UI (정산 요약 / ZIP 백업 / 메뉴별 판매). 정산 ZIP은 한국어 3파일(`정산서-{날짜}.txt`, `주문내역-{날짜}.csv`, `쿠폰내역-{날짜}.csv`) — manifest/summary/menu-snapshot/settlement.sql 미포함. 정산서.txt 6섹션(요약·결제 검증·메뉴별 매출·카테고리·배달 형태·취소). 주문내역 CSV는 운영 컬럼만(`external_token`·`use_other_name`·`custom_bank`·`hold_reason` 제거). 메뉴별 판매 API `GET /admin/api/settlement/menu-sales`는 8행 고정·메뉴 ID 순·0건 메뉴 포함. 백업 다운로드 API `GET /admin/api/backups[/:name]`는 `auto-*.zip` 패턴 화이트리스트 + path traversal 5중 가드. 취소시각 = `updated_at` (status=CANCELED일 때만 해석). 회귀: `server/domain/__tests__/menu-sales.test.js` 10건 + `server/jobs/__tests__/auto-snapshot.test.js` 13건 + `server/routes/__tests__/admin.test.js` 16건(menu-sales 3 + backups 12 + zip 4) + UI 컴포넌트 30건.
- **adjustment Codex 후속 보강 (2026-05-20)**: ① **쿠폰 금액 NET/gross 분리** — `orders.total_price`는 `calculatePrice()`가 `subtotal − discount`로 저장하는 NET(★★★). `summary.gross_amount`(= NET + `coupon_discount_total` = 주문항목 단가 합계) 신규 필드. 정산서 [1] 「총 상품금액」 = gross, 「실수령 예상」 = `total_amount`(NET, 추가 차감 금지). UI / CSV / TXT 모두 같은 산식. CSV `주문금액 = total_price + couponDiscount`, `최종결제금액 = total_price`. ② **메뉴별 합계 ≡ gross_amount 정합성** — 정산서 [3] `합계 − 총 상품금액 = 차이` 정상 운영 시 0원. [5] 배달 형태별도 `order_items` JOIN(gross)로 [3][4]와 통일. ③ **쿠폰 집계 SETTLED+DONE 한정** — CANCELED/DINING 쿠폰은 정산 카운트 제외. ④ **백업 API symlink/realpath 가드** — `lstatSync(safe).isSymbolicLink()` 거부 + `realpathSync(root)/(safe)` prefix 재검증. 목록도 `lstatSync` + symlink/디렉터리 제외. ⑤ **CSV 「은행」 ← `custom_bank` 병합** — `bank='기타'` 또는 `custom_bank` 존재 시 `custom_bank` 노출. ⑥ **`?date` regex 검증** — `^\d{4}-\d{2}-\d{2}$` 외 400 INVALID_DATE (settlement/menu-sales/zip). zip은 `date=all`도 거부 (합산 ZIP 미지원). ⑦ **`?bank` 0 이상 정수 검증** — `Number.isInteger && >= 0` 외 400 VALIDATION_ERROR (음수·소수·문자). 회귀: `server/domain/__tests__/settlement.test.js` +5 + `server/jobs/__tests__/auto-snapshot.test.js` +7 + `server/routes/__tests__/admin.test.js` +19 (symlink 6 + date 6 + bank 7) + UI Summary +1. 전체 회귀 카운트 1358 → 1485 (+127, 본체 +95 + 후속 +32).

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
