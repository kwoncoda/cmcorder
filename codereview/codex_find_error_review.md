# Codex find_error 구현 리뷰

## 1. 전체 평가

- 판단: **조건부 통과**
- 확인된 사실:
  - 현재 브랜치는 `find_error`이다.
  - `find_error`와 `main`은 같은 커밋을 가리키고 있어, 이번 리뷰는 `main` 대비 커밋 diff가 아니라 **커밋되지 않은 작업트리 변경사항** 기준으로 수행했다.
  - 사용자 주문 상태 CTA, 관리자 칸반 액션, 관리자 응답 직렬화, 시간 계산 ISO 변환, 계좌 복사 문자열, cart 이미지 메타데이터, 최근 주문 재진입 등 핵심 수정은 대부분 코드에 반영되어 있다.
  - 핵심 신규 테스트 일부는 통과했다. `npm test -- src/utils/__tests__/time.test.js src/components/organisms/__tests__/AdminCardColumn.test.jsx src/pages/customer/__tests__/StatusPage.test.jsx src/components/organisms/__tests__/RecentOrdersSection.test.jsx src/hooks/__tests__/useOrderToken.test.jsx src/store/__tests__/recentOrders.store.test.js` 결과 6개 파일, 80개 테스트 통과.
- 조건부 판단 이유:
  - P1 이슈 2개가 남아 있다. 특히 사용자 `transfer-report` API가 서버 상태 머신을 우회해 완료/취소/조리중 주문도 `TRANSFER_REPORTED`로 되돌릴 수 있다.
  - 관리자 칸반 inline 상태 변경 실패가 화면에 표시되지 않고 `console.warn`으로만 끝난다.
  - 전체 `npm test`는 시간 초과와 `EPIPE`로 완료 신호를 확인하지 못했다.

## 2. P0/P1 이슈

| 심각도 | 파일/위치 | 문제 | 재현 또는 근거 | 영향 | Claude에게 지시할 수정 방향 |
|---|---|---|---|---|---|
| P1 | `server/routes/customer.js:188`, `server/repositories/order-repo.js:173` | 사용자 이체 완료 요청 API가 `LEGAL_TRANSITIONS`를 검증하지 않고 `status = 'TRANSFER_REPORTED'`를 강제한다. | `/api/orders/:id/transfer-report`는 token만 확인한 뒤 `updateTransferInfo`를 호출한다. `updateTransferInfo`는 현재 상태 확인 없이 `TRANSFER_REPORTED`로 업데이트한다. | 유효 token을 가진 사용자가 `PAID`, `COOKING`, `READY`, `DONE`, `CANCELED` 주문을 다시 이체 확인 요청 상태로 되돌릴 수 있다. 정산/조리 현황/완료 데이터가 꼬일 수 있다. | `transfer-report` 처리 전에 현재 상태를 확인하고 허용 상태를 명시한다. 최소 `ORDERED`만 허용하고, `HOLD` 재제출 허용 여부는 정책 확인 후 결정한다. 허용되지 않는 상태는 409로 거부하고 테스트를 추가한다. |
| P1 | `src/pages/admin/DashboardPage.jsx:65`, `src/pages/admin/DashboardPage.jsx:69` | 관리자 칸반 상태 변경 실패가 사용자에게 보이지 않는다. | `handleAction` 실패 시 401만 로그인으로 보내고 나머지는 `console.warn('[admin-action]', ...)`으로 끝난다. 버튼별 pending/disabled 상태도 없다. | 운영자가 확인/보류/조리시작 버튼을 눌렀는데 네트워크 실패, CSRF 실패, 불법 전이 실패가 발생해도 화면상 실패를 모를 수 있다. 빠른 중복 클릭도 방어되지 않는다. | 카드 또는 컬럼 단위 error banner/toast를 추가하고, 요청 중인 주문/버튼은 disabled 처리한다. 실패 시 `ApiError.message`를 화면에 표시하고, 성공/실패 케이스 테스트를 추가한다. |

## 3. P2/P3 이슈

| 심각도 | 파일/위치 | 문제 | 재현 또는 근거 | 영향 | Claude에게 지시할 수정 방향 |
|---|---|---|---|---|---|
| P2 | `src/components/organisms/ClosedScreen.jsx:11`, `src/components/organisms/ClosedScreen.jsx:18`, `src/store/businessState.js:19` | 오픈 예정 기준이 15:00으로 완전히 통일되지 않았다. | 5월 20일은 15:00이나, 5월 21일 schedule과 마감 후 문구는 여전히 `11:00`이다. | 사용자가 요구한 “모두 오후 3시에 오픈할 예정”과 다르게 보일 수 있다. | 두 운영일 모두 15:00인지 사용자에게 확인하고, 확인 결과에 맞춰 문구, schedule, 테스트를 함께 맞춘다. |
| P2 | `src/pages/customer/CheckoutPage.jsx:54` | 주문 생성 직후 status 페이지로 직접 이동하지 않는다. | 주문 생성 후 `/orders/:id/complete?token=...`로 이동한다. Complete 화면에서 status/transfer 진입은 가능하지만, 리뷰 요구의 “주문 생성 후 status 페이지 이동”과는 다르다. | 사용자가 주문 직후 상태 페이지에 바로 들어가지 않아 진행 상태 추적 흐름이 한 단계 우회된다. | 현재 완료 화면 유지가 의도인지 확인한다. 요구 그대로라면 생성 직후 status로 이동하거나 complete 화면에서 status CTA를 더 명확히 한다. |
| P2 | `src/hooks/useOrderToken.js:41`, `src/hooks/useOrderToken.js:62`, `src/store/recentOrders.js:28`, `src/store/recentOrders.js:43` | 주문 access token을 localStorage에 만료 없이 저장한다. | URL token을 sessionStorage와 localStorage에 저장하고, 최근 주문 store에도 token을 저장한다. TTL, 운영일 기준 pruning, schema version이 없다. | 축제 공용/공유 기기에서 주문 조회 token이 오래 남을 수 있고, 오래된 주문 카드가 남을 수 있다. | 운영일 또는 짧은 TTL 기준으로 token/recent order를 정리한다. terminal/fetch 실패 주문은 store에서 제거하고 persist version/migration을 추가한다. |
| P2 | `src/components/organisms/RecentOrdersSection.jsx:34`, `src/components/organisms/RecentOrdersSection.jsx:64`, `src/components/organisms/RecentOrdersSection.jsx:75` | 모든 최근 주문이 `DONE/CANCELED`이거나 조회 실패해도 섹션 제목만 남을 수 있다. | 부모는 저장된 `orders.length`만 보고 섹션을 렌더하고, 각 카드가 개별적으로 `return null`을 한다. | 홈 화면에 “진행 중 주문” 제목만 보이는 빈 섹션 UX가 생길 수 있다. | 조회 결과를 부모에서 집계하거나 hidden count를 반영해 실제 표시 카드가 0개이면 섹션 전체를 숨긴다. 동시에 stale entry 제거를 추가한다. |
| P2 | `src/pages/customer/TransferPage.jsx:46`, `src/components/organisms/TransferReportForm.jsx:110` | 사용자-facing 또는 접근성 문구에 `이체 신고`가 남아 있다. | 실패 기본 메시지 `이체 신고에 실패했어요.`, form `aria-label="이체 신고 폼"`이 남아 있다. | QA 기준 “이체 신고 문구가 남아 있지 않은가”에 걸린다. | 사용자 노출 문구와 aria-label을 `이체 완료 요청` 계열로 통일한다. |
| P3 | `src/store/businessState.js:8`, `server/db/init.sql:172` | 16:30 기준을 설명하는 주석이 남아 있다. | 사용자 화면에는 영향 없지만, 코드 주석은 “16:30 → 15:00” 변경 사유 중심이다. | 운영 정책 변경 이력이 애매하면 이후 수정자가 혼동할 수 있다. | 실제 최종 운영 시간 기준만 남기거나 변경 이력을 문서로 분리한다. |

## 4. 원래 버그 13개 해결 여부

| 버그 번호 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 |
|---|---|---|---|
| 1 | 해결 | `src/components/molecules/StampBadge.jsx:22`, `src/styles/components.css:244` | 영문 `recommended` 사용자 노출은 제거되고 `추천` 배지로 바뀌었다. 수동 디자인 확인만 필요. |
| 2 | 해결 | `src/store/cart.js:4`, `src/store/cart.js:41`, `src/pages/customer/CartPage.jsx:56` | cart item에 `image/code/sub`가 보존된다. 실제 asset 누락 여부는 브라우저 QA 필요. |
| 3 | 해결 / 확인 필요 | `src/styles/components.css:25`, `src/styles/components.css:28`, `src/styles/components.css:32` | 로고 CSS가 `contain`과 transparent로 변경됐다. 실제 모바일/관리자 화면에서 검은 단색이 사라졌는지는 시각 QA 필요. |
| 4 | 해결 | `src/pages/customer/CompletePage.jsx:19`, `src/pages/customer/CompletePage.jsx:72` | 복사 문자열은 `국민은행 233001-04-403536`만 사용하고, 화면 예금주는 유지한다. |
| 5 | 해결 | `src/pages/customer/StatusPage.jsx:93` | `ORDERED` 상태 status 페이지에 `이체 완료 요청` 버튼이 추가됐다. 단, 서버 API 상태 guard는 P1로 별도 수정 필요. |
| 6 | 부분 해결 | `src/pages/customer/TransferPage.jsx:46`, `src/components/organisms/TransferReportForm.jsx:110` | 주요 버튼은 바뀌었지만 실패 문구/aria-label에 `이체 신고`가 남아 있다. |
| 7 | 해결 | `server/routes/admin.js:73`, `server/routes/customer.js:231`, `src/utils/time.js` | SQLite timestamp를 ISO 8601 `Z` 형식으로 정규화하고 클라이언트 util 테스트가 추가됐다. 기존/null 데이터 수동 QA는 필요. |
| 8 | 해결 | `server/routes/admin.js:96`, `server/routes/admin.js:198`, `server/routes/admin.js:208`, `src/api/schemas.js:58` | 관리자 응답의 boolean/timestamp shape가 프론트 schema와 맞도록 직렬화됐다. |
| 9 | 해결 | `src/components/organisms/AdminCardColumn.jsx:59`, `src/components/organisms/AdminCardColumn.jsx:60` | `TRANSFER_REPORTED`에서 `확인`, `보류` 액션이 보인다. 상태 변경 실패 표시 이슈는 P1로 별도 남음. |
| 10 | 해결 | `src/components/organisms/AdminCardColumn.jsx:60`, `src/pages/admin/DashboardPage.jsx:65` | `TRANSFER_REPORTED -> PAID` inline 액션이 추가됐다. |
| 11 | 해결 | `src/components/layouts/AdminLayout.jsx` | 미구현 내역/쿠폰 nav가 숨김 처리됐다. 라우트가 원래 없던 구조라 접근 가능한 빈 기능은 확인되지 않았다. |
| 12 | 부분 해결 | `src/components/organisms/ClosedScreen.jsx:10`, `src/components/organisms/ClosedScreen.jsx:18`, `src/store/businessState.js:19` | 5월 20일은 15:00 기준이나 5월 21일과 마감 후 문구는 11:00이 남아 있다. |
| 13 | 부분 해결 | `src/store/recentOrders.js:28`, `src/components/organisms/RecentOrdersSection.jsx:60`, `src/hooks/useOrderToken.js:59` | 홈 최근 주문 재진입은 추가됐다. 다만 localStorage token 만료 없음, 빈 섹션 가능성, stale entry 정리가 남아 있다. |

## 5. 사용자 플로우 리뷰

확인된 사용자 플로우는 다음과 같다.

1. 주문 생성 시 `access_token`을 받아 sessionStorage/localStorage와 recent order store에 저장한다.
2. 주문 생성 후에는 `/orders/:id/complete?token=...`로 이동한다.
3. `ORDERED` 상태의 `/orders/:id/status`에는 `이체 완료 요청` 버튼이 보이고 `/orders/:id/transfer?token=...`로 이동한다.
4. 이체 완료 요청 제출 후 서버는 `TRANSFER_REPORTED` 상태로 변경하고 status 화면으로 돌아갈 수 있다.
5. 홈 메뉴 화면에는 localStorage 기반 `RecentOrdersSection`이 표시되어 최근 주문 status로 재진입할 수 있다.

평가:

- 흐름 자체는 이전보다 크게 개선됐다.
- 다만 주문 생성 직후 status 페이지로 바로 이동하지 않는 점은 요구사항과 다르다. complete 화면을 유지할지 정책 확인이 필요하다.
- 가장 큰 리스크는 `transfer-report` API가 현재 상태를 검증하지 않는 점이다. 이 문제 때문에 완료/취소/조리중 주문이 다시 `TRANSFER_REPORTED`로 되돌아갈 수 있다.
- localStorage token fallback은 UX에는 도움이 되지만, 만료/정리 정책이 없어 공용 기기와 오래된 주문 카드 측면에서 과하다.

## 6. 관리자 플로우 리뷰

확인된 관리자 플로우는 다음과 같다.

1. 관리자 목록/상세 API는 SQLite boolean/timestamp를 프론트 schema에 맞게 직렬화한다.
2. `TRANSFER_REPORTED` 카드에는 `확인 -> PAID`, `보류 -> HOLD` 액션이 있다.
3. `PAID -> COOKING -> READY -> DONE` inline 액션이 있다.
4. `HOLD -> PAID` 재확인과 `HOLD -> CANCELED` 취소가 있다.
5. 카드 클릭과 버튼 클릭은 `stopPropagation`으로 분리되어 있어 클릭 영역 충돌은 코드상 방어되어 있다.

평가:

- `server/domain/order-state.js`의 `LEGAL_TRANSITIONS`와 관리자 UI의 주요 액션은 대체로 일치한다.
- `TRANSFER_REPORTED -> CANCELED`, `PAID -> CANCELED`, `COOKING -> CANCELED`, `READY -> CANCELED`는 서버에서 가능하지만 칸반 UI에는 노출되지 않는다. 운영상 필요한 취소 지점인지 확인 필요다.
- inline action 실패가 화면에 표시되지 않는 점은 운영 리스크다. 상세 페이지에는 에러 표시가 있지만, 칸반에서 바로 처리하는 현재 운영 흐름에는 부족하다.

## 7. 테스트 리뷰

좋은 점:

- 시간 계산 util 테스트가 추가되어 SQLite timestamp와 ISO timestamp parsing을 검증한다.
- `AdminCardColumn` 테스트가 상태별 액션과 카드/버튼 클릭 분리를 검증한다.
- `StatusPage` 테스트가 `ORDERED` 상태 CTA와 token query 전달을 검증한다.
- `RecentOrdersSection`, `useOrderToken`, `recentOrders.store` 테스트가 최근 주문 재진입의 기본 동작을 검증한다.
- 위 핵심 테스트 6개 파일은 80개 테스트가 통과했다.

부족한 점:

- 전체 `npm test`는 시간 초과와 `EPIPE`로 완료되지 않아 전체 green 신호를 확인하지 못했다.
- `transfer-report` API가 `PAID/COOKING/READY/DONE/CANCELED` 상태에서 거부되는지 테스트가 없다.
- 관리자 inline action 실패 시 화면 에러가 표시되는지 테스트가 없다.
- 최근 주문이 모두 terminal/fetch 실패일 때 섹션 전체가 숨겨지는지 테스트가 없다.
- 5월 21일 오픈 시간이 15:00인지 11:00인지 정책 테스트가 확정되어 있지 않다.
- `useMenuData.test.jsx`는 코드상 특별히 운영 플로우를 흔드는 테스트로 보이지 않는다. 보고된 플레이크는 현재 확인된 운영 리스크라기보다 테스트 환경/비동기 cleanup 문제일 가능성이 높다. 다만 전체 테스트가 시간 초과된 상태라 확정은 어렵다.

추가해야 할 테스트:

- `POST /api/orders/:id/transfer-report`: `ORDERED` 허용, `HOLD` 허용 여부 정책별 테스트, `PAID/COOKING/READY/DONE/CANCELED` 409 거부 테스트
- 관리자 칸반 상태 변경 실패 UI 테스트: 409/500/network error 표시, 중복 클릭 방지
- 최근 주문 cleanup 테스트: terminal 주문 제거, fetch 실패 주문 제거, 표시 카드 0개일 때 섹션 미렌더
- localStorage token TTL/pruning 테스트
- 오픈 예정 문구와 `SCHEDULE` 15:00 일관성 테스트

## 8. 수동 QA 필요 항목

- [ ] 모바일 홈에서 추천 메뉴 배지가 `recommended`가 아니라 자연스러운 `추천` 표시로 보이는지 확인
- [ ] 인벤토리/장바구니/완료 화면에서 실제 배그 컨셉 이미지가 유지되는지 확인
- [ ] 홈/관리자/로그인/모바일에서 로고가 검은 단색으로 깨지지 않는지 확인
- [ ] 주문 생성 후 complete 화면에서 status/transfer 진입 CTA가 충분히 명확한지 확인
- [ ] status 페이지 `ORDERED` 상태에서 `이체 완료 요청` 버튼이 보이고 정상 이동하는지 확인
- [ ] 이체 완료 요청 직후 status가 `TRANSFER_REPORTED`로 바뀌는지 확인
- [ ] 새로고침 후 token fallback으로 status 조회가 유지되는지 확인
- [ ] 홈으로 돌아간 뒤 최근 주문 카드로 status 페이지에 재진입할 수 있는지 확인
- [ ] 같은 사용자가 여러 주문을 했을 때 최근 주문 카드 정렬과 표시가 자연스러운지 확인
- [ ] 완료/취소된 주문이 최근 주문 영역에 빈 제목만 남기지 않는지 확인
- [ ] 관리자에서 `TRANSFER_REPORTED` 카드 클릭 시 상세가 정상 로드되는지 확인
- [ ] 관리자 칸반에서 `확인`, `보류`, `조리 시작`, `조리 완료`, `전달 완료`가 정상 전환되는지 확인
- [ ] 네트워크를 끊거나 서버 오류를 유도했을 때 관리자 액션 실패가 화면에 보이는지 확인
- [ ] 관리자가 버튼을 빠르게 여러 번 눌렀을 때 중복 상태 변경/오류 표시가 안전한지 확인
- [ ] `국민은행 233001-04-403536`만 복사되고 예금주 `박동빈`은 복사 문자열에 포함되지 않는지 확인
- [ ] 사용자 화면과 접근성 라벨에 `이체 신고` 문구가 남지 않았는지 확인
- [ ] 모든 오픈 예정 문구와 실제 오픈 계산이 15:00 정책과 맞는지 확인

## 9. Claude에게 줄 후속 수정 지시

1. `POST /api/orders/:id/transfer-report`에 상태 검증을 추가하세요.
   - 현재 주문 상태가 `ORDERED`일 때만 `TRANSFER_REPORTED`로 변경하세요.
   - `HOLD`에서 사용자가 다시 이체 정보를 보낼 수 있어야 한다면 `HOLD` 허용 여부를 명시적으로 정책화하세요.
   - `PAID`, `COOKING`, `READY`, `DONE`, `CANCELED`는 409로 거부하세요.
   - 이 동작을 서버 테스트로 고정하세요.

2. 관리자 칸반 inline action에 사용자-visible 실패 처리를 추가하세요.
   - 요청 중인 주문/버튼은 disabled 처리하세요.
   - 실패 시 화면에 에러 메시지를 표시하세요.
   - 중복 클릭, 409, 500, 네트워크 실패 테스트를 추가하세요.

3. 오픈 시간 정책을 다시 확정하고 코드/문구/테스트를 통일하세요.
   - 사용자 요구가 “모든 오픈 예정은 오후 3시”라면 5월 21일 schedule과 마감 후 문구도 15:00으로 바꾸세요.
   - 5월 21일만 11:00이 맞다면 문서와 사용자-facing 문구에 그 예외를 명확히 반영하세요.

4. `이체 신고` 잔여 문구를 정리하세요.
   - 실패 메시지, aria-label, 사용자 화면 문구를 `이체 완료 요청`으로 통일하세요.
   - 코드 내부 주석은 선택 사항이지만, 새 개발자가 혼동하지 않도록 같이 정리하는 편이 안전합니다.

5. 최근 주문/token 저장 정책을 보완하세요.
   - localStorage token에 TTL 또는 운영일 기준 만료를 적용하세요.
   - `DONE/CANCELED` 또는 fetch 실패 주문은 recent order store에서 제거하세요.
   - 실제 표시 카드가 0개이면 `RecentOrdersSection` 전체를 숨기세요.

6. 전체 테스트와 빌드를 다시 확인하세요.
   - 현재 일부 핵심 테스트는 통과했지만 전체 `npm test`는 완료 신호를 얻지 못했습니다.
   - 전체 테스트 시간 초과/EPIPE 원인을 분리하고, `npm run build`까지 확인하세요.

## 10. 결론

- 지금 상태 그대로 `main`에 병합하는 것은 권장하지 않는다.
- 병합 전 반드시 고쳐야 할 항목은 P1 두 가지다.
  - `transfer-report` API의 상태 전이 검증 누락
  - 관리자 칸반 상태 변경 실패의 화면 표시/중복 클릭 방어
- 실사용 QA에서는 사용자 주문 재진입, 관리자 빠른 처리, localStorage token 잔존, 15:00 오픈 문구, 모바일 로고/이미지 표시를 집중적으로 봐야 한다.
