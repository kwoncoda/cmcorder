# 테이블 점유/식사중/테이블 잠금 개발 기획서

> 작성일: 2026-05-19 / 갱신: 2026-05-19 (사용자 결정 7건 반영) / 브랜치: `table_lock` / 작성자: Claude
> 본 문서는 *설계 문서*이며 코드 변경을 포함하지 않습니다.
> §10에 사용자 결정 8건 모두 확정 — 본 문서의 모든 결정 사항은 lock-in 상태.

---

## 0. 사전 전제 (반드시 먼저 읽기)

- 운영 기간: 2026-05-20 ~ 2026-05-21 (양일 단발 운영). 일회성 서비스.
- 테이블 번호는 **1~15번**. 이미 `minimap_design` 라운드에서 정착 — `server/routes/customer.js:46-53` zod `min(1).max(15)`.
- **동시성 전제:** 같은 테이블에 두 주문이 동시에 들어가는 상황은 **없다고 상정**한다. 본 설계는 race condition 방어를 핵심 목표로 두지 않는다. 다만 *프론트 캐시 stale* 상황(오래된 화면)은 서버에서 한 번 더 검증한다.
- 작업 절차는 CLAUDE.md "작업 절차" 4단계 준수 — docker 컨테이너 안에서만 dev/test 실행 (ADR-033).

---

## 1. 현재 구조 분석 (코드 확인 결과)

### 1.1 주문 생성 API

- 파일: `server/routes/customer.js:122-188` (`POST /api/orders`).
- 입력 검증: `CreateOrderSchema` (zod) — `server/routes/customer.js:32-69`.
  - `table_no`: `z.number().int().min(1).max(15).nullable().optional()` — 위반 시 400 `VALIDATION_ERROR` + 메시지 `"테이블 번호는 1번부터 15번까지만 선택할 수 있어요."`
  - `delivery_type`: `'dineIn' | 'takeout'` (기본 `'dineIn'`)
- 가격 계산: ADR-020 Pattern B — `calculatePrice(...)` 자체 계산 후 `createOrder`.
- 영업 가드: CLOSED 상태에서 POST → 423 (미들웨어 `server/middleware/business-state.js`).

### 1.2 주문 상태 머신

- 파일: `server/domain/order-state.js`.
- 합법 전이 (ADR-025, 13 + 5 불법 거부):
  ```
  ORDERED            → TRANSFER_REPORTED, CANCELED
  TRANSFER_REPORTED  → PAID, HOLD, CANCELED
  PAID               → COOKING, CANCELED
  COOKING            → READY, CANCELED
  READY              → DONE, CANCELED          ← 현재는 READY가 곧 "전달 완료"로 DONE 처리
  HOLD               → PAID, CANCELED
  DONE               → (터미널)
  CANCELED           → (터미널)
  ```
- 회귀: `server/domain/__tests__/order-state.test.js` 18 케이스.
- 라우트 적용 지점: `server/routes/admin.js:319-336` (`POST /admin/api/orders/:id/transition`) — `transition(from, to)` 실패 시 errorHandler가 409로 매핑.

### 1.3 관리자 대시보드 컬럼 구조

- 파일: `src/constants/admin-columns.js`.
- 현재 6 컬럼:
  | 순서 | status              | title          |
  |---:|---------------------|----------------|
  | 1  | ORDERED             | 주문중         |
  | 2  | TRANSFER_REPORTED   | 이체확인요청   |
  | 3  | PAID                | 이체완료       |
  | 4  | COOKING             | 조리중         |
  | 5  | READY               | 수령대기       |
  | 6  | HOLD                | 보류           |
- 컬럼별 액션 매트릭스: `src/components/organisms/AdminCardColumn.jsx:85-98` (`ACTION_BY_STATUS`).
  - READY 컬럼 액션: `[{ label: '전달 완료', to: 'DONE', variant: 'primary' }]` ← **현재 "전달 완료" 클릭이 곧 DONE.**
- 폴링: `DashboardPage.jsx:19` POLL_INTERVAL_MS=5000ms, TICK_INTERVAL_MS=60000ms (경과 시간 갱신).

### 1.4 READY / DONE / CANCELED 현재 의미

- READY: 조리 완료 → 사용자에게 *수령 안내*. `STATE_LABEL.READY = '픽업 준비 완료! 본부로 와 주세요!'` (`src/pages/customer/StatusPage.jsx:23`).
- DONE: "수령 완료". `STATE_LABEL.DONE = '수령 완료. 맛있게 드세요!'`. 사용자 ready_at→done_at 타임스탬프 자동 기록 (`server/repositories/order-repo.js:157-163`).
- CANCELED: 운영자가 어느 단계에서든 취소 가능. cancel reason 필드 존재.
- **이번 기능의 도전:** *현재 DONE의 의미가 "전달 완료(수령 완료)"이므로, 새 DINING 상태를 끼워넣으면 의미가 재정의된다.* 자세한 정책은 §2.2 참조.

### 1.5 테이블 번호 저장 위치

- 컬럼: `orders.table_no INTEGER` (`server/db/init.sql:53`). NOT NULL이 아니라 nullable.
- 1~15 범위 제약은 **DB CHECK 없음** — 애플리케이션 레이어(zod)에서만 검증. (자세한 회귀: `server/routes/__tests__/customer.test.js:520-620`).

### 1.6 테이블 번호 프론트 선택 UI

- 파일: `src/pages/customer/CheckoutPage.jsx:18` (`TABLES = [1,..,15]`).
- UI: 6열 grid radio-cell. 현재 모든 테이블이 항상 선택 가능 (사용 불가 표시 없음).
- 비고: 미니맵(`MapPage.jsx`)은 좌석 1~15 이미지 표시용 — 선택 흐름은 CheckoutPage 안에서만.

### 1.7 사용자 진행 중 주문 표시 조건

- 파일: `src/components/organisms/RecentOrdersSection.jsx`.
- TERMINAL = `new Set(['DONE', 'CANCELED'])` — 위 두 상태만 카드 즉시 hide (line 20).
- 영속 저장소: `src/store/recentOrders.js` (zustand persist, localStorage, 최대 10건, TTL 48h).
- 표시 조건: 그 외 상태(ORDERED/TRANSFER_REPORTED/PAID/COOKING/READY/HOLD)는 모두 "진행 중" 카드로 노출.

### 1.8 관리자 상태 변경 버튼 구조

- 파일: `src/components/organisms/AdminCardColumn.jsx:118-178` (`OrderCard`).
- 버튼: `ACTION_BY_STATUS[status]` 배열을 그대로 렌더링. 클릭 시 `onAction(orderId, to)` → 대시보드 `handleAction`이 `POST /admin/api/orders/:id/transition`.
- pending 상태 동안 disabled, aria-busy.

### 1.9 관리자 nav/tabs 구조

- 파일: `src/components/layouts/AdminLayout.jsx:16-22`.
- 현재 5 nav: `본부 / 메뉴 / 내역 / 정산 / 쿠폰` (find_error_v3에서 이체확인 nav 제거).
- 라우트: `src/App.jsx:83-94` (admin 6 페이지 모두 React.lazy).

### 1.10 관리자 로그/history 구조

- DB: `order_events`(주문 전이) + `admin_events`(메뉴/시스템) 분리.
  - `admin_events.category` CHECK constraint: `IN ('menu','system')` (`server/db/init.sql:182`). **'table' 카테고리는 미정의.**
  - `admin_events.operating_date`는 listAdminEvents에서 `WHERE operating_date = ?`로 필터 — NULL이면 자동 제외 (`server/repositories/admin-events-repo.js:70`).
- 통합 API: `GET /admin/api/history?type=all|orders|menus|system` (`server/routes/admin.js:392-463`).
  - 응답 row 통합 스키마: `{ id, source, category, event_type, action_name, actor, order_id, order_no, from_status, to_status, target_id, target_name, before_value, after_value, note, created_at }`.
  - type allowlist (P2 Codex): 위 4값 외 400 — 새 type 추가 시 allowlist도 같이 늘려야 함.

### 1.11 테이블 번호 1~15 검증 위치

- 프론트: `CheckoutPage.jsx:18` `TABLES` 상수 (현재는 정적 배열).
- 백엔드: `customer.js:46-53` zod schema (API 최종 방어선).
- DB: CHECK 제약 **없음**. nullable.
- 회귀: `server/routes/__tests__/customer.test.js:520-620` 9 케이스 (1/8/15 정상, 0/16/999/-1/문자 거부, null/미지정 호환).

---

## 2. 새 기능 정책 정의

### 2.1 테이블 점유 정책

**점유 자동 시작:**
- 사용자가 `POST /api/orders`에 `delivery_type='dineIn'` + `table_no=N`으로 주문 생성 시 그 시점부터 N번 테이블 = "점유 중".

**점유 해제 시점:**
- 주문이 CANCELED (어느 단계에서든)
- 새 흐름에서 DINING → DONE 전이 (관리자가 "테이블 준비 완료" 클릭)
- *현재 흐름의 DONE 전이는 점유 해제와 별개 — §2.2 참조.*

**점유와 수동 잠금은 별개:**
- 수동 잠금 해제는 *수동 잠금만 해제*. 진행 중 주문 때문에 점유된 테이블은 잠금 해제해도 사용 가능해지지 *않는다*.

### 2.2 주문 상태 정책 (★ 핵심 결정 — Q1+Q1.1 확정)

**결정 요약 (사용자 답변):**
- DINING **+ SETTLED** 신설 (옵션 B).
- DONE 의미는 *유지하되 실주 사용 안 함* (dead status). 어드민 흐름은 **DONE을 건너뛴다**.
- 어드민 버튼은 **2개**(옵션 α). 실제 흐름은 `READY → DINING → SETTLED`.

**최종 상태 흐름:**

```
ORDERED → TRANSFER_REPORTED → PAID → COOKING → READY → DINING → SETTLED
                                                          │          │
                                                          ▼          ▼
                                                       어드민         어드민
                                                     "전달 완료"   "테이블 준비 완료"

                                  HOLD ← TRANSFER_REPORTED → PAID (재확인)
                                  CANCELED ← (어느 단계에서든 가능)

DONE: enum에는 보존(legacy). 새 흐름에서는 *사용 안 함*. dead status.
```

**새 합법 전이 (ADR-025 갱신):**
```
READY    → DINING       (관리자 "전달 완료" 클릭)
READY    → CANCELED     (유지)
DINING   → SETTLED      (관리자 "테이블 준비 완료" 클릭)
DINING   → CANCELED     (예외 케이스 대비)
SETTLED  → (터미널)
DONE     → (터미널, 사용 안 함)
```

**삭제되는 전이:**
- `READY → DONE` (직접 전이 폐지). 회귀 테스트(`order-state.test.js`)에서 케이스 갱신 필요.

**의미 정의 (사용자 결정 기준):**
- `DINING` = "전달 완료, 손님 식사 중"
- `SETTLED` = "테이블 정리 완료, 주문 사이클 끝" ← *사실상 새 종결 상태*
- `DONE` = (의미 보존: "수령 완료") *그러나 본 흐름에서는 진입 X*

**기존 ADR-025 회귀 테스트 영향:**
- 13 합법 전이 → 약 14~15 합법 전이 (READY→DINING, DINING→SETTLED, DINING→CANCELED 추가; READY→DONE 삭제). DONE의 합법 진입은 *없음*으로 갱신.
- 불법 전이 회귀(5건)는 그대로 유지 + 새 케이스 추가:
  - `READY → DONE` *불법*
  - `READY → SETTLED` *불법*(DINING 우회 차단)
  - `DINING → DONE` *불법*(SETTLED를 거쳐야 함이 아니라 — DONE은 dead status라 진입 자체 차단)
  - `DINING → READY` *불법*

### 2.3 사용자 진행 중 주문 표시 정책

- **표시 허용:** ORDERED · TRANSFER_REPORTED · PAID · COOKING · READY · HOLD
- **표시 제외:** DINING · DONE(dead) · SETTLED · CANCELED
- 구현 위치: `src/components/organisms/RecentOrdersSection.jsx:20`의 `TERMINAL` 갱신:
  ```js
  const TERMINAL = new Set(['DINING', 'DONE', 'SETTLED', 'CANCELED']);
  ```
  - DONE도 포함 — 본 흐름에서 진입은 없지만 *legacy 데이터/방어선* 차원에서 안전.
- `STATE_LABEL.DINING`/`STATE_LABEL.SETTLED`는 StatusPage 직접 URL 접근 안전망용으로 둠.
  - 추천 카피:
    - `DINING: '식사 중! 맛있게 드세요!'`
    - `SETTLED: '주문이 완료되었어요. 또 오세요!'`

### 2.4 테이블 사용 가능 여부 정책

**사용자가 선택 가능한 테이블:**
- 해당 테이블 번호로 작성된 *진행 중 주문*이 **없어야** 함. "진행 중 주문" = 상태가 다음에 포함된 주문:
  ```
  ORDERED · TRANSFER_REPORTED · PAID · COOKING · READY · DINING · HOLD
  ```
  (즉, **SETTLED / CANCELED**만 점유 해제로 간주. DONE은 dead status라 진입 X.)
- 해당 테이블에 *수동 잠금*이 걸려 있지 않아야 함.
- *오늘 영업일(`operating_date`)* 기준으로만 필터링한다 — 5/20 주문이 5/21 점유를 끌어다 쓰지 않게.
- **포장(`delivery_type='takeout'`) 주문은 점유에 영향 없음.** `table_no IS NULL` 이므로 자연스럽게 제외.

**사용자 안내 문구 (확정):**
> "현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요."

표시 시점:
1. CheckoutPage radio-cell에 disabled 처리 + tooltip/aria-label.
2. 주문 제출 시점에 서버 거부되면 동일 안내를 alert/ErrorState로 노출.

**사용자 응답에 order_no 노출 X (Q2 확정):**
- `GET /api/tables/availability` 응답은 `{ table_no, status }` 최소 형태. 다른 손님 주문 번호는 노출하지 않는다.
- 어드민 응답(`GET /admin/api/tables`)은 `order_no`, `dining_at`, `locked_by` 포함.

### 2.5 테이블 잠금 정책 (Q4 + Q6 확정)

**관리자 수동 잠금 (별도 개념):**
- 어드민 nav에 **"테이블 잠금" 탭 추가** — 위치: *"쿠폰" 옆* (오른쪽 끝).
- 1~15 테이블 카드/grid UI.
- 각 테이블에 **"잠금" / "해제" 단순 토글**.
- **사유 입력 X (Q4 확정)** — `table_locks.reason` 컬럼 자체 생성 안 함. 잠금/해제만.
- 잠금/해제 모두 `admin_events`에 로그 1행 INSERT — **`category='system'`** (Q6 확정 — 새 카테고리 신설 안 함).
- 이벤트 `event_type`은 `TABLE_LOCK` / `TABLE_UNLOCK`, `target_id`에 `table_no` 보존.

**잠금의 의미 (제한):**
- *주문을 받지 않도록 막는* 기능. 점유 중인 테이블을 강제로 비우는 기능이 아님.
- "잠긴 테이블" = 사용자 주문 화면에서 선택 불가 + 서버 POST /api/orders에서도 거부.
- 점유 중인 테이블에 추가로 수동 잠금이 걸려 있을 수 있음 (이중 상태). 잠금 해제 시에도 점유는 유지.

---

## 3. 데이터 모델 설계 (Q7 확정 — 마이그레이션 X, init.sql 단일 갱신)

### 3.1 적용 방식 (Q7 결정)

- **마이그레이션 스크립트 작성 안 함.** 사용자 결정: 로컬 dev DB든 운영 DB든 *DB 초기화*로 새 스키마 적용.
- 따라서 `bootstrap.js`의 `applyPostInitMigrations`에 새 단계 추가하지 않는다.
- **`server/db/init.sql`만 *최종 형태*로 갱신**한다. 신규 DB 첫 부팅 시 init.sql 1회 실행으로 모든 변경이 적용됨.
- 운영 DB는 docker compose down → named volume `chickenedak-data` 초기화(또는 별도 데이터 디렉토리 비우기) → docker compose up.
- 기존 데이터 보존 불필요 — 운영 시작 전(5/20 16:30 이전) 적용.

### 3.2 신설 테이블 — `table_locks` (init.sql에 직접 작성)

```sql
CREATE TABLE IF NOT EXISTS table_locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_no INTEGER NOT NULL CHECK(table_no BETWEEN 1 AND 15),
  locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
  locked_at TEXT,                     -- locked=1로 토글된 시각 (datetime('now'))
  unlocked_at TEXT,                   -- locked=0으로 토글된 시각
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(table_no)                    -- 테이블당 1행 — UPSERT 패턴
);
CREATE INDEX IF NOT EXISTS idx_table_locks_locked ON table_locks(locked);
```

- **`reason` 컬럼 없음 (Q4 확정).** 잠금 사유 입력 UI도 없음 — 단순 토글.
- **`locked_by` 컬럼 없음.** 어드민 단일 PIN 환경이라 actor 식별이 의미 없음 (admin_events에 actor='admin'으로 기록되긴 함).
- 초기 데이터: 처음에는 행이 없어도 됨. 잠금 시 INSERT or UPDATE (UPSERT).
- 조회 시 행이 없으면 `locked=0`으로 간주.
- *table_no를 1~15로 제한*하는 CHECK constraint를 DB에 둠 (앱 레이어와 이중 방어).

### 3.3 `admin_events.category` — 'system' 흡수 (Q6 확정)

- 현재 CHECK constraint `IN ('menu','system')` **그대로 유지**. 스키마 변경 없음.
- 테이블 잠금/해제 이벤트는 `category='system'`으로 INSERT.
- `target_id`에 `table_no` 보존, `target_name`에 `'테이블 N번'`.
- 이벤트 타입:
  - `TABLE_LOCK` — action_name `'테이블 잠금'`
  - `TABLE_UNLOCK` — action_name `'테이블 잠금 해제'`
- `operating_date`는 `getBusinessState(db).operating_date` 채움 (find_error_v3 P1-2 회귀 차단 — NULL이면 시스템 탭에서 사라짐).
- *주문 전이*(READY→DINING, DINING→SETTLED)는 `order_events`에 자동 기록(`updateOrderStatus(..., { actor: 'admin' })`). 별도 admin_events 기록 X.

### 3.4 `orders.status` CHECK constraint — init.sql 갱신

```sql
-- init.sql 최종 형태
status TEXT NOT NULL DEFAULT 'ORDERED' CHECK(status IN (
  'ORDERED','TRANSFER_REPORTED','PAID','COOKING','READY',
  'DINING','DONE','SETTLED',
  'HOLD','CANCELED'
))
```

- `DINING`, `SETTLED` 추가. `DONE`은 *legacy/dead* 의미로 보존(향후 데이터 호환).
- *마이그레이션 X* — DB 초기화 시 init.sql이 위 형태로 단번에 적용.

### 3.5 `orders.dining_at` / `settled_at` 컬럼 — init.sql 갱신

```sql
-- init.sql 최종 형태 (orders 테이블 정의 안에)
  dining_at TEXT,
  settled_at TEXT,
```

- `STATUS_TIME_FIELD`(`server/repositories/order-repo.js:157`)에 추가:
  ```js
  DINING:  'dining_at',
  SETTLED: 'settled_at',
  ```
- 어드민 카드 경과 시간 계산: DINING 상태일 때 `elapsedMinutes(order.dining_at, now)`.

---

## 4. API 설계

### 4.1 사용자용

**GET `/api/tables/availability`** (신설 — Q2/Q5 확정)

- 응답: 1~15 테이블의 사용 가능 여부 배열. **`order_no` 미포함**(Q2).
  ```json
  [
    { "table_no": 1, "status": "available" },
    { "table_no": 2, "status": "occupied" },
    { "table_no": 3, "status": "dining" },
    { "table_no": 4, "status": "locked" }
  ]
  ```
- status enum: `available | occupied | dining | locked`.
  - 점유와 식사 중을 *상태 값으로는 분리*하되, 사용자 UI 입장에서는 둘 다 "선택 불가"로 표시 (disabled + aria-label).
- CLOSED 상태에서도 응답 가능해야 함 (사용자가 메뉴 진입 가능한 시점이면 availability도 조회 가능).
- **폴링 X (Q5 확정)** — CheckoutPage 진입 시 1회 fetch + 주문 접수 버튼 클릭 직전 1회 추가 fetch. SSE/주기 폴링 없음.

**POST `/api/orders`** (기존 + 검증 추가)

- 입력 검증에 *사용 가능 테이블 가드* 추가 — `delivery_type='dineIn'` + `table_no=N`일 때:
  1. zod 1~15 검증 (기존)
  2. **table availability 도메인 호출 (신규)** — N번이 `available` 아니면 거부:
     - HTTP 409 `TABLE_NOT_AVAILABLE`
     - 메시지: `"현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요."`
- 라우트 위치: `customer.js`의 `db.transaction` 안쪽 *첫 단계*에서 검증 후 진행.

### 4.2 관리자용 (Q2/Q4 확정)

**GET `/admin/api/tables`** (신설)
- 응답: 사용자 API와 같은 형태 + 어드민 전용 필드:
  ```json
  [
    { "table_no": 1, "status": "available", "updated_at": "..." },
    { "table_no": 2, "status": "occupied", "order_no": 12, "updated_at": "..." },
    { "table_no": 3, "status": "dining",   "order_no": 11, "dining_at": "...", "updated_at": "..." },
    { "table_no": 4, "status": "locked",   "locked_at": "...", "updated_at": "..." }
  ]
  ```
- `order_no`, `dining_at`은 어드민 응답에만 포함(Q2).
- `reason` 필드는 *없음*(Q4 — 사유 컬럼 미생성).

**POST `/admin/api/tables/:tableNo/lock`** (신설)
- body: **없음** (Q4 — 사유 입력 X). `{}` 또는 빈 body 허용.
- 동작: `table_locks` UPSERT (`locked=1`, `locked_at=now`), `admin_events`에 `TABLE_LOCK` 1행 INSERT — `category='system'`, `target_id=N`, `target_name='테이블 N번'`, operating_date 채움.
- 응답: 갱신된 테이블 row.
- 인증: `requireAdmin` + `requireCsrf` 적용 (관리자 기존 미들웨어 패턴 그대로).

**POST `/admin/api/tables/:tableNo/unlock`** (신설)
- body: 없음.
- 동작: `table_locks` UPSERT (`locked=0`, `unlocked_at=now`), `admin_events`에 `TABLE_UNLOCK` 1행 — `category='system'`.
- *진행 중 주문 점유는 영향 없음* — 본 API는 수동 잠금만 해제.

**상태 전이 API는 기존 그대로 사용** — `POST /admin/api/orders/:id/transition`:
- 본부 대시보드 READY 컬럼 "전달 완료" 버튼: `{ to: 'DINING' }` 전송.
- DINING 컬럼 "테이블 준비 완료" 버튼: `{ to: 'SETTLED' }` 전송 (*DONE이 아니다 — Q1+Q1.1 확정*).
- 새 엔드포인트를 추가하기보다 *기존 라우트를 재사용*.

### 4.3 API 경로 상수 갱신

`src/api/routes.js`에 추가:
```js
TABLES_AVAILABILITY: '/api/tables/availability',
ADMIN_TABLES: '/admin/api/tables',
ADMIN_TABLE_LOCK: (n) => `/admin/api/tables/${n}/lock`,
ADMIN_TABLE_UNLOCK: (n) => `/admin/api/tables/${n}/unlock`,
```

### 4.4 history API 영향

- `HISTORY_TYPE_ALLOWLIST` (`server/routes/admin.js:169`)에 `'tables'` 추가 (옵션 b 선택 시).
- 응답 row의 `category`가 `'table'`이 추가 가능해짐 — 클라이언트(`HistoryPage.jsx`)에서 카테고리별 라벨/필터 갱신 필요.

---

## 5. 관리자 대시보드 설계

### 5.1 컬럼 구성 (7개로 확장)

`src/constants/admin-columns.js`에 한 행 추가:

| 순서 | status | title |
|---:|---|---|
| 1 | ORDERED | 주문중 |
| 2 | TRANSFER_REPORTED | 이체확인요청 |
| 3 | PAID | 이체완료 |
| 4 | COOKING | 조리중 |
| 5 | **READY** | **수령대기** |
| 6 | **DINING** | **식사중** ← 신규, 5번 우측 |
| 7 | HOLD | 보류 |

- 7컬럼 그리드 — `.admin-board` CSS의 grid-template-columns가 `repeat(6, ...)`로 잡혀 있을 수 있으므로 *grid 변경 필요*. (확인 필요 — `src/styles/components.css` 또는 design-bundle/app.css 그리드 변수 확인 후 작업)
- HOLD를 가장 오른쪽에 두는 현재 정책 유지 (긴급 대응 컬럼이라 끝 배치). 단, DINING이 *위치상 READY 오른쪽*이라는 사용자 요구를 정확히 반영 — 결과적으로 HOLD가 7번째.

### 5.2 READY 컬럼 버튼 변경

`ACTION_BY_STATUS.READY` (`AdminCardColumn.jsx:93`):
```js
// 변경 전
READY: [{ label: '전달 완료', to: 'DONE', variant: 'primary' }]
// 변경 후
READY: [{ label: '전달 완료', to: 'DINING', variant: 'primary' }]
```

라벨은 동일 — 운영자 인지 부담 최소.

### 5.3 DINING 컬럼 카드 표시 (Q3 확정)

- 표시 항목:
  - 주문번호 `#{order.no}`
  - 수령 위치(테이블/포장) — `formatLocationLabel(order)` 재사용
  - 메뉴 요약 — `previewItems(order.items)` 재사용 (최대 3개 + 외 N개)
  - **식사 경과 시간 (분)** — `elapsedMinutes(order.dining_at, now)` 사용.
  - 액션 버튼: `[{ label: '테이블 준비 완료', to: 'SETTLED', variant: 'primary' }]` ← **SETTLED**(Q1+Q1.1)
- elapsed tone (Q3 — 30분/60분 완화 임계):
  ```js
  function diningElapsedTone(minutes) {
    if (minutes >= 60) return 'border-danger';
    if (minutes >= 30) return 'border-warning';
    return 'border-divider';
  }
  ```
- READY/COOKING/HOLD 컬럼의 elapsed tone(5/10분)은 *그대로*. DINING에만 별도 임계 함수 분기.

### 5.4 elapsed 계산 분기

`OrderCard` 내부:
```js
const baselineAt = order.status === 'DINING' ? order.dining_at : order.transferred_at;
const elapsedMin = useMemo(
  () => calcElapsedMinutes(baselineAt, new Date(tick)),
  [baselineAt, tick],
);

// tone 분기 — DINING은 30/60, 그 외는 5/10
const tone = order.status === 'DINING'
  ? diningElapsedTone(elapsedMin)
  : elapsedTone(elapsedMin);
```

### 5.5 사용자 화면에서는 DINING 미노출

- `RecentOrdersSection` TERMINAL 확장으로 자동 처리.
- StatusPage 직접 URL 진입은 가능 — *카피만 안전망으로 추가*. 알림이나 강제 리다이렉트는 본 범위 외.

---

## 6. 테이블 잠금 페이지 설계

### 6.1 nav 추가

`AdminLayout.jsx`의 `ITEMS` 마지막에 추가:
```js
{ to: '/admin/tables', label: '테이블 잠금', testid: 'admin-nav-tables' }
```

라우트도 `App.jsx`에 React.lazy로 추가: `'/admin/tables'` → `AdminTablesPage` (신규 페이지).

### 6.2 페이지 구성 (Q4 확정)

- 헤더: "테이블 잠금" + biz-badge 그대로.
- 본문: 1~15 카드 그리드 (5열 × 3행 권장).
- 각 카드:
  - 상단 큰 번호 `#{n}`
  - 현재 상태 배지:
    - **사용 가능** (초록)
    - **이용 중** (주황) — order_no 작게 표시
    - **식사 중** (회색) — dining_at부터의 경과 분
    - **잠김** (빨강) — *사유 표시 없음* (Q4 — reason 컬럼 자체 없음)
  - 버튼:
    - 잠김이면 **"잠금 해제"** 단일 버튼.
    - 잠김 아니면 **"잠금"** 단일 버튼. **사유 입력 모달 없음** (Q4) — 클릭 즉시 POST.
- 점유 중 + 잠김 중복 상태: 둘 다 표시 (잠금 우선 색상). 해제 클릭 후에도 점유 중이면 카드는 "이용 중/식사 중"으로 유지 + 안내 토스트: "수동 잠금만 해제됐어요. 진행 중 주문 때문에 아직 사용할 수 없습니다."

### 6.3 페이지 데이터

- 진입 시 `GET /admin/api/tables` 1회 호출.
- 폴링 X — 어드민이 잠금/해제 후 즉시 refetch. DashboardPage와의 데이터 일관성은 *수동 새로고침*으로 처리.
- 잠금/해제 mutation 후 응답 row로 캐시 갱신 + 전체 refetch.

### 6.4 design-bundle 참고

- `docs/design-bundle/screens-admin.jsx`에 테이블 잠금 화면이 *없음*. — 새 페이지의 디자인은 *기존 어드민 톤*(`.admin-page`, `.col`, `.order-card` 류 semantic 클래스)을 따른다.
- 카드 디자인은 어드민 주문 카드 톤을 차용. 신규 CSS는 가능하면 기존 토큰(--color-success/--color-warning/--color-danger/--color-muted) 재사용.

---

## 7. 동시성/정합성 리스크 분석 (본 범위 한정)

본 기능의 핵심 전제는 **같은 테이블에 두 주문이 동시에 들어가는 상황은 없다**는 것이다. 따라서 다음은 본 범위 *주요 리스크가 아니다*:

- 두 사용자가 같은 테이블을 동시 주문하는 race condition
- DB partial unique index 기반 강한 동시성 방어
- 트랜잭션 locking 정교화
- concurrency stress test

다만 *프론트 캐시 stale*과 *서버 단일 진실*은 분석해 두어야 한다:

### 7.1 오래된 availability 화면 + 사이 잠금

- 사용자가 CheckoutPage를 열어둔 사이 관리자가 잠금 토글.
- 사용자가 그 테이블을 클릭하고 주문 제출 시 — **서버가 최종 방어선이어야 한다.** `POST /api/orders` 안에서 availability 재확인 → 409 `TABLE_NOT_AVAILABLE` + 안내 문구.

### 7.2 사이 시점 점유 발생

- 사용자가 availability=available을 본 직후 다른 사용자가 같은 테이블 주문.
- 같은 테이블 동시 주문은 전제 외라 본 케이스는 *현실에서는 운영 동선상* 거의 일어나지 않는다.
- 만약 발생해도 서버가 두 번째 주문에서 거부 — *데이터 정합성은 깨지지 않는다*.

### 7.3 사용자 진영 가드 (UX)

- CheckoutPage에서 availability fetch 실패 → fallback: 모든 테이블 enable + 제출 시 서버 거부로 처리. *fallback이 사용자 흐름을 막지 않게* 한다.
- availability에서 'occupied'/'dining' 응답이 와도 사용자에게는 단일 disabled 상태로 표시 — 운영자 정보(order_no)는 노출 X 권장.

### 7.4 관리자 취소/테이블 준비 완료 반영

- CANCELED 전이는 *어느 단계에서든 가능*. 현재 라우트(`POST /admin/api/orders/:id/transition`)에 정책상 변경 불필요 — availability 도메인이 *진행 중 주문 status 집합*으로 계산하므로 CANCELED 즉시 사용 가능 상태로 전환.
- DINING → DONE 전이도 동일 — DONE 즉시 사용 가능.

### 7.5 table_no=NULL (포장) 케이스 회귀

- 점유 판정 SQL에서 `table_no IS NOT NULL` 필터 필수. 포장 주문이 1번 테이블 점유로 잘못 계산되는 회귀를 차단.
- 회귀 테스트: 포장 주문 1건이 있어도 1~15 모두 available 응답.

### 7.6 운영일 경계 (operating_date)

- 5/20 진행 중 주문이 5/21 첫 손님 입장에서 보이지 않게 — availability SQL에 `operating_date = ?` 필터 필수.
- 정산 마감 시점에 진행 중 주문이 0건이어야 마감 가능(ADR-012) — 본 변경은 정산 가드에 영향 없음 (오히려 DINING 상태가 남아 있으면 마감 자체가 막힘 = 자연 가드).

---

## 8. 심각도와 구현 우선순위

### P0 (절대 깨지면 안 됨)
- 사용 불가능한 테이블로 주문이 접수되는 문제 — 서버 `POST /api/orders` 최종 방어선 작동.
- 식사 중(DINING) 테이블이 다시 선택 가능한 문제 — availability 도메인의 진행 중 상태 집합에 DINING 포함.
- READY → DINING 으로의 전이가 깨지면 *전체 흐름 단절* — `order-state.js` 합법 전이 갱신 회귀 필수.
- DB 초기화 후 init.sql 적용 누락(orders 컬럼 누락/status enum 누락) — bootstrap 단위 테스트 필수.

### P1 (운영 사고로 이어질 수 있음)
- 테이블 수동 잠금이 주문 생성에 반영되지 않는 문제 — availability 응답 + POST 가드 양쪽 모두에서 잠금 반영.
- READY → DINING → SETTLED 흐름이 깨지는 문제 — 두 전이 모두 회귀 케이스 추가.
- DINING → DONE 또는 READY → DONE 등 *DONE 진입 전이가 새어 들어오는 회귀* — DONE은 dead status로 정의되었으므로 진입 전이는 모두 불법이어야 함.
- 사용자가 DINING/SETTLED 주문을 계속 진행 중으로 보는 문제 — `RecentOrdersSection.TERMINAL` 확장.
- 잠금 해제 클릭 시 점유 중 테이블이 사용 가능으로 잘못 표시되는 문제 — 잠금만 해제하고 점유는 유지.
- admin_events 'system' 카테고리 기록 시 operating_date 누락 → 시스템 탭에서 사라지는 회귀(find_error_v3 P1-2 동형).

### P2 (UX 결함)
- DINING 카드 경과 시간 0분 표시 안 됨 / 1분 단위 갱신 누락 — 1분 tick 의존성에 `dining_at` 반영 누락 시 발생.
- DINING 30/60분 임계가 *READY/COOKING의 5/10분 임계로 덮어쓰기*되는 회귀(elapsed tone 분기 누락).
- 테이블 잠금 페이지에서 점유와 잠금 상태 우선순위 표기 혼동.
- 사용자 disabled UI에 적절한 카피/aria-label 부재.

### P3 (디자인/문구)
- DINING 컬럼 배지 색감 / SETTLED 표기 카피 조정.
- 어드민 nav "테이블 잠금" 라벨이 길어서 줄바꿈 발생 가능 — 본 범위 마무리 단계.

---

## 9. 영향 받는 파일 (참고용)

| 영역 | 파일 | 변경 성격 |
|---|---|---|
| 백엔드 도메인 | `server/domain/order-state.js` | 합법 전이 갱신 + DINING/SETTLED 추가, DONE 진입 차단 |
| 백엔드 도메인 (신규) | `server/domain/table-availability.js` | 신규 — availability 계산 |
| 백엔드 리포 (신규) | `server/repositories/table-locks-repo.js` | 신규 — UPSERT/get/list (reason 컬럼 없음) |
| 백엔드 리포 | `server/repositories/order-repo.js` | `STATUS_TIME_FIELD`에 DINING/SETTLED 추가 |
| 백엔드 init | `server/db/init.sql` | **단일 갱신**: status enum + dining_at/settled_at 컬럼 + table_locks 테이블 모두 포함 |
| 백엔드 부트스트랩 | `server/db/bootstrap.js` | **변경 거의 없음** (마이그레이션 X) |
| 백엔드 라우트 | `server/routes/customer.js` | POST /api/orders availability 가드 + GET /api/tables/availability (order_no 미포함) |
| 백엔드 라우트 | `server/routes/admin.js` | GET/POST /admin/api/tables* (사유 입력 X), 'system' 카테고리에 TABLE_LOCK/UNLOCK |
| 프론트 상수 | `src/constants/admin-columns.js` | DINING 컬럼 추가 (위치: READY와 HOLD 사이) |
| 프론트 컴포넌트 | `src/components/organisms/AdminCardColumn.jsx` | 액션 매트릭스(SETTLED), elapsed baseline 분기, DINING 30/60 tone |
| 프론트 컴포넌트 | `src/components/organisms/RecentOrdersSection.jsx` | TERMINAL = {DINING, DONE, SETTLED, CANCELED} |
| 프론트 페이지 | `src/pages/customer/CheckoutPage.jsx` | availability fetch(진입 1회+제출 직전) + disabled radio-cell + 안내 문구 |
| 프론트 페이지 | `src/pages/customer/StatusPage.jsx` | DINING/SETTLED 카피 안전망 |
| 프론트 레이아웃 | `src/components/layouts/AdminLayout.jsx` | nav 항목 추가 |
| 프론트 라우터 | `src/App.jsx` | 라우트 추가 |
| 프론트 페이지 (신규) | `src/pages/admin/TablesPage.jsx` | 신규 — 테이블 잠금 화면 (단순 토글) |
| 프론트 API | `src/api/routes.js` | 상수 4건 추가 |
| 프론트 스타일 | `src/styles/components.css` (or design-bundle) | 7컬럼 그리드 + 테이블 카드 스타일 (확인 필요) |
| 문서 | `docs/DECISIONS.md` | ADR-025 갱신 노트 + (신규) ADR-035 후보 |
| 문서 | `docs/API_DRAFT.md`, `docs/DB_DRAFT.md` | API/DB 갱신 동기화 |
| 운영 자산 | `docs/operations/admin-card.md`, `d1-rehearsal.md` | DB 초기화 절차 + 테이블 잠금 운영 + 식사 중 컬럼 |
| 회귀 테스트 | `server/domain/__tests__/order-state.test.js` 외 다수 | 새 전이/availability/locks 회귀 |

---

## 10. 사용자 결정 (2026-05-19 확정)

| # | 결정 항목 | 답 |
|---|---|---|
| Q1 | DONE 의미 재정의 | **옵션 B — SETTLED 신설.** DONE 의미는 보존하되 *실주 사용 안 함* (dead status). |
| Q1.1 | SETTLED 흐름의 어드민 버튼 수 | **옵션 α — 버튼 2개.** 실 흐름 `READY → DINING → SETTLED`. DONE은 dead status. |
| Q2 | availability 응답에 order_no 노출 여부 | **옵션 A — 사용자에게는 숨김.** 어드민 응답만 `order_no` 포함. |
| Q3 | DINING 경과 시간 임계 색상 | **옵션 B — 30분/60분 완화 임계.** READY/COOKING 5/10분과 분리 운영. |
| Q4 | 잠금 사유 입력 UX | **사용 안 함.** `table_locks.reason` 컬럼 자체 미생성. 단순 잠금/해제 토글. |
| Q5 | availability 폴링 주기 | **옵션 A — 진입 1회 + 제출 직전 1회.** 주기 폴링 X. 서버 409 최종 방어선이 보완. |
| Q6 | 테이블 잠금 이벤트 로그 | **옵션 B — `category='system'` 흡수.** admin_events 스키마 변경 없음. |
| Q7 | 마이그레이션 적용 시점 | **마이그레이션 X.** 로컬/실서버 모두 *DB 초기화*로 적용. `init.sql`만 최종 형태로 갱신. |

이상의 8건이 본 문서의 모든 설계 결정을 lock-in한다.
구현 단계 진입 후 변경이 필요하면 본 문서 갱신 → ADR-035 후보로 docs/DECISIONS.md에 기록.

---

## 11. 참고

- 이 문서와 함께 작성된 자매 문서:
  - `docs/table_occupancy_work_instruction.md` — Superpowers subagent-driven-development 기반 작업 지시서
  - `docs/table_occupancy_qa_plan.md` — 시나리오/자동 테스트/통과 기준 검수 지시서
- 본 문서의 모든 코드 인용은 *현재 브랜치 `table_lock`*의 파일을 기준으로 한다.
