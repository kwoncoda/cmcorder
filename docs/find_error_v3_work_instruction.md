# find_error_v3 작업 지시서

## 목표

이번 v3 수정의 목표는 실사용 테스트에서 발견된 쿠폰 중복 사용 문제를 막고, 관리자 운영 화면을 `docs/design-bundle`의 의도에 더 가깝게 정리하는 것이다.

핵심 목표:

- 쿠폰 중복 사용을 학번 기준으로 확실히 차단
- 관리자 내역 탭을 전체/주문/메뉴/시스템 구조로 확장
- 관리자 메뉴에 각 메뉴 효과 정보 표시
- 불필요한 이체확인 탭 제거
- 사용자/관리자 문구 정리
- 어드민 페이지 이모지 제거
- `docs/design-bundle` 기준으로 장사 시작 UI와 대시보드 카드 UI 개선

## 사용자 결정사항

- 기존 운영 DB는 없으며 DB는 초기화할 예정입니다.
- 자동 백업 로그를 관리자 내역의 시스템 로그에 포함합니다.
- 관리자 로그인 로그를 관리자 내역의 시스템 로그에 포함합니다.
- 이체확인 라우트/API/컴포넌트는 향후 사용 가능성을 고려해 남기고, nav에서만 제거합니다.
- 메뉴 효과는 DB/API 필드가 아니라 프론트 정적 매핑으로 둡니다.

## 수정 범위

### A. 쿠폰 정책 수정

1. 쿠폰 중복 여부를 이름이 아니라 학번 기준으로 검사
2. 한 번 쿠폰을 사용한 학번은 다시 쿠폰 사용 불가
3. 쿠폰 중복이어도 일반 주문은 가능해야 함

대상 후보:

- `server/domain/coupon.js`
- `server/repositories/coupon-repo.js`
- `server/routes/customer.js`
- `server/db/init.sql`
- `server/db/bootstrap.js`
- `server/domain/__tests__/coupon.test.js`
- `server/routes/__tests__/customer.test.js`

### B. 관리자 내역 확장

4. 내역 탭에 전체 / 주문 / 메뉴 / 시스템 필터 구현
5. 주문 로그, 메뉴 변경 로그, 시스템 로그 저장 및 조회 구조 설계
6. 장사 시작, 메뉴 품절/가격 변경 등 중요 이벤트 기록

대상 후보:

- `server/db/init.sql`
- `server/db/bootstrap.js`
- `server/repositories/order-events-repo.js`
- 신규 후보: `server/repositories/admin-events-repo.js`
- `server/routes/admin.js`
- `server/routes/customer.js`
- `src/pages/admin/HistoryPage.jsx`
- `src/api/routes.js`
- `src/api/schemas.js`
- `src/pages/admin/__tests__/HistoryPage.test.jsx`
- `server/routes/__tests__/admin.test.js`

### C. 메뉴 효과 표시

7. 어드민 메뉴 페이지에 메뉴별 효과 표시

대상 후보:

- `src/pages/admin/MenuAdminPage.jsx`
- `src/constants/menus.js`
- `src/api/schemas.js`
- 필요 시 `server/routes/admin.js`
- 필요 시 `server/db/init.sql`

### D. 관리자 탭 구조 변경

8. 어드민 이체확인 탭 제거

대상 후보:

- `src/components/layouts/AdminLayout.jsx`
- `src/App.jsx`
- `src/pages/admin/TransfersPage.jsx`
- `src/__tests__/App.test.jsx`

### E. 문구 변경

9. 쿠폰 문구 변경
10. 쿠폰 대상 패턴 안내 문구 삭제
11. `admin1` 표시를 `어드민`으로 변경

대상 후보:

- `src/pages/customer/CheckoutPage.jsx`
- `src/components/layouts/AdminLayout.jsx`
- `src/pages/admin/HistoryPage.jsx`
- 필요 시 관리자 actor 표시 helper

### F. 관리자 UI/UX 개선

12. 장사 시작 UI를 `docs/design-bundle` 기준으로 개선
13. 영업 전에도 6개 상태 박스 유지
14. 어드민 페이지 이모지 제거, 단 open/영업중 초록 dot 유지
15. 대시보드 6개 박스, 내부 카드, 드래그/스크롤 UI를 `docs/design-bundle` 기준으로 개선
16. 취소 버튼 스타일 개선

대상 후보:

- `src/pages/admin/DashboardPage.jsx`
- `src/components/organisms/AdminCardColumn.jsx`
- `src/components/organisms/StartBusinessCTA.jsx`
- `src/components/organisms/BusinessStateBadge.jsx`
- `src/components/molecules/StatusChip.jsx`
- `src/pages/admin/SettlementPage.jsx`
- `src/pages/admin/CouponsPage.jsx`
- `src/pages/admin/MenuAdminPage.jsx`
- `src/pages/admin/HistoryPage.jsx`
- `src/pages/admin/TransfersPage.jsx`
- `src/styles/components.css`

## 구현 정책

### 쿠폰 중복 정책

- 쿠폰 중복 기준은 `student_id`입니다.
- 이름이 달라도 `student_id`가 같으면 쿠폰은 다시 사용할 수 없습니다.
- 한 학번당 쿠폰은 1회만 사용할 수 있습니다.
- 쿠폰 중복일 때는 쿠폰 사용만 막고, 일반 주문은 가능해야 합니다.
- 에러 문구:
  `이미 쿠폰을 사용한 학번이에요.`
- 백엔드가 최종 방어선이어야 합니다.
- 가능하면 `used_coupons.student_id`에 unique constraint 또는 equivalent 방어를 검토하세요.
- 기존 운영 DB는 없고 DB 초기화 예정이므로 기존 중복 `student_id` 데이터 마이그레이션은 고려하지 않아도 됩니다.
- 현재 구현은 `UNIQUE(student_id, name)` 및 `student_id + name` 조회 기준이므로 반드시 변경해야 합니다.
- 쿠폰 대상 여부 검증과 쿠폰 중복 사용 검증을 분리하세요.

### 관리자 내역 정책

- 내역 탭에는 전체 / 주문 / 메뉴 / 시스템 필터가 있어야 합니다.
- 전체는 모든 로그를 보여줍니다.
- 주문은 주문 생성, 이체 완료 요청, 관리자 상태 변경 등 주문 관련 로그입니다.
- 메뉴는 메뉴 품절 처리, 품절 해제, 가격 변경 등 메뉴 관련 로그입니다.
- 시스템은 장사 시작, 관리자 로그인, 시스템 시작 등 운영 관련 로그입니다.
- 자동 백업은 이 저장소에 실제 기능이 있으며, v3 시스템 로그 범위에 포함합니다.
- 관리자 로그인도 v3 시스템 로그 범위에 포함합니다.
- 로그 최소 표시 항목:
  - 시간
  - 유형
  - 제목/액션
  - 상세 내용
  - 처리 주체
  - 관련 주문번호 또는 메뉴명
- 기존 `order_events`는 주문 로그용으로 유지하세요.
- 메뉴/시스템 로그는 기존 `order_events.order_id NOT NULL` 구조와 맞지 않으므로, 신규 `admin_events` 테이블을 추가하고 history API에서 `order_events`와 합쳐 반환하는 방식을 우선 검토하세요.

### 메뉴 효과 정책

- 어드민 메뉴 페이지에 메뉴별 효과를 표시하세요.
- 효과 목록:
  - 후라이드: 회복량 +10
  - 양념: 회복량 +75
  - 뿌링클: 회복량 +100
  - 감자튀김: 부활
  - 뿌링감자튀김: 소생
  - 칠리스: 부스트 +100%
  - 콜라: 부스트 +60%
  - 사이다: 부스트 +40%
- 현재 `src/pages/admin/MenuAdminPage.jsx`에는 효과 컬럼이 있지만 API 응답에 `sub`가 없어 `—`가 표시될 수 있습니다.
- 사용자 결정에 따라 DB/API에 effect 필드를 추가하지 않습니다.
- `code` 기준 프론트 정적 매핑을 어드민 메뉴 페이지에 적용하세요.
- 사용자 요청은 어드민 페이지 기준이므로 사용자 메뉴 화면까지 확장하지 않습니다.

### 어드민 탭 정책

- 이체확인 탭은 nav에서 제거하세요.
- 대시보드에서 이체 확인 요청 상태를 처리할 수 있어야 합니다.
- 사용자 결정에 따라 `/admin/transfers` 라우트, `TransfersPage`, `GET /admin/api/transfers`는 남기세요.
- 구현은 nav 제거 + 기존 라우트/API 보존 방식으로 진행하세요.

### 문구 정책

- `쿠폰 사용 (컴모융 학생 한정 1,000원 할인)` → `컴모융 학생 1,000원 할인`
- `컴모융(****38***) 학생만 쿠폰 사용이 가능해요` 문구 삭제
- 현재 구현의 실제 문구는 `컴모융(****37***) 학생만 쿠폰 사용이 가능해요.`입니다. 이 문구도 삭제하세요.
- `admin1` 사용자 표시 → `어드민`
- 내부 계정명은 유지하되 화면 표시만 변환하는 것을 우선합니다.
- `actor` 값이 `admin` 또는 `admin1`로 들어오는 경우 모두 화면에서는 `어드민`으로 표시하는 helper를 검토하세요.

### 관리자 UI 정책

- 장사 시작 UI는 `docs/design-bundle`의 장사 시작 네모 칸 안 UI/UX를 최대한 반영합니다.
- 장사 시작 버튼은 `start-cta` 카드 안에 있어야 합니다.
- 장사 시작 전에도 아래 6개 상태 박스는 그대로 보여야 합니다.
- 어드민 페이지의 불필요한 이모지는 제거합니다.
- 단, 영업중/open 옆 초록색 동그라미는 유지합니다.
- 초록 dot은 가능하면 이모지 문자가 아니라 CSS 원형 dot으로 구현하세요.
- 대시보드 6개 상태 박스와 내부 주문 카드는 `docs/design-bundle` 스타일에 맞춰 개선합니다.
- 취소 버튼은 지나치게 강한 빨간색 버튼처럼 보이지 않게 개선합니다.
- 위험 액션임은 알 수 있어야 하되, 전체 UI를 해치지 않는 스타일로 조정합니다.
- `StatusChip`은 고객 화면에서도 사용되므로, 관리자 이모지 제거는 전역 삭제보다 관리자용 prop 또는 별도 표시 방식을 우선 검토하세요.

## Claude 구현 순서 제안

1. `docs/design-bundle`에서 관리자 내역, 메뉴, 시스템 로그, 대시보드 UI, 장사 시작 UI 확인
2. 현재 쿠폰 중복 검증 구조와 `used_coupons` 스키마 확인
3. 쿠폰 중복 기준을 `student_id`로 변경
4. 관리자 내역 로그 모델 확장 또는 범용화
5. 주문/메뉴/시스템 이벤트 기록 지점 추가
6. `HistoryPage`에 전체/주문/메뉴/시스템 필터 구현
7. 어드민 메뉴 페이지에 메뉴 효과 표시
8. 어드민 이체확인 탭 제거
9. 쿠폰/어드민 문구 변경
10. 어드민 이모지 제거
11. 장사 시작 UI와 대시보드 6컬럼/카드 디자인 개선
12. 취소 버튼 스타일 개선
13. 테스트 추가
14. lint/build/test 실행

## 구현 우선순위

- P0: 쿠폰 중복 기준을 `student_id`로 변경하고 DB 또는 애플리케이션 최종 방어선 추가
- P1: 관리자 내역을 전체/주문/메뉴/시스템 필터 구조로 확장하고 주요 이벤트 기록
- P2: 메뉴 효과 표시, 이체확인 탭 제거, 장사 시작 전 6컬럼 유지, 대시보드 UI 개선
- P3: 문구 정리, `admin1` 표시 변경, 이모지 제거 세부 정리

## 남은 확인 질문

- 쿠폰 중복 요청을 서버가 에러로 반환한 뒤 사용자가 쿠폰을 해제하고 재주문하게 할까요, 아니면 프론트에서 사전에 쿠폰 선택만 막을까요?
- 어드민 `StatusChip`의 이모지까지 모두 제거할까요?

## 확정되어 더 이상 질문하지 않아도 되는 사항

- 기존 DB 마이그레이션 정책: 기존 DB 없음, 초기화 예정
- 자동 백업 로그: 포함
- 관리자 로그인 로그: 포함
- 이체확인 라우트/API: 보존, nav만 제거
- 메뉴 효과 정보: 프론트 정적 매핑
