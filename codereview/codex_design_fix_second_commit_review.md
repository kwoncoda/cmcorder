# Codex design_fix 두 번째 디자인 커밋 리뷰

## 1. 최종 판단

**병합 보류**

최신 커밋 `28bb7e6 두번째 디자인 개발`은 대부분 UI/CSS/테스트 변경으로 구성되어 있고 `design_bundle` 정합성은 전반적으로 개선되었습니다. 다만 `TransferReportForm`에서 “다른 이름으로 이체” 입력 경로가 제거되고 `useOtherName: false`로 고정되어, 서버가 유지 중인 `use_other_name`/`other_name` 이체 매칭 기능을 프런트에서 더 이상 사용할 수 없습니다. 이번 브랜치의 금지 범위인 이체 완료 요청 로직 변경에 해당하므로 P1로 봅니다.

## 2. 리뷰 대상 커밋 확인

- 현재 브랜치: `design_fix`
  - `git branch --show-current`는 dubious ownership 경고로 실패했습니다.
  - `.git/HEAD` 확인 결과 `ref: refs/heads/design_fix`였습니다.
- 최신 커밋: `28bb7e6 두번째 디자인 개발`
  - `git log --oneline -5`에서 최신 커밋 메시지가 사용자가 말한 “두 번째 디자인 개발 커밋”과 일치함을 확인했습니다.
- `HEAD~1..HEAD` diff 요약:
  - 9 files changed, 136 insertions(+), 96 deletions(-)
  - 변경 파일:
    - `src/components/organisms/AdminCardColumn.jsx`
    - `src/components/organisms/ClosedScreen.jsx`
    - `src/components/organisms/TransferReportForm.jsx`
    - `src/components/organisms/__tests__/AdminCardColumn.test.jsx`
    - `src/components/organisms/__tests__/TransferReportForm.test.jsx`
    - `src/pages/admin/DashboardPage.jsx`
    - `src/pages/admin/MenuAdminPage.jsx`
    - `src/pages/admin/__tests__/DashboardPage.test.jsx`
    - `src/styles/components.css`
- `design_fix` 전체 diff 요약:
  - 기준: `find_error_v3...HEAD`
  - 18 files changed, 925 insertions(+), 214 deletions(-)
  - 서버/API/store/hooks/constants 변경 없음.
  - 변경 범위는 문서, UI 컴포넌트, 페이지 JSX, CSS, 관련 테스트에 집중되어 있습니다.
- `design_bundle` 기준 경로:
  - 루트 `design_bundle` 폴더는 없고, 실제 원본은 `docs/design-bundle/`입니다.
  - 비교 기준 파일: `docs/design-bundle/screens-admin.jsx`, `docs/design-bundle/screens-customer.jsx`, `docs/design-bundle/app.css`, `docs/design-bundle/tokens.css`

## 3. P0/P1 이슈

### P0

없음.

### P1-1. 이체 신고의 “다른 이름으로 이체” 기능 경로가 프런트에서 제거됨

- 심각도: P1
- 파일/위치:
  - `src/components/organisms/TransferReportForm.jsx:52`
  - `src/components/organisms/TransferReportForm.jsx:80`
  - `src/components/organisms/TransferReportForm.jsx:85`
  - `src/components/organisms/__tests__/TransferReportForm.test.jsx:23`
- 문제:
  - 최신 커밋에서 `useOtherName`/`otherName` 상태, 체크박스, 추가 입력 필드가 제거되었습니다.
  - 제출 payload는 항상 `useOtherName: false`, `otherName: undefined`로 고정됩니다.
- 근거:
  - 서버는 여전히 `TransferReportSchema`에서 `useOtherName`/`otherName`을 허용합니다. `server/routes/customer.js:64`
  - DB 업데이트도 `use_other_name`, `other_name`을 저장합니다. `server/repositories/order-repo.js:221`
  - 이체 매칭 도메인은 `use_other_name=1`이면 `other_name`을 매칭 이름으로 사용합니다. `server/domain/transfer-matching.js:31`
- 영향:
  - 부모/친구/다른 명의로 이체한 사용자가 실제 입금자명을 별도로 신고할 수 없습니다.
  - 운영자가 사용하는 이체 매칭의 후보 이름이 주문자명 또는 입금자명으로만 제한되어, 정상 입금이 보류/수동 확인으로 밀릴 수 있습니다.
  - 이번 작업 지시의 “이체 완료 요청 로직 변경 금지”와 충돌합니다.
- Claude 수정 지시:
  - `TransferReportForm`에서 “다른 이름으로 이체했어요” 체크박스와 `otherName` 입력, 검증, 제출 payload를 이전 동작으로 복원하세요.
  - 디자인상 helper/불필요 문구를 줄이는 것은 허용하되, `useOtherName=true`와 `otherName` 전송 경로는 유지하세요.
  - `TransferReportForm.test.jsx`에서 제거된 `useOtherName=true 시 otherName 포함 제출` 회귀 테스트를 복원하세요.
  - 서버/API/DB/상태 전이 코드는 변경하지 마세요.

## 4. P2/P3 이슈

### P2-1. 영업 시작 전 `StartBusinessCTA` 버튼은 아직 `design_bundle`과 완전히 같지 않음

- 병합 전 필수 여부: P1 처리 후 수동 QA에서 확인 권장. 기능 차단 수준은 아님.
- 파일/위치:
  - `src/pages/admin/DashboardPage.jsx:85`
  - `src/components/organisms/StartBusinessCTA.jsx:33`
  - `src/components/organisms/StartBusinessCTA.jsx:70`
- 문제:
  - 최신 커밋은 `CLOSED` 분기에서 `.start-cta urgent`를 항상 적용해 카드 톤을 개선했습니다.
  - 그러나 `StartBusinessCTA`는 `shouldBeOpen=false`일 때 여전히 secondary 버튼과 “시간 전” 안내 문구를 렌더링합니다.
  - `docs/design-bundle/screens-admin.jsx`의 CLOSED CTA는 시간 조건과 무관하게 `.start-cta.urgent` 안의 primary “장사 시작” 버튼 형태입니다.
- 영향:
  - 영업 시작 시간 전 수동 QA에서 CTA 카드와 버튼 정합성이 “부분 해결”로 보일 수 있습니다.
  - 클릭 기능은 `onStart`에 연결되어 있어 기능 회귀는 낮습니다.

### P2-2. 좁은 화면에서 `start-cta`와 대시보드 카드 밀림은 수동 확인 필요

- 병합 전 필수 여부: 수동 QA 필수.
- 파일/위치:
  - `src/styles/components.css:1426`
  - `src/styles/components.css:1576`
- 문제:
  - `.start-cta`는 flex row, 80px mascot, 20px gap, 버튼을 같은 행에 두며 별도 wrap media query가 없습니다.
  - `.admin-board`는 640px 미만에서 2열로 줄어들지만 주문 카드에 은행/위치/아이템 meta가 늘어 최신 커밋 이후 세로/가로 밀림 가능성이 커졌습니다.
- 영향:
  - 관리자 대시보드 모바일/좁은 화면에서 CTA 또는 주문 카드 텍스트가 답답하게 보일 수 있습니다.

### P3-1. `.biz-dot` 색상이 design token 대신 hard-coded 색으로 들어감

- 병합 전 필수 여부: 병합 후 정리 가능.
- 파일/위치:
  - `src/styles/components.css:217`
  - `src/styles/components.css:221`
- 문제:
  - OPEN/CLOSED dot가 `#B6E97A`, `#FF6B47`로 hard-coded 되었습니다.
  - 현재 시각 정합성은 좋아졌지만, 토큰 기반 테마 유지 관점에서는 `--color-success` 계열과 어긋날 수 있습니다.

## 5. 수정사항_v4 반영 여부

| 번호 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 | 심각도 재평가 |
|---:|---|---|---|---|
| 1 | 해결 | `src/components/organisms/BusinessStateBadge.jsx`, `src/styles/components.css:209`, `src/styles/components.css:227`, `src/pages/admin/DashboardPage.jsx:105` | 토큰 색 정리는 선택 | P3 |
| 2 | 부분 해결 | `src/pages/admin/DashboardPage.jsx:85`, `src/components/organisms/StartBusinessCTA.jsx:33`, `src/styles/components.css:1426` | 영업 시작 전 secondary 버튼 정합성 수동 확인 | P2 |
| 3 | 해결 | `src/pages/admin/DashboardPage.jsx:58`, `src/components/organisms/StartBusinessCTA.jsx:34`, `src/pages/admin/__tests__/DashboardPage.test.jsx:120` | 없음 | 낮음 |
| 4 | 해결 | `src/pages/admin/DashboardPage.jsx:73`, `src/pages/admin/DashboardPage.jsx:93`, `src/constants/admin-columns.js` | 없음 | 낮음 |
| 5 | 해결 | `src/pages/admin/MenuAdminPage.jsx:80`, `src/styles/components.css:1858` | 실제 화면에서 `✓`/`✕` 크기 확인 | P3 |
| 6 | 해결 | `src/pages/customer/CompletePage.jsx:63`, `src/pages/customer/CompletePage.jsx:65` | 없음 | 낮음 |
| 7 | 해결 | `src/pages/customer/CompletePage.jsx:64`, `src/styles/components.css:835` | 실제 animation/pulse는 수동 QA 필요 | P3 |
| 8 | 해결 | `src/pages/customer/CompletePage.jsx:68`, `src/styles/components.css:960` | 없음 | 낮음 |
| 9 | 해결 | `src/pages/customer/CheckoutPage.jsx:97`, `src/pages/customer/CheckoutPage.jsx:100` | 없음 | 낮음 |
| 10 | 해결 | `src/pages/admin/DashboardPage.jsx:105`, `src/styles/components.css:1535`, `src/styles/components.css:1576` | 수동 비교 권장 | P3 |
| 11 | 해결 | `src/components/organisms/AdminCardColumn.jsx:144`, `src/styles/components.css:1628`, `src/styles/components.css:1660` | 모바일 텍스트 밀림 확인 | P2 |
| 12 | 해결 | `src/styles/components.css:1426`, `src/styles/components.css:1447`, `src/styles/components.css:1628`, `src/styles/components.css:1706` | 없음 | 낮음 |
| 13 | 해결 | `src/components/organisms/AdminCardColumn.jsx:169`, `src/styles/components.css:1683`, `src/styles/components.css:1706` | 없음 | 낮음 |
| 14 | 확인 필요 | `src/styles/components.css:1426`, `src/styles/components.css:1576`, `src/styles/components.css:1628` | 모바일/좁은 화면 수동 QA 필요 | P2 |

## 6. design_bundle 정합성 평가

### 좋아진 점

- 관리자 CLOSED CTA가 `.start-cta.urgent` 카드 톤에 더 가까워졌습니다.
- OPEN 상태 dot와 pulse가 다시 명확하게 보입니다.
- 주문 카드의 본문 폰트, meta, 경과 시간, 액션 버튼 높이가 커져 이전보다 읽기 쉬워졌습니다.
- 주문 카드 위험 액션은 빨간 배경 버튼이 아니라 기본 카드 버튼 톤으로 유지되어 `design_bundle`의 조용한 위험 버튼 톤과 맞습니다.
- CompletePage에서 “치킨 디너 위너!” 문구가 제거되었고 dogtag pulse가 복원되었습니다.
- 입금 안내 박스는 `acc-label`, `acc-bank`, `acc-no`, `acc-amount`, `acc-actions` 구조가 `design_bundle`에 가깝습니다.
- 쿠폰 helper 문구는 제거되어 화면에 “컴모융 학생 1,000원 할인”만 남았습니다.
- 메뉴 가격 편집 저장/취소는 작은 `✓`/`✕` 버튼으로 복원되었습니다.

### 아직 다른 점

- `StartBusinessCTA`는 `shouldBeOpen=false`에서 secondary 버튼과 “시간 전” 안내를 유지합니다. `design_bundle` CLOSED CTA의 primary 버튼 감각과 완전히 같지는 않습니다.
- 주문 카드에는 최신 커밋에서 수령 위치/은행 정보가 추가되어 `design_bundle`보다 정보량이 많습니다. 운영성은 좋아졌지만 좁은 열에서는 밀림 가능성이 있습니다.
- `docs/design-bundle/screens-admin.jsx` 원본은 일부 이모지 기반 dot를 쓰지만 현재 구현은 CSS dot입니다. 방향성은 맞지만 픽셀 단위 동일성은 수동 비교가 필요합니다.

### 반드시 수동 QA해야 하는 화면

- 관리자 대시보드 CLOSED 상태: 장사 시작 CTA + 6개 상태 박스.
- 관리자 대시보드 OPEN 상태: OPEN dot, pulse, 주문 카드 대비.
- 관리자 주문 카드: `ORDERED`, `TRANSFER_REPORTED`, `HOLD`의 취소/보류/확인 버튼 톤.
- 사용자 CompletePage: dogtag stage, WINNER 문구, 입금 안내 박스, 계좌/금액 복사.
- CheckoutPage 쿠폰 영역: helper 문구 제거와 disabled 상태.
- 메뉴 관리 가격 편집: `✓`/`✕`, Enter 저장, Escape/취소.
- 모바일/좁은 화면: CTA, 주문 카드, sticky bar.

## 7. 기능 로직 변경 여부

- DB schema 변경: 없음.
  - `find_error_v3...HEAD`에서 `server/db`, `server/repositories`, schema SQL 변경 없음.
- API route 변경: 없음.
  - `src/api`, `server/routes` 변경 없음.
- 주문 상태 전이 로직 변경: 없음.
  - `server/domain/order-state`, admin/customer transition route 변경 없음.
- 쿠폰 검증/중복 방지 로직 변경: 없음.
  - `server/domain/coupon`, coupon repository, used coupon migration 변경 없음.
  - Checkout UI에서 helper 문구만 제거되었고 `coupon: useCoupon ? { used: true } : null` 흐름은 유지됩니다.
- 관리자 내역/로그 정책 변경: 없음.
- 장사 시작 기능 로직 변경: 없음.
  - `handleStartBusiness`의 `/admin/api/business/open` 호출, `setStatus('OPEN')`, `refetch()` 흐름 유지.
- 이체 완료 요청 로직 변경: **있음, P1**
  - `TransferReportForm`에서 `useOtherName`/`otherName` 입력 경로가 제거되고 제출값이 `false`/`undefined`로 고정되었습니다.
  - 서버 기능은 그대로 남아 있으므로, 프런트 UI가 기존 기능을 차단하는 형태입니다.

## 8. 회귀 위험 평가

- 장사 시작 버튼 클릭: 낮음.
  - `onStart` 연결 유지, DashboardPage 테스트에 API 호출 + `status=OPEN` 전이 검증 존재.
- 주문 상태 변경 버튼: 낮음.
  - `ACTION_BY_STATUS`와 `onAction?.(order.id, a.to)` 유지.
  - 위험 버튼 톤은 CSS만 조정.
- 관리자 대시보드 6컬럼 렌더링: 낮음.
  - CLOSED 분기에서도 `{board}` 렌더 유지.
- 쿠폰 사용/미사용 주문: 낮음.
  - helper 문구 제거만 확인됨. payload 로직은 유지.
- 이체 완료 요청: 중간~높음.
  - 일반 이체 신고는 동작하지만, 다른 명의 이체 신고 경로가 제거되어 실사용 회귀 가능성이 있습니다.
- 주문 완료 페이지 계좌 복사: 낮음.
  - `copyAccount`, `copyAmount`, fallback 로직 유지.
- 주문 완료 페이지 status 이동: 낮음.
  - `/orders/:id/status${tokenQuery}` 이동 버튼 유지.
- 관리자 메뉴 가격 저장/취소: 낮음.
  - `onClick={() => save(m)}`, Escape 취소 유지. 버튼 스타일만 변경.
- 관리자 내역/쿠폰 탭 접근: 낮음.
  - `App.jsx`, `AdminLayout.jsx`, 관련 route/nav 변경 없음.

## 9. 테스트/빌드/lint 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm test -- --run` | 첫 실행 120초 timeout | 종료 과정에서 `EPIPE` 발생. 테스트 실패 확정은 아니며 출력량/시간 제한 영향으로 판단. |
| `npm test -- --run --reporter=dot` | 통과, exit code 0 | 전체 Vitest 재실행 통과. jsdom/axe `getComputedStyle(elt, pseudoElt)` 미구현 경고와 React Router future flag 경고는 반복됨. |
| `npm run lint` | 통과, exit code 0 | 0 errors, 3 warnings. 기존 unused eslint-disable warning: `ErrorBoundary.jsx`, `useApi.js`, `useGlobalErrorHandler.js`. |
| `npm run build` | 통과, exit code 0 | Vite build 성공. 190 modules transformed. |
| `git diff --check HEAD~1..HEAD` | 통과, exit code 0 | whitespace error 없음. |
| `docker compose -f docker-compose.dev.yml ps` | 실패 | Windows Docker config/daemon 접근 권한 거부. Docker exec 테스트는 실행하지 않음. |

## 10. main 병합 전 수동 QA 체크리스트

- 관리자 대시보드 design_bundle 비교
- OPEN 초록 dot 확인
- 장사 시작 카드/버튼 확인
- CompletePage 디자인 확인
- 입금 안내 박스 확인
- 쿠폰 helper 문구 제거 확인
- 관리자 메뉴 저장/취소 이모지 확인
- 주문 카드 글자 대비 확인
- 취소 버튼 톤 확인
- 모바일 화면 확인
- 장사 시작/상태 변경/계좌 복사 기능 확인
- 이체 완료 요청에서 일반 입금자명 신고 확인
- “다른 이름으로 이체” 기능을 유지할지 제품 판단 확인

## 11. Claude에게 줄 후속 수정 지시

P1 수정 프롬프트:

```text
design_fix 브랜치 최신 커밋 리뷰에서 P1이 발견되었습니다. 소스 범위는 TransferReportForm과 해당 테스트만 수정하세요.

문제:
- src/components/organisms/TransferReportForm.jsx에서 “다른 이름으로 이체했어요” 체크박스와 otherName 입력이 제거되어 사용자가 다른 명의 이체를 신고할 수 없습니다.
- 서버는 server/routes/customer.js, server/repositories/order-repo.js, server/domain/transfer-matching.js에서 useOtherName/otherName 기능을 그대로 지원합니다.
- 이번 design_fix는 UI 정합성 작업이며 이체 완료 요청 기능 로직 변경 금지 범위입니다.

수정:
1. TransferReportForm에 useOtherName state, otherName state, 체크박스, 조건부 otherName Input, otherName 검증을 복원하세요.
2. 제출 payload에서 useOtherName과 otherName을 사용자가 입력한 값으로 전송하세요.
3. 디자인은 design_bundle 톤에 맞게 간결하게 유지하고 helper 문구를 새로 추가하지 마세요.
4. TransferReportForm.test.jsx에서 useOtherName=true 시 otherName 포함 제출 테스트를 복원하세요.
5. 서버/API/DB/상태 전이/쿠폰 로직은 절대 변경하지 마세요.

검증:
- npm test -- --run --reporter=dot
- npm run lint
- npm run build
```

선택 수정:

- `StartBusinessCTA`의 `shouldBeOpen=false` secondary 버튼이 `design_bundle` CTA와 다른 것이 의도인지 확인하세요. 의도되지 않았다면 CLOSED 상태에서는 CTA 버튼 톤/문구를 `design_bundle`처럼 primary “장사 시작”으로 맞추세요.
- `.biz-dot` hard-coded 색상을 유지할지, `--color-success`/`--color-danger` 계열 토큰으로 되돌릴지 결정하세요.
- 좁은 화면에서 `.start-cta` flex wrap 또는 모바일 전용 정렬이 필요한지 QA 후 판단하세요.

## 12. 결론

- 현재 커밋 상태로 그대로 유지하기에는 P1 회귀 위험이 있습니다.
- main 병합은 P1 처리 전에는 보류가 맞습니다.
- 병합 전 반드시 확인할 것:
  - “다른 이름으로 이체” 기능을 복원하거나, 제거가 제품 요구임을 명시적으로 승인받을 것.
  - 관리자 대시보드 CLOSED/OPEN 화면을 `docs/design-bundle/`과 수동 비교할 것.
  - 모바일/좁은 화면에서 CTA와 주문 카드가 깨지지 않는지 확인할 것.
- 병합 후 추적할 것:
  - `StartBusinessCTA` 시간 전 secondary 버튼의 design_bundle 정합성.
  - dot 색상 토큰 정리.
  - jsdom/axe 경고 및 lint unused eslint-disable warning 정리.
