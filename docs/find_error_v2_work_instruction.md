# find_error_v2 작업 지시서

## 목표

이번 v2 수정의 목표는 실사용 테스트에서 드러난 혼란 요소를 줄이고, 사용자 주문 흐름과 관리자 운영 흐름을 현장 사용에 맞게 정리하는 것이다.

핵심 목표:

- 사용자가 헷갈리는 UI 제거
- 관리자 내역/쿠폰 탭 복구 또는 구현
- 주문 학번 검증과 쿠폰 대상 검증 분리
- 이체 완료 요청 중복 제출 UX 개선
- 관리자 대시보드에서 필요한 주문 정보 표시
- 빈 대시보드/장사 시작 UI 개선
- 실사용 현장에서 문의를 줄이는 방향으로 정리

## 수정 범위

### A. 사용자 메뉴/추천 UI 정리

1. 학생회 추천 BEST UI 밑에 작게 줍기 가능한 추천 메뉴 UX 제거
   - 대상: `src/components/organisms/RecommendedBanner.jsx`
   - 정책: 추천 BEST는 배너/요약만 남기고 작은 추천 카드와 줍기 버튼은 제거한다.

### B. 관리자 내역/쿠폰 탭 구현

2. 어드민 페이지 내역/쿠폰 탭 복구 및 동작 구현
   - 대상:
     - `src/components/layouts/AdminLayout.jsx`
     - `src/App.jsx`
     - 신규 `src/pages/admin/HistoryPage.jsx`
     - 신규 `src/pages/admin/CouponsPage.jsx`
     - `server/routes/admin.js`
     - `server/db/init.sql`
     - `server/repositories/coupon-repo.js`
   - 현재 확인:
     - `used_coupons` 테이블과 repo helper는 있음.
     - 관리자 쿠폰 사용 내역 API/페이지는 없음.
     - 주문 상태 변경 로그 테이블/API/페이지는 없음.

### C. 학번/쿠폰 검증 로직 수정

3. 주문은 숫자 9자리 학번이면 가능, 쿠폰은 `****37***` 패턴일 때만 사용 가능
   - 대상:
     - `src/pages/customer/CheckoutPage.jsx`
     - `server/routes/customer.js`
     - `server/domain/coupon.js`
   - 주문 가능 검증과 쿠폰 대상 검증을 분리한다.

### D. 주문 상태 화면 정리

4. 접수/입금/확인/조리/수령 시간 리스트 제거
   - 대상:
     - `src/pages/customer/StatusPage.jsx`
     - `src/components/organisms/OrderTimeline.jsx`
   - 사용자 화면에서는 `showMiniview=false`로 처리하는 방향을 우선한다.

7. 상태 화면의 닭고기/체크 이모지 제거
   - 대상:
     - `src/pages/customer/StatusPage.jsx`
   - `READY` 본문 문구와 ready banner의 이모지를 제거한다.

### E. 이체 완료 요청 화면 정리

5. “본부가 통장 입금을 확인하면 자동으로 조리가 시작돼요...” 문구 제거
   - 대상:
     - `src/pages/customer/TransferPage.jsx`

6. 이체 완료 요청 중복 제출 시 내부 에러 대신 친절한 안내 처리
   - 대상:
     - `server/routes/customer.js`
     - `server/domain/order-state.js`
     - `server/middleware/error.js`
     - `src/pages/customer/TransferPage.jsx`
     - `src/components/organisms/TransferReportForm.jsx`

### F. 관리자 대시보드 개선

8. 본부 대시보드 카드에 주문 항목 표시
   - 대상:
     - `src/components/organisms/AdminCardColumn.jsx`
     - `GET /admin/api/orders`
   - 백엔드는 이미 `order.items`를 내려주므로 프론트 표시가 핵심이다.

9. 경과 시간이 -1분이 아니라 0분부터 시작
   - 대상:
     - `src/utils/time.js`
     - `src/components/organisms/AdminCardColumn.jsx`

10. HOLD 상태의 “재확인” 문구를 “이체 확인”으로 변경
   - 대상:
     - `src/components/organisms/AdminCardColumn.jsx`

11. 본부 대시보드 주문 카드 클릭 시 상세 페이지로 이동하지 않게 변경
   - 대상:
     - `src/pages/admin/DashboardPage.jsx`
     - `src/components/organisms/AdminCardColumn.jsx`

12. 장사 시작(시간 전) 버튼 UI 개선
   - 대상:
     - `src/pages/admin/DashboardPage.jsx`
     - `src/components/organisms/StartBusinessCTA.jsx`
     - `src/styles/components.css`

13. 장사 시작 후 빈 상태에서도 6개 상태 박스가 항상 보이도록 변경
   - 대상:
     - `src/pages/admin/DashboardPage.jsx`
     - `src/components/organisms/AdminCardColumn.jsx`
     - `src/constants/admin-columns.js`

## 구현 정책

### 학번 정책

- 주문 가능 조건: 숫자 9자리
- 쿠폰 사용 가능 조건: 9자리 중 지정 위치에 `37`이 포함된 `****37***` 패턴
- 쿠폰 미대상 학번이어도 주문 자체는 가능
- 프론트와 백엔드 모두 동일 정책 적용
- 에러 문구도 구분
  - 학번이 9자리 숫자가 아님: “학번은 숫자 9자리로 입력해주세요.”
  - 쿠폰 대상이 아님: “해당 학번은 쿠폰 대상이 아니에요.”
  - 단, 쿠폰 대상이 아니어도 일반 주문은 가능해야 함

구현 세부:

- 프론트:
  - `ORDER_STUDENT_ID_PATTERN = /^\d{9}$/`
  - `COUPON_STUDENT_ID_PATTERN = /^\d{4}37\d{3}$/`
  - `valid`는 주문 학번 검증만 봐야 함.
  - `couponEligible`만 쿠폰 패턴을 봐야 함.
- 백엔드:
  - `POST /api/orders`에서 학생 주문의 `student_id`는 9자리 숫자인지 검증한다.
  - `coupon.used=true`일 때만 `consumeCoupon`의 `37` 패턴 검증을 적용한다.
  - 쿠폰 미사용 주문은 non-37 학번도 성공해야 한다.

### 이체 완료 요청 중복 제출 정책

- `ORDERED → TRANSFER_REPORTED` 정상
- `TRANSFER_REPORTED`에서 다시 제출하면 내부 에러를 노출하지 않음
- 사용자 문구:
  “이미 이체 완료 요청이 접수됐어요. 본부 확인을 기다려주세요.”
- DB 상태는 변경하지 않음
- `PAID/COOKING/READY/DONE/CANCELED/HOLD`는 여전히 사용자 재요청 불가
- 내부 에러 메시지 “불법 상태 전이...”가 사용자 화면에 노출되면 안 됨

권장 구현:

- 서버에서 기존 주문 상태가 `TRANSFER_REPORTED`이면 상태 변경 없이 별도 code/message를 반환한다.
- 예: 409 `{ error: 'TRANSFER_ALREADY_REPORTED', message: '이미 이체 완료 요청이 접수됐어요. 본부 확인을 기다려주세요.' }`
- 프론트는 해당 code를 친절 문구로 표시하고, 가능하면 status 페이지로 이동시킨다.
- `PAID/COOKING/READY/DONE/CANCELED/HOLD`는 기존 409 또는 별도 친절 문구로 막되, `TRANSFER_REPORTED`로 되돌리지 않는다.

### 관리자 내역 탭 정책

- 주문 상태 변경 로그를 보여주는 화면으로 정의
- 최소 표시 항목:
  - 시간
  - 주문번호
  - 변경 전 상태
  - 변경 후 상태
  - 액션 이름
  - 처리 주체
- 백엔드 로그 테이블/API가 없으면 최소 구현 설계 포함
- 이미 있으면 해당 구조를 활용

현재 확인:

- 주문 상태 변경 로그 테이블/API는 없음.
- `docs/DB_DRAFT.md`에는 `order_events` 설계가 있음.
- design-bundle은 `orders_audit` + `menu_audit`를 언급함.

권장 최소 구현:

- `order_events` 테이블 추가
  - `id`
  - `order_id`
  - `event_type`
  - `from_status`
  - `to_status`
  - `action_name`
  - `actor`
  - `note`
  - `created_at`
- 이벤트 기록 위치
  - 주문 생성
  - 사용자 이체 완료 요청 성공
  - 관리자 상태 전이 성공
  - 관리자 취소/보류
- API
  - `GET /admin/api/history?date=YYYY-MM-DD&type=orders`

### 관리자 쿠폰 탭 정책

- 쿠폰 사용 내역을 보여주는 화면으로 정의
- 최소 표시 항목:
  - 사용 시간
  - 주문번호
  - 이름
  - 학번
  - 쿠폰명
  - 할인 금액
- 쿠폰 사용 기록이 현재 주문 데이터에만 있다면 별도 기록 테이블이 필요한지 분석
- 최소 변경으로 구현 가능한 방향 제시

현재 확인:

- `used_coupons` 테이블은 있음.
- `used_coupons`에는 `student_id`, `name`, `order_id`, `used_at`이 있음.
- 쿠폰명/할인금액 컬럼은 없음.
- 현재 쿠폰 사용 기록은 주문 생성 트랜잭션에서 생성됨.

권장 최소 구현:

- 별도 테이블을 추가하지 않고 `used_coupons JOIN orders` 조회로 시작한다.
- `coupon_name`은 `컴모융 1,000원 할인`, `discount_amount`는 `1000` 상수로 내려준다.
- API:
  - `GET /admin/api/coupons/usage?date=YYYY-MM-DD`
- 응답 예:

```json
[
  {
    "used_at": "2026-05-20T17:30:00Z",
    "order_id": 17,
    "order_no": 17,
    "name": "홍길동",
    "student_id": "202637042",
    "coupon_name": "컴모융 1,000원 할인",
    "discount_amount": 1000
  }
]
```

### 관리자 대시보드 카드 정책

- 카드에 주문번호, 가격, 이름, 상태, 경과 시간뿐 아니라 주문 항목도 표시
- 예:
  - 후라이드 x1
  - 콜라 x2
- 너무 길면 2~3개까지만 표시하고 “외 n개” 처리 가능
- `order.items`가 없거나 비어도 카드가 깨지면 안 됨
- 항목 표시가 상태 변경 버튼을 밀어내지 않도록 카드 내부 간격을 조정한다.

### 대시보드 카드 클릭 정책

- 카드 전체 클릭으로 상세 페이지 이동하지 않음
- 상태 변경 버튼만 동작
- 카드 클릭 가능해 보이는 cursor/pointer 스타일 제거
- 접근성상 button/article 구조 충돌이 없도록 정리
- 카드 본문은 비상호작용 영역으로 두고, 액션 버튼만 focusable하게 둔다.
- `/admin/orders/:id` 상세 라우트는 필요 시 다른 진입 경로로 유지할 수 있으나, 대시보드 카드 클릭으로는 이동하지 않는다.

### 빈 대시보드 정책

- 장사 시작 후 주문이 없어도 “오늘 첫 주문 대기 중...” 문구만 보이면 안 됨
- 본부 대시보드의 6개 상태 박스는 항상 보여야 함
- 각 박스 내부에 “해당 상태 주문 없음” 정도의 작은 빈 상태 문구를 표시
- `groupOrdersByStatus([])`가 이미 6개 키를 반환하므로 Dashboard의 `orders.length === 0` 전체 EmptyState 분기를 제거하거나 보조 문구로만 낮춘다.

## Claude 구현 순서 제안

1. `design_bundle`에서 내역/쿠폰/대시보드 구조 확인
   - 기준 폴더는 `docs/design-bundle`
   - 특히 `screens-admin.jsx`, `screens-customer.jsx`, `app.css` 확인
2. 현재 백엔드의 주문 로그/쿠폰 기록/API 존재 여부 확인
   - `used_coupons`는 있음
   - 내역 로그 테이블/API는 없음
   - 쿠폰 관리자 API는 없음
3. 학번 검증과 쿠폰 검증 분리
   - 프론트 `CheckoutPage`
   - 백엔드 `POST /api/orders`
   - 테스트 갱신
4. 이체 완료 요청 중복 제출 UX 수정
   - 서버 code/message 또는 프론트 매핑
   - 내부 `불법 상태 전이` 문구 미노출 보장
5. 사용자 상태 화면 불필요 UI/문구/이모지 제거
   - status timeline miniview 제거
   - transfer 안내 문구 제거
   - READY 이모지 제거
6. 관리자 대시보드 카드 주문 항목 표시
7. 관리자 카드 클릭 상세 이동 제거
8. HOLD 액션 문구 변경
9. 경과 시간 0분 clamp 처리
10. 장사 시작 버튼/빈 대시보드 UI 수정
11. 내역/쿠폰 탭 구현
   - 쿠폰 탭은 `used_coupons` 기반으로 먼저 구현
   - 내역 탭은 `order_events` 또는 합의된 감사 로그 테이블/API 추가
12. 테스트 추가
13. lint/build/test 실행

## 주요 테스트 수정 후보

- `src/pages/customer/__tests__/CheckoutPage.test.jsx`
- `server/routes/__tests__/customer.test.js`
- `src/pages/customer/__tests__/TransferPage.test.jsx`
- `src/pages/customer/__tests__/StatusPage.test.jsx`
- `src/components/organisms/__tests__/OrderTimeline.test.jsx`
- `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
- `src/pages/admin/__tests__/DashboardPage.test.jsx`
- 신규 `src/pages/admin/__tests__/HistoryPage.test.jsx`
- 신규 `src/pages/admin/__tests__/CouponsPage.test.jsx`
- `server/routes/__tests__/admin.test.js`
- `server/repositories/__tests__/coupon-repo.test.js`

