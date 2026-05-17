# Codex find_error_v3 코드 리뷰

## 1. 최종 판단

**병합 보류**

근거:

- **확인됨**: 현재 브랜치는 `find_error_v3`이다.
- **확인됨**: `main...HEAD` 커밋 diff는 없고, 리뷰 대상 변경은 모두 working tree의 modified/untracked 파일이다.
- **확인됨**: 쿠폰 `student_id` 중복 방지는 DB 제약, 도메인 검증, 에러 문구, 일반 주문 분리 테스트까지 대체로 충족한다.
- **확인됨**: 관리자 내역/메뉴 효과/이체확인 nav 제거/문구 변경/UI 개선은 상당 부분 구현되었다.
- **병합 보류 사유**: P1이 2개 있다. Windows 호스트에서 `npm run build`가 즉시 실패하며, 관리자 로그인 로그는 저장되지만 현재 관리자 내역 API에서 조회되지 않는다.

## 2. P0/P1 이슈

P0은 없음.

| 심각도 | 파일/위치 | 문제 | 근거 | 영향 | Claude 수정 지시 |
|---|---|---|---|---|---|
| P1 | `package.json:9` | `build` 스크립트가 Windows/PowerShell에서 실행 불가 | **확인됨**: `"build": "NODE_ENV=production vite build"`. Windows 호스트에서 `npm run build` 실행 결과 `'NODE_ENV' is not recognized as an internal or external command`로 실패. | 사용자의 현재 환경이 Windows이므로 커밋 전/병합 전 build 게이트가 깨진다. Docker/Linux에서는 통과할 수 있으나 프로젝트 명령이 호스트에서 깨지는 상태다. | cross-platform 방식으로 바꿔라. 예: `cross-env NODE_ENV=production vite build`를 쓰고 devDependency를 추가하거나, `vite build`로 되돌린 뒤 dev 컨테이너의 `NODE_ENV=development` 오염 문제를 별도 코드/문서로 해결하라. 수정 후 Windows 호스트와 Docker 중 프로젝트가 지원하는 경로에서 build를 재검증하라. |
| P1 | `server/routes/admin.js:195-200`, `server/repositories/admin-events-repo.js:60-70` | 관리자 로그인 로그가 시스템 내역에 표시되지 않음 | **확인됨**: 로그인 성공 시 `ADMIN_LOGIN` 이벤트를 `operating_date` 없이 저장한다. **확인됨**: `listAdminEvents()`는 `operating_date = ?`로만 조회하며 `NULL operating_date`를 항상 제외한다고 주석과 테스트가 명시한다. **확인됨**: `GET /admin/api/history?type=system`은 `listAdminEvents()`를 통해 조회한다. | 사용자 결정사항은 "로그인 로그도 포함"인데, DB에는 쌓여도 관리자 내역의 시스템 탭에서 볼 수 없다. 실사용 QA의 시스템 로그 검수 항목을 통과하지 못한다. | 로그인 이벤트에도 현재 `business_state.operating_date`를 채우거나, 시스템 로그 조회에서 정책적으로 `ADMIN_LOGIN`의 `NULL operating_date`를 포함하라. 그 뒤 `POST /admin/login` 이후 `GET /admin/api/history?type=system&date=...`에서 `ADMIN_LOGIN`이 보이는 API 테스트를 추가하라. |

## 3. P2/P3 이슈

| 심각도 | 병합 전 필수 여부 | 파일/위치 | 문제 | 근거/영향 | 권장 조치 |
|---|---|---|---|---|---|
| P2 | 권장 | `src/components/molecules/StatusChip.jsx:20-26`, `src/components/organisms/AdminCardColumn.jsx:148`, `src/pages/admin/OrderDetailPage.jsx:68`, `src/pages/admin/TransfersPage.jsx:83`, `src/components/organisms/OrderTimeline.jsx:69` | 어드민 화면 이모지가 아직 남아 있음 | **확인됨**: 대시보드 카드, 주문 상세, 직접 접근 가능한 이체확인 페이지에서 `StatusChip` 이모지가 렌더링된다. 주문 상세의 `OrderTimeline` 미니뷰도 `✅/🔄/⏳`를 렌더링한다. 사용자 요청은 "어드민 페이지 안에 있는 이모지 모두 제거"였다. | `StatusChip`에 `showIcon={false}` 또는 admin variant를 추가하고 admin 화면에서만 이모지를 숨겨라. `OrderTimeline`도 admin 미니뷰에서 텍스트/도트 기반 표시로 바꾸는 방식을 권장한다. |
| P2 | 권장 | `server/routes/admin.js:383-415` | `GET /admin/api/history?type=...`의 type 파라미터 검증 없음 | **확인됨**: 허용값이 아닌 type은 주문/관리자 이벤트 모두 빈 배열로 200 응답한다. 리뷰 요구사항은 type 검증 여부 확인이었다. | `all/orders/menus/system` allowlist로 검증하고 잘못된 type은 400을 반환하라. |
| P2 | 권장 | `server/routes/admin.js:265-274` | 메뉴 변경과 로그 기록이 같은 트랜잭션으로 묶이지 않음 | **확인됨**: `toggleMenu()` 실행 후 `logMenuPatchEvents()`를 호출한다. 로그 INSERT 실패 시 메뉴 변경은 이미 반영됐는데 API는 에러로 끝날 수 있다. | 메뉴 변경과 로그 기록을 단일 트랜잭션으로 묶거나, 로그 실패가 핵심 액션을 깨뜨리지 않도록 명확한 정책을 정해 catch/log 처리하라. |
| P3 | 병합 후 가능 | `src/pages/admin/HistoryPage.jsx:33-43` | 탭 카운트가 `all` 탭이 아닐 때 전체 기준 카운트가 아님 | **확인됨**: `computeCounts()`는 현재 탭 응답만 기준으로 카운트를 만든다. `orders` 탭에서는 `orders`만 실제 값이고 다른 탭은 0으로 표시된다. | 전체 카운트가 필요하면 별도 summary API 또는 all 응답 캐시를 사용하라. |
| P3 | 병합 후 가능 | `server/db/bootstrap.js:121-170` | 기존 DB 마이그레이션의 임의 구버전 대응은 제한적 | **확인됨**: 기존 운영 DB는 없고 초기화 예정이라 현재 운영 전제에서는 문제 없음. 다만 `used_coupons`에 unique index가 전혀 없는 임의 구버전 DB는 rebuild가 실행되지 않을 수 있다. | 운영 DB가 실제로 생긴 뒤에는 004 마이그레이션을 더 보수적으로 만들지 여부를 재검토하라. |
| P3 | 병합 후 가능 | `server/routes/admin.js:431-435` | 통합 내역 정렬의 동일 초 단위 tie-break가 약함 | **확인됨**: `created_at`이 같은 경우 `return 0`이다. order/admin 소스 내부 정렬에 의존한다. | `created_at DESC`, `source`, `id` 등으로 결정적 정렬을 적용하면 운영 로그 비교가 더 안정적이다. |

## 4. 수정사항_v3 해결 여부

| 번호 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 | 심각도 재평가 |
|---|---|---|---|---|
| 1. 쿠폰 중복 기준 student_id | 해결 | `server/db/init.sql:97-103`, `server/domain/coupon.js:65-91`, `server/routes/__tests__/customer.test.js:195-294` | 없음. 기존 DB 초기화 전제에서는 충분 | 기존 P0 해결 |
| 2. 관리자 내역 전체/주문/메뉴/시스템 | 부분 해결 | `server/routes/admin.js:378-435`, `server/repositories/admin-events-repo.js`, `src/pages/admin/HistoryPage.jsx` | 로그인 로그 조회 P1, type 검증 P2 | P1 잔존 |
| 3. 어드민 메뉴 효과 표시 | 해결 | `src/constants/menu-effects.js`, `src/pages/admin/MenuAdminPage.jsx:68`, `src/constants/__tests__/menu-effects.test.js` | 없음 | P2 해결 |
| 4. 어드민 이체확인 탭 제거 | 해결 | `src/components/layouts/AdminLayout.jsx:15-21`, `src/App.jsx:87`, `server/routes/admin.js:325-346` | 없음. nav 제거 + 라우트/API 보존 확인 | P2 해결 |
| 5. 쿠폰/admin1 문구 변경 | 해결 | `src/pages/customer/CheckoutPage.jsx:100-103`, `src/utils/admin-display.js`, `src/pages/admin/HistoryPage.jsx:111` | 없음 | P3 해결 |
| 6. 관리자 UI/UX 개선 | 부분 해결 | `src/pages/admin/DashboardPage.jsx`, `src/components/organisms/AdminCardColumn.jsx`, `src/styles/components.css` | admin shared 컴포넌트 이모지 잔존 P2 | P2 잔존 |

## 5. 쿠폰 student_id 중복 방지 리뷰

DB:

- **확인됨**: 신규 DB 스키마는 `used_coupons`에 `UNIQUE(student_id)`를 둔다.
- **확인됨**: bootstrap migration `004-coupon-student-unique`는 기존 `(student_id, name)`류 unique가 있으면 table rebuild로 `UNIQUE(student_id)` 구조를 만든다.
- **확인됨**: 사용자는 기존 DB가 없고 DB 초기화 예정이라고 결정했다. 이 전제에서는 init.sql 반영만으로도 핵심 방어가 동작한다.

API/도메인:

- **확인됨**: `validateCoupon()`은 `SELECT id FROM used_coupons WHERE student_id = ?`로 검사한다.
- **확인됨**: `consumeCoupon()`은 `SQLITE_CONSTRAINT_UNIQUE`를 `CouponError(ALREADY_USED)`와 `이미 쿠폰을 사용한 학번이에요.`로 변환한다.
- **확인됨**: `POST /api/orders`에서 쿠폰 사용 주문은 트랜잭션 안에서 주문 생성과 쿠폰 소비를 처리한다. 쿠폰 중복이면 해당 쿠폰 사용 요청은 롤백된다.
- **확인됨**: 같은 학번으로 쿠폰 없이 일반 주문은 성공하는 테스트가 추가되어 있다.

UX:

- **확인됨**: 사용자 화면 쿠폰 문구는 `컴모융 학생 1,000원 할인`으로 변경되었다.
- **확인됨**: 중복 에러 문구는 백엔드 응답으로 사용자에게 표시될 수 있다.
- **추정**: 중복 쿠폰 제출 시 주문을 자동으로 쿠폰 없는 주문으로 전환하지는 않는다. 현재 정책 해석은 "쿠폰 없이 다시 제출하면 일반 주문 가능"에 가깝다. QA에서 이 흐름이 현장 사용자에게 충분히 명확한지 확인하는 것이 좋다.

Race condition:

- **확인됨**: 앱 레벨 검사 후 INSERT 사이에 동시 요청이 들어와도 DB `UNIQUE(student_id)`가 최종 방어선이다.
- **확인됨**: 직접 INSERT 중복을 `SQLITE_CONSTRAINT_UNIQUE`로 막는 테스트가 있다.

## 6. 관리자 내역/이벤트 로그 리뷰

구조:

- **확인됨**: 기존 `order_events`는 주문 로그 전용으로 유지하고, 메뉴/시스템 로그는 신규 `admin_events`로 분리했다.
- **확인됨**: `GET /admin/api/history`는 `order_events`와 `admin_events`를 `o-<id>`, `a-<id>` prefix로 합쳐 id 충돌을 피한다.
- **확인됨**: `all/orders/menus/system` 필터가 구현되어 있다.
- **확인됨**: `created_at`은 응답에서 ISO 8601 `Z` 형식으로 변환된다.

문제:

- **확인됨**: 로그인 로그는 저장되지만 `operating_date`가 없어 시스템 내역에 노출되지 않는다. P1이다.
- **확인됨**: invalid `type` 검증이 없어 운영/테스트 중 잘못된 쿼리를 빈 로그로 오해할 수 있다. P2다.
- **확인됨**: 메뉴 변경 로그는 실제 메뉴 변경 후 기록한다. 로그 실패 시 원 액션과 응답 상태가 불일치할 수 있다. P2다.

표시:

- **확인됨**: `HistoryPage`는 전체/주문/메뉴/시스템 탭과 actor 표시 변환을 구현했다.
- **확인됨**: `admin`/`admin1`은 `displayActor()`로 `어드민` 표시된다.
- **확인됨**: design bundle의 검색/CSV 기능은 구현되지 않았다. 이번 v3 필수 범위는 탭 필터라서 병합 차단 이슈로 보지는 않는다.

## 7. 메뉴 효과/어드민 nav/문구 리뷰

메뉴 효과:

- **확인됨**: `src/constants/menu-effects.js`는 `MENUS[*].sub`에서 code 기준 정적 매핑을 만든다.
- **확인됨**: 8개 효과는 요구사항과 일치한다.
- **확인됨**: DB/API 확장 없이 프론트 정적 매핑이라는 사용자 결정과 일치한다.
- **확인됨**: 없는 code는 `—` fallback이다.

어드민 nav:

- **확인됨**: `AdminLayout` nav에서 이체확인 탭은 제거되었다.
- **확인됨**: `/admin/transfers` 라우트와 `GET /admin/api/transfers` API는 남아 있다.
- **확인됨**: 대시보드 카드의 `TRANSFER_REPORTED`와 `HOLD` 상태에서 이체 확인 액션은 계속 가능하다.

문구:

- **확인됨**: 쿠폰 라벨은 `컴모융 학생 1,000원 할인`이다.
- **확인됨**: `컴모융(****37***)` 안내 문구는 사용자 화면에서 제거되었다.
- **확인됨**: `admin`/`admin1` 화면 표시는 `어드민`으로 변환된다. 내부 actor 값은 보존된다.

## 8. 어드민 UI/UX 리뷰

design_bundle 정합:

- **확인됨**: 루트 `design_bundle` 폴더는 없고 실제 번들은 `docs/design-bundle`에 있다.
- **확인됨**: `docs/design-bundle/app.css`의 `.start-cta`, `.admin-board`, `.col`, `.order-card`, 스크롤바 스타일이 현재 CSS에 상당 부분 반영되었다.
- **확인됨**: CLOSED 상태에서도 6개 상태 컬럼을 렌더링하도록 `DashboardPage`가 변경되었다.
- **확인됨**: OPEN/영업중 초록 dot은 CSS dot으로 유지된다.
- **확인됨**: 취소/보류 버튼은 `btn-danger-outline`으로 과한 빨간 배경을 줄였다.

잔여 문제:

- **확인됨**: 관리자 화면에서 `StatusChip`와 `OrderTimeline`을 통해 이모지가 여전히 렌더링된다. P2다.
- **추정**: 모바일 2열 전환은 CSS로 존재하지만, 실제 작은 화면에서 5개 nav + 6컬럼 카드 + 내부 스크롤이 모두 운영 가능한지는 Playwright/실기기 QA가 필요하다.

## 9. DB/마이그레이션 리뷰

init.sql:

- **확인됨**: `used_coupons`는 `UNIQUE(student_id)`로 변경되었다.
- **확인됨**: `admin_events` 테이블과 `created_at/category/operating_date` 인덱스가 추가되었다.

bootstrap migration:

- **확인됨**: `004-coupon-student-unique`와 `005-admin-events`가 추가되었다.
- **확인됨**: 신규 DB 초기화 전제에서는 안전하다.
- **확인됨**: 기존 `(student_id, name)` unique 구조는 table rebuild로 전환한다.
- **확인됨**: 중복 `student_id`가 있으면 `INSERT OR IGNORE`로 첫 행만 남긴다. 사용자가 "기존 DB 없음"을 선택했으므로 병합 차단은 아니다.
- **추정**: 임의의 더 오래된 DB에서 unique index가 전혀 없으면 004가 rebuild하지 않고 applied 처리될 수 있다. 운영 DB 초기화 전제에서는 P3 참고 사항이다.

admin_events:

- **확인됨**: `category`는 `menu|system`으로 제한된다.
- **확인됨**: `ADMIN_LOGIN`을 `operating_date NULL`로 저장하는 설계는 현재 사용자 결정과 QA 목표에 맞지 않는다. P1이다.

## 10. build/NODE_ENV 리뷰

- **확인됨**: `package.json` build 스크립트가 `vite build`에서 `NODE_ENV=production vite build`로 바뀌었다.
- **확인됨**: Windows 호스트에서 `npm run build`는 실패했다.
- **확인됨**: Claude 보고의 build 성공은 Docker/Linux 환경 기준으로 보인다.
- **판단**: 현재 사용자 환경에서 build 명령이 깨지므로 P1이다.
- **권장**: Docker-only 정책을 명확히 할 것이 아니라면 cross-platform 스크립트로 바꿔야 한다. Docker-only를 유지할 경우에도 `CLAUDE.md` 또는 ADR-033에 "build/test/lint는 docker compose dev 컨테이너에서만 실행"을 명시해야 한다.

## 11. 테스트 리뷰

좋은 점:

- 쿠폰 중복 기준 변경은 도메인, 라우트, DB unique 성격의 테스트가 추가되어 핵심 회귀를 잘 잡는다.
- `admin_events` repo/API, 메뉴 로그, 장사 시작 로그, 자동 백업 로그, 메뉴 효과 표시, nav 제거, actor 표시 테스트가 추가되었다.
- 대시보드 CLOSED 6컬럼, 카드 클래스, danger outline 버튼 테스트가 추가되었다.

부족한 점:

- P1: 로그인 후 `GET /admin/api/history?type=system`에 `ADMIN_LOGIN`이 표시되는 통합 테스트가 없다.
- P1: `package.json` build 스크립트의 Windows 호스트 실행 가능성을 검증하지 않았다.
- P2: invalid history `type`에 대한 400 테스트가 없다.
- P2: 어드민 화면 전체 이모지 제거 테스트가 shared 컴포넌트까지 포괄하지 않는다. `StatusChip` 테스트는 오히려 이모지 렌더링을 기대하고 있다.
- P2: 메뉴 변경 성공 후 로그 기록 실패 시 동작 정책 테스트가 없다.

추가 권장 테스트:

- 로그인 성공 후 시스템 내역에서 `ADMIN_LOGIN` 노출.
- `GET /admin/api/history?type=bad` 400.
- admin dashboard/order detail/transfers에서 상태 이모지 미노출.
- Windows 또는 cross-platform build 스크립트 검증은 CI OS 매트릭스나 별도 문서 게이트로 보강.

## 12. 커밋 전 필수 확인

현재 커밋은 아직 없고, `main...HEAD` diff도 없다. 따라서 아래 modified/untracked 파일을 커밋 대상에 포함해야 한다.

Modified:

- `package.json`
- `server/db/bootstrap.js`
- `server/db/init.sql`
- `server/domain/__tests__/coupon.test.js`
- `server/domain/coupon.js`
- `server/jobs/__tests__/auto-snapshot.test.js`
- `server/jobs/auto-snapshot.js`
- `server/repositories/coupon-repo.js`
- `server/routes/__tests__/admin.test.js`
- `server/routes/__tests__/customer.test.js`
- `server/routes/admin.js`
- `src/__tests__/App.test.jsx`
- `src/api/schemas.js`
- `src/components/layouts/AdminLayout.jsx`
- `src/components/organisms/AdminCardColumn.jsx`
- `src/components/organisms/BusinessStateBadge.jsx`
- `src/components/organisms/StartBusinessCTA.jsx`
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
- `src/components/organisms/__tests__/BusinessStateBadge.test.jsx`
- `src/pages/admin/CouponsPage.jsx`
- `src/pages/admin/DashboardPage.jsx`
- `src/pages/admin/HistoryPage.jsx`
- `src/pages/admin/MenuAdminPage.jsx`
- `src/pages/admin/SettlementPage.jsx`
- `src/pages/admin/TransfersPage.jsx`
- `src/pages/admin/__tests__/DashboardPage.test.jsx`
- `src/pages/admin/__tests__/HistoryPage.test.jsx`
- `src/pages/admin/__tests__/MenuAdminPage.test.jsx`
- `src/pages/customer/CheckoutPage.jsx`
- `src/pages/customer/__tests__/CheckoutPage.test.jsx`
- `src/styles/components.css`

Untracked:

- `docs/find_error_v3_development_plan.md`
- `docs/find_error_v3_qa_plan.md`
- `docs/find_error_v3_work_instruction.md`
- `docs/tasks/2026-05-18-find_error_v3.md`
- `server/repositories/__tests__/admin-events-repo.test.js`
- `server/repositories/admin-events-repo.js`
- `src/components/layouts/__tests__/AdminLayout.test.jsx`
- `src/constants/__tests__/menu-effects.test.js`
- `src/constants/menu-effects.js`
- `src/utils/__tests__/admin-display.test.js`
- `src/utils/admin-display.js`

커밋 전 제외해야 할 파일:

- `.env`, `.env.*`
- DB 실데이터 파일, 세션/암호 파일
- `dist`, `node_modules`, 로그/임시 파일
- 현재 `git status`에는 위 제외 대상이 보이지 않는다.

커밋 전 재실행할 명령:

- P1 수정 후 Windows 호스트에서 `npm run build`
- 프로젝트 정책이 Docker-only라면 `docker compose -f docker-compose.dev.yml exec dev npm run build`
- `npm test -- --run` 또는 Docker 기준 동일 명령
- `npm run lint`

## 13. main 병합 전 수동 QA

- [ ] 같은 `student_id` + 다른 이름 쿠폰 중복 차단
- [ ] 같은 `student_id`로 쿠폰 없이 일반 주문 가능
- [ ] 관리자 내역 전체/주문/메뉴/시스템 필터
- [ ] 메뉴 품절/추천/가격 변경 로그
- [ ] 장사 시작 시스템 로그
- [ ] 관리자 로그인 시스템 로그
- [ ] 자동 백업 로그 또는 이벤트 타입 확인
- [ ] 어드민 메뉴 효과 표시
- [ ] 이체확인 탭 nav 미노출 + `/admin/transfers` 직접 라우트 보존
- [ ] `GET /admin/api/transfers` API 보존
- [ ] 쿠폰 문구 변경
- [ ] `admin1` → `어드민` 표시
- [ ] 어드민 이모지 제거, shared status/timeline 포함
- [ ] 장사 시작 전 6컬럼 표시
- [ ] 대시보드 `TRANSFER_REPORTED` 확인/보류 처리
- [ ] HOLD 주문의 이체 확인/취소 처리
- [ ] 모바일 관리자 화면 nav/6컬럼/카드/스크롤 깨짐 여부

## 14. Claude에게 줄 후속 수정 지시

아래는 P1 해결을 위해 바로 전달할 수 있는 프롬프트다.

```text
find_error_v3 리뷰에서 P1 두 개가 발견되었습니다. 소스 수정 후 테스트를 갱신하세요.

1. package.json build 스크립트가 Windows에서 실패합니다.
   현재 "NODE_ENV=production vite build"는 Windows/cmd/PowerShell에서 동작하지 않습니다.
   cross-platform 방식으로 변경하세요. 예: cross-env를 devDependency로 추가하고
   "cross-env NODE_ENV=production vite build"를 쓰거나, Docker-only 정책이 아니라면
   "vite build"로 되돌리고 dev 컨테이너 NODE_ENV 오염 문제를 별도 방식으로 해결하세요.
   수정 후 Windows 호스트 `npm run build` 또는 프로젝트가 명시한 공식 build 경로를 통과시켜 주세요.

2. ADMIN_LOGIN 로그가 시스템 내역에 표시되지 않습니다.
   로그인 성공 시 admin_events에는 저장되지만 operating_date가 NULL이고,
   listAdminEvents는 operating_date = ? 조건이라 NULL 행을 제외합니다.
   사용자 결정사항은 로그인 로그를 시스템 로그에 포함하는 것입니다.
   로그인 이벤트에 현재 business_state.operating_date를 채우거나,
   history 조회 정책을 수정해 시스템 탭에서 ADMIN_LOGIN이 보이게 하세요.
   `POST /admin/login` 이후 `GET /admin/api/history?type=system&date=2026-05-20`에서
   ADMIN_LOGIN이 반환되는 테스트를 추가하세요.

P1 수정 후 npm test -- --run, npm run lint, npm run build를 재실행하고 결과를 보고하세요.
```

P2 후속 수정은 선택사항이지만, 병합 전 함께 처리하는 것을 권장한다.

## 15. 결론

- main 병합 가능 여부: **현재는 불가**. P1 두 개 수정 후 재검토가 필요하다.
- 병합 전 반드시 확인할 항목: Windows/cross-platform build 성공, 시스템 내역의 관리자 로그인 로그 노출.
- 실사용 QA 집중 지점: 쿠폰 중복 방지, 내역 필터, 로그인/백업/장사 시작 시스템 로그, 어드민 shared 컴포넌트의 이모지 잔존, 모바일 관리자 화면.
- 실제 소스코드 수정 여부: 이 리뷰에서는 소스코드를 수정하지 않았고, 리뷰 문서만 작성했다.
