# Codex 리뷰 수정 계획 — P0/P1/P2 자동 수정

작성일: 2026-05-15
실행 모드: Superpowers subagent-driven-development + TDD (자동)
대상: `docs/codex리뷰결과.md` 의 P0 5건 · P1 6건 · P2 3건

## 0. 진행 원칙

1. 항목마다 **실제 코드/문서 기준 재검증** → 진짜 버그 여부 확인.
2. production code 수정 전 **실패 테스트 먼저 작성** (TDD).
3. 패치 후 테스트 통과 → 명세 정합/품질 리뷰.
4. 보안·정합성·가격·권한은 **서버 기준 재계산/검증**. 클라 값 신뢰 금지.
5. 단순 우회·테스트 삭제·기능 제거 금지.
6. 자동 수정이 위험한 항목은 BLOCKED로 기록하고 다음으로 진행.
7. 항목 단위 1 커밋 (한국어 메시지).
8. 전체 종료 후 `npm test` + `npm run build` 통과 + summary 작성.

## 1. 사전 검증 — 코드 ↔ 리뷰 매칭 결과

| 리뷰 항목 | 코드 검증 | 결론 |
|---|---|---|
| P0-1 Docker 정적 서빙 | `server/app.js`에 `express.static` X | **버그 확정** |
| P0-2 SSE 미구현 | `useOrderPolling` 으로 fallback (0900068 커밋) | **이미 폴링으로 대응 — 문서 정합만 남음** |
| P0-3 쿠폰 위변조 | `consumeCoupon` 호출이 `student_id && !is_external` 가드 안 | **버그 확정** (할인은 적용, 기록 누락) |
| P0-4 주문 상세 무인증 | `GET /api/orders/:id` 인증 X + `external_token` 응답 | **버그 확정** |
| P0-5 CLOSED GET 통과 | 미들웨어 GET 통과, 프론트는 423 발생 시 /closed redirect (POST 만) | **부분 문제 — SPA 가드 보강 필요** |
| P1-1 E2E 실패 | `tests/smoke.spec.js`는 1개. 로컬 dev server 미기동 시 타임아웃 | **환경 의존 — 명령 수정** |
| P1-2 admin card 매핑 | `AdminCardColumn`이 `order.depositorName` 읽음. 서버는 `depositor_name`/`name` | **버그 확정** |
| P1-3 정산 보조 누락 | 통장합계/차이/쿠폰 요약 X | **누락 확정** |
| P1-4 메뉴 CRUD | 가격 편집 UI X. 서버는 `base_price` patch 가능 | **누락 확정** |
| P1-5 PII 자동삭제 | 일회성 서비스이므로 수동 폐기 절차 문서화로 충분 | **운영 가이드 보강** |
| P1-6 CSRF | 관리자 mutation API에 토큰 검증 X | **누락 확정** |
| P2-1 README 불일치 | EJS+Alpine 옛 표기 | **문서 갱신** |
| P2-2 react-hook-form | 실제 미채택 | **계획 문서 갱신** |
| P2-3 canvas 경고 | jsdom 미지원 | **테스트 setup 보강** |

## 2. 수정 작업 순서

### P0-1. Express dist 정적 서빙 + SPA fallback

**파일:**
- 수정: `server/app.js`
- 수정: `Dockerfile` (필요 시 path 환경변수)
- 신규 테스트: `server/__tests__/static-spa.test.js`

**TDD 단계:**
1. supertest로 `GET /` → 200 + HTML 응답, `GET /menu` → 200 HTML, `GET /api/menus` → JSON 유지 검증하는 실패 테스트 작성.
2. `server/app.js`에 `DIST_PATH` 환경변수 (기본 `./dist`) → `express.static(DIST_PATH)` + `app.get('*', ...)` SPA fallback 추가.
3. fallback은 API/admin/healthz 경로 제외.
4. dist 디렉토리 없으면 fallback skip (테스트 환경).

### P0-2. SSE 정책 정합 (문서 갱신)

**파일:**
- 수정: `docs/FEATURE_LIST.md` F-S-010/011 (폴링 fallback로 변경, SSE는 Phase 2)
- 수정: `docs/DECISIONS.md` ADR 추가 또는 ADR-015 변경 기록

**작업:**
- 별도 테스트 추가 없음 (이미 `useOrderPolling.test.jsx` 존재).
- F-S-010/011을 "5초 폴링 fallback (ADR-015 변경 2026-05-15)"로 갱신.

### P0-3. 쿠폰 할인 위변조 방어

**파일:**
- 수정: `server/routes/customer.js`
- 신규 테스트: `server/routes/__tests__/customer.test.js` 케이스 추가

**TDD 단계:**
1. 실패 테스트: `coupon.used=true` + `is_external=true` → 400 또는 할인 X. 
2. 실패 테스트: `coupon.used=true` + `student_id=null` → 400.
3. 실패 테스트: `coupon.used=true` + invalid student_id → 400 (validateCoupon 호출).
4. customer.js에서 `input.coupon?.used`가 true면 가격 계산 전 `validateCoupon` 호출. 외부인이거나 학번 없으면 `CouponError('COUPON_REQUIRES_STUDENT')`로 거부.
5. 검증 통과 후 가격 계산 + consumeCoupon. 트랜잭션으로 묶음.

### P0-4. 주문 상세 인증 + external_token 보호

**파일:**
- 수정: `server/routes/customer.js`
- 신규 테스트: `server/routes/__tests__/customer.test.js` 케이스 추가

**TDD 단계:**
1. 실패 테스트: 학생 주문에 학번+이름 없이 `GET /api/orders/:id` → 401.
2. 실패 테스트: 외부인 주문에 잘못된 token으로 조회 → 403.
3. 실패 테스트: 응답에 `external_token`이 *조회한 본인*이 외부인인 경우에만 포함.
4. customer.js: query param `?student_id=&name=` 또는 `?token=` 검증. 미일치 시 401/403.
5. serializeOrder에서 인증 컨텍스트별로 `external_token` 필터링.
6. 기존 `GET /api/orders/:id`만 사용하는 호출자 검토 (useOrderPolling은 token query를 이미 보냄).

### P0-5. CLOSED GET 정책 정합 — SPA 가드 보강

**현재 정책:** 백엔드는 GET 통과(이미 6/11 테스트가 기대). SPA는 423 catch 시 /closed.
**리뷰 지적:** 사용자가 직접 /menu URL 진입 시 CLOSED여도 메뉴가 보임.

**파일:**
- 수정: `src/components/layouts/CustomerLayout.jsx` 또는 신규 가드 컴포넌트
- 신규 테스트: layout 테스트

**TDD 단계:**
1. 실패 테스트: businessState=CLOSED + pathname=/menu → /closed로 navigate.
2. CustomerLayout에 useBusinessStateStore 구독 + 진행 중 주문 페이지 제외하고 status==='CLOSED' 시 redirect.
3. 마운트 시 `/api/business-state` fetch (이미 dashboard sync 패턴 있음 — 3da61a6 커밋 참조).
4. `/closed` 자체는 예외.

### P1-1. E2E smoke 통과

**파일:**
- 수정: `playwright.config.js` (또는 npm script) — `webServer` 단계에서 백엔드 같이 띄우거나 dev에서 mock.
- 수정: `tests/smoke.spec.js`

**TDD 단계:**
1. smoke.spec 실패 원인 확인 → goto('/')가 React 빌드에서 API call 의존 시 타임아웃.
2. webServer 설정에 backend(server.js)도 launch 또는 npm 스크립트 `dev:full` 정의.
3. smoke를 백엔드까지 같이 돌면 통과해야.

### P1-2. 관리자 카드 필드 매핑

**파일:**
- 수정: `src/components/organisms/AdminCardColumn.jsx`
- 신규 테스트: `src/components/organisms/__tests__/AdminCardColumn.test.jsx` 추가 케이스

**TDD 단계:**
1. 실패 테스트: order.depositor_name 또는 order.name + 금액(total_price) 표시 검증.
2. AdminCardColumn에서 `order.depositor_name ?? order.name`, `order.total_price` 표시.

### P1-3. 정산 보조 — 통장 합계/차이/쿠폰 요약

**파일:**
- 수정: `server/domain/settlement.js` (summary에 coupon_count, coupon_discount 추가)
- 수정: `src/pages/admin/SettlementPage.jsx` (통장 합계 입력 + 차이 + 쿠폰 요약)
- 테스트: 도메인/페이지 테스트 추가

**TDD 단계:**
1. 도메인 테스트: getSettlementSummary가 coupon_count, coupon_discount_total 반환.
2. 페이지 테스트: 통장 합계 입력 → 매출 - 합계 = 차이 표시. 쿠폰 N건 표시.

### P1-4. 메뉴 CRUD — 가격 편집 UI

**파일:**
- 수정: `src/pages/admin/MenuAdminPage.jsx`
- 테스트: 가격 변경 → toggle API 호출 검증

**TDD 단계:**
1. 가격 편집 input 추가 (수정 모드 토글). Save 시 `base_price` patch.
2. 이름/분류/이미지 편집은 일회성 운영에서 불필요 → BLOCKED로 기록.

### P1-5. PII 자동 삭제 정책 — 운영 가이드

**파일:**
- 신규: `docs/operations/pii-deletion.md` (수동 폐기 절차)
- 수정: `docs/operations/admin-card.md` (정산 후 7일 내 데이터 삭제 안내)
- 수정: `docs/DECISIONS.md` (ADR 추가)

**작업:** 일회성 서비스이므로 cron job 대신 운영 절차 + ZIP 보관 + DB 삭제 명령 문서화.

### P1-6. CSRF 토큰

**파일:**
- 신규: `server/middleware/csrf.js`
- 수정: `server/app.js` + `server/routes/admin.js`
- 수정: `src/api/client.js` (X-CSRF-Token 헤더)
- 신규 테스트

**TDD 단계:**
1. GET /admin/api/csrf-token → 토큰 발급 + 쿠키.
2. POST /admin/api/* mutation에 X-CSRF-Token 누락 → 403.
3. 토큰 일치 시 통과.
4. SameSite=lax + double-submit cookie 패턴.

### P2-1. README

**파일:** `README.md`

EJS+Alpine → React 18 SPA + Vite + Express + better-sqlite3 표기 갱신.

### P2-2. react-hook-form 문서

**파일:** `docs/IMPLEMENTATION_PLAN.md` 또는 `docs/DECISIONS.md`

폼 라이브러리 미채택 결정 추가 (controlled inputs로 충분).

### P2-3. canvas 경고

**파일:** `src/__tests__/setup.js`

HTMLCanvasElement.getContext mock 추가하여 axe-core 색대비 검사 우회.

## 3. 자동 수정 종료 조건

- 각 항목 수정 후 관련 테스트 통과 확인.
- 마지막에 `npm test` 전체 통과.
- `npm run build` 성공.
- `docs/CODEX_REVIEW_FIX_SUMMARY.md` 작성.

## 4. BLOCKED 처리 기준

다음 조건 충족 시 BLOCKED 기록 후 다음으로 진행:
- API 계약 변경이 진행 중 주문 흐름을 깨고 fallback 미존재
- 테스트 작성이 5분 이내 불가하고 운영 안전성에 직결되지 않음
- 사용자 결정이 필요한 정책 (예: 이름/분류 변경 UI 형태)
