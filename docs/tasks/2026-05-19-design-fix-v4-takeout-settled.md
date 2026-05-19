# 2026-05-19 — design_fix_v4 Task 2: 포장 주문 READY → SETTLED 직접 전이

## 목표

포장(`takeout`) 주문이 매장 식사용 `DINING` 단계를 거치지 않도록 흐름 분기:

- **dineIn**: `READY → DINING → SETTLED` (변화 없음)
- **takeout**: `READY → SETTLED` 직접 (DINING 건너뜀)

기대 효과:

- 포장은 *DINING 컬럼에 표시되지 않음*
- 테이블 점유에 영향 없음 (table_no IS NULL 자연 제외 — 추가 변경 X)
- 사용자 진행 중 카드에서 SETTLED 진입 시 자동 hide (TERMINAL set 회귀)
- 정산 SETTLED 기준 매출 집계 동일

운영자 라벨은 `dineIn`/`takeout` 둘 다 **"전달 완료"** — 인지 부담 최소화.
UI + 서버 양방향 방어선(방식 C).

## 만든 것

- `server/domain/order-state.js`: `canTransition` / `transition` 에 옵셔널 `{ deliveryType }` 인자.
- `server/repositories/order-repo.js`: 변경 없음 (전이 검증은 라우트 책임 유지).
- `server/routes/admin.js`: `POST /admin/api/orders/:id/transition` 에서 `order.delivery_type` 을 전이 검증에 전달.
- `src/components/organisms/AdminCardColumn.jsx`: `ACTION_BY_STATUS` 상수 유지 + 신규 `getActionsForOrder(order)` 분기 함수 — `READY + takeout` → `to: 'SETTLED'`.

## 한 일

### 1. RED — `server/domain/__tests__/order-state.test.js` (+9 케이스)

- `canTransition('READY', 'SETTLED', { deliveryType: 'takeout' })` → `true`
- `canTransition('READY', 'SETTLED', { deliveryType: 'dineIn' })` → `false` (DINING 우회 차단 회귀)
- `canTransition('READY', 'SETTLED')` (opts 없음) → `false` (backwards-compat: dineIn 기본 흐름)
- `canTransition('READY', 'DINING', { deliveryType: 'takeout' })` → `false` (방어선)
- `canTransition('READY', 'DINING', { deliveryType: 'dineIn' })` → `true` (회귀)
- `canTransition('READY', 'DINING')` (opts 없음) → `true` (backwards-compat)
- takeout 옵션은 READY 외 상태에서는 `LEGAL_TRANSITIONS` 표 따름 (`PAID → COOKING` 정상)
- `transition` takeout `READY → SETTLED` 던지지 않음
- `transition` takeout `READY → DINING` `StateTransitionError` (from/to/code 메타 검증)

기존 DONE dead-status 메타 회귀("DONE은 어떤 합법 전이의 우변에도 등장하지 않는다") 그대로 유지.

### 2. GREEN — `server/domain/order-state.js`

```js
export function canTransition(from, to, opts = {}) {
  const { deliveryType } = opts;
  // takeout 특수 케이스 (design_fix_v4):
  //   READY → SETTLED 합법 (DINING 건너뜀)
  //   READY → DINING 불법 (포장은 테이블 점유 의미 없음 — 방어선)
  if (deliveryType === 'takeout' && from === 'READY') {
    if (to === 'SETTLED') return true;
    if (to === 'DINING') return false;
  }
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(from, to, opts = {}) {
  if (!canTransition(from, to, opts)) {
    throw new StateTransitionError(from, to);
  }
}
```

`LEGAL_TRANSITIONS` 객체 자체는 *변경하지 않음* — DONE dead-status 메타 회귀 보호.

### 3. RED → GREEN — `server/repositories/__tests__/order-repo.test.js` (+1 케이스)

- takeout 픽스처로 `updateOrderStatus(id, 'SETTLED')` from READY → `settled_at` 기록 + `dining_at` 비어 있음.

repo 자체는 상태 머신 검증을 하지 않으므로 ("라우트가 전이 검증" — 기존 line 158 주석 + DONE legacy 검증) 코드 변경 없이 신규 테스트만 통과. timestamp 컬럼 매핑(`STATUS_TIME_FIELD.SETTLED = settled_at`) 회귀.

### 4. RED → GREEN — `server/routes/__tests__/admin.test.js` (+4 신규 + 3 픽스처 정합)

신규 4건:

- takeout READY → SETTLED → `200`
- takeout READY → DINING → `409 ILLEGAL_TRANSITION` (방어선)
- dineIn READY → DINING → `200` (회귀)
- dineIn READY → SETTLED → `409 ILLEGAL_TRANSITION` (DINING 우회 차단 회귀)

기존 `READY → DINING → SETTLED 전이 이벤트 로깅 (table_lock)` 그룹 3건은 `delivery_type: 'takeout'` 픽스처를 사용해 DINING 으로 전이하던 코드 → `dineIn` 으로 정정. DINING/SETTLED 로깅 검증 의도는 그대로 유지 (테스트 삭제·단순화 아님).

### 5. GREEN — `server/routes/admin.js`

```js
transition(order.status, to, { deliveryType: order.delivery_type });
```

다른 라우트 변경 없음. `updateOrderStatus` 는 그대로(라우트가 검증, repo는 단순 UPDATE).

### 6. RED → GREEN — `src/components/organisms/__tests__/AdminCardColumn.test.jsx` (+2 신규 / 1 회귀 보강)

- takeout READY 카드: 라벨 "전달 완료", 클릭 시 `onAction(id, 'SETTLED')` 호출
- delivery_type 누락 시 dineIn 기본 → DINING (backwards-compat) — 레거시 픽스처 회귀
- 기존 `READY 카드 버튼 → DINING` 테스트에 `delivery_type: 'dineIn', table_no: 3` 명시 (명세 강화)

### 7. GREEN — `src/components/organisms/AdminCardColumn.jsx`

`ACTION_BY_STATUS` 상수 유지 (`DINING` 등 다른 상태에서 그대로 사용). 신규 함수 `getActionsForOrder(order)` 추가 후 `OrderCard` 안 `actions` 계산을 `getActionsForOrder(order)` 호출로 교체.

```js
function getActionsForOrder(order) {
  if (order.status === 'READY' && order.delivery_type === 'takeout') {
    return [{ label: '전달 완료', to: 'SETTLED', variant: 'primary' }];
  }
  return ACTION_BY_STATUS[order.status] ?? [];
}
```

`formatLocationLabel` 변경 없음.

## 테스트 결과

```
docker compose -f docker-compose.dev.yml exec dev npm test -- --run
→ Test Files: 108 passed (108)
→ Tests: 1385 passed (1385)
```

증분: 1369 → 1385 (+16) — order-state +9, order-repo +1, admin route +4, AdminCardColumn +2.

```
docker compose -f docker-compose.dev.yml exec dev npm run lint
→ 0 errors, 3 warnings (모두 pre-existing, 본 변경과 무관)
```

## 절대 깨지면 안 되는 회귀 확인

- `LEGAL_TRANSITIONS` 객체 자체 변경 없음. 우변 합집합에 `'DONE'` 없음 (`order-state.test.js` 메타 회귀 통과).
- `transition`/`canTransition` opts 미전달 시 기존 동작 그대로 (backwards-compat).
- `STATUS_TIME_FIELD.SETTLED = 'settled_at'` 그대로 — takeout SETTLED 도 settled_at 기록.
- 정산 `COMPLETED_STATES = ['SETTLED', 'DONE']` 변경 없음 — takeout SETTLED 자동 집계.
- `OCCUPYING_STATUSES` + `AND table_no IS NOT NULL` 변경 없음 — 포장(`table_no=NULL`)은 테이블 점유 계산에서 자연 제외.
- `RecentOrdersSection.TERMINAL = new Set(['DINING', 'DONE', 'SETTLED', 'CANCELED'])` 변경 없음 — 사용자 진행 중 카드에서 SETTLED 자동 hide.
- `settlement.test.js` "DINING 1건 있으면 마감 차단" + "SETTLED만 있으면 마감 가능" 그대로 통과.

## 다음에 할 것

- Subagent 3: 회귀 QA + 문서 동기화 (CLAUDE.md 절대 깨지면 안 되는 것 / DECISIONS.md).
