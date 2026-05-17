# Codex find_error_v2 코드 리뷰

## 1. 최종 판단

**조건부 병합 가능**으로 판단합니다.

코드 기준으로 수정사항_v2 13개는 대부분 해결됐고, 주문/정산/관리자 핵심 흐름을 막는 P0/P1 기능 결함은 확인되지 않았습니다. 다만 아래 조건은 병합 전 반드시 확인해야 합니다.

- 확인한 사실: 현재 브랜치는 `find_error_v2`입니다.
- 확인한 사실: `git diff main...HEAD`는 비어 있었고, 구현은 현재 working tree 변경으로 존재합니다. `HistoryPage`, `CouponsPage`, `order-events-repo` 등 핵심 신규 파일이 `??` untracked 상태입니다. 병합 전 `git add -A` 등으로 신규 파일 포함 여부를 반드시 확인해야 합니다.
- 확인한 사실: 첫 `npm test -- --run`은 stale `dist/assets` 때문에 `bundle.test.js`가 실패했습니다. `npm run build` 후 `bundle.test.js` 및 전체 `npm test -- --run --reporter=dot`은 통과했습니다.
- 확인한 사실: `npm run lint`는 0 errors / 3 warnings입니다.
- 확인한 사실: `npm run build`는 성공했습니다.

## 2. P0/P1 이슈

코드 기능 기준 P0/P1 이슈는 **없음**입니다.

| 심각도 | 파일/위치 | 문제 | 근거 | 영향 | Claude 수정 지시 |
|---|---|---|---|---|---|
| 없음 | - | 주문/정산/관리자 운영을 막는 P0/P1 결함은 확인되지 않음 | 테스트 재실행 통과, 주요 상태/API/DB 경로 코드 확인 | - | - |

단, 병합 절차상으로는 현재 핵심 신규 파일이 untracked입니다. 이것은 코드 버그는 아니지만, PR/커밋에 누락되면 `/admin/history`, `/admin/coupons`, `order_events` repo import가 깨질 수 있으므로 병합 전 필수 확인 항목입니다.

## 3. P2/P3 이슈

| 심각도 | 병합 전 필수 여부 | 파일/위치 | 문제 | 근거 | 영향 | Claude 수정 지시 |
|---|---|---|---|---|---|---|
| P2 | 병합 전 권장 | `src/pages/customer/TransferPage.jsx:48-50`, `src/pages/customer/StatusPage.jsx:21-27` | 중복 이체 완료 요청 시 내부 에러는 노출되지 않지만, 지정 문구인 “이미 이체 완료 요청이 접수됐어요...”가 화면에 직접 표시되지는 않음 | `TRANSFER_ALREADY_REPORTED`를 받으면 바로 status로 이동하고, status는 “이체 완료 요청 — 본부 확인 중”만 표시 | QA 기준이 “친절한 안내 문구 표시”라면 부분 해결로 판정될 수 있음 | status 이동 시 flash state/query를 넘겨 상단 배너로 지정 문구를 1회 표시하거나, TransferPage에서 지정 문구를 표시한 뒤 status로 이동 |
| P2 | 정책 확인 후 처리 | `server/routes/customer.js:42-55` | 백엔드에서 `is_external=false`인데 `student_id`가 비어 있거나 누락된 주문을 거부하지 않음 | 검증 조건이 `student_id != null && student_id !== ''`일 때만 9자리 검사 | 프론트 정상 흐름은 보호되지만 API 직접 호출 시 “학생 주문은 9자리 학번” 정책과 불일치 가능 | `!is_external`이면 `student_id` 필수 + 9자리 숫자 검증으로 강화할지 정책 결정 |
| P2 | 수동 QA 필요 | `src/pages/admin/CouponsPage.jsx:33`, `src/styles/components.css:1857` | 쿠폰 사용 내역 표가 고정 grid 폭을 사용해 모바일 좁은 화면에서 overflow 가능성이 있음 | `COLS = '100px 120px 1fr 100px 100px'`, `.bar-row`는 grid | 현장 운영자가 휴대폰으로 관리자 쿠폰 탭을 보면 가로 스크롤 또는 잘림 가능 | 모바일에서 행을 2줄 카드형으로 접거나 `minmax(0, 1fr)`/반응형 CSS 추가 |
| P3 | 병합 후 가능 | `docs/API_DRAFT.md`, `docs/ARCHITECTURE.md`, 과거 task 문서 | ADR-019 핵심 정규식은 코드와 일치하지만 주변 문서 일부에 과거 prefix/쿠폰 오류명 흔적이 남아 있음 | 검색 결과 `COUPON_PREFIX`, prefix 설명, 과거 작업 문서가 혼재 | 개발자 혼란 가능 | 최신 정책: 주문 9자리, 쿠폰 `^\d{4}37\d{3}$`로 문서 정리 |
| P3 | 병합 후 가능 | `docs/design-bundle/screens-admin.jsx`, `src/pages/admin/HistoryPage.jsx` | design-bundle의 내역 탭은 검색/필터/CSV/시스템·메뉴 로그까지 포함하지만 현재 구현은 주문 상태 로그 최소 구현 | v2 작업 지시서의 최소 요구는 주문 상태 변경 로그였으므로 기능 결함은 아님 | 운영 중 감사 로그 확장 요구가 생길 수 있음 | Phase 2로 메뉴 변경, 로그인, 영업 시작/종료 로그와 필터/CSV 추가 검토 |

## 4. 수정사항_v2 13개 해결 여부

| 번호 | 해결 여부 | 근거 파일 | 추가 수정 필요 여부 | 심각도 재평가 |
|---:|---|---|---|---|
| 1 | 해결 | `src/components/organisms/RecommendedBanner.jsx:1-30`, `src/pages/customer/MenuPage.jsx` | 없음 | P3 해결 |
| 2 | 해결 | `src/App.jsx`, `src/components/layouts/AdminLayout.jsx:16-23`, `src/pages/admin/HistoryPage.jsx`, `src/pages/admin/CouponsPage.jsx`, `server/routes/admin.js:276-315` | 병합 전 신규 파일 커밋 포함 확인 필요 | P1 해결, 절차 확인 필요 |
| 3 | 해결, 단 백엔드 빈 학번 정책 보강 여지 | `src/pages/customer/CheckoutPage.jsx:15-37`, `server/routes/customer.js:31-55`, `server/domain/coupon.js:23-51` | API 직접 호출에서 non-external 빈 학번 허용 여부 정책 확인 | P1 해결, P2 보강 |
| 4 | 해결 | `src/pages/customer/StatusPage.jsx:68`, `src/components/organisms/__tests__/OrderTimeline.test.jsx` | 없음 | P2 해결 |
| 5 | 해결 | `src/pages/customer/TransferPage.jsx` | 없음 | P3 해결 |
| 6 | 부분 해결 | `server/routes/customer.js:222-230`, `src/pages/customer/TransferPage.jsx:48-50` | 내부 에러 미노출은 해결. 지정 안내 문구 직접 노출은 보강 권장 | P2 |
| 7 | 해결 | `src/pages/customer/StatusPage.jsx:21-27`, `src/pages/customer/StatusPage.jsx:75-79` | `StatusChip`의 상태 아이콘은 남아 있으나 요청한 READY 문구 좌측/수령 문구 옆 이모지는 제거됨 | P3 해결 |
| 8 | 해결 | `src/components/organisms/AdminCardColumn.jsx:77-135` | 없음 | P2 해결 |
| 9 | 해결 | `src/utils/time.js:25-30` | 없음 | P2 해결 |
| 10 | 해결 | `src/components/organisms/AdminCardColumn.jsx:61-72` | 없음 | P2 해결 |
| 11 | 해결 | `src/pages/admin/DashboardPage.jsx:108-114`, `src/components/organisms/AdminCardColumn.jsx:91-162` | 없음 | P2 해결 |
| 12 | 해결, 시각 QA 필요 | `src/components/organisms/StartBusinessCTA.jsx:37-74` | 모바일/데스크톱 실화면 확인 권장 | P3 해결 |
| 13 | 해결 | `src/pages/admin/DashboardPage.jsx:104-115`, `src/components/organisms/AdminCardColumn.jsx:198-207` | 없음 | P2 해결 |

## 5. 학번/쿠폰 검증 리뷰

확인한 사실:

- 프론트 주문 가능 검증은 `ORDER_SID = /^\d{9}$/`입니다.
- 프론트 쿠폰 가능 검증은 `COUPON_SID = /^\d{2}\d{2}37\d{3}$/`이며, 이는 정책 `^\d{4}37\d{3}$`와 동치입니다.
- 백엔드 주문 검증도 값이 있는 non-external `student_id`에 대해 9자리 숫자를 요구합니다.
- 백엔드 쿠폰 검증은 `server/domain/coupon.js`의 `STUDENT_ID_PATTERN = /^\d{2}\d{2}37\d{3}$/`입니다.
- `202111123`은 프론트에서 일반 주문 가능하고 쿠폰은 비활성화됩니다.
- `202137123`은 4자리 뒤 `37` 패턴이므로 쿠폰 대상입니다.
- 8자리, 10자리, 문자 포함 학번은 프론트에서 막히고, 백엔드도 값이 들어오면 거부합니다.
- 외부인은 `is_external=true`, `student_id=null`, 쿠폰 없음 흐름으로 유지됩니다.

남은 리스크:

- 백엔드에서 `is_external=false`인데 `student_id`가 누락되거나 빈 문자열이면 9자리 검증 자체를 건너뜁니다. 프론트 정상 UI에서는 이런 요청이 생성되지 않지만, API 정책 일관성 관점에서는 보강 여지가 있습니다.
- ADR-019 핵심 정책인 학과 코드 `37` 검증은 코드와 충돌하지 않습니다. 다만 일부 오래된 문서에는 prefix/오류 코드 표현이 남아 있어 문서 정비가 권장됩니다.

## 6. 관리자 내역/쿠폰 탭 리뷰

### 내역 탭

확인한 사실:

- `order_events` 테이블이 `server/db/init.sql`과 `server/db/bootstrap.js`의 `003-order-events` 마이그레이션에 추가됐습니다.
- 마이그레이션은 `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`를 사용해 기존 DB에 idempotent하게 적용됩니다.
- 주문 생성, 사용자 이체 완료 요청, 관리자 상태 변경에서 `logOrderEvent`가 호출됩니다.
- `createOrder`, `updateOrderStatus`, `updateTransferInfo`는 상태 변경과 로그 insert를 같은 repository transaction 안에서 처리합니다.
- `GET /admin/api/history`는 `/admin/api` 공통 `requireAdmin` 뒤에 정의되어 인증을 요구합니다.
- 날짜 필터는 query의 `date` 또는 business state의 `operating_date`를 사용하고, `orders.operating_date` 기준으로 조회합니다.
- `HistoryPage`는 로딩/에러/401/빈 상태를 처리합니다.

평가:

- v2 최소 요구인 주문 상태 변경 로그 화면으로는 동작합니다.
- design-bundle의 검색/필터/CSV/시스템·메뉴 로그까지는 구현하지 않았습니다. 작업 지시서의 “최소 표시 항목” 기준으로는 병합 차단 이슈가 아닙니다.
- 과거 주문에는 `order_events`가 없을 수 있지만 내역 탭은 빈 상태로 처리되므로 UI가 깨질 가능성은 낮습니다.

### 쿠폰 탭

확인한 사실:

- 별도 신규 쿠폰 테이블 없이 기존 `used_coupons`를 재사용합니다.
- `listCouponUsage`는 `used_coupons`와 `orders`를 join해서 운영일자 기준으로 쿠폰 사용 주문만 조회합니다.
- `GET /admin/api/coupons/usage`는 `/admin/api` 공통 인증을 받습니다.
- 응답은 주문번호, 이름, 학번, 쿠폰명, 할인 금액, 사용 시간을 제공합니다.
- 쿠폰 기록 시점은 기존 정책대로 주문 생성 transaction 안에서 `consumeCoupon`이 실행되는 시점입니다.
- `CouponsPage`는 로딩/에러/401/빈 상태를 처리합니다.

평가:

- 쿠폰 미사용 주문이 잘못 표시될 구조는 확인되지 않았습니다.
- 할인 금액은 현재 고정 1,000원 정책과 일치합니다.
- 모바일 좁은 화면에서 고정 grid가 잘릴 가능성은 수동 QA가 필요합니다.

## 7. 관리자 대시보드 리뷰

확인한 사실:

- 주문 카드에 `order.items` 최대 3개가 “메뉴명 × 수량” 형태로 표시되고, 초과분은 “외 n개”로 표시됩니다.
- 카드 전체 클릭 핸들러와 pointer 스타일은 제거됐고, `article` 안의 상태 변경 버튼만 동작합니다.
- HOLD 상태 버튼 라벨은 “이체 확인”입니다.
- `elapsedMinutes`는 음수를 `0`으로 clamp합니다.
- 영업 OPEN 상태에서 주문이 없어도 `ADMIN_COLUMNS` 6개 컬럼을 항상 렌더하고, 각 컬럼에는 “해당 상태 주문 없음” 문구가 표시됩니다.
- 장사 시작 전 버튼은 `shouldBeOpen=false`일 때 block 버튼이 아니라 compact 버튼으로 렌더됩니다.

평가:

- 수정사항_v2 대시보드 항목은 코드 기준 해결됐습니다.
- 관리자 nav가 6개 항목으로 늘었으므로 모바일/좁은 화면에서 topnav overflow는 실사용 QA로 확인해야 합니다.

## 8. 사용자 화면 리뷰

확인한 사실:

- 추천 BEST 아래 작은 추천 메뉴 카드/줍기 UI는 제거됐고, 추천 배너 자체는 유지됩니다.
- 주문 상태 화면은 `OrderTimeline`에 `showMiniview={false}`를 전달해 접수/입금/확인/조리/수령 시간 리스트를 숨깁니다.
- READY 상태 문구의 닭고기 이모지와 “#n번 수령 가능해요” 옆 체크 이모지는 제거됐습니다.
- 이체 완료 요청 화면의 불필요한 안내 배너 문구는 제거됐습니다.
- 중복 이체 완료 요청 시 서버 내부 메시지 “불법 상태 전이...”는 사용자에게 노출되지 않습니다.

남은 리스크:

- 중복 이체 완료 요청 시 TransferPage에서 지정 안내 문구를 직접 보여주지 않고 status로 이동합니다. status 화면의 “이체 완료 요청 — 본부 확인 중”은 자연스럽지만, QA 시나리오가 지정 문구 표시를 요구하면 부분 해결로 판정될 수 있습니다.

## 9. DB/마이그레이션 리뷰

확인한 사실:

- `order_events` 신규 테이블은 `init.sql`과 bootstrap migration 양쪽에 반영됐습니다.
- migration 이름은 `003-order-events`이며 중복 실행에 안전한 DDL을 사용합니다.
- 기존 DB는 `_migrations`에 `003-order-events`가 없으면 table/index를 추가합니다.
- 신규 DB는 `init.sql`로 테이블이 생긴 뒤 migration 003이 no-op DDL 후 migration row를 기록합니다.
- 기존 주문에는 이벤트 로그가 없을 수 있지만 history API는 `order_events` 기준 조회라 빈 목록을 반환할 수 있습니다.
- `used_coupons` 기존 데이터는 `orders`와 join 가능한 경우 쿠폰 탭에서 표시됩니다.

확인 필요:

- 운영 DB에 `_migrations` 상태가 꼬여 있는 경우, 즉 `003-order-events`가 기록돼 있지만 실제 테이블이 없는 경우는 self-heal하지 않습니다. 일반 운영 경로에서는 낮은 가능성입니다.
- 병합 전 기존 DB 볼륨에서 앱을 띄워 `order_events` migration 적용, 주문 생성, 이체 요청, 관리자 상태 변경 후 history API 표시를 직접 확인해야 합니다.

권장 수동 명령:

```bash
npm run build
npm test -- --run
npm run lint
```

운영 DB 스모크는 실제 운영 DB 파일을 열람하지 않는 전제에서 복제본 또는 dev 볼륨으로 확인하세요.

## 10. 테스트 리뷰

좋은 점:

- 프론트 CheckoutPage에 9자리 일반 주문, 쿠폰 대상/미대상 분기 테스트가 추가됐습니다.
- 백엔드 customer route에 non-37 일반 주문 허용, non-37 쿠폰 거부, 중복 이체 요청, 상태별 transfer-report 차단 테스트가 추가됐습니다.
- `order_events` repo/API 테스트가 추가됐고, admin history/coupons API 인증과 date filter가 테스트됩니다.
- AdminCardColumn은 주문 항목 표시, “외 n개”, 클릭 상세 이동 방지, HOLD 라벨, a11y를 검증합니다.
- `elapsedMinutes` 0분 clamp 테스트가 있습니다.
- HistoryPage/CouponsPage 렌더링 테스트가 있습니다.

부족한 점:

- 중복 이체 요청 후 지정 안내 문구가 사용자에게 보이는지는 테스트하지 않고, status로 navigate하는 것만 검증합니다.
- 백엔드에서 non-external 빈 `student_id`를 거부하는 테스트가 없습니다.
- CouponsPage 모바일 overflow나 admin topnav 모바일 overflow는 자동 테스트가 없습니다.
- HistoryPage는 design-bundle의 필터/검색/CSV가 없다는 점을 명시적으로 scope-out하는 테스트나 문서가 없습니다.

직접 실행 결과:

- `npm run build`: 통과.
- `npm test -- --run`: 첫 실행은 stale `dist/assets` 때문에 `bundle.test.js` 실패.
- `npm test -- --run src/__tests__/bundle.test.js --reporter=verbose`: build 후 통과.
- `npm test -- --run --reporter=dot`: build 후 전체 통과.
- `npm run lint`: 0 errors / 3 warnings.

## 11. main 병합 전 필수 수동 QA

- [ ] `git status --short`에서 `src/pages/admin/HistoryPage.jsx`, `src/pages/admin/CouponsPage.jsx`, `server/repositories/order-events-repo.js` 등 신규 파일이 커밋 대상에 포함됐는지 확인
- [ ] 기존 DB 또는 복제 DB에서 `003-order-events` migration 적용 확인
- [ ] `202111123`으로 쿠폰 없이 일반 주문 가능
- [ ] `202137123`으로 쿠폰 주문 가능
- [ ] 쿠폰 미대상 9자리 학번으로 일반 주문 가능
- [ ] 8자리, 10자리, 문자 포함 학번은 주문 불가
- [ ] 중복 이체 완료 요청 시 “불법 상태 전이” 미노출
- [ ] 중복 이체 완료 요청 시 사용자에게 충분히 친절한 안내가 보이는지 확인
- [ ] 관리자 내역 탭이 보이고 주문 생성/이체 요청/관리자 상태 변경 로그가 표시됨
- [ ] 관리자 쿠폰 탭이 보이고 쿠폰 사용 주문만 표시됨
- [ ] 쿠폰 미사용 주문이 쿠폰 탭에 표시되지 않음
- [ ] 관리자 카드에 주문 항목 표시
- [ ] 주문 항목이 4개 이상일 때 “외 n개” 표시가 정확함
- [ ] 카드 클릭 시 상세 페이지 이동 없음
- [ ] 상태 변경 버튼은 정상 동작
- [ ] HOLD 상태 버튼이 “이체 확인”으로 표시
- [ ] 경과 시간이 0분부터 표시되고 음수로 내려가지 않음
- [ ] 주문 없음 상태에서 6개 상태 컬럼 표시
- [ ] 장사 시작 시간 전 버튼이 과도하게 길지 않음
- [ ] 모바일 화면에서 관리자 nav, 쿠폰 탭 행, 대시보드 컬럼, 사용자 status/transfer 화면 깨짐 없음

## 12. Claude에게 줄 후속 수정 지시

P0/P1 기능 결함은 없으므로 **후속 수정은 선택사항**입니다. 다만 병합 전 UX 기준을 더 엄격히 맞추려면 아래 프롬프트를 그대로 전달할 수 있습니다.

```text
find_error_v2 리뷰 후속 수정입니다. 소스 수정 범위는 아래 P2/P3만 다룹니다.

1. TransferPage에서 TRANSFER_ALREADY_REPORTED 응답을 받으면 내부 에러를 노출하지 않는 기존 동작은 유지하되, 사용자에게 “이미 이체 완료 요청이 접수됐어요. 본부 확인을 기다려주세요.” 문구가 실제 화면에 보이게 해주세요. status로 이동하는 정책을 유지한다면 location state 또는 query로 1회성 배너를 표시해도 됩니다.
2. server/routes/customer.js에서 is_external=false 주문은 student_id가 반드시 9자리 숫자여야 하는지 정책을 확인하고, 그렇다면 빈 값/누락도 400으로 막아주세요. is_external=true 외부인 흐름은 그대로 유지해야 합니다.
3. CouponsPage의 쿠폰 사용 내역 행이 모바일 좁은 화면에서 깨지지 않도록 반응형 카드형 또는 2줄 레이아웃을 추가해주세요.
4. 변경 후 npm run build, npm test -- --run, npm run lint를 다시 실행하고 결과를 보고해주세요.
```

## 13. 결론

- main 병합 가능 여부: **조건부 병합 가능**.
- P0/P1 기능 결함: **없음**.
- 병합 전 반드시 확인할 항목: 신규 파일이 커밋/PR에 포함됐는지, 기존 DB에서 `003-order-events`가 적용되는지, 중복 이체 완료 요청 UX가 QA 기준을 만족하는지.
- 실사용 QA 집중 지점: 학번/쿠폰 분리, 중복 이체 요청, 관리자 내역/쿠폰 탭, 주문 없는 대시보드 6컬럼, 모바일 관리자 화면.
- 실제 소스코드 수정 여부: 이 리뷰에서는 앱/서버 소스는 수정하지 않았고, 리뷰 문서만 추가했습니다.
