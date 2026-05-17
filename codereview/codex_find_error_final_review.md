# Codex find_error 최종 재리뷰

## 1. 최종 판단

- 판단: **조건부 병합 가능**
- 확인된 사실:
  - 현재 브랜치는 `find_error`이다.
  - `find_error`와 `main`은 같은 커밋을 가리키며, 현재 변경사항은 커밋되지 않은 작업트리 변경사항이다. 따라서 본 리뷰는 `main` 대비 현재 작업트리 전체 변경과 신규 untracked 파일을 포함해 검토했다.
  - 이전 Codex 리뷰의 P1 2건은 코드와 테스트 기준으로 해결됐다.
  - 새 P0/P1 이슈는 확인되지 않았다.
  - 직접 실행 결과:
    - `npm test -- --run --silent`: 94 files / 1003 tests PASS
    - `npm run lint`: 0 errors / 3 warnings
    - `npm run build`: success
- 조건:
  - main 병합 전 최소 수동 QA는 반드시 필요하다.
  - `HOLD` 사용자 UX와 `recentOrders` fetch 실패 시 제거 정책은 P2로 남아 있어, 실사용 전 운영 방식 확인 또는 후속 개선을 권장한다.

## 2. 이전 P1 이슈 해결 여부

| 이전 이슈 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 | 심각도 재평가 |
|---|---|---|---|---|
| P1-1. `transfer-report` API 상태 전이 검증 누락 | 해결 | `server/routes/customer.js:208`, `server/domain/order-state.js:28`, `server/routes/__tests__/customer.test.js:508`, `server/routes/__tests__/customer.test.js:528`, `server/routes/__tests__/customer.test.js:544` | 필수 수정 없음. 선택적으로 거부 시 transfer info 필드도 변경되지 않는지 테스트를 더 추가할 수 있음. | P1 해소 |
| P1-2. 관리자 칸반 액션 실패 표시/중복 클릭 방어 누락 | 해결 | `src/pages/admin/DashboardPage.jsx:33`, `src/pages/admin/DashboardPage.jsx:66`, `src/pages/admin/DashboardPage.jsx:69`, `src/pages/admin/DashboardPage.jsx:106`, `src/components/organisms/AdminCardColumn.jsx:152`, `src/pages/admin/__tests__/DashboardPage.test.jsx:379`, `src/pages/admin/__tests__/DashboardPage.test.jsx:414` | 필수 수정 없음. 테스트 selector를 접근성 role 기반으로 바꾸는 것은 선택사항. | P1 해소 |

상세 확인:

- `ORDERED -> TRANSFER_REPORTED`는 `LEGAL_TRANSITIONS`상 합법이고, 사용자 API에서 `transition(existing.status, 'TRANSFER_REPORTED')`로 검증한다.
- `TRANSFER_REPORTED`, `PAID`, `COOKING`, `READY`, `DONE`, `CANCELED`, `HOLD` 상태의 중복/역전 요청은 409 `ILLEGAL_TRANSITION`으로 거부된다.
- 거부 후 DB status가 유지되는 테스트가 있다.
- 관리자 액션 실패 시 `admin-action-error` 배너가 표시되고, 성공 재시도 시 에러가 사라지며 `refetch`가 호출된다.
- pending 중 같은 카드 액션 버튼이 disabled 되고, 중복 클릭으로 `apiFetch`가 추가 호출되지 않는 테스트가 있다.
- 401 로그인 만료 흐름은 기존처럼 `/admin/login` 이동을 유지한다.

## 3. 새로 발견한 P0/P1 이슈

없음.

## 4. P2/P3 이슈

| 심각도 | 파일/위치 | 문제 | 영향 | 병합 후 처리 가능 여부 | 권장 조치 |
|---|---|---|---|---|---|
| P2 | `src/pages/customer/StatusPage.jsx:85`, `src/pages/customer/StatusPage.jsx:98`, `server/routes/customer.js:208` | `HOLD` 상태에서 서버는 재요청을 409로 막지만, status 화면은 “재제출해 주세요”와 “이체 정보 다시 보내기” CTA를 계속 노출한다. | 사용자가 CTA를 따라 transfer 화면에서 제출하면 409가 나오므로 UX가 정책과 충돌한다. 운영자가 현장 문의로 처리할 수 있다면 P1은 아니지만 혼란 가능성이 있다. | 가능. 단 실사용 전 문구/운영 가이드 확인 권장. | 정책이 “HOLD는 부스 문의”라면 CTA를 숨기고 안내 문구를 “본부에 문의해 주세요”로 정리한다. 정책이 “사용자 재제출 허용”이라면 서버 전이를 별도로 설계한다. |
| P2 | `src/components/organisms/RecentOrdersSection.jsx:37`, `src/components/organisms/RecentOrdersSection.jsx:39` | 최근 주문 fetch 실패 시 즉시 `removeOrder`로 localStorage 카드가 사라진다. | 일시적 네트워크/서버 오류에도 홈의 진행 중 주문 재진입 카드가 사라질 수 있다. | 가능. 축제 운영 전 개선 권장. | 401/403/404 또는 terminal 상태일 때만 제거하고, 5xx/network error는 카드 유지 + 재시도 안내가 안전하다. |
| P3 | `src/components/organisms/StartBusinessCTA.jsx:6`, `src/components/organisms/StartBusinessCTA.jsx:40` | 15:00 이전에도 운영자가 “장사 시작 (시간 전)” 버튼으로 수동 OPEN을 누를 수 있다. | 수동 오픈을 허용하는 운영 정책이면 문제 없음. 엄격한 15:00 오픈 정책이면 운영자 실수 가능성이 있다. | 가능 | 15:00 이전 수동 OPEN 허용 여부를 운영자에게 확인한다. |
| P3 | `server/db/init.sql:172`, `src/components/organisms/BusinessStateBadge.jsx:7`, `src/store/__tests__/businessState.store.test.js:44` | 사용자 화면은 15:00으로 통일됐지만 일부 주석에는 `16:30` 변경 이력이 남아 있다. | 사용자 영향 없음. 이후 유지보수자가 혼동할 수 있다. | 가능 | 주석을 최종 정책 기준으로 정리한다. |
| P3 | `src/pages/admin/__tests__/DashboardPage.test.jsx:386`, `src/pages/admin/__tests__/DashboardPage.test.jsx:409` | 관리자 액션 테스트가 `button:nth-of-type(2)` selector를 사용한다. | 현재는 통과하지만 DOM 구조 변경에 약하다. | 가능 | `within(card).getByRole('button', { name: '확인' })`처럼 접근성 role 기반 selector로 바꾼다. |

추가 확인:

- 5월 20일과 5월 21일의 오픈 시간은 `ClosedScreen`, `businessState`, 테스트 기준 모두 `15:00 ~ 21:00`으로 통일됐다.
- 사용자 화면의 `11:00` 흔적은 확인되지 않았다.
- 사용자-facing `이체 신고` 문구는 transfer/status/form 화면에서 제거됐다. 서버 주석, 기존 문서, 일부 테스트명/fixture 문자열에는 남아 있지만 실제 사용자 화면 영향은 없다.
- 48시간 TTL은 축제 양일 운영에는 대체로 적합하다. 다만 token이 행사 다음날까지 남을 수 있으므로 공용 기기 사용 가능성을 수동 QA/운영 안내에서 확인해야 한다.

## 5. main 병합 전 필수 수동 QA

- [ ] 사용자 주문 생성 후 완료 화면에서 주문번호, 계좌 안내, status/transfer 진입 경로가 명확한지 확인
- [ ] `ORDERED` status 페이지에서 `이체 완료 요청` 버튼이 보이는지 확인
- [ ] 이체 완료 요청 제출 후 `TRANSFER_REPORTED`로 바뀌고 새로고침 후에도 유지되는지 확인
- [ ] `PAID`, `COOKING`, `READY`, `DONE`, `CANCELED`, `HOLD` 주문에서 transfer 재요청이 막히는지 확인
- [ ] `HOLD` 상태 사용자 화면에서 CTA와 안내가 운영 정책과 충돌하지 않는지 확인
- [ ] 관리자 칸반에서 `TRANSFER_REPORTED -> PAID`, `TRANSFER_REPORTED -> HOLD`가 정상 동작하는지 확인
- [ ] 관리자 실패 배너가 실제 네트워크 실패/409 실패에서 보이고, 성공 재시도 후 사라지는지 확인
- [ ] 관리자 버튼 빠른 중복 클릭 시 중복 API 호출이나 중복 상태 변경이 없는지 확인
- [ ] 5월 21일 안내도 `15:00 ~ 21:00`, `오후 3시` 기준으로 보이는지 확인
- [ ] 15:00 이전 수동 `장사 시작 (시간 전)`이 운영 정책상 허용되는지 확인
- [ ] 최근 주문 카드가 홈에서 최신순으로 보이고, 완료/취소 주문은 제거되는지 확인
- [ ] 일시적 네트워크 실패 시 최근 주문 카드 제거 정책이 과도하지 않은지 확인
- [ ] 모바일 화면에서 sticky bar, 관리자 카드 액션 버튼, 최근 주문 카드가 겹치거나 잘리지 않는지 확인
- [ ] 실제 기기에서 로고와 메뉴/장바구니 이미지가 깨지지 않는지 확인
- [ ] 계좌 복사 결과가 `국민은행 233001-04-403536`만 포함하는지 확인

## 6. 테스트 평가

통과한 테스트:

- `npm test -- --run --silent`
  - 94 files passed
  - 1003 tests passed
  - `package.json`의 `test` script가 `vitest run`이므로 전체 Vitest suite가 실행됐다.
- `npm run lint`
  - 0 errors
  - 3 warnings
  - 경고는 기존 unused eslint-disable directive 계열이다.
- `npm run build`
  - Vite production build 성공

좋은 점:

- transfer-report 상태 가드 테스트가 실제 HTTP API를 통해 `ORDERED` 성공과 비허용 상태 409를 검증한다.
- 비허용 상태 테스트가 거부 후 DB status 보존까지 확인한다.
- 관리자 실패 UI 테스트가 에러 배너 표시, 성공 후 에러 클리어, pending 중 disabled, 중복 클릭 API 1회 호출을 검증한다.
- recentOrders 테스트가 TTL pruning, terminal 제거, fetch 실패 제거, 모든 카드 제거 후 섹션 미렌더까지 포함한다.
- `useMenuData.test.jsx`도 전체 suite에서 통과해, 이전에 언급된 플레이크는 이번 실행에서는 재현되지 않았다.

부족한 테스트:

- transfer-report 거부 시 `bank`, `depositor_name`, `amount`, `transferred_at` 같은 이체 정보 필드가 함께 보존되는지까지는 직접 검증하지 않는다.
- `HOLD` status 페이지의 CTA와 서버 409 정책 충돌을 검증하는 테스트가 없다. 오히려 현재 테스트는 `HOLD` CTA 유지를 기대한다.
- recentOrders fetch 실패 제거는 테스트되어 있지만, 5xx/network error와 401/403/404를 구분하는 정책 테스트는 없다.
- 관리자 액션 테스트 일부가 DOM selector에 의존해 구조 변경에 취약하다.

추가 권장 테스트:

- `transfer-report` 불법 상태 요청 후 이체 정보 필드와 timestamp가 변경되지 않는지 확인
- `HOLD` 상태에서 CTA를 숨기거나 안내만 보여 주는 정책 테스트
- recentOrders에서 5xx/network error는 보존, 401/403/404는 제거하는 정책 테스트
- 관리자 action button selector를 role/name 기반으로 정리한 회귀 테스트

## 7. Claude에게 줄 후속 수정 지시

P0/P1 후속 수정은 없습니다. 후속 수정은 선택사항입니다.

선택 후속 지시:

1. `HOLD` 상태 UX를 서버 정책과 맞춰 주세요.
   - 현재 서버는 `HOLD -> TRANSFER_REPORTED` 사용자 재요청을 409로 막습니다.
   - status 페이지에서는 `이체 정보 다시 보내기` CTA와 “재제출해 주세요” 안내가 남아 있습니다.
   - 정책이 “본부 문의”라면 CTA를 숨기고 “본부에 문의해 주세요” 안내만 표시하세요.
   - 정책이 “재제출 허용”이라면 서버 상태 모델부터 재설계하세요.

2. recentOrders fetch 실패 제거 정책을 완화해 주세요.
   - 현재는 모든 fetch 실패에서 `removeOrder`를 호출합니다.
   - 5xx/network error는 카드 유지 + 재시도 안내, 401/403/404는 제거로 나누는 편이 안전합니다.
   - 관련 테스트를 추가하세요.

3. 테스트 selector와 주석을 정리해 주세요.
   - 관리자 테스트의 `button:nth-of-type(2)`를 role/name selector로 바꾸세요.
   - 사용자 화면에 영향 없는 `16:30`, `이체 신고` 주석은 유지보수 혼동을 줄이도록 정리하세요.

## 8. 결론

- main 병합 가능 여부: **조건부 병합 가능**
- 병합 전 반드시 확인할 항목:
  - 사용자 정상 주문 → 이체 완료 요청 → 관리자 확인 → 조리중 → 수령대기 → 완료 수동 QA
  - `HOLD` 상태 UX가 운영 정책과 충돌하지 않는지 확인
  - 관리자 실패 배너와 중복 클릭 방어를 실제 브라우저에서 확인
  - 5월 21일 15:00 오픈 안내와 모바일 화면 확인
- 실사용 QA 집중 포인트:
  - 사용자가 홈으로 돌아온 뒤 최근 주문 상태를 다시 찾을 수 있는지
  - 네트워크가 잠깐 실패해도 최근 주문 재진입 경로가 과도하게 사라지지 않는지
  - 관리자가 빠르게 주문을 처리할 때 실패/중복 클릭/상태 이동이 명확하게 보이는지
