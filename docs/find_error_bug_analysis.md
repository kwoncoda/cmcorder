# find_error 버그 분석 문서

## 검토 기준

- 현재 브랜치: `find_error`로 확인됨.
- 정확한 `design_bundle` 폴더명은 없고, `docs/design-bundle` 폴더가 존재함. 본 문서는 이 폴더를 디자인 기준으로 비교함.
- 실제 앱 소스코드와 민감 설정 파일은 수정하지 않았음.
- 표기 기준:
  - **확인됨**: 코드에서 직접 확인한 사실
  - **추정**: 코드 구조상 가능성이 높은 원인
  - **확인 필요**: 코드만으로 운영 의도나 실제 화면 상태를 확정할 수 없는 부분

## 유형별 요약

| 유형 | 관련 버그 | 요약 | 우선도 |
|---|---:|---|---|
| A. 이미지/디자인 표시 문제 | 1, 2, 3 | 추천 도장 문구, 인벤토리 이미지 유실, 로고 표시 문제 | P2 |
| B. 계좌 복사/입금 안내 문구 문제 | 4, 6 | 복사 문자열에 예금주 포함, `이체 신고` 문구 잔존 | P2 |
| C. 사용자 주문 상태 추적 플로우 문제 | 5, 13 | status 페이지에서 이체 완료 요청 진입 불가, 홈 재진입 경로 부족 | P1 |
| D. 이체 완료 요청/확인 요청 플로우 문제 | 5, 6, 8 | 사용자는 요청 버튼을 놓치기 쉽고, 관리자 상세 조회가 깨질 수 있음 | P1 |
| E. 관리자 주문 상태 변경 플로우 문제 | 8, 9, 10 | 칸반 inline 액션 부재, 상세 조회 오류, 상태 이동 UX 불명확 | P0/P1 |
| F. 내역/쿠폰탭 비활성화 문제 | 11 | 라우트 미구현으로 의도적 disabled 처리 | P2 |
| G. 시간 계산 버그 | 7 | SQLite UTC timestamp를 KST 브라우저에서 local time처럼 파싱할 가능성 | P1 |
| H. 오픈 예정 문구 문제 | 12 | 코드/문서/design-bundle에 `16:30`, `11:00` 문구가 남아 있음 | P2 |

---

## A. 이미지/디자인 표시 문제

### 버그 1

- 버그 번호: 1
- 사용자가 발견한 현상: 후라이드(붕대), 뿌링클(의료용 키트) 이미지 뒤에 `recommended`가 써져 있음.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `src/constants/menus.js`와 `server/db/init.sql`에서 후라이드(`BANDAGE`)와 뿌링클(`MED_KIT`)의 `recommended` 초깃값이 `true`임.
  - **확인됨**: `src/components/molecules/StampBadge.jsx`의 기본 recommended 라벨이 영문 `RECOMMENDED`임.
  - **확인됨**: `MenuCard`는 `recommended={m.recommended}`일 때 이미지 위에 `StampBadge variant="recommended"`를 절대 위치로 표시함.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/constants/menus.js`
  - `server/db/init.sql`
  - `src/components/organisms/MenuCard.jsx`
  - `src/components/molecules/StampBadge.jsx`
  - `src/pages/admin/MenuAdminPage.jsx`
- design_bundle 기준과 다른 점:
  - `docs/design-bundle/data.js`도 후라이드/뿌링클을 `recommended: true`로 둠.
  - `docs/design-bundle/screens-customer.jsx`도 `RECOMMENDED` 도장을 표시함.
  - 따라서 현재 구현은 design-bundle과 대체로 일치하지만, 사용자 기대와 다름.
- 심각도: P2
- 수정 방향:
  - 추천 표시 정책을 다시 결정해야 함.
  - 선택지: 추천 도장 제거, `추천`/`BEST` 한글 배지로 변경, 추천 메뉴 영역에만 표시하고 일반 카드에서는 숨김.
- Claude가 수정 전에 확인해야 할 사항:
  - 후라이드/뿌링클을 추천 메뉴로 유지할지 확인 필요.
  - 영문 `RECOMMENDED` 도장을 완전히 제거할지, 한글/아이콘 배지로 바꿀지 확인 필요.
- 테스트 포인트:
  - 홈 전체 메뉴 카드에서 후라이드/뿌링클 도장 표시 여부.
  - 추천 탭과 `학생회 추천 BEST` 배너 표시 정책.
  - 관리자 메뉴 관리의 `BEST 표시` 토글과 사용자 화면 반영.

### 버그 2

- 버그 번호: 2
- 사용자가 발견한 현상: 메뉴를 담고 인벤토리로 들어가면 메뉴 이미지가 이모지로 보이고, 알려준 배그 이미지가 보이지 않음.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `MenuList`는 `m.image`가 있으면 `MenuCard`에 `useFallback={false}`를 넘겨 실제 `/items/*.webp` 이미지를 표시함.
  - **확인됨**: `cart` store의 `addItem`은 `menuId`, `name`, `basePrice`, `category`, `quantity`만 저장하고 `image`, `code`, `sub`를 저장하지 않음.
  - **확인됨**: `CartPage`는 store item의 `image`를 다시 `CartItem`에 전달하지만, store에 image가 없어서 `useFallback={!item.image}`가 `true`가 됨.
  - 결과적으로 인벤토리에서는 `MenuFallback`의 🍗/🍟/🥤 이모지로 떨어짐.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/store/cart.js`
  - `src/pages/customer/CartPage.jsx`
  - `src/components/organisms/CartItem.jsx`
  - `src/components/molecules/MenuFallback.jsx`
  - `public/items/*.webp`
- design_bundle 기준과 다른 점:
  - `docs/design-bundle/screens-customer.jsx`의 cart item은 `it.img`가 있으면 `<img>`를 사용함.
  - `docs/design-bundle/data.js`에는 각 메뉴의 `img`가 유지됨.
  - 현재 구현은 메뉴 화면에서는 이미지가 유지되지만, 인벤토리 상태 저장 단계에서 이미지 메타데이터가 사라져 design-bundle과 다름.
- 심각도: P2
- 수정 방향:
  - cart item에 `image`, `code`, `sub`를 보존하거나, `CartPage`에서 `menuId`로 메뉴 원본 데이터를 재조인해야 함.
  - 주문 API payload에는 기존처럼 `menu_id`와 `quantity`만 보내 서버 가격 권위를 유지해야 함.
- Claude가 수정 전에 확인해야 할 사항:
  - cart store에 이미지 메타데이터를 저장해도 되는지, 아니면 메뉴 목록을 재조회해서 조인할지 결정 필요.
  - 이미지 누락 시 fallback 정책은 유지할지 확인 필요.
- 테스트 포인트:
  - 메뉴 담기 후 `/cart`에서 실제 `/items/*.webp` 이미지 표시.
  - 수량 변경/삭제 후에도 이미지 유지.
  - 새로고침 시 cart persistence가 없으므로 유지 필요 여부 확인 필요.

### 버그 3

- 버그 번호: 3
- 사용자가 발견한 현상: `오늘 저녁은 치킨이닭!` 문구 왼쪽 이미지 쪽 웹 로고가 검은색으로만 보임.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `CustomerLayout`은 `<div className="brand-mark" />`만 렌더링하고, CSS 배경 이미지로 `/mascot/mascot.png`를 사용함.
  - **확인됨**: `src/styles/components.css`의 `.brand-mark`는 `background-size: cover`, `background-color: #1a1d12`, `28px x 28px`임.
  - **확인됨**: `public/mascot/mascot.png`, `docs/design-bundle/assets/mascot.png`, `docs/design-bundle/uploads/웹 로고.png`의 SHA256 해시가 동일함.
  - **추정**: 이미지가 투명 영역을 갖거나 작은 28px 영역에서 `cover`로 잘리면 검은 배경색만 두드러질 수 있음.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/components/layouts/CustomerLayout.jsx`
  - `src/styles/components.css`
  - `public/mascot/mascot.png`
  - `docs/design-bundle/assets/mascot.png`
- design_bundle 기준과 다른 점:
  - design-bundle도 `.brand-mark`에 `assets/mascot.png`를 배경으로 사용함.
  - 실제 asset은 동일하지만, 현재 화면에서 검은색으로만 보인다면 CSS 크롭/배경색/투명 PNG 처리 문제를 확인해야 함.
- 심각도: P2
- 수정 방향:
  - `background-size: contain` 또는 `<img src="/mascot/mascot.png">` 구조로 변경 검토.
  - 검은 배경색이 필요한지 확인하고, 투명 이미지라면 배경색 제거 또는 로고가 드러나는 배경으로 조정.
- Claude가 수정 전에 확인해야 할 사항:
  - 사용자가 기대하는 로고가 `웹 로고.png` 전체인지, 28px 축소용 별도 crop 이미지가 필요한지 확인 필요.
  - 로고 주변 검은 배경을 완전히 제거할지 확인 필요.
- 테스트 포인트:
  - 모바일/데스크톱 헤더에서 로고가 단색 블록이 아닌 실제 캐릭터/로고로 식별되는지.
  - 관리자 로그인 화면의 brand mark도 같은 문제가 있는지.

---

## B. 계좌 복사/입금 안내 문구 문제

### 버그 4

- 버그 번호: 4
- 사용자가 발견한 현상: 계좌번호 복사 시 `국민은행 233001-04-403536 박동빈`이 뜨는데, `국민은행 233001-04-403536`만 뜨도록 해야 함.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `CompletePage`의 `ACCOUNT_TEXT`가 `${ACCOUNT_BANK} ${ACCOUNT_NUMBER} ${ACCOUNT_HOLDER}`로 구성되어 있음.
  - **확인됨**: 복사 버튼은 `copyText(ACCOUNT_TEXT)`를 호출함.
  - **확인됨**: 화면에는 `acc-bank`로 `국민은행 · 예금주 박동빈`, `acc-no`로 `국민은행 233001-04-403536`이 따로 표시됨.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/pages/customer/CompletePage.jsx`
- design_bundle 기준과 다른 점:
  - `docs/design-bundle/screens-customer.jsx`는 화면에는 예금주를 표시하지만 복사 동작은 `23300104403536` 숫자만 복사함.
  - 사용자가 요구한 복사 문자열은 design-bundle보다 은행명이 포함된 `국민은행 233001-04-403536`임.
- 심각도: P2
- 수정 방향:
  - 계좌번호 값은 유지하고, 복사 대상 문자열만 `국민은행 233001-04-403536`로 제한.
  - 화면의 예금주 안내는 그대로 둘지 확인 필요.
- Claude가 수정 전에 확인해야 할 사항:
  - 복사 완료 후 toast/버튼 라벨에 실제 복사 문자열을 보여줄지 확인 필요.
  - 예금주 `박동빈`은 화면 안내에는 유지해도 되는지 확인 필요.
- 테스트 포인트:
  - clipboard에 `국민은행 233001-04-403536`만 들어가는지.
  - 예금주가 복사 문자열에 포함되지 않는지.
  - fallback 복사 경로도 동일 문자열을 쓰는지.

### 버그 6

- 버그 번호: 6
- 사용자가 발견한 현상: `이체 신고 제출` 문구를 `이체 완료 요청`으로 바꿔야 함.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `TransferPage` 하단 sticky submit 버튼 문구가 `이체 신고 제출`임.
  - **확인됨**: `TransferReportForm` 내부 기본 버튼도 `이체 신고 제출`임.
  - **확인됨**: `StatusPage`의 `TRANSFER_REPORTED` 표시 문구도 `이체 신고 완료 — 본부 확인 대기`임.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/pages/customer/TransferPage.jsx`
  - `src/components/organisms/TransferReportForm.jsx`
  - `src/pages/customer/StatusPage.jsx`
  - 관련 테스트: `src/pages/customer/__tests__/TransferPage.test.jsx`, `src/components/organisms/__tests__/TransferReportForm.test.jsx`
- design_bundle 기준과 다른 점:
  - design-bundle은 `확인 요청 보내기`, `이체했어요 · 확인 요청 보내기`를 사용함.
  - 사용자 요구는 `이체 완료 요청`으로 더 명확함.
- 심각도: P2
- 수정 방향:
  - 사용자-facing 문구에서 `이체 신고`를 `이체 완료 요청` 또는 `이체 확인 요청`으로 통일.
  - API 경로명 `transfer-report`는 내부 구현명으로 유지 가능하지만, 사용자 화면에는 노출하지 않는 것이 좋음.
- Claude가 수정 전에 확인해야 할 사항:
  - 버튼 최종 문구를 `이체 완료 요청`으로 통일할지, 화면 제목은 `이체 확인 요청`으로 유지할지 확인 필요.
- 테스트 포인트:
  - transfer 페이지 submit 버튼 문구.
  - HOLD 재제출 버튼 문구.
  - 상태 페이지 `TRANSFER_REPORTED` 카피.

---

## C. 사용자 주문 상태 추적 플로우 문제

### 버그 5

- 버그 번호: 5
- 사용자가 발견한 현상: 주문중에서 조리 현황 보기에 들어가면 `주문 접수됨`, `입금 대기중`은 뜨지만, 이체 완료 후 확인 요청 버튼을 누를 방법이 없음.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: 주문 완료 페이지에는 `/orders/:id/transfer`로 가는 `이체 완료하고 확인 요청` 버튼이 있음.
  - **확인됨**: status 페이지의 sticky 영역은 현재 상태 표시와 `HOLD`일 때 `이체 정보 다시 보내기` 버튼만 제공함.
  - **확인됨**: `ORDERED` 상태의 status 페이지에는 `/orders/:id/transfer`로 이동하는 버튼이 없음.
  - 따라서 사용자가 status 페이지로 먼저 들어오면 이체 완료 요청 플로우가 끊김.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/pages/customer/CompletePage.jsx`
  - `src/pages/customer/StatusPage.jsx`
  - `src/pages/customer/TransferPage.jsx`
  - `src/App.jsx`
  - `src/hooks/useOrderToken.js`
  - `server/routes/customer.js`
- design_bundle 기준과 다른 점:
  - design-bundle의 완료 화면에는 이체 확인 요청 CTA가 있음.
  - design-bundle의 status 화면은 `HOLD` 재제출만 명시하고, `ORDERED`에서 transfer CTA는 명시하지 않음.
  - 실제 사용자 흐름상 status 페이지에서 `ORDERED` 상태일 때도 CTA가 필요함.
- 심각도: P1
- 수정 방향:
  - `StatusPage`에서 `ORDERED` 상태이면 `이체 완료 요청` 버튼을 노출하고 `/orders/:id/transfer`로 이동.
  - `TRANSFER_REPORTED` 상태에서는 중복 요청을 막고 현재 확인 대기 상태를 명확히 표시.
- Claude가 수정 전에 확인해야 할 사항:
  - status 페이지에서 바로 transfer 페이지로 이동시키는 방식인지, 모달로 요청을 받는 방식인지 확인 필요.
  - 요청을 누른 후 상태명을 `TRANSFER_REPORTED`로 유지할지, 별도 상태명을 추가할지 확인 필요.
- 테스트 포인트:
  - `/orders/:id/status?token=...`에서 `ORDERED` 상태 버튼 노출.
  - 버튼 클릭 후 `/orders/:id/transfer?token=...` 이동.
  - 제출 후 `/orders/:id/status?token=...` 복귀와 `TRANSFER_REPORTED` 표시.

### 버그 13

- 버그 번호: 13
- 사용자가 발견한 현상: 사용자가 홈으로 갔을 때 현재 주문이 조리 중인지, 수령 가능한지 알 수 없음. 예: `orders/1/status` 같은 방식으로 확인 가능해야 함.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: 라우트는 `/orders/:id/status`가 이미 존재함.
  - **확인됨**: 주문 생성 후 `access_token`을 `sessionStorage`의 `order:${id}:token`에 저장하고 URL에도 `?token=...`을 붙임.
  - **확인됨**: `GET /api/orders/:id`는 token이 없으면 401, token 불일치면 403을 반환함.
  - **확인됨**: 홈(`/menu`) 헤더나 본문에 최근 주문/status 재진입 UI가 없음.
  - **확인됨**: 경로의 `:id`는 주문번호 `no`가 아니라 DB `id` 기준임. 화면에는 `order.no`를 주문번호로 보여줌.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/App.jsx`
  - `src/pages/customer/CheckoutPage.jsx`
  - `src/pages/customer/StatusPage.jsx`
  - `src/hooks/useOrderToken.js`
  - `server/routes/customer.js`
  - `server/repositories/order-repo.js`
- design_bundle 기준과 다른 점:
  - design-bundle 프로토타입은 단일 메모리 `order` 상태로 화면을 전환하므로, 실제 새로고침/홈 재진입 문제를 다루지 않음.
  - 실제 구현은 보안을 위해 token 기반 조회를 요구하므로, 주문번호만으로 조회하는 구조는 현재 없음.
- 심각도: P1
- 수정 방향:
  - 홈에 `진행 중인 주문 보기` 또는 최근 주문 카드 추가.
  - sessionStorage에 저장된 최신 `orderId`/token 목록을 활용하거나 서버 조회 정책을 별도로 설계.
  - 주문번호(`no`)만 입력해 조회할 경우 보안상 추가 식별값 또는 token 링크가 필요함.
- Claude가 수정 전에 확인해야 할 사항:
  - 사용자가 말한 `orders/1/status`의 `1`이 DB id인지 주문번호 `no`인지 확인 필요.
  - 주문번호만 알아도 조회 허용할지, token 또는 학번/이름 같은 추가 식별값을 요구할지 확인 필요.
  - `sessionStorage`는 브라우저 세션 종료 시 사라지므로 `localStorage` 사용 여부 확인 필요.
- 테스트 포인트:
  - 주문 완료 후 자동 또는 버튼으로 status 진입.
  - 홈으로 갔다가 최근 주문/status 재진입.
  - 새로고침 후 token 유지.
  - token 없는 `/orders/:id/status` 접근 시 안내 문구.

---

## D. 이체 완료 요청/확인 요청 플로우 문제

### 버그 8

- 버그 번호: 8
- 사용자가 발견한 현상: 어드민 페이지에 `이체 확인 요청`이 하나 떴는데 클릭하면 `주문을 불러올 수 없어요`가 뜸. 클릭 시 어떤 기능인지 확인 필요.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `TransfersPage`와 관리자 대시보드 카드는 클릭 시 `/admin/orders/:id`로 이동함.
  - **확인됨**: `OrderDetailPage`는 `API.ADMIN_ORDER(id)` 응답을 `OrderSchema`로 검증함.
  - **확인됨**: 관리자 API `GET /admin/api/orders/:id`는 `getOrder`의 raw DB row를 그대로 반환함.
  - **추정**: raw DB row의 `is_external`은 SQLite integer `0/1`인데 `OrderSchema`는 boolean을 기대하므로 zod validation이 실패하고 `주문을 불러올 수 없어요`가 표시될 가능성이 높음.
  - **확인 필요**: 실제 브라우저 콘솔/네트워크에서 validation error details 확인 필요.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/pages/admin/TransfersPage.jsx`
  - `src/pages/admin/DashboardPage.jsx`
  - `src/pages/admin/OrderDetailPage.jsx`
  - `src/api/schemas.js`
  - `server/routes/admin.js`
  - `server/repositories/order-repo.js`
- design_bundle 기준과 다른 점:
  - design-bundle의 관리자 카드 액션은 상세 페이지 이동 없이 카드 안에서 `확인`, `보류` 등을 처리하는 프로토타입임.
  - 현재 구현은 카드 클릭 → 상세 페이지 → 액션 버튼 방식임.
- 심각도: P1
- 수정 방향:
  - 관리자 주문 상세용 schema를 raw DB 응답에 맞추거나, 관리자 API 응답을 프론트 schema에 맞게 serialize.
  - 클릭 목적을 명확히 정리: 상세 보기인지, 즉시 액션인지, 둘 다인지 결정.
- Claude가 수정 전에 확인해야 할 사항:
  - 관리자 카드 클릭 UX를 design-bundle처럼 inline action으로 할지, 상세 페이지를 유지할지 확인 필요.
  - 현재 `주문을 불러올 수 없어요`의 실제 에러가 schema validation인지 네트워크/인증 문제인지 로그 확인 필요.
- 테스트 포인트:
  - `TRANSFER_REPORTED` 주문 클릭 시 상세 정상 표시.
  - raw API 응답의 `is_external`, `items`, timestamp 필드 schema 통과.
  - 401/403/404와 validation error UI 구분.

---

## E. 관리자 주문 상태 변경 플로우 문제

### 버그 9

- 버그 번호: 9
- 사용자가 발견한 현상: design_bundle 기준으로 `이체 확인 요청` 밑에 `확인`과 `보류`가 떠야 하는데 안 뜸. 다른 상태도 확인 필요.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: 현재 대시보드 `AdminCardColumn`의 `OrderCard`에는 상태별 액션 버튼이 없음. 카드 클릭만 있음.
  - **확인됨**: 액션 버튼은 `OrderDetailPage`에만 있음.
  - **확인됨**: design-bundle은 `TRANSFER_REPORTED` 카드에 `✓ 확인`, `보류` 버튼을 inline으로 표시함.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/components/organisms/AdminCardColumn.jsx`
  - `src/pages/admin/OrderDetailPage.jsx`
  - `src/constants/admin-columns.js`
  - `server/domain/order-state.js`
  - `server/routes/admin.js`
  - `docs/design-bundle/screens-admin.jsx`
- design_bundle 기준과 다른 점:
  - design-bundle 상태별 inline 액션:
    - `ORDERED`: 취소
    - `TRANSFER_REPORTED`: 확인, 보류
    - `PAID`: 조리 시작
    - `COOKING`: 조리 완료
    - `READY`: 전달 완료
    - `HOLD`: 재확인, 취소
  - 현재 칸반에는 inline 액션이 없고, 상세 페이지로 들어가야 함.
- 심각도: P1
- 수정 방향:
  - design-bundle 기준으로 칸반 카드에 상태별 액션 버튼을 추가하거나, 상세 페이지 이동 구조를 유지하되 카드에 명확한 CTA를 추가.
  - 액션명은 사용자 요구에 맞춰 `확인`, `보류`, `조리 시작`, `수령대기`, `완료` 등으로 정리.
- Claude가 수정 전에 확인해야 할 사항:
  - design-bundle처럼 칸반 카드에서 바로 상태 변경해도 되는지 확인 필요.
  - 보류 사유 입력이 필수인지 확인 필요.
- 테스트 포인트:
  - `TRANSFER_REPORTED` 카드에서 확인/보류 버튼 표시.
  - 각 버튼 클릭 후 API 호출과 컬럼 이동.
  - 상세 페이지와 칸반 inline 액션이 중복될 경우 일관성.

### 버그 10

- 버그 번호: 10
- 사용자가 발견한 현상: 현재 이체완료로 옮길 수 없음. 이체 확인 요청에서 옆으로 옮기는 방법이 없음.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: 백엔드 상태 머신은 `TRANSFER_REPORTED -> PAID`를 합법 전이로 허용함.
  - **확인됨**: `OrderDetailPage`에는 `confirm_transfer` 액션이 있고 `to: 'PAID'`로 전환함.
  - **확인됨**: 하지만 칸반 카드에는 전환 버튼이 없고, 상세 페이지는 버그 8 때문에 열리지 않을 수 있음.
  - 따라서 실사용에서는 `TRANSFER_REPORTED -> PAID` 전환 경로가 막힌 것으로 보임.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `server/domain/order-state.js`
  - `server/routes/admin.js`
  - `src/pages/admin/OrderDetailPage.jsx`
  - `src/components/organisms/AdminCardColumn.jsx`
- design_bundle 기준과 다른 점:
  - design-bundle은 `TRANSFER_REPORTED` 카드에서 `✓ 확인`을 누르면 바로 `PAID`로 이동함.
  - 현재 구현은 상세 페이지 방식이고, 칸반 직접 이동이 없음.
- 심각도: P0
- 수정 방향:
  - 먼저 관리자 상세 조회 오류를 해결.
  - 그 다음 `TRANSFER_REPORTED` 상태에서 `확인` 버튼으로 `PAID` 전환이 가능한 UI를 보장.
  - 칸반 inline 액션 또는 상세 액션 중 하나를 운영자가 빠르게 사용할 수 있게 정리.
- Claude가 수정 전에 확인해야 할 사항:
  - `확인` 클릭 후 바로 `PAID`로 갈지, 바로 `COOKING`까지 갈지 확인 필요.
  - 사용자에게 보이는 `이체 완료` 상태를 별도 단계로 유지할지 확인 필요.
- 테스트 포인트:
  - `TRANSFER_REPORTED` 주문을 `PAID`로 전환.
  - 전환 후 관리자 칸반의 `이체완료` 컬럼으로 이동.
  - 사용자 status 페이지에서 `입금 확인 완료` 또는 `이체 완료`로 반영.

---

## F. 내역/쿠폰탭 비활성화 문제

### 버그 11

- 버그 번호: 11
- 사용자가 발견한 현상: 내역과 쿠폰탭이 비활성화되어 있음. 왜 그런지 확인 필요.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `AdminLayout`의 nav item에서 `/admin/history`와 `/admin/coupons`가 `disabled: true`로 설정됨.
  - **확인됨**: 주석에 `내역/쿠폰은 P1 Phase 2 — 라우트 미구현이라 disabled placeholder`라고 명시되어 있음.
  - **확인됨**: `App.jsx`에는 `/admin/history`, `/admin/coupons` 라우트가 없음.
  - **확인됨**: 서버에는 `GET /admin/api/history`, `GET /admin/api/coupons`가 없음. 쿠폰 사용 데이터는 `used_coupons` 테이블과 정산 요약에서만 일부 사용됨.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/components/layouts/AdminLayout.jsx`
  - `src/App.jsx`
  - `server/db/init.sql`
  - `server/domain/coupon.js`
  - `src/pages/admin/SettlementPage.jsx`
  - `docs/design-bundle/screens-admin.jsx`
- design_bundle 기준과 다른 점:
  - design-bundle에는 `AdminHistory`와 `AdminCoupons` placeholder 화면이 존재함.
  - 현재 실제 구현은 nav만 있고 라우트/API가 없어서 의도적으로 비활성화됨.
- 심각도: P2
- 수정 방향:
  - 운영에 필요한 범위를 결정해야 함.
  - 최소안: nav에서 숨기거나 `준비 중` 화면으로 라우팅.
  - 구현안: 내역 API/화면, 쿠폰 사용 내역 API/화면 추가.
- Claude가 수정 전에 확인해야 할 사항:
  - 이번 버그 수정에서 내역/쿠폰탭을 실제 활성화할지, 숨김/준비중으로 둘지 확인 필요.
  - 쿠폰 사용 내역에 학번/이름이 포함되므로 개인정보 노출 범위 확인 필요.
- 테스트 포인트:
  - nav disabled 여부와 접근성 `aria-disabled`.
  - 활성화 시 `/admin/history`, `/admin/coupons` 라우트 접근.
  - 쿠폰 중복 사용 방지와 정산 요약 유지.

---

## G. 시간 계산 버그

### 버그 7

- 버그 번호: 7
- 사용자가 발견한 현상: 몇 분 안 지났는데 이체 확인 요청이 `540분 경과`라고 뜸.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `AdminCardColumn`은 `new Date(order.transferred_at)`와 `new Date(tick)`의 차이로 분을 계산함.
  - **확인됨**: 서버는 SQLite `datetime('now')`로 `transferred_at`을 저장함.
  - **추정**: SQLite `datetime('now')`는 UTC 기준 문자열을 만들고, 브라우저가 `YYYY-MM-DD HH:mm:ss`를 KST local time으로 해석하면 9시간 차이, 즉 540분 오차가 발생할 수 있음.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/components/organisms/AdminCardColumn.jsx`
  - `server/repositories/order-repo.js`
  - `server/db/init.sql`
- design_bundle 기준과 다른 점:
  - design-bundle 목데이터는 `ago` 값을 직접 넣어 표시하므로 timezone parsing 문제가 드러나지 않음.
  - 실제 구현은 서버 timestamp를 브라우저에서 파싱하므로 timezone 정책이 필요함.
- 심각도: P1
- 수정 방향:
  - 서버 timestamp를 ISO 8601 with timezone으로 반환하거나, SQLite 저장 시 localtime/UTC 정책을 명확히 통일.
  - 클라이언트에서 `YYYY-MM-DD HH:mm:ss`를 임의 파싱하지 않도록 안전한 parser를 둠.
  - 가능하면 서버가 `elapsed_minutes`를 계산해 내려주는 방식도 검토.
- Claude가 수정 전에 확인해야 할 사항:
  - 운영 서버/DB timezone이 UTC인지 KST인지 확인 필요.
  - 기존 DB timestamp를 마이그레이션해야 하는지 확인 필요.
- 테스트 포인트:
  - 이체 요청 직후 0~1분 표시.
  - 5분/10분 경계 border 색상.
  - KST 브라우저, UTC 서버 조합에서 540분 오차 재현/해소.

---

## H. 오픈 예정 문구 문제

### 버그 12

- 버그 번호: 12
- 사용자가 발견한 현상: 오픈 예정 문구를 모두 `오후 3시에 오픈할 예정`으로 바꿔야 함.
- 실제 코드/화면 구조상 원인으로 보이는 부분:
  - **확인됨**: `ClosedScreen`은 `오늘 부스는 16:30부터 시작합니다`, `16:30 ~ 21:00`, `11:00 ~ 21:00` 문구를 사용함.
  - **확인됨**: `businessState` store의 `SCHEDULE`은 5/20 `16:30`, 5/21 `11:00` 시작임.
  - **확인됨**: `server/db/init.sql`의 `business_open_time`도 `16:30`임.
  - **확인됨**: design-bundle과 기존 docs에도 16:30 기준 문구가 다수 남아 있음.
- 관련 파일/컴포넌트/API/상태관리 위치:
  - `src/components/organisms/ClosedScreen.jsx`
  - `src/store/businessState.js`
  - `server/db/init.sql`
  - `docs/design-bundle/screens-customer.jsx`
  - `docs/design-bundle/screens-admin.jsx`
- design_bundle 기준과 다른 점:
  - design-bundle은 16:30 오픈 기준임.
  - 사용자 요구는 15:00 오픈 문구로 변경하는 것이므로 design-bundle 기준도 함께 업데이트가 필요한지 확인해야 함.
- 심각도: P2
- 수정 방향:
  - 사용자-facing 문구는 `오후 3시에 오픈할 예정`으로 통일.
  - 실제 `shouldBeOpen` 계산 시간도 15:00으로 바꿀지, 문구만 바꿀지 분리해서 결정.
- Claude가 수정 전에 확인해야 할 사항:
  - 두 운영일 모두 15:00 오픈인지 확인 필요.
  - 관리자 `장사 시작` 알림 기준도 15:00으로 바꿀지 확인 필요.
  - 기존 문서 전체를 수정할지, 앱 소스와 design-bundle만 수정할지 확인 필요.
- 테스트 포인트:
  - `/closed` 화면 문구.
  - 관리자 CLOSED CTA 안내.
  - `shouldBeOpen` 경계 시간 테스트.
  - DB 초기값 `business_open_time`과 운영 문구 일치.
