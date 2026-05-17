# find_error_v2 개발 기획서

## 검토 기준

- 현재 브랜치: `find_error_v2`로 확인됨.
- 루트의 `design_bundle` 폴더는 없고, 실제 디자인 번들은 `docs/design-bundle`에 있음. 본 문서는 이 폴더를 기준으로 비교함.
- `main...HEAD` 기준 변경 파일은 별도로 확인되지 않았고, 현재 작업 브랜치의 워킹트리 구현을 기준으로 분석함.
- `.env`, 비밀키, 환경변수, 세션/암호 파일은 열람하지 않았음.
- 실제 앱 소스코드는 수정하지 않았고, 문서만 작성함.

## 표기 기준

- **확인됨**: 코드에서 직접 확인한 사실
- **추정**: 코드 구조상 가능성이 높은 원인
- **확인 필요**: 운영 정책 또는 실제 화면으로 재확인이 필요한 내용

---

## 1. 추천 BEST 아래 작은 추천 메뉴 제거

- 번호: 1
- 사용자가 발견한 현상: `학생회 추천 BEST` UI 아래에 추천 메뉴가 작게 표시되고, 그 메뉴도 `줍기`가 가능함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/components/organisms/RecommendedBanner.jsx`가 `.best-banner` 아래에 `grid grid-cols-3`로 `MenuCard`를 렌더링함.
  - **확인됨**: 각 `MenuCard`에는 `onAdd`가 전달되어 추천 영역에서도 장바구니 담기가 가능함.
  - **확인됨**: `src/pages/customer/MenuPage.jsx`는 `category === 'all'`일 때 `RecommendedBanner menus={popular}`를 표시함.
  - 구현 상태 구분: 백엔드의 인기/추천 메뉴 API는 이미 있음. 문제는 프론트 UI가 사용자 기대보다 과함.
- design_bundle 기준 의도:
  - **확인됨**: `docs/design-bundle/screens-customer.jsx`의 `ScreenMenu`는 `best-banner`를 하나의 추천 카피/보급품 박스처럼 보여주고, 그 아래에 별도 작은 추천 카드 그리드를 두지 않음.
  - **확인됨**: 추천 메뉴 자체는 일반 메뉴 그리드나 추천 카테고리에서 선택하는 구조임.
- 관련 프론트 파일:
  - `src/pages/customer/MenuPage.jsx`
  - `src/components/organisms/RecommendedBanner.jsx`
  - `src/components/organisms/MenuCard.jsx`
  - `src/components/organisms/MenuList.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `GET /api/popular`
  - `GET /api/menus`
  - `server/domain/popularity.js`
  - `menus.recommended`
- 기능 유형: UI 제거, UX 개선
- 심각도: P2
- 수정 방향:
  - `RecommendedBanner`는 `best-banner` 카피/요약만 렌더링하고, 내부 `MenuCard` 3개 그리드와 `onAdd` 동작을 제거함.
  - 추천 메뉴 구매는 기존 메뉴 그리드 또는 `추천` 카테고리에서만 가능하게 유지함.
- 구현 전 확인 필요 사항:
  - `best-banner`의 하위 문구에 추천 메뉴명 목록은 남길지 확인 필요.
  - `추천` 카테고리 탭은 유지하는지 확인 필요.
- 테스트 포인트:
  - 전체 메뉴 화면에서 `학생회 추천 BEST` 아래 작은 카드/줍기 버튼이 보이지 않는지.
  - 일반 메뉴 카드와 `추천` 탭에서는 주문 담기가 계속 가능한지.
  - `GET /api/popular` 호출 제거 여부 또는 호출 유지 여부에 따라 테스트 mock 정리.

---

## 2. 관리자 내역/쿠폰 탭 복구 및 구현

- 번호: 2
- 사용자가 발견한 현상: 어드민 페이지에 `내역`과 `쿠폰` 탭이 없음. design-bundle에는 내역은 진행 로그, 쿠폰은 누가 몇 시에 쿠폰을 사용했는지 보는 사용 내역으로 구성되어 있음.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/components/layouts/AdminLayout.jsx` 주석에 `내역(history)·쿠폰(coupons) nav 제거`가 명시되어 있음.
  - **확인됨**: 현재 관리자 nav는 `본부`, `메뉴`, `정산`, `이체확인` 4개뿐임.
  - **확인됨**: `src/App.jsx`에는 `/admin/history`, `/admin/coupons` 라우트가 없음.
  - **확인됨**: `server/routes/admin.js`에는 `/admin/api/history`, `/admin/api/coupons/usage` 같은 조회 API가 없음.
  - **확인됨**: `server/db/init.sql`에는 `used_coupons` 테이블이 있음.
  - **확인됨**: `server/repositories/coupon-repo.js`에는 `listUsedCoupons(db)`와 `countUsedCoupons(db)` helper가 있음.
  - **확인됨**: 주문 상태 변경 로그 전용 테이블은 현재 `server/db/init.sql`에 없음. `orders`에는 상태별 timestamp 필드만 있음.
  - **확인됨**: `docs/DB_DRAFT.md`에는 `order_events` 설계가 있으나 실제 init.sql에는 반영되지 않음.
  - 구현 상태 구분: 쿠폰 사용 기록 DB와 repo helper는 있음. 관리자 쿠폰 API/프론트 탭은 없음. 주문 상태 변경 감사 로그 DB/API/프론트는 없음.
- design_bundle 기준 의도:
  - **확인됨**: `docs/design-bundle/screens-admin.jsx`의 top nav는 `본부`, `메뉴`, `내역`, `정산`, `쿠폰` 5개 탭으로 구성됨.
  - **확인됨**: `AdminHistory`는 필터 `전체/주문/메뉴/시스템`, 검색, CSV 내보내기, `log-feed` 형태의 감사 로그를 가짐.
  - **확인됨**: design-bundle 하단 안내는 실제 구현으로 `orders_audit` + `menu_audit` 테이블 또는 이와 유사한 INSERT 로그를 언급함.
  - **확인됨**: `AdminCoupons`는 `쿠폰 사용 내역` 화면으로 학번, 이름, 시각, 주문번호를 표 형태로 보여줌.
  - **확인됨**: `src/styles/components.css`에는 `log-feed`, `log-row`, `settle-grid` 등 관련 스타일이 이미 존재함.
- 관련 프론트 파일:
  - `src/App.jsx`
  - `src/components/layouts/AdminLayout.jsx`
  - 신규 필요: `src/pages/admin/HistoryPage.jsx`
  - 신규 필요: `src/pages/admin/CouponsPage.jsx`
  - `src/styles/components.css`
- 관련 백엔드 파일/API/DB 테이블:
  - `server/routes/admin.js`
  - `server/db/init.sql`
  - `server/repositories/coupon-repo.js`
  - `used_coupons`
  - 신규 필요 후보: `order_events` 또는 `orders_audit`
  - 신규 필요 후보 API: `GET /admin/api/history`, `GET /admin/api/coupons/usage`
- 기능 유형: 관리자 기능 추가
- 심각도: P1
- 수정 방향:
  - 관리자 nav에 `내역`, `쿠폰`을 복구하고 라우트를 추가함.
  - 쿠폰 탭은 최소 변경으로 `used_coupons JOIN orders` 조회 API부터 구현 가능함.
  - 쿠폰 사용 내역 최소 표시 항목은 사용 시간, 주문번호, 이름, 학번, 쿠폰명, 할인 금액으로 정의함. 현재 `used_coupons`에는 쿠폰명/할인 금액 컬럼이 없으므로 `쿠폰명='컴모융 1,000원 할인'`, 할인 금액 `1000` 상수로 계산하는 최소 구현이 가능함.
  - 내역 탭은 현재 DB에 로그가 없으므로 `order_events` 같은 최소 테이블을 추가하고, 주문 생성/이체 완료 요청/관리자 상태 전이 시점에 INSERT하도록 설계함.
  - 이미 존재하는 `orders` timestamp만으로 과거 로그를 완전히 복원할 수는 없음. 초기 구현에서는 현재 주문 상태별 timestamp를 보조 표시로 쓰되, 새 이벤트부터 정확한 로그로 쌓는 방향이 현실적임.
- 구현 전 확인 필요 사항:
  - 내역 탭이 주문 상태 변경만 보여야 하는지, 메뉴 가격/품절/추천 변경과 로그인/로그아웃까지 포함해야 하는지 확인 필요.
  - design-bundle은 `orders_audit` + `menu_audit`을 언급하지만, 현재 문서 `DB_DRAFT.md`는 `order_events`를 언급함. 테이블명을 `order_events`로 통일할지 확인 필요.
  - 쿠폰 사용 기록은 현재 주문 생성 트랜잭션 안에서 `consumeCoupon`이 실행될 때 `used_coupons`에 기록됨. 결제/입금 완료 시점이 아니라 주문 생성 시점 기록이 맞는지 확인 필요.
  - 쿠폰 거부 시도 로그는 현재 테이블/API가 없음. v2에 거부 로그까지 포함할지, 사용 성공 내역만 구현할지 확인 필요.
  - 정산 기능은 `used_coupons`를 조인해 쿠폰 건수/할인 합계를 계산함. 쿠폰 기록 구조 변경 시 정산 결과와 충돌하지 않도록 유지해야 함.
- 테스트 포인트:
  - 관리자 nav에 `내역`, `쿠폰` 탭이 보이고 라우팅되는지.
  - 상태 변경 시 내역에 시간, 주문번호, 전/후 상태, 액션 이름, 처리 주체가 기록되는지.
  - 쿠폰 사용 주문만 쿠폰 탭에 표시되는지.
  - 쿠폰 탭의 사용 시간은 `used_coupons.used_at` 기준인지 확인.
  - 정산 쿠폰 요약과 쿠폰 탭 건수가 일치하는지.

### 관리자 내역/쿠폰 탭 상세 분석

- 현재 백엔드에 주문 상태 변경 로그, 관리자 액션 로그, 쿠폰 사용 기록 테이블/API가 있는가?
  - 주문 상태 변경 로그 테이블/API: **없음으로 확인됨**.
  - 관리자 액션 로그 테이블/API: **없음으로 확인됨**.
  - 쿠폰 사용 기록 테이블: **있음**. `used_coupons(id, student_id, name, order_id, used_at)`.
  - 쿠폰 사용 기록 API: **없음으로 확인됨**.
- 없다면 최소 구현으로 필요한 테이블/API:
  - `order_events(id, order_id, event_type, from_status, to_status, action_name, actor, note, created_at)`
  - `GET /admin/api/history?type=orders&since=YYYY-MM-DD`
  - `GET /admin/api/coupons/usage?date=YYYY-MM-DD`
  - 쿠폰 API는 `used_coupons uc JOIN orders o ON o.id = uc.order_id`로 주문번호와 운영일자를 가져오면 됨.
- 쿠폰 사용 기록 시점:
  - **확인됨**: 현재 `POST /api/orders`에서 주문 생성 트랜잭션 안에 `consumeCoupon`을 호출하고, 이때 `used_coupons`에 INSERT함.
  - 따라서 현재 구현 기준 쿠폰 기록은 결제/입금 완료가 아니라 주문 생성 시점에 생성됨.
  - 정책 변경이 없다면 이 구조를 유지해야 정산 쿠폰 할인과 주문 금액 스냅샷이 맞음.
- design_bundle 화면 구조:
  - 내역: 상단 제목/검색/CSV, 필터 탭, info bar, `log-feed` 행 목록.
  - 쿠폰: 상단 제목, 요약 info bar, `settle-grid` 안의 표 형태 최근 사용 목록.
- 현재 관리자 라우팅 구조에 탭을 추가할 수 있는가?
  - **확인됨**: `AdminLayout`의 `ITEMS` 배열과 `App.jsx` lazy route에 항목을 추가하면 가능함.
- 숨겨둔 내역/쿠폰 nav를 다시 살려야 하는가?
  - **확인됨**: 코드 주석상 이전에는 의도적으로 숨겼음.
  - 사용자 요청이 명확하므로 v2에서는 숨김 정책을 폐기하고 실제 동작하는 탭으로 복구하는 방향이 맞음.
- 정산 기능과 충돌하지 않는가?
  - 쿠폰 성공 내역은 이미 정산이 `used_coupons`를 참조하므로, 조회 API만 추가하면 충돌 가능성은 낮음.
  - `used_coupons` 스키마를 바꾸거나 UNIQUE 정책을 바꾸면 정산/중복 쿠폰 정책에 영향이 있음. 최소 구현에서는 기존 테이블을 유지해야 함.

---

## 3. 주문 학번 검증과 쿠폰 대상 검증 분리

- 번호: 3
- 사용자가 발견한 현상: `202111***`처럼 학년/학과번호가 `37`이 아닌 학번을 입력하면 학번 형식 오류가 뜨고 주문 접수 자체가 안 됨. 주문은 숫자 9자리이면 가능해야 하고, `****37***` 패턴은 컴모융 쿠폰 사용 가능 여부만 판단해야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/pages/customer/CheckoutPage.jsx`의 `errors.sid`가 `!sidDeptOK`이면 `학번 형식이 올바르지 않습니다`를 반환함.
  - **확인됨**: `valid`가 `!errors.sid`에 의존하므로 `37` 패턴이 아니면 쿠폰 사용 여부와 무관하게 주문 제출이 차단됨.
  - **확인됨**: 프론트의 `SID_PATTERN`은 `/^\d{2}\d{2}37\d{3}$/`임.
  - **확인됨**: 백엔드 `CreateOrderSchema`는 `student_id`를 일반 문자열로 받고, 쿠폰 미사용 주문에 대해 9자리 숫자 검증을 강제하지 않음.
  - **확인됨**: 백엔드 쿠폰 검증은 `server/domain/coupon.js`의 `STUDENT_ID_PATTERN`으로 `37` 패턴을 검사함.
  - 구현 상태 구분: 백엔드는 쿠폰 대상 검증은 있음. 주문 가능 학번 검증은 백엔드에 명확히 없음. 프론트는 주문 검증과 쿠폰 검증이 결합되어 있음.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle의 `ScreenCheckout`도 현재는 `sidDeptOK` 실패를 주문 폼 오류로 막는 코드가 남아 있음.
  - **확인됨**: 다만 `docs/design-bundle/uploads/USER_FLOW.md`에는 학번 9자리 검증과 쿠폰 학과 코드 `37` 매칭이 별도 분기로 설명되어 있음.
  - 사용자 정책이 최신 요구사항이므로 design-bundle 코드보다 사용자 정책을 우선해야 함.
- 관련 프론트 파일:
  - `src/pages/customer/CheckoutPage.jsx`
  - `src/pages/customer/__tests__/CheckoutPage.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `POST /api/orders`
  - `server/routes/customer.js`
  - `server/domain/coupon.js`
  - `server/domain/pricing.js`
  - `used_coupons`
  - `orders.student_id`
- 기능 유형: 검증 로직 수정
- 심각도: P1
- 수정 방향:
  - 프론트에서 `orderStudentIdValid = /^\d{9}$/.test(sid)`와 `couponEligible = /^\d{4}37\d{3}$/.test(sid)`를 분리함.
  - 주문 제출 `valid`는 `!external`일 때 9자리 숫자만 요구함.
  - 쿠폰 체크박스 활성화만 `37` 패턴과 이름 입력 여부에 묶음.
  - 쿠폰 미대상 학번이면 쿠폰은 비활성/미적용되지만 일반 주문은 계속 가능해야 함.
  - 백엔드도 `POST /api/orders`에서 학생 주문의 `student_id`가 있으면 9자리 숫자인지 검증하고, 쿠폰 사용 시에만 `consumeCoupon`의 `37` 패턴 검증을 적용함.
- 구현 전 확인 필요 사항:
  - 외부인(`is_external=true`) 주문은 `student_id=null`을 계속 허용하는지 확인 필요. 현재 구조상 허용 중임.
  - 학생 주문에서 학번 9자리 숫자를 백엔드에서 반드시 강제할지 확인 필요. 사용자 정책상 강제하는 것이 맞음.
  - 쿠폰 중복 UNIQUE가 현재 `student_id + name` 조합임. 학번 단독 1회인지, 학번+이름 1회인지 확인 필요. `DB_DRAFT.md`와 실제 init.sql이 서로 다름.
- 테스트 포인트:
  - `202111123`은 쿠폰 미대상이지만 주문 가능해야 함.
  - `202637123`은 쿠폰 사용 가능해야 함.
  - 8자리/10자리/문자 포함 학번은 주문 불가.
  - 쿠폰 대상이 아닌 경우 `coupon: null` 또는 `coupon.used=false`로 주문 API가 호출되는지.
  - 백엔드에서 쿠폰 미사용 + non-37 9자리 학번 주문이 성공하는지.

### 학번/쿠폰 검증 상세 분석

- 현재 학번 검증이 주문 생성 단계 전체를 막고 있는가?
  - **확인됨**: 프론트에서 막고 있음. `errors.sid`가 `valid`를 false로 만들며 제출 전 return함.
- 현재 쿠폰 검증과 학번 검증이 결합되어 있는가?
  - **확인됨**: 프론트에서 결합되어 있음. `SID_PATTERN`이 주문 학번 오류와 쿠폰 가능 여부에 모두 사용됨.
  - **확인됨**: 백엔드는 쿠폰 사용 시 `consumeCoupon`에서만 `37` 패턴을 검사함.
- 프론트 검증과 백엔드 검증이 같은 정책인가?
  - **확인됨**: 같지 않음. 프론트는 non-37 학생 주문을 차단하지만, 백엔드는 쿠폰 미사용이면 명시적으로 차단하지 않음.
- 수정 방향:
  - 주문 가능 조건: `^\d{9}$`
  - 쿠폰 가능 조건: `^\d{4}37\d{3}$`
  - 에러 문구:
    - 주문 학번 오류: `학번은 숫자 9자리로 입력해주세요.`
    - 쿠폰 대상 아님: `해당 학번은 쿠폰 대상이 아니에요.`

---

## 4. 사용자 주문 상태 화면의 시간 리스트 제거

- 번호: 4
- 사용자가 발견한 현상: 사용자가 주문 상태를 보는 화면에서 접수, 입금, 확인, 조리, 수령의 시간을 볼 필요가 없음.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/pages/customer/StatusPage.jsx`는 `history` 객체에 `created_at`, `transferred_at`, `paid_at`, `cooking_at`, `ready_at`, `done_at`을 넣어 `OrderTimeline`에 전달함.
  - **확인됨**: `OrderTimeline`은 `showMiniview`가 true이면 `단계별 진입 시각` 목록과 timestamp를 렌더링함.
  - 구현 상태 구분: 백엔드 timestamp 제공은 있음. 문제는 프론트 사용자 화면 노출임.
- design_bundle 기준 의도:
  - **확인됨**: `docs/design-bundle/screens-customer.jsx`의 `ScreenStatus`는 `Timeline current={order.status}`를 보여주지만, 단계별 시간 미니뷰는 없음.
  - design-bundle 기준 사용자에게는 상태 진행과 핵심 카피가 우선임.
- 관련 프론트 파일:
  - `src/pages/customer/StatusPage.jsx`
  - `src/components/organisms/OrderTimeline.jsx`
  - `src/pages/customer/__tests__/StatusPage.test.jsx`
  - `src/components/organisms/__tests__/OrderTimeline.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `GET /api/orders/:id`
  - `orders.created_at`, `orders.transferred_at`, `orders.paid_at`, `orders.cooking_at`, `orders.ready_at`, `orders.done_at`
- 기능 유형: UI 제거
- 심각도: P2
- 수정 방향:
  - 사용자 `StatusPage`에서는 `OrderTimeline`에 `showMiniview={false}`를 전달하거나 prop 기본값을 조정함.
  - 관리자 상세 화면의 시간 표시 필요 여부는 별도 정책으로 유지 가능함.
- 구현 전 확인 필요 사항:
  - 관리자 `OrderDetailPage`의 timeline history는 유지할지 확인 필요. 사용자의 요청은 사용자 주문 상태 화면에 한정됨.
  - `OrderTimeline` 컴포넌트 기본값을 바꾸면 관리자 화면까지 영향이 있으므로 호출부에서 명시하는 편이 안전함.
- 테스트 포인트:
  - 사용자 status 화면에서 단계별 시간 리스트와 ISO timestamp가 보이지 않는지.
  - 진행 단계 dot/label은 계속 보이는지.
  - 관리자 상세 화면의 timeline이 의도대로 유지되는지.

---

## 5. 이체 확인 요청 페이지 안내 문구 제거

- 번호: 5
- 사용자가 발견한 현상: 이체 확인 요청 페이지의 `본부가 통장 입금을 확인하면 자동으로 조리가 시작돼요. 이름·은행·금액·시각 4가지가 일치해야 해요.` 문구가 필요 없음.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/pages/customer/TransferPage.jsx`에 해당 문구가 `warn-banner info`로 하드코딩되어 있음.
  - 구현 상태 구분: 프론트 문구만 해당. 백엔드 영향 없음.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle `ScreenTransfer`에도 같은 안내 문구가 있음.
  - 사용자 최신 요청이 design-bundle 코드보다 우선임.
- 관련 프론트 파일:
  - `src/pages/customer/TransferPage.jsx`
  - `src/pages/customer/__tests__/TransferPage.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - 없음
- 기능 유형: UI 제거
- 심각도: P3
- 수정 방향:
  - 해당 `warn-banner info` 블록을 제거함.
  - 결제 금액, 은행, 입금자 이름, 제출 버튼은 유지함.
- 구현 전 확인 필요 사항:
  - 이 문구 제거 후 은행/이름/금액 입력 의도가 충분히 명확한지 모바일 화면에서 확인 필요.
- 테스트 포인트:
  - 문구가 화면에 노출되지 않는지.
  - 이체 완료 요청 폼 제출 동작은 유지되는지.

---

## 6. 이체 완료 요청 중복 제출 UX 개선

- 번호: 6
- 사용자가 발견한 현상: 이체 완료 요청 버튼을 누른 후 뒤로가기로 다시 은행/입금자 이름을 입력하고 제출하면 `불법 상태 전이: TRANSFER_REPORTED → TRANSFER_REPORTED`가 표시됨.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `server/routes/customer.js`의 `POST /api/orders/:id/transfer-report`는 `transition(existing.status, 'TRANSFER_REPORTED')`를 호출함.
  - **확인됨**: `server/domain/order-state.js`는 `TRANSFER_REPORTED → TRANSFER_REPORTED`를 불법 전이로 판단하고 `StateTransitionError`를 throw함.
  - **확인됨**: `server/middleware/error.js`는 `StateTransitionError`를 409 `ILLEGAL_TRANSITION`으로 반환하며 메시지는 내부 문구 그대로임.
  - **확인됨**: `src/pages/customer/TransferPage.jsx`는 `ApiError.message`를 그대로 `serverError`로 보여줌.
  - 구현 상태 구분: 백엔드 상태 머신 보호는 있음. 사용자 친화적 중복 제출 처리는 백엔드/프론트 모두 미흡함.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle은 제출 시 상태를 `TRANSFER_REPORTED`로 바꾸는 데모 흐름만 있고, 중복 제출 예외 처리는 없음.
  - 최신 사용자 요청 기준으로 UX 정책을 새로 정의해야 함.
- 관련 프론트 파일:
  - `src/pages/customer/TransferPage.jsx`
  - `src/components/organisms/TransferReportForm.jsx`
  - `src/api/client.js`
  - `src/pages/customer/__tests__/TransferPage.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `POST /api/orders/:id/transfer-report`
  - `server/routes/customer.js`
  - `server/domain/order-state.js`
  - `server/middleware/error.js`
  - `orders.status`, `orders.transferred_at`
- 기능 유형: UX 개선, 상태 플로우 수정
- 심각도: P1
- 수정 방향:
  - 권장 정책:
    - `ORDERED → TRANSFER_REPORTED`는 정상 처리.
    - `TRANSFER_REPORTED`에서 다시 제출하면 DB 상태를 바꾸지 않고 사용자에게 `이미 이체 완료 요청이 접수됐어요. 본부 확인을 기다려주세요.`를 보여줌.
    - `PAID/COOKING/READY/DONE/CANCELED/HOLD`는 `TRANSFER_REPORTED`로 되돌리지 않음.
  - 구현 방식은 둘 중 하나:
    - 서버에서 `TRANSFER_REPORTED` 중복 제출을 별도 409 code(`TRANSFER_ALREADY_REPORTED`)와 친절한 message로 반환하고 프론트가 그대로 표시.
    - 또는 서버가 200으로 기존 주문을 반환하는 idempotent 처리를 함. 단, 상태와 timestamp는 변경하지 않아야 함.
  - 현재 구조상 서버가 명확한 code/message를 반환하고 프론트에서 code를 친절 문구로 매핑하는 방식이 가장 안전함.
- 구현 전 확인 필요 사항:
  - 중복 제출 후 자동으로 status 페이지로 이동할지, 폼에 안내만 보여줄지 확인 필요. 현장 UX상 status 페이지로 이동하는 편이 자연스러움.
  - `HOLD` 상태에서 사용자 재요청을 계속 막는 현재 정책을 유지할지 확인 필요. 이전 코드 주석은 HOLD 사용자 재요청 CTA를 제거했다고 설명함.
- 테스트 포인트:
  - 같은 주문으로 두 번째 transfer-report를 보내도 내부 `불법 상태 전이` 문구가 사용자 화면에 보이지 않는지.
  - DB status와 `transferred_at`이 덮어쓰이지 않는지.
  - `PAID/COOKING/READY/DONE/CANCELED/HOLD` 상태는 계속 재요청 불가인지.

---

## 7. 사용자 상태 화면 READY 이모지 제거

- 번호: 7
- 사용자가 발견한 현상: 현재 주문 상태 화면에서 `픽업 준비 완료` 문구 왼쪽 닭고기 이모지와 `#1번 수령 가능해요` 옆 체크 이모지를 제거해야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/pages/customer/StatusPage.jsx`의 `STATE_LABEL.READY`가 `🍗 픽업 준비 완료! 본부로 와 주세요!`로 시작함.
  - **확인됨**: `READY` 상태의 `ready-banner`가 `✅ #{order.no}번`을 표시함.
  - **확인됨**: `StatusChip`의 `READY` icon도 `✅`이지만, 사용자 요청 문맥은 상태 본문/ready-banner로 보임.
  - 구현 상태 구분: 프론트 문구/표시만 해당. 백엔드 영향 없음.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle `ScreenStatus`도 `ready-banner`에 `✅`를 사용함.
  - 최신 사용자 요청이 design-bundle보다 우선임.
- 관련 프론트 파일:
  - `src/pages/customer/StatusPage.jsx`
  - `src/components/molecules/StatusChip.jsx` 확인 필요
  - `src/pages/customer/__tests__/StatusPage.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - 없음
- 기능 유형: UI 제거
- 심각도: P3
- 수정 방향:
  - `STATE_LABEL.READY`에서 닭고기 이모지를 제거함.
  - `ready-banner`의 체크 이모지를 제거하고 `#{order.no}번 수령 가능해요!`만 표시함.
  - `StatusChip`의 아이콘까지 제거할지는 별도 확인 후 결정함.
- 구현 전 확인 필요 사항:
  - status chip의 상태 아이콘도 전체적으로 제거해야 하는지 확인 필요.
- 테스트 포인트:
  - READY 상태 화면의 큰 문구와 banner에 해당 이모지가 보이지 않는지.
  - READY 상태 핵심 문구는 유지되는지.

---

## 8. 본부 대시보드 카드에 주문 항목 표시

- 번호: 8
- 사용자가 발견한 현상: 본부 대시보드 카드에 주문번호, 가격, 이름, 상태, 경과 데이터뿐 아니라 주문 항목도 보여야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/components/organisms/AdminCardColumn.jsx`의 `OrderCard`는 주문번호, 금액, 이름, 상태, 경과 시간만 표시함.
  - **확인됨**: `server/repositories/order-repo.js`의 `listOrders`는 각 주문에 `items`를 붙여 반환함.
  - **확인됨**: `server/routes/admin.js`의 `GET /admin/api/orders`는 `listOrders(...).map(serializeAdminOrder)`로 items를 유지함.
  - 구현 상태 구분: 백엔드는 주문 항목 데이터를 이미 제공함. 프론트 카드 표시만 없음.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle의 간단 카드는 주문 항목을 표시하지 않음.
  - 다만 사용자 최신 요청은 현장 본부 운영에서 메뉴 확인이 필요하다는 요구임.
- 관련 프론트 파일:
  - `src/components/organisms/AdminCardColumn.jsx`
  - `src/pages/admin/DashboardPage.jsx`
  - `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `GET /admin/api/orders`
  - `server/repositories/order-repo.js`
  - `order_items`
- 기능 유형: 관리자 기능 추가, 대시보드 구조 수정
- 심각도: P1
- 수정 방향:
  - 카드 본문에 `order.items`를 2~3개까지 `이름 x수량`으로 표시함.
  - 항목이 많으면 `외 n개`로 축약함.
  - items가 없거나 응답 누락이면 기존 카드 정보만 표시하고 깨지지 않게 방어함.
- 구현 전 확인 필요 사항:
  - 품목 표시 최대 개수와 줄바꿈/축약 정책 확인 필요.
  - `주문 항목`을 이체 확인 카드에만 보여줄지, 모든 상태 카드에 보여줄지 확인 필요. 사용자 요청상 전체 본부 대시보드 카드로 해석함.
- 테스트 포인트:
  - 단일/복수 메뉴 주문이 카드에 표시되는지.
  - 긴 메뉴명 또는 여러 항목에서 카드 레이아웃이 깨지지 않는지.
  - API 응답에 items가 비어도 화면이 정상인지.

---

## 9. 경과 시간 -1분 시작 방지

- 번호: 9
- 사용자가 발견한 현상: 경과 시간이 `-1분 경과`부터 시작하지 말고 `0분 경과`부터 보여야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/utils/time.js`의 `elapsedMinutes`는 `Math.floor((now - start) / 60000)`를 그대로 반환함.
  - **확인됨**: `src/components/organisms/AdminCardColumn.jsx`는 이 값을 그대로 `{elapsedMin}분 경과`로 표시함.
  - **추정**: 서버 timestamp와 클라이언트 tick 사이의 미세한 시각 차이 또는 테스트 fixture의 미래 시각 때문에 음수가 될 수 있음.
  - 구현 상태 구분: 프론트 유틸 문제. 백엔드 timestamp ISO 변환은 이미 있음.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle mock 데이터는 `ago`를 양수 분 값으로만 사용함.
  - 운영 화면에서 음수 경과 시간은 의도되지 않음.
- 관련 프론트 파일:
  - `src/utils/time.js`
  - `src/components/organisms/AdminCardColumn.jsx`
  - `src/utils/__tests__/time.test.js`
  - `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `orders.transferred_at`
  - `server/routes/admin.js` timestamp 직렬화
  - `server/routes/customer.js` timestamp 직렬화
- 기능 유형: 시간 계산 수정
- 심각도: P2
- 수정 방향:
  - `elapsedMinutes`에서 계산 결과를 `Math.max(0, value)`로 clamp함.
  - invalid/null timestamp는 현재처럼 0을 반환함.
- 구현 전 확인 필요 사항:
  - `created_at` 기준 경과와 `transferred_at` 기준 경과 중 상태별 기준 시각 정책 확인 필요. 현재 카드는 `transferred_at` 없으면 0임.
- 테스트 포인트:
  - 시작 시간이 현재보다 1~59초 미래여도 0분으로 표시되는지.
  - 정상 과거 timestamp는 기존처럼 분 단위 표시되는지.
  - 5분/10분 warning 기준은 clamp 이후에도 정상인지.

---

## 10. HOLD 상태 버튼 문구 변경

- 번호: 10
- 사용자가 발견한 현상: 보류 상태의 `재확인` 문구를 `이체 확인`으로 변경해야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/components/organisms/AdminCardColumn.jsx`의 `ACTION_BY_STATUS.HOLD`에 `{ label: '재확인', to: 'PAID' }`가 있음.
  - **확인됨**: `src/pages/admin/OrderDetailPage.jsx`는 `HOLD`에서 `이체 확인` 액션 라벨을 이미 사용함.
  - 구현 상태 구분: 백엔드 상태 전이(`HOLD → PAID`)는 이미 있음. 프론트 대시보드 카드 라벨만 불일치.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle은 HOLD 액션을 `재확인`으로 표시함.
  - 최신 사용자 요청이 design-bundle보다 우선임.
- 관련 프론트 파일:
  - `src/components/organisms/AdminCardColumn.jsx`
  - `src/pages/admin/OrderDetailPage.jsx`
  - `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `POST /admin/api/orders/:id/transition`
  - `server/domain/order-state.js`
  - `orders.status`
- 기능 유형: UX 개선, 상태 플로우 수정
- 심각도: P2
- 수정 방향:
  - 대시보드 카드의 HOLD 액션 라벨을 `이체 확인`으로 변경함.
  - 실제 전이 대상은 현재처럼 `PAID`를 유지함.
- 구현 전 확인 필요 사항:
  - HOLD에서 바로 `PAID`로 가는 정책을 유지할지 확인 필요. 현재 상태 머신과 상세 페이지는 유지 중임.
- 테스트 포인트:
  - HOLD 카드에 `재확인`이 보이지 않고 `이체 확인`이 보이는지.
  - 버튼 클릭 시 `onAction(id, 'PAID')`가 호출되는지.

---

## 11. 본부 대시보드 카드 클릭 상세 이동 제거

- 번호: 11
- 사용자가 발견한 현상: 본부 대시보드 주문 카드를 눌러도 주문 상세 정보 페이지로 이동하지 않게 해야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/pages/admin/DashboardPage.jsx`가 `AdminCardColumn`에 `onSelectOrder={(id) => navigate(`/admin/orders/${id}`)}`를 전달함.
  - **확인됨**: `AdminCardColumn.jsx`의 `OrderCard`는 article과 내부 본문 button 클릭으로 `onSelect`를 호출함.
  - **확인됨**: 카드 class에 `cursor-pointer`, `hover:opacity-90`가 있어 클릭 가능해 보임.
  - 구현 상태 구분: 프론트 라우팅/상호작용 문제. 백엔드 영향 없음.
- design_bundle 기준 의도:
  - **확인됨**: `docs/design-bundle/uploads/USER_FLOW.md`에는 과거 흐름으로 카드 클릭 상세 이동이 언급되어 있음.
  - 그러나 design-bundle `screens-admin.jsx`의 카드 데모는 카드 내부 액션 버튼 중심으로 작동함.
  - 최신 사용자 요청은 대시보드에서 inline 액션만 쓰는 방향임.
- 관련 프론트 파일:
  - `src/pages/admin/DashboardPage.jsx`
  - `src/components/organisms/AdminCardColumn.jsx`
  - `src/pages/admin/__tests__/DashboardPage.test.jsx`
  - `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - 없음. `/admin/orders/:id` 라우트/API는 다른 경로에서 유지 가능.
- 기능 유형: UX 개선
- 심각도: P2
- 수정 방향:
  - Dashboard에서 `onSelectOrder`를 전달하지 않거나, `OrderCard` 본문 선택 핸들러를 제거함.
  - 카드 본문을 `<button>`으로 둘 필요가 없으면 비상호작용 markup으로 변경함.
  - cursor/pointer/hover 스타일을 제거해 카드 전체가 클릭 가능해 보이지 않도록 함.
  - 상태 변경 버튼은 계속 동작해야 함.
- 구현 전 확인 필요 사항:
  - `/admin/orders/:id` 상세 페이지 자체를 유지할지 확인 필요. 이번 요청은 대시보드 카드 클릭 이동 제거로 해석함.
  - 키보드 접근성상 카드 focus를 제거하고 액션 버튼만 focus 가능하게 할지 확인 필요.
- 테스트 포인트:
  - 카드 본문 클릭 시 navigate가 호출되지 않는지.
  - 액션 버튼 클릭은 계속 `POST /admin/api/orders/:id/transition`을 호출하는지.
  - 카드에 클릭 가능 pointer 스타일이 남지 않는지.

---

## 12. 장사 시작(시간 전) 버튼 UI 개선

- 번호: 12
- 사용자가 발견한 현상: `장사 시작(시간 전)` 버튼을 길게 늘어뜨리지 말고 UI/UX적으로 보기 좋게 변경해야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/components/organisms/StartBusinessCTA.jsx`는 `Button block`으로 전체 너비 버튼을 렌더링함.
  - **확인됨**: `DashboardPage.jsx`는 CLOSED 상태에서 `start-cta` 안내 카드와 별도 `StartBusinessCTA`를 연속으로 보여줌.
  - **추정**: 시간 전 상태의 secondary CTA가 전체 너비로 늘어나 사용자에게 과도하게 보이는 문제.
  - 구현 상태 구분: 프론트 UI만 해당. 백엔드 영업 시작 API는 있음.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle은 `.start-cta.urgent` 안에 설명과 버튼이 한 덩어리로 들어가며, 버튼이 카드 전체를 길게 차지하지 않음.
- 관련 프론트 파일:
  - `src/pages/admin/DashboardPage.jsx`
  - `src/components/organisms/StartBusinessCTA.jsx`
  - `src/styles/components.css`
  - `src/components/organisms/__tests__/StartBusinessCTA.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `POST /admin/api/business/open`
  - `business_state`
- 기능 유형: UX 개선
- 심각도: P2
- 수정 방향:
  - CLOSED 카드 내부 우측 또는 하단에 적정 폭의 CTA를 배치함.
  - 시간 전 상태는 secondary 톤의 compact button으로 표시하고, 안내 문구도 짧게 유지함.
  - `StartBusinessCTA`의 `block` 사용을 optional로 변경하거나 Dashboard 전용 배치를 조정함.
- 구현 전 확인 필요 사항:
  - 시간 전이어도 장사 시작을 허용하는 현재 정책을 유지할지 확인 필요. 현재 API는 시간 전 차단을 하지 않음.
  - 버튼 라벨을 `장사 시작`으로 통일할지, 시간 전 안내를 보조 텍스트로만 둘지 확인 필요.
- 테스트 포인트:
  - 시간 전 CLOSED 상태에서 버튼이 과도하게 긴 UI로 보이지 않는지.
  - 클릭 시 기존 API 호출과 상태 전환이 유지되는지.
  - 모바일에서 버튼과 안내 문구가 겹치지 않는지.

---

## 13. 장사 시작 후 빈 대시보드에서도 6개 상태 박스 유지

- 번호: 13
- 사용자가 발견한 현상: 장사 시작 후 주문이 없으면 `오늘 첫 주문 대기 중 주문이 들어오면 여기에 표시됩니다.` 문구가 뜨는데, 대신 본부 대시보드의 6개 박스가 보여야 함.
- 현재 구현에서 문제로 보이는 부분:
  - **확인됨**: `src/pages/admin/DashboardPage.jsx`는 `orders.length === 0`이면 `EmptyState`만 렌더링하고 `admin-board`를 렌더링하지 않음.
  - **확인됨**: `AdminCardColumn` 자체는 orders가 비면 `비어 있음`을 표시할 수 있음.
  - **확인됨**: `groupOrdersByStatus`는 항상 6개 status 키를 반환함.
  - 구현 상태 구분: 백엔드 문제 없음. 프론트 조건부 렌더링 문제.
- design_bundle 기준 의도:
  - **확인됨**: design-bundle `AdminDashboardBody`는 OPEN 상태에서 항상 `admin-board`를 렌더링하고, 각 컬럼이 비면 `— 비어있음 —`을 표시함.
- 관련 프론트 파일:
  - `src/pages/admin/DashboardPage.jsx`
  - `src/components/organisms/AdminCardColumn.jsx`
  - `src/constants/admin-columns.js`
  - `src/pages/admin/__tests__/DashboardPage.test.jsx`
- 관련 백엔드 파일/API/DB 테이블:
  - `GET /admin/api/orders`
  - `orders`
- 기능 유형: 대시보드 구조 수정
- 심각도: P2
- 수정 방향:
  - `orders.length === 0`이어도 `ADMIN_COLUMNS.map(...)`으로 6개 컬럼을 항상 렌더링함.
  - 전체 EmptyState는 제거하거나, 6개 컬럼 위/아래의 작은 보조 문구로만 표시함.
  - 컬럼 내부 빈 상태 문구를 `해당 상태 주문 없음` 정도로 변경 검토.
- 구현 전 확인 필요 사항:
  - 전체 빈 상태 안내를 완전히 제거할지, 보조 문구로 남길지 확인 필요.
- 테스트 포인트:
  - OPEN + 주문 0건에서 6개 컬럼이 모두 보이는지.
  - 각 컬럼 내부 빈 상태가 자연스럽게 보이는지.
  - 주문이 들어온 후 해당 컬럼에 카드가 정상 표시되는지.

---

## 우선순위 요약

| 우선순위 | 항목 | 이유 |
|---|---:|---|
| P1 | 2 | 관리자 내역/쿠폰 탭은 사용자 요청이 명확하고, 쿠폰 기록/운영 확인에 직접 영향 |
| P1 | 3 | non-37 학번 주문 차단은 주문 접수 자체에 직접 영향 |
| P1 | 6 | 입금 요청 중복 제출에서 내부 에러가 노출되어 사용자 혼란과 문의 발생 |
| P1 | 8 | 본부가 카드만 보고 조리/전달할 때 주문 항목 확인이 필요 |
| P2 | 1, 4, 9, 10, 11, 12, 13 | 현장 혼란 또는 운영자 불편 개선 |
| P3 | 5, 7 | 문구/표시 정리 |

