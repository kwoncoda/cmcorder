# Codex find_error_v2 최종 게이트 리뷰

## 1. 최종 판단

**조건부 병합 가능**입니다.

코드 기준으로 이전 Codex 리뷰의 P2/P3 보완사항은 반영됐고, 주문/정산/관리자 핵심 운영을 막는 새 P0/P1 이슈는 확인되지 않았습니다. 다만 이번 로컬 게이트에서 `npm test -- --run --reporter=dot` 전체 테스트가 1회 실패했습니다. 실패 지점은 find_error_v2 변경 경로가 아니라 `CompletePage.jsx`의 지연 `setState`가 테스트 환경 teardown 이후 실행된 비동기 테스트 안정성 문제로 보입니다.

따라서 main 병합 전 조건은 다음입니다.

- CI 또는 로컬에서 전체 `npm test -- --run`이 clean pass인지 재확인하거나, `CompletePage` 타이머 정리 이슈를 별도 수정한다.
- 기존 운영 DB 복제본에서 `003-order-events` migration과 관리자 내역/쿠폰 탭 smoke test를 수행한다.
- 모바일 관리자 nav와 쿠폰 탭 화면을 실기기로 확인한다.

## 2. P0/P1 이슈

**없음.**

| 심각도 | 파일/위치 | 문제 | 근거 | 영향 | Claude 수정 지시 |
|---|---|---|---|---|---|
| 없음 | - | 주문 생성, 쿠폰 검증, 이체 요청, 관리자 내역/쿠폰, 대시보드 상태 변경에서 P0/P1 결함은 확인되지 않음 | 핵심 코드 및 find_error_v2 대상 테스트 묶음 통과 | - | - |

## 3. P2/P3 이슈

| 심각도 | 병합 전 필수 여부 | 파일/위치 | 문제 | 근거 | 권장 처리 |
|---|---|---|---|---|---|
| P2 | 병합 전 필수 | `src/pages/customer/CompletePage.jsx:59`, `src/pages/customer/__tests__/CompletePage.test.jsx` | 전체 테스트 명령이 teardown 이후 타이머 `setState`로 실패 | `npm test -- --run --reporter=dot` 실행 중 `ReferenceError: window is not defined`, 격리 실행은 통과 | CI에서 전체 테스트 clean pass를 확인하거나, 복사 성공 후 `setTimeout` cleanup을 별도 수정 |
| P3 | 병합 전 수동 QA | `src/components/layouts/AdminLayout.jsx`, `src/styles/components.css` | 관리자 6탭 nav는 모바일 전용 wrapping/overflow 보정이 없음 | `.admin-topnav`/`.nav`가 고정 flex 구조 | 실기기에서 심각한 잘림이 있으면 반응형 nav 보완 |
| P3 | 병합 후 가능 | `docs/ARCHITECTURE.md`, `docs/TEST_PLAN.md`, `docs/API_DRAFT.md` 일부 historical 문구 | `prefix 202637`, `COUPON_PREFIX` 같은 과거 흔적이 남아 있음 | `docs/DECISIONS.md`가 현행 정책을 canonical로 선언했지만 오래된 문서 검색 결과는 남음 | 개발 문서 정비 이슈로 추적. 현행 구현/ADR/API_DRAFT 핵심 표기는 정리됨 |
| P3 | 병합 후 가능 | `src/pages/admin/HistoryPage.jsx` | design-bundle의 검색/필터/CSV/시스템·메뉴 로그는 미구현 | v2 최소 범위는 주문 상태 로그 | 운영 후 필요하면 Phase 2로 확장 |

## 4. Git/커밋 상태 확인

- 현재 브랜치: `find_error_v2`
- 최신 커밋: `d1d8819 feat(find_error_v2): 13 수정사항 + Codex P2 보완`
- working tree clean 여부: 리뷰 문서 작성 전 기준 clean. `git status --short`는 항목 없이 global ignore 접근 경고만 출력됨.
- `main...HEAD` diff: 존재함. `45 files changed, 3244 insertions(+), 255 deletions(-)`.
- 신규 파일 커밋 포함 여부: 포함됨.
  - `server/repositories/order-events-repo.js`
  - `server/repositories/__tests__/order-events-repo.test.js`
  - `src/pages/admin/HistoryPage.jsx`
  - `src/pages/admin/CouponsPage.jsx`
  - `src/pages/admin/__tests__/HistoryPage.test.jsx`
  - `src/pages/admin/__tests__/CouponsPage.test.jsx`
  - `docs/find_error_v2_development_plan.md`
  - `docs/find_error_v2_work_instruction.md`
  - `docs/find_error_v2_qa_plan.md`
  - `codereview/codex_find_error_v2_review.md`
- 비밀 파일/빌드 산출물 포함 여부: `git diff main...HEAD --name-only` 기준 `.env`, `node_modules`, `dist`, sqlite DB, session/secret/password/key 파일은 포함되지 않음.

## 5. 이전 Codex 보완사항 해결 여부

| 항목 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 |
|---|---|---|---|
| P2-1. `TRANSFER_ALREADY_REPORTED` 안내 문구 직접 표시 | 해결 | `src/pages/customer/TransferPage.jsx:48-54`, `src/pages/customer/StatusPage.jsx:42-80`, `src/pages/customer/__tests__/TransferPage.test.jsx`, `src/pages/customer/__tests__/StatusPage.test.jsx` | 없음. status로 이동하며 `location.state`로 1회성 flash 표시 후 history state를 `replace`로 정리함 |
| P2-1. 내부 “불법 상태 전이” 미노출 및 DB 미변경 | 해결 | `server/routes/customer.js:222-230`, `server/routes/__tests__/customer.test.js:664-815` | 없음. 중복 제출은 409 `TRANSFER_ALREADY_REPORTED`, DB row와 이벤트 로그 미변경 테스트 있음 |
| P2-2. non-external 빈 `student_id` 거부 | 해결 | `server/routes/customer.js:42-60`, `server/routes/__tests__/customer.test.js:357-413` | 없음. 누락/빈 문자열/null 모두 400, 9자리 학생 주문은 200, 외부인 null은 200 |
| P2-2. 주문 검증과 쿠폰 검증 분리 유지 | 해결 | `src/pages/customer/CheckoutPage.jsx`, `server/routes/customer.js`, `server/domain/coupon.js` | 없음. 일반 주문은 9자리, 쿠폰은 `^\d{4}37\d{3}$` 계열 검증 |
| P2-3. CouponsPage 모바일 반응형 | 해결, 수동 QA 필요 | `src/pages/admin/CouponsPage.jsx:70-97`, `src/styles/components.css`의 `.coupon-usage-row` media query, `src/pages/admin/__tests__/CouponsPage.test.jsx:88-100` | 자동 테스트는 CSS hook 확인 수준이므로 모바일 실기기 확인 필요 |
| P2-4. ADR-019 / API_DRAFT 문서 정비 | 대부분 해결 | `docs/DECISIONS.md:474-492`, `docs/API_DRAFT.md:52-60` | 오래된 `ARCHITECTURE.md`/`TEST_PLAN.md` historical 문구는 병합 후 정리 가능 |

## 6. DB/마이그레이션 리뷰

`order_events` migration은 운영 DB에 안전하게 적용되는 구조입니다.

- `server/db/init.sql`과 `server/db/bootstrap.js` 모두 `order_events` 테이블 및 `idx_order_events_order_id`, `idx_order_events_created_at` 인덱스를 정의합니다.
- bootstrap migration `003-order-events`는 `CREATE TABLE IF NOT EXISTS`와 `CREATE INDEX IF NOT EXISTS`를 사용합니다.
- 기존 DB는 `_migrations`에 `003-order-events`가 없으면 테이블/인덱스를 생성하고 migration row를 기록합니다.
- 신규 DB는 `init.sql`에서 먼저 테이블이 생기고, post-init migration은 no-op DDL 후 migration row만 기록하는 구조라 중복 생성 위험이 낮습니다.
- 주문 생성, 사용자 이체 완료 요청, 관리자 상태 변경 로그는 repository transaction 안에서 상태 변경과 같이 기록됩니다.
- 기존 주문은 과거 `order_events`가 없을 수 있지만, History API는 빈 배열을 반환하고 `HistoryPage`는 빈 상태를 처리합니다.

확인 필요:

- 운영 DB 복제본에서 실제 bootstrap 실행 후 `_migrations`에 `003-order-events`가 들어가는지 확인해야 합니다.
- 운영 DB에 `_migrations` row만 있고 실제 테이블이 없는 비정상 상태는 자동 복구하지 않습니다. 일반 경로에서는 낮은 가능성이지만, 병합 전 smoke test로 충분히 걸러야 합니다.

권장 smoke:

```bash
npm run build
npm run lint
npm test -- --run server/routes/__tests__/customer.test.js server/routes/__tests__/admin.test.js server/repositories/__tests__/order-events-repo.test.js
```

운영 DB는 직접 열지 말고 복제본 또는 dev 볼륨에서 확인하세요.

## 7. 관리자 내역/쿠폰/대시보드 리뷰

관리자 내역 탭:

- `/admin/history` 라우트와 nav가 추가됐습니다.
- `GET /admin/api/history`는 `/admin/api` 공통 `requireAdmin` 뒤에 있어 인증을 요구합니다.
- 주문 생성, 사용자 이체 완료 요청, 관리자 상태 변경 이벤트가 `order_events`에 기록됩니다.
- `HistoryPage`는 로딩/에러/401/빈 상태를 처리합니다.
- 운영 관점에서 최소 항목인 시간, 주문번호, 변경 전/후 상태, 액션명, actor는 확인 가능합니다.

관리자 쿠폰 탭:

- `/admin/coupons` 라우트와 nav가 추가됐습니다.
- `GET /admin/api/coupons/usage`는 `used_coupons JOIN orders`로 쿠폰 사용 주문만 조회합니다.
- 쿠폰 미사용 주문은 `used_coupons`에 row가 없으므로 표시되지 않습니다.
- 사용 시간, 주문번호, 이름, 학번, 쿠폰명, 할인 금액이 표시됩니다.
- 모바일은 `.coupon-usage-row` 2열 반응형 구조로 보완됐지만, 실제 좁은 화면에서 확인해야 합니다.

관리자 대시보드:

- 주문 카드에 주문 항목이 표시되고, 3개 초과는 “외 n개”로 축약됩니다.
- 카드 전체 클릭 상세 이동은 제거됐고 액션 버튼만 동작합니다.
- HOLD 액션 라벨은 “이체 확인”입니다.
- `elapsedMinutes`는 0 미만으로 내려가지 않습니다.
- 주문 없음 상태에서도 6개 상태 컬럼이 유지됩니다.

남은 운영 확인:

- 관리자 6탭 nav는 모바일에서 가로폭이 부족할 수 있습니다. 현장 운영자가 휴대폰으로 관리자 페이지를 쓸 가능성이 있으면 실기기 QA가 필요합니다.

## 8. 사용자 주문/쿠폰/이체 UX 리뷰

주문/쿠폰:

- 프론트와 백엔드 모두 학생 주문의 기본 조건을 숫자 9자리로 둡니다.
- 쿠폰 사용 가능 조건은 `^\d{4}37\d{3}$`와 동치인 `^\d{2}\d{2}37\d{3}$`입니다.
- `202111123` 같은 non-37 9자리 학번은 쿠폰 없이 일반 주문 가능해야 하며, 코드와 테스트가 이를 보장합니다.
- `is_external=false`인데 `student_id`가 누락/빈 문자열/null이면 400입니다.
- `is_external=true` 외부인 흐름은 학번 없이 주문 가능합니다.

이체 UX:

- `ORDERED → TRANSFER_REPORTED` 정상 경로는 유지됩니다.
- `TRANSFER_REPORTED` 중복 제출은 서버에서 DB 변경 없이 409 `TRANSFER_ALREADY_REPORTED`를 반환합니다.
- 프론트는 status 페이지로 이동하면서 지정 안내 문구를 `status-flash`로 표시합니다.
- status 페이지는 history state를 `replace`로 정리하므로 새로고침/뒤로가기에서 같은 flash가 반복될 가능성은 낮습니다.
- `PAID/COOKING/READY/DONE/CANCELED/HOLD`는 여전히 사용자 재요청이 막힙니다.

## 9. 테스트 리뷰

직접 실행 결과:

- `npm run lint`: 통과, 0 errors / 3 warnings.
- `npm run build`: 통과.
- find_error_v2 핵심 변경 테스트 묶음: 통과.
  - `server/routes/__tests__/customer.test.js`
  - `server/routes/__tests__/admin.test.js`
  - `server/repositories/__tests__/order-events-repo.test.js`
  - `src/pages/customer/__tests__/TransferPage.test.jsx`
  - `src/pages/customer/__tests__/StatusPage.test.jsx`
  - `src/pages/customer/__tests__/CheckoutPage.test.jsx`
  - `src/pages/admin/__tests__/CouponsPage.test.jsx`
  - `src/pages/admin/__tests__/HistoryPage.test.jsx`
  - `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
  - `src/pages/admin/__tests__/DashboardPage.test.jsx`
- `src/pages/customer/__tests__/CompletePage.test.jsx` 단일 실행: 통과.
- 전체 `npm test -- --run --reporter=dot`: 실패.

전체 테스트 실패 근거:

- 실패: `ReferenceError: window is not defined`
- 위치: `src/pages/customer/CompletePage.jsx:59`
- 원인 추정: 복사 성공 후 `setTimeout(() => setCopyState('idle'), 2000)`이 테스트 환경 teardown 이후 실행되며 React state update 발생.
- 영향: find_error_v2 기능 회귀라기보다는 전체 테스트 신뢰성/병렬 실행 안정성 문제입니다. 그래도 병합 게이트에서는 전체 테스트 clean pass 확인이 필요합니다.

lint warning 3개:

- `src/components/ErrorBoundary.jsx`
- `src/hooks/useApi.js`
- `src/hooks/useGlobalErrorHandler.js`

세 warning 모두 unused eslint-disable 계열이며 이번 find_error_v2 변경으로 새로 생긴 핵심 오류는 아닙니다.

부족한 테스트:

- 쿠폰 탭 모바일은 CSS class hook만 검증하고 실제 viewport layout은 자동 검증하지 않습니다.
- 관리자 6탭 nav 모바일 overflow는 자동 테스트가 없습니다.
- 전체 테스트의 `CompletePage` timer cleanup 문제는 별도 회귀 테스트 또는 fake timer cleanup이 필요합니다.

## 10. main 병합 전 수동 QA 체크리스트

- [ ] 기존 DB에서 `order_events` migration 적용 확인
- [ ] `_migrations`에 `003-order-events` 기록 확인
- [ ] 주문 생성 후 관리자 내역 탭에 `주문 접수` 로그 표시
- [ ] 이체 완료 요청 후 관리자 내역 탭에 `이체 완료 요청` 로그 표시
- [ ] 관리자 상태 변경 후 내역 탭에 전/후 상태와 actor 표시
- [ ] `202111123` 일반 주문 가능
- [ ] `202637123` 쿠폰 주문 가능
- [ ] 쿠폰 미대상 9자리 학번은 일반 주문 가능하고 쿠폰 할인 미적용
- [ ] `is_external=false` + `student_id` 누락 학생 주문 거부
- [ ] `is_external=false` + `student_id=""` 학생 주문 거부
- [ ] `is_external=false` + `student_id=null` 학생 주문 거부
- [ ] `is_external=true` + `student_id` 없음 외부인 주문 가능
- [ ] 중복 이체 완료 요청 안내 문구 표시
- [ ] 중복 이체 완료 요청 시 내부 에러 “불법 상태 전이” 미노출
- [ ] 중복 이체 완료 요청 후 DB 상태/입금정보/timestamp 미변경
- [ ] 관리자 쿠폰 탭 사용 내역 표시
- [ ] 쿠폰 미사용 주문이 쿠폰 탭에 표시되지 않음
- [ ] 쿠폰 탭 모바일 화면 확인
- [ ] 관리자 6탭 nav 모바일 화면 확인
- [ ] 주문 없음 상태에서 6컬럼 유지
- [ ] 카드 클릭 상세 이동 없음
- [ ] 상태 변경 버튼 정상 동작
- [ ] 전체 `npm test -- --run` clean pass 재확인 또는 `CompletePage` timer issue 별도 처리

## 11. 결론

- main 병합 가능 여부: **조건부 병합 가능**.
- 병합 전 반드시 해야 할 것:
  - 전체 테스트 명령의 clean pass를 CI 또는 로컬에서 확보한다.
  - 기존 DB 복제본으로 `order_events` migration smoke test를 수행한다.
  - 쿠폰 탭과 관리자 6탭 nav 모바일 화면을 확인한다.
- 병합 후 추적할 것:
  - `CompletePage` 복사 성공 타이머 cleanup / 테스트 안정성 개선.
  - `docs/ARCHITECTURE.md`, `docs/TEST_PLAN.md` 등에 남은 과거 `prefix 202637`/`COUPON_PREFIX` 문구 정리.
  - 관리자 내역 탭의 검색/필터/CSV/메뉴·시스템 로그 확장 여부.

실제 소스코드는 수정하지 않았고, 이 최종 게이트 리뷰 문서만 추가했습니다.
