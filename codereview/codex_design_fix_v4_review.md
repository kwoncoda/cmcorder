# Codex design_fix_v4 코드 리뷰

## 1. 최종 판단

**병합 가능**

확인한 사실:
- 현재 브랜치는 `design_fix_v4`이다.
- `main..HEAD`에는 보고된 3개 커밋만 있다.
- 리뷰 문서 작성 전 `git status --short`에는 변경 파일이 없었고, working tree는 clean이었다. 단, 사용자 홈 git ignore 접근 권한 warning은 표시됐다.
- 변경 범위는 TableMapCTA 추가, MenuPage 삽입, 포장 주문 READY -> SETTLED 분기, 관련 테스트/문서에 집중되어 있다.

판단:
- P0/P1 없음.
- 기능 구현은 병합 가능하다.
- 남은 이슈는 성능/UX/운영성 개선 성격의 P2/P3이며 병합 차단은 아니다.

## 2. P0/P1 이슈

없음.

## 3. P2/P3 이슈

| 심각도 | 병합 전 필수 여부 | 파일/위치 | 문제 | 판단/후속 권장 |
| --- | --- | --- | --- | --- |
| P2 | 병합 후 가능, 행사 전 권장 | `src/components/organisms/TableMapCTA.jsx:31-39`, `public/map/table-location.webp` | 홈 메뉴 CTA 썸네일이 2.43MB 원본 지도 WebP를 그대로 참조한다. CTA가 카테고리 바 위라 첫 화면 또는 근접 viewport에서 로드될 가능성이 높다. | 기능은 안전하지만 모바일 네트워크에서 메뉴 첫 진입 성능에 영향을 줄 수 있다. 별도 작은 썸네일 WebP/AVIF를 만들거나 CSS 배경 없이 아이콘형 CTA로 경량화하는 것을 행사 전 권장한다. |
| P3 | 병합 후 가능 | `src/styles/components.css:2444-2512` | `.table-map-cta`는 `:active`, `:focus-visible`은 있지만 명시적 `:hover` 상태가 없다. | 접근성과 키보드 focus는 충분하다. 데스크톱 hover 피드백만 보강하면 된다. |
| P3 | 병합 후 가능 | `server/domain/order-state.js:35-44`, `server/domain/order-state.js:71-83` | `LEGAL_TRANSITIONS` 표만 보면 takeout READY -> SETTLED가 드러나지 않고, `canTransition(..., { deliveryType })`를 통해서만 표현된다. | Claude 보고대로 DONE dead status 회귀 방지를 위해 의도적으로 표를 유지한 것으로 보인다. 향후 새 호출자가 `LEGAL_TRANSITIONS`를 직접 참조하지 않도록 주석/테스트 유지가 필요하다. |

## 4. 커밋/브랜치 상태 확인

- 현재 브랜치: `design_fix_v4`
- `main..design_fix_v4` 커밋 목록:
  - `d72d91c chore(design_fix_v4): 회귀 매트릭스 통과 + 문서 동기화 (Subagent 3)`
  - `68fda3f feat(design_fix_v4): 포장 주문 READY→SETTLED + 서버 도메인 옵션 deliveryType (Subagent 2)`
  - `da50102 feat(design_fix_v4): 홈 카테고리 바 위 TableMapCTA + Link to /map (Subagent 1)`
- working tree clean 여부: 리뷰 문서 작성 전 clean 확인. `git status --short`는 상태 행 없이 git ignore 권한 warning만 출력했다.
- 주요 포함 파일:
  - `src/components/organisms/TableMapCTA.jsx`
  - `src/pages/customer/MenuPage.jsx`
  - `src/components/organisms/AdminCardColumn.jsx`
  - `server/domain/order-state.js`
  - `server/routes/admin.js`
  - 관련 테스트와 `docs/design_fix_v4_*` 문서 3종
- 제외되어야 할 파일 포함 여부:
  - `.env`, DB 실데이터, `dist`, `node_modules`, 세션/비밀 파일은 `main..HEAD` diff에 없다.
- table_lock 회귀 여부:
  - `server/domain/table-availability.js`, `server/repositories/table-locks-repo.js`, `/map/table-location.webp`, `MapPage`, `BoothMinimapModal`은 이번 diff에서 변경되지 않았다.
  - `DINING`/`SETTLED` 정산, 사용자 진행 중 주문 제외, table availability 관련 코드도 유지되어 있다.

## 5. TableMapCTA 리뷰

확인한 사실:
- `TableMapCTA`는 `src/components/organisms/TableMapCTA.jsx`에 신규 organism으로 추가됐다.
- `MenuPage`에서 `<RecentOrdersSection />` 다음, `<CategoryTabs />` 바로 앞에 렌더링된다.
- 문구는 요구사항과 일치한다:
  - `테이블 배치도`
  - `주문 전 테이블 위치를 확인해 주세요`
  - `배치도 보기`
- CTA는 React Router `<Link to="/map">`를 사용하므로 새 모달 구현 없이 기존 `/map` 페이지와 `BoothMinimapModal` 흐름을 재사용한다.
- `CustomerLayout`의 `header-map-link`는 이번 diff에서 변경되지 않아 기존 헤더 미니맵 버튼은 유지된다.
- 인벤토리 버튼 관련 파일도 이번 diff에서 변경되지 않았다.
- `public/map/table-location.webp`는 변경되지 않았고, 새 이미지 생성도 없다.
- `TableMapCTA.test.jsx`는 문구, `/map` 링크, 접근 가능한 anchor, 썸네일 경로를 확인한다.
- `MenuPage.test.jsx`는 CTA가 페이지 안에서 CategoryTabs 앞에 위치하는지 DOM 순서로 확인한다.

판단:
- CTA 위치와 동작은 요구사항대로 구현됐다.
- 카테고리 필터는 기존 상태/테스트가 유지되고, CTA 삽입으로 필터 state나 menu list 계산을 건드리지 않았다.
- 모바일 레이아웃은 `min-height: 88px`, 72px 썸네일, flex 구조로 과도하게 크지는 않아 보인다.
- 성능상 원본 2.43MB 이미지를 작은 썸네일로 재사용하는 점만 P2로 남긴다.

## 6. 포장 READY → SETTLED 리뷰

확인한 사실:
- `AdminCardColumn`은 `getActionsForOrder(order)`를 추가해 `order.status === 'READY' && order.delivery_type === 'takeout'`이면 `to: 'SETTLED'` 액션을 반환한다.
- dine-in READY 카드는 기존처럼 `to: 'DINING'`이다.
- 두 경우 모두 버튼 라벨은 `전달 완료`로 유지된다.
- `OrderCard`는 액션 클릭 시 `onAction(order.id, a.to)`를 호출한다.
- `order-repo`는 `SETTLED` 전이 시 `settled_at`을 기록하므로 takeout READY -> SETTLED도 정산 완료 데이터로 남는다.
- 사용자 진행 중 주문 정책은 `SETTLED`를 terminal로 제거하므로 포장 완료 후 고객 진행 중 카드에서 사라지는 정책과 맞다.
- table availability는 `SETTLED`를 점유 상태로 보지 않는다. 포장 주문은 `table_no=null`이므로 테이블 점유/잠금 정책과 충돌하지 않는다.

판단:
- 포장 주문이 DINING 컬럼으로 들어가지 않는 프론트 액션 분기는 안전하다.
- SETTLED 기준 정산/스냅샷 정책과도 일관된다.

## 7. 서버 상태 전이 리뷰

확인한 사실:
- `canTransition(from, to, opts)`와 `transition(from, to, opts)`에 `deliveryType` 옵션이 추가됐다.
- `deliveryType === 'takeout' && from === 'READY'`이면:
  - `to === 'SETTLED'`: 허용
  - `to === 'DINING'`: 거부
- dine-in 또는 opts 미지정은 기존 `LEGAL_TRANSITIONS` 흐름을 따른다.
- `LEGAL_TRANSITIONS`에는 `DONE` 우변 진입이 다시 추가되지 않았다.
- admin transition route는 `getOrder`로 주문을 읽고 `transition(order.status, to, { deliveryType: order.delivery_type })`를 호출한 뒤 `updateOrderStatus`를 실행한다.
- 운영 코드에서 `updateOrderStatus`를 직접 호출하는 곳은 admin transition route뿐이다. 테스트에서 직접 호출하는 것은 repository timestamp 검증 목적이다.

판단:
- API 직접 호출 takeout READY -> DINING은 서버에서 `ILLEGAL_TRANSITION`으로 막힌다.
- dine-in READY -> DINING은 허용되고, dine-in READY -> SETTLED는 거부된다.
- DINING -> SETTLED 기존 흐름은 유지된다.
- route/domain에서 방어하고 repo는 단순 update로 남기는 설계는 현재 호출 구조에서는 안전하다. 향후 새 mutation route를 추가하면 반드시 `transition` domain guard를 거쳐야 한다.

## 8. 회귀 위험 평가

- 쿠폰: 이번 diff에서 coupon domain/route 핵심 로직은 변경되지 않았다. 선별 테스트에 admin/customer route 회귀가 포함됐다.
- 이체 완료 요청: `TransferReportForm`, `TransferPage`는 이번 diff에서 변경되지 않았다.
- 다른 이름 이체: 관련 컴포넌트/route 직접 변경 없음.
- 미니맵: `/map/table-location.webp`, `MapPage`, `BoothMinimapModal`은 변경되지 않았고 CTA는 `/map` 링크만 추가했다.
- 테이블 잠금/점유: `table-availability`, `table-locks-repo`, `TablesPage`는 이번 diff에서 변경되지 않았다.
- READY -> DINING -> SETTLED 매장 식사 흐름: `deliveryType='dineIn'` 테스트로 유지 확인.
- takeout READY -> SETTLED: 프론트 액션, domain, admin route 테스트가 추가되어 있다.
- 정산/스냅샷: `SETTLED` 기준 집계가 유지된다.
- DINING 마감 차단: `settlement`의 `IN_PROGRESS_STATES`에 `DINING` 유지.

## 9. 테스트/lint/build 리뷰

Codex 직접 실행:

```text
npm test -- --run src/components/organisms/__tests__/TableMapCTA.test.jsx src/pages/customer/__tests__/MenuPage.test.jsx src/components/organisms/__tests__/AdminCardColumn.test.jsx server/domain/__tests__/order-state.test.js server/routes/__tests__/admin.test.js server/repositories/__tests__/order-repo.test.js server/domain/__tests__/settlement.test.js server/jobs/__tests__/auto-snapshot.test.js
```

결과:

```text
8 passed, 250 tests passed
```

Codex 직접 실행:

```text
npm run lint
```

결과:

```text
0 errors, 3 warnings
```

warning은 기존 미사용 eslint-disable 경고다:
- `src/components/ErrorBoundary.jsx`
- `src/hooks/useApi.js`
- `src/hooks/useGlobalErrorHandler.js`

추가 확인:

```text
git diff --check main..HEAD
```

결과: 문제 없음.

Claude 보고:
- docker 전체 테스트: 108 files / 1385 passed
- docker lint: 0 errors / 3 existing warnings
- docker build: success
- `/`, `/menu`, `/map`, `/api/business-state` curl 확인 성공

Codex는 `npm run build`를 직접 실행하지 않았다. 이유는 build가 `dist` 산출물을 갱신할 수 있고, 이번 작업은 리뷰 문서 작성만 허용되어 있기 때문이다.

테스트 적정성:
- TableMapCTA 단위 테스트가 문구, 링크, 썸네일, anchor 구조를 잡는다.
- MenuPage 통합 테스트가 CTA가 CategoryTabs 앞에 오는 DOM 순서를 잡는다.
- AdminCardColumn 테스트가 dine-in READY -> DINING, takeout READY -> SETTLED, delivery_type 누락 시 기존 DINING 기본 흐름을 잡는다.
- order-state와 admin route 테스트가 takeout READY -> DINING 직접 호출 방어, dine-in READY -> SETTLED 거부, DINING -> SETTLED를 잡는다.
- 기존 테스트 삭제/단순화로 보이는 리스크는 확인되지 않았다.

## 10. main 병합 전 수동 QA 체크리스트

- [ ] 모바일 `/menu`에서 테이블 배치도 CTA가 카테고리 바 위에 보이는지
- [ ] CTA 클릭 시 `/map` 진입 및 미니맵 모달 정상
- [ ] 헤더 미니맵 버튼 정상
- [ ] 인벤토리 버튼 정상
- [ ] 카테고리 5탭 정상
- [ ] dineIn READY -> DINING
- [ ] DINING -> SETTLED
- [ ] takeout READY -> SETTLED
- [ ] takeout 주문이 DINING 컬럼에 보이지 않음
- [ ] API 직접 호출 takeout READY -> DINING 방어
- [ ] dineIn READY -> SETTLED 방어
- [ ] 정산 SETTLED 집계
- [ ] DINING 남아 있을 때 마감 차단
- [ ] 다른 이름 이체 회귀 없음
- [ ] 쿠폰 회귀 없음
- [ ] 테이블 잠금/점유 회귀 없음

## 11. Claude에게 줄 후속 수정 지시

P0/P1 없음. 선택 후속 수정:

```text
design_fix_v4 후속 개선입니다. 병합 차단은 아니지만 행사 전 모바일 성능을 위해 TableMapCTA가 2.43MB 원본 /map/table-location.webp를 72px 썸네일로 로드하지 않도록 작은 전용 썸네일 자산을 추가하거나, 이미지 없는 경량 CTA로 바꿔 주세요. 가능하면 .table-map-cta:hover 상태도 추가해 데스크톱 피드백을 보강해 주세요. 기존 /map의 원본 지도 이미지는 변경하지 마세요.
```

## 12. 결론

main 병합 가능 여부:
- **병합 가능**

병합 전 반드시 해야 할 것:
- 전체 test/lint/build 결과 최종 확인
- 모바일 `/menu` CTA 위치와 `/map` 진입 수동 QA
- dine-in/takeout 상태 전이 수동 QA

병합 후 추적할 것:
- TableMapCTA 썸네일 경량화
- CTA hover 상태 추가
- 향후 새 상태 변경 호출자가 생길 경우 `transition(..., { deliveryType })` domain guard를 반드시 거치도록 유지
