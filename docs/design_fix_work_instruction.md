# design_fix 작업 지시서

## 최우선 정책

- 이번 design_fix는 기능 개발이 아니라 `design_bundle` 원본 디자인 복원입니다.
- 이 저장소의 실제 원본 디자인 경로는 `docs/design-bundle/`입니다. 작업 전 반드시 `docs/design-bundle/screens-admin.jsx`, `docs/design-bundle/screens-customer.jsx`, `docs/design-bundle/app.css`, `docs/design-bundle/tokens.css`를 먼저 확인하세요.
- Claude는 임의로 색감/레이아웃/버튼 스타일을 새로 만들지 마세요.
- `design_bundle`에 있는 색상, 카드, 박스, 버튼, 배치, 여백, 그림자, 라운드, 포인트 컬러를 최대한 그대로 반영하세요.
- 기능 로직은 건드리지 마세요.
- DB schema를 변경하지 마세요.
- API를 변경하지 마세요.
- 주문/쿠폰/입금/로그/상태 전이 로직을 변경하지 마세요.
- 필요한 경우 CSS/컴포넌트 구조만 최소 변경하세요.
- 앱 동작을 바꾸는 리팩터링, 백엔드 수정, 상태 정책 변경은 금지입니다.
- 테스트가 현재 find_error_v3 문구를 고정하고 있다면, 구현 변경에 맞춰 테스트 기대값만 조정하세요. 테스트 조정도 UI 문구/클래스 검증 범위 안에서만 하세요.

## 구현 기준 파일

- 원본 기준
  - `docs/design-bundle/screens-admin.jsx`
  - `docs/design-bundle/screens-customer.jsx`
  - `docs/design-bundle/app.css`
  - `docs/design-bundle/tokens.css`
- 현재 구현
  - `src/components/layouts/AdminLayout.jsx`
  - `src/pages/admin/DashboardPage.jsx`
  - `src/components/organisms/StartBusinessCTA.jsx`
  - `src/components/organisms/BusinessStateBadge.jsx`
  - `src/components/organisms/AdminCardColumn.jsx`
  - `src/pages/admin/MenuAdminPage.jsx`
  - `src/pages/customer/CompletePage.jsx`
  - `src/pages/customer/CheckoutPage.jsx`
  - `src/styles/components.css`

## 구현 항목

1. 영업 중 OPEN 초록 dot 복원
   - `AdminLayout.jsx`의 우측 `.biz-badge.open`에서 `OPEN` 옆 초록 dot이 확실히 보이게 하세요.
   - `DashboardPage.jsx`의 `.open-status`에서도 `영업 중` 옆 초록 dot과 pulse가 원본처럼 보여야 합니다.
   - `BusinessStateBadge.jsx`도 `영업 중 (OPEN)` 앞 dot이 사라지지 않게 정렬하세요.
   - 색상은 `var(--color-success)` 계열을 사용하고, 임의의 새 초록색을 만들지 마세요.

2. 장사 시작 카드/버튼 `design_bundle` 기준 복원
   - `DashboardPage.jsx`의 `CLOSED` 분기 구조를 `docs/design-bundle/screens-admin.jsx`의 `.start-cta.urgent` 구조에 맞추세요.
   - 카드 구성은 `cta-mascot`, `left`, 큰 primary 버튼 중심으로 맞추세요.
   - `StartBusinessCTA.jsx`는 실제 장사 시작 버튼 동작만 담당하게 하고, 카드 레이아웃을 어지럽히지 않게 하세요.
   - `BusinessStateBadge`를 CTA 카드 안에 새로 끼워 넣는 방식은 피하세요.
   - 장사 시작 전에도 아래 6개 상태 박스가 그대로 보여야 합니다.

3. 어드민 메뉴 가격 설정 저장/취소 이모지 복원
   - `MenuAdminPage.jsx`의 가격 편집 저장/취소 버튼을 원래 작은 아이콘 버튼 형태로 복원하세요.
   - find_error_v3에서 `✓ -> 저장`, `✕ -> 취소`로 바꾼 기록이 있으므로 `✓`/`✕` 계열을 우선 복원하세요.
   - 화면에는 작은 아이콘을 쓰되 `aria-label="저장"`, `aria-label="취소"`는 유지하세요.
   - 가격 저장 API, optimistic update, 품절/추천 토글은 건드리지 마세요.

4. CompletePage의 `치킨 디너 위너!` 제거
   - `src/pages/customer/CompletePage.jsx`에서 해당 한글 부 카피를 제거하세요.
   - `WINNER WINNER` / `CHICKEN DINNER!` 2줄 강조는 유지하세요.
   - 새 대체 문구를 만들지 마세요.

5. CompletePage 상단 연출 박스 `design_bundle` 느낌 반영
   - `DogTagFrame` 사용부를 원본 `<DogTag dropping pulse />` 감각에 맞추세요.
   - 현재 `pulse={false}`라면 원본처럼 pulse가 보이게 조정하세요.
   - `DogTagFrame`의 sessionStorage 1회 animation 정책은 유지하세요.

6. CompletePage 입금 안내 박스 `design_bundle` 디자인 반영
   - `.account-card`, `.acc-label`, `.acc-bank`, `.acc-no`, `.acc-amount`, `.acc-actions` 구조를 원본과 맞추세요.
   - `.acc-bank`에는 은행/예금주, `.acc-no`에는 계좌번호를 분리해서 보이게 하세요.
   - `.acc-amount`의 mono 28px, accent 색, dashed top border를 유지하세요.
   - 계좌 복사/금액 복사 기능은 그대로 둡니다.

7. 쿠폰 helper 문구 삭제
   - `CheckoutPage.jsx` 쿠폰 영역에서 화면 노출 문구는 `컴모융 학생 1,000원 할인`만 남기세요.
   - `학번 9자리 + 이름 입력 시 활성화됩니다.` 문구는 삭제하세요.
   - 쿠폰 활성/비활성 계산, 학번 정규식, 외부인 처리, 주문 payload는 변경하지 마세요.

8. 본부 대시보드 6컬럼/주문카드/색감/버튼/스크롤 디자인을 `design_bundle` 기준으로 정렬
   - `AdminCardColumn.jsx`의 카드 마크업을 `docs/design-bundle/screens-admin.jsx`의 `AdminOrderCard` 구조에 가깝게 맞추세요.
   - `.admin-board`, `.col`, `.col-head`, `.col-body`, `.order-card`, `.order-card.warn`, `.order-card.danger`, `.order-card .actions`는 원본 CSS를 기준으로 사용하세요.
   - Tailwind utility와 semantic CSS가 충돌해 색이 달라지는 부분은 정리하세요.
   - 6컬럼 상태 구성은 유지하세요.

9. 주문 카드가 너무 어두워 글씨가 안 보이는 문제 해결
   - 원본 토큰을 기준으로 배경과 글자 대비를 맞추세요.
   - 핵심 토큰은 `--color-bg`, `--color-surface`, `--color-elevated`, `--color-ink`, `--color-muted`, `--color-accent`입니다.
   - 노란색 포인트는 `--color-accent`를 사용하세요.
   - 임의의 밝은 카드 테마를 새로 만들지 말고, 원본 카드 톤 안에서 대비 문제를 해결하세요.

10. 취소 버튼/보류 버튼 등 위험 버튼도 `design_bundle` 톤에 맞춤
    - 주문 카드 내부의 `취소`, `보류`는 과한 빨간 배경이 아니라 원본 액션 버튼 톤에 맞추세요.
    - primary 액션만 노란 강조로 보이게 하고, 위험 액션은 원본 카드 내부 버튼처럼 조용하게 보이게 하세요.
    - 버튼 클릭 시 기존 상태 전이 API 호출은 그대로 유지하세요.

## 금지 사항

- 주문/쿠폰/입금/로그 API 변경 금지.
- DB schema 변경 금지.
- 상태 전이 로직 변경 금지.
- 쿠폰 검증 정책 변경 금지.
- 관리자 내역 로그 정책 변경 금지.
- `businessState` store 정책 변경 금지.
- `ORDERED`, `TRANSFER_REPORTED`, `PAID`, `COOKING`, `READY`, `HOLD`, `CANCELED` 전이 정책 변경 금지.
- `HOLD -> PAID` 정책 변경 금지.
- 서버 가격 계산 정책(ADR-020 Pattern B) 변경 금지.
- access token, session, localStorage/sessionStorage 보안 정책 변경 금지.
- `.env`, 비밀키, DB 실데이터, 세션 파일 열람/수정 금지.
- `design_bundle`에 없는 새로운 디자인 임의 창작 금지.
- 새 컬러 팔레트, 새 카드 스타일, 새 hero/marketing UI 추가 금지.

## 권장 작업 순서

1. `docs/design-bundle`의 원본 화면과 CSS selector를 먼저 확인합니다.
2. `DashboardPage.jsx`, `AdminLayout.jsx`, `StartBusinessCTA.jsx`, `BusinessStateBadge.jsx`에서 영업 상태/장사 시작 UI를 원본 구조로 맞춥니다.
3. `AdminCardColumn.jsx`와 `components.css`에서 대시보드 카드 구조와 색감 충돌을 정리합니다.
4. `MenuAdminPage.jsx` 가격 편집 버튼을 작은 아이콘 형태로 복원합니다.
5. `CompletePage.jsx`의 한글 부 카피 제거, dogtag pulse, account-card 구조를 정렬합니다.
6. `CheckoutPage.jsx` 쿠폰 helper 문구를 제거합니다.
7. 관련 UI 테스트 기대값만 갱신합니다.
8. 수동 QA에서 `design_bundle` 원본과 나란히 비교합니다.

## 우선순위

- P1: 영업 중 dot, 장사 시작 CTA, 장사 시작 전 6개 상태 박스, CompletePage 입금 안내 박스, 본부 대시보드 색감/카드 대비.
- P2: CompletePage 상단 연출, 위험 버튼 톤, 대시보드 노란 포인트/스크롤 감각.
- P3: 가격 저장/취소 아이콘, 쿠폰 helper 문구 삭제.

