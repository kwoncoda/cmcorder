# DB 초안 — 오늘 저녁은 치킨이닭!

> ⚠️ **최신 결정 우선 (2026-05-15 갱신 — `docs/CODEX_REVIEW_v2_FIX_SUMMARY.md`):** §6 PII 보존 정책 → 운영자 수동 폐기 (ADR-027). orders 테이블에 `access_token` 컬럼 신규 (마이그레이션 002, P0-4). 본문에 남아있는 "정산 후 N일 자동 NULL" 표기는 D+7일 수동 절차 (`docs/operations/pii-deletion.md`)로 대체.
>
> ⚠️ **find_error_v3 변경 (2026-05-18, ADR-034):**
> - `used_coupons.UNIQUE(student_id)` — 이전 `(student_id, name)`은 같은 학번/다른 이름으로 쿠폰 재사용 가능했던 P0 결함. 마이그레이션 `004-coupon-student-unique`로 idempotent table-rebuild.
> - `admin_events` 테이블 신규 (`§2.10`) — 메뉴/시스템 이벤트 통합 로그. `order_events`는 주문 상태 변경 전용 유지. 마이그레이션 `005-admin-events` (CREATE IF NOT EXISTS).

**작성일:** 2026-05-04 (`/plan-eng-review` 1차)
**관련 문서:** `ARCHITECTURE.md` §3·§5, `API_DRAFT.md`, `DECISIONS.md`
**상태:** DRAFT
**DB:** SQLite 3.x (better-sqlite3, WAL 모드)

---

## 0. 원칙

1. **SQLite + WAL 모드** — `PRAGMA journal_mode=WAL`로 동시 읽기 허용. 30 동시 사용자 + 5-10 관리자 환경에 적합.
2. **Raw SQL only** — ORM 미사용. `db/repositories/*.js`가 prepared statement로 쿼리 실행.
3. **마이그레이션 = 정렬된 SQL 파일** — `db/migrations/NNN-name.sql`을 부팅 시 `_migrations` 테이블 검사 후 미적용분 순차 실행.
4. **PII 컬럼 명시** — 학번·이름·이체정보·은행·테이블 번호·access/external 토큰. 정산 후 7일 내 **운영자 수동 폐기** 대상 (ADR-027 변경, 2026-05-15 — `docs/operations/pii-deletion.md`).
5. **금액은 정수(원)** — Float 미사용. 결제 정확도 보장.
6. **시각은 UTC ISO 8601 + business_date 별도 컬럼** — 일자 기준 집계는 `business_date`로 (KST 기준 마감 가변, ADR-014, ADR-018).
7. **외래 키 강제** — `PRAGMA foreign_keys=ON` 부팅 시 설정.

---

## 1. ER 다이어그램

```
┌─────────────────┐         ┌─────────────────┐
│ menu_categories │◀────────│      menus      │
│─────────────────│         │─────────────────│
│ id (PK)         │         │ id (PK)         │
│ name            │         │ category_id (FK)│
│ display_order   │         │ name            │
└─────────────────┘         │ price (INT)     │
                            │ image_url?      │
                            │ is_recommended  │
                            │ is_sold_out     │
                            │ deleted_at?     │
                            │ created_at      │
                            │ updated_at      │
                            └────────┬────────┘
                                     │
                                     │
┌─────────────────┐         ┌────────▼────────┐         ┌──────────────────┐
│ used_coupons    │         │      orders     │────────▶│   order_items    │
│─────────────────│         │─────────────────│         │──────────────────│
│ id (PK)         │         │ id (PK)         │         │ id (PK)          │
│ student_id (UQ) │         │ order_no        │         │ order_id (FK)    │
│ name            │         │ business_date   │         │ menu_id (FK)     │
│ order_id (FK)   │────────▶│ status          │         │ menu_name_snap   │
│ used_at         │         │ student_id?     │         │ unit_price_snap  │
│ discount        │         │ customer_name   │         │ qty              │
└─────────────────┘         │ is_external     │         │ line_total       │
                            │ external_token? │         └──────────────────┘
                            │ token_expires_at│
                            │ pickup_method   │
                            │ table_no?       │         ┌──────────────────┐
                            │ subtotal        │         │ rejected_coupons │
                            │ discount        │         │──────────────────│
                            │ total           │         │ id (PK)          │
                            │ transfer_bank?  │         │ student_id?      │
                            │ transfer_alt_   │         │ name?            │
                            │   name?         │         │ reason           │
                            │ transfer_at?    │         │ ip               │
                            │ paid_at?        │         │ attempted_at     │
                            │ cooking_at?     │         └──────────────────┘
                            │ ready_at?       │
                            │ done_at?        │         ┌──────────────────┐
                            │ canceled_at?    │         │ admins           │
                            │ cancel_reason?  │         │──────────────────│
                            │ created_at      │         │ id (PK)          │
                            │ updated_at      │         │ username (UQ)    │
                            └────────┬────────┘         │ pin_hash         │
                                     │                   │ role             │
                                     │                   │ created_at       │
                            ┌────────▼────────┐         └──────────────────┘
                            │ order_events    │
                            │─────────────────│         ┌──────────────────┐
                            │ id (PK)         │         │ admin_sessions   │
                            │ order_id (FK)   │         │  (connect-       │
                            │ event_type      │         │   sqlite3)       │
                            │ from_status?    │         │──────────────────│
                            │ to_status?      │         │ sid (PK)         │
                            │ note?           │         │ data             │
                            │ actor           │         │ expires_at       │
                            │ created_at      │         └──────────────────┘
                            └─────────────────┘

┌──────────────────────┐                      ┌──────────────────────┐
│ settlement_snapshots │                      │ backup_downloads     │
│──────────────────────│                      │──────────────────────│
│ id (PK)              │                      │ id (PK)              │
│ business_date (UQ)   │                      │ business_date        │
│ closed_at            │                      │ filename             │
│ closed_by_admin_id   │                      │ source ('manual'/    │
│ summary_json         │                      │  'auto')             │
│ deposit_total?       │                      │ size_bytes           │
│ deposit_diff?        │                      │ downloaded_by?       │
│ deposit_input_at?    │                      │ created_at           │
└──────────────────────┘                      └──────────────────────┘

┌──────────────────────┐
│ _migrations          │
│──────────────────────│
│ filename (PK)        │
│ applied_at           │
└──────────────────────┘
```

---

## 2. 테이블 정의 (CREATE TABLE)

### 2.1 `menu_categories`

```sql
CREATE TABLE menu_categories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO menu_categories (id, name, display_order) VALUES
  (1, '치킨',   10),
  (2, '사이드', 20),
  (3, '음료',   30);
```

### 2.2 `menus`

```sql
CREATE TABLE menus (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL REFERENCES menu_categories(id),
  name            TEXT NOT NULL,
  price           INTEGER NOT NULL CHECK (price >= 0),       -- 원 단위
  image_url       TEXT,
  fallback_emoji  TEXT,
  is_recommended  INTEGER NOT NULL DEFAULT 0 CHECK (is_recommended IN (0,1)),
  is_sold_out     INTEGER NOT NULL DEFAULT 0 CHECK (is_sold_out IN (0,1)),
  display_order   INTEGER NOT NULL DEFAULT 0,
  deleted_at      TEXT,                                       -- soft delete
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_menus_category ON menus(category_id) WHERE deleted_at IS NULL;
```

> SQLite는 BOOLEAN 미지원이라 `INTEGER + CHECK (... IN (0,1))` 패턴.
> `image_url`은 `/images/menus/<filename>.png` 형식 또는 NULL → fallback_emoji 사용.

### 2.3 `orders` ★ 핵심 테이블

```sql
CREATE TABLE orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no            INTEGER NOT NULL,                       -- 일자별 1부터 (ADR-018)
  business_date       TEXT NOT NULL,                          -- YYYY-MM-DD (KST 기준 운영 일자)
  status              TEXT NOT NULL CHECK (status IN
    ('ORDERED','TRANSFER_REPORTED','PAID','COOKING','READY','DONE','CANCELED','HOLD')),

  -- 주문자 정보 (ADR-021)
  student_id          TEXT,                                   -- 9자리 숫자, 외부인은 NULL
  customer_name       TEXT NOT NULL,
  is_external         INTEGER NOT NULL DEFAULT 0 CHECK (is_external IN (0,1)),
  external_token      TEXT,                                   -- 외부인만 (ADR-021)
  token_expires_at    TEXT,

  -- 수령
  pickup_method       TEXT NOT NULL CHECK (pickup_method IN ('dine_in','takeout')),
  table_no            INTEGER,

  -- 금액 (ADR-020 서버 계산)
  subtotal            INTEGER NOT NULL CHECK (subtotal >= 0),
  discount            INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total               INTEGER NOT NULL CHECK (total >= 0),

  -- 이체 정보
  transfer_bank       TEXT,
  transfer_alt_name   TEXT,                                   -- 다른 이름으로 이체 시
  transfer_at         TEXT,

  -- 상태별 타임스탬프
  paid_at             TEXT,
  cooking_at          TEXT,
  ready_at            TEXT,
  done_at             TEXT,
  canceled_at         TEXT,
  hold_at             TEXT,
  hold_reason         TEXT,
  cancel_reason       TEXT,

  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

  -- 데이터 무결성
  UNIQUE (business_date, order_no),
  CHECK (
    (is_external = 0 AND student_id IS NOT NULL) OR
    (is_external = 1 AND student_id IS NULL AND external_token IS NOT NULL)
  ),
  CHECK (subtotal - discount = total)
);

CREATE INDEX idx_orders_business_status ON orders(business_date, status);
CREATE INDEX idx_orders_student         ON orders(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX idx_orders_external_token  ON orders(external_token) WHERE external_token IS NOT NULL;
CREATE INDEX idx_orders_status_updated  ON orders(status, updated_at);  -- 5/10분 경고용
```

**핵심 제약:**
- `(business_date, order_no)` UNIQUE — 일자별 리셋 (ADR-018) 안전 보장.
- `CHECK is_external` — 외부인은 student_id NULL + token 필수. 학생은 student_id 필수 + token NULL.
- `CHECK subtotal - discount = total` — DB 레벨 무결성 (ADR-020 서버 계산 검증을 DB가 이중 가드).

**`order_no` 발급 전략:**
```sql
-- 트랜잭션 내부:
INSERT INTO orders (business_date, order_no, ...)
VALUES (
  ?,
  COALESCE((SELECT MAX(order_no) FROM orders WHERE business_date = ?), 0) + 1,
  ...
);
```
WAL + 트랜잭션 + UNIQUE 제약으로 race 없음.

### 2.4 `order_items`

```sql
CREATE TABLE order_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id           INTEGER NOT NULL REFERENCES menus(id),
  menu_name_snap    TEXT NOT NULL,                  -- 주문 시점 메뉴명 (사후 변경 방어)
  unit_price_snap   INTEGER NOT NULL CHECK (unit_price_snap >= 0),
  qty               INTEGER NOT NULL CHECK (qty >= 1 AND qty <= 20),
  line_total        INTEGER NOT NULL CHECK (line_total >= 0),

  CHECK (unit_price_snap * qty = line_total)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_menu  ON order_items(menu_id);
```

> **스냅샷 컬럼 근거:** 주문 시점 메뉴명/가격을 저장. 운영 중 메뉴 변경 시에도 정산이 안전. ADR-020 server-calc 결과를 DB에 보관.

### 2.5 `used_coupons` ★ ADR-019 + ADR-021

```sql
CREATE TABLE used_coupons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  TEXT NOT NULL UNIQUE,                 -- 학번당 1회 (축제 전체)
  -- 2026-05-13 변경 (ADR-019): prefix '202637' → 학과 코드 '37' 매칭 (위치 5-6)
  -- 검증 정규식 ^\d{2}\d{2}37\d{3}$ — 애플리케이션 레이어 (CHECK 제약 미사용)
  name        TEXT NOT NULL,
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  discount    INTEGER NOT NULL,
  used_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_used_coupons_used_at ON used_coupons(used_at);
```

**UNIQUE student_id**가 race condition 자체를 막음 (ADR-019).

### 2.6 `rejected_coupons`

```sql
CREATE TABLE rejected_coupons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    TEXT,
  name          TEXT,
  reason        TEXT NOT NULL CHECK (reason IN ('format','prefix','name','duplicate','rate_limit')),
  ip            TEXT,
  attempted_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rejected_attempted ON rejected_coupons(attempted_at);
CREATE INDEX idx_rejected_ip_time   ON rejected_coupons(ip, attempted_at);  -- rate-limit 조회용
```

운영 가이드: 정산 후 N일 보관 (학생증 대조 가능), 그 후 폐기.

### 2.7 `order_events` (감사·디버깅·인계)

```sql
CREATE TABLE order_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,                        -- 'created','transition','transfer_reported','hold','cancel'
  from_status TEXT,
  to_status   TEXT,
  note        TEXT,                                 -- HOLD 사유, 취소 사유 등
  actor       TEXT NOT NULL,                        -- 'customer:202637042' / 'admin:hub' / 'system'
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_order_events_order ON order_events(order_id);
CREATE INDEX idx_order_events_time  ON order_events(created_at);
```

> **선택 사항:** MVP에 필수는 아니지만, 인수인계·디버깅 가치가 큼. 매 상태 변경마다 1행 INSERT (저비용).

### 2.8 `admins`

```sql
CREATE TABLE admins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  pin_hash    TEXT NOT NULL,                        -- argon2id 또는 scrypt
  role        TEXT NOT NULL DEFAULT 'admin',        -- MVP는 'admin' 단일
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);
```

**어드민 자동 시드 (2026-05-13 신규, init.sql 동작):**

- 첫 부팅 시 `db/bootstrap.js`가 `admins` 테이블 빈 상태 감지
- 환경변수 `DEFAULT_ADMIN_PIN` 명시 시 → 해당 PIN을 scrypt 해시로 INSERT (`username='admin'`, `role='super_admin'`)
- `DEFAULT_ADMIN_PIN` 미명시 시 → 6자리 랜덤 PIN 생성 + scrypt 해시 INSERT + **stdout 1회 출력** (`[INIT] Generated admin PIN: 482917 — 운영 시작 전 변경 권장`)
- 재부팅 시 admins 테이블에 행 있으면 시드 skip
- 추가 admin: CLI `node scripts/admin-add.js <username> <pin>` 또는 Phase 2 UI

자세한 흐름은 `docs/ARCHITECTURE.md` §6.5 및 §8.5 참조.

### 2.9 `admin_sessions` (`connect-sqlite3`가 자동 생성)

```sql
-- 라이브러리가 자동 생성하지만 참고용:
CREATE TABLE admin_sessions (
  sid         TEXT PRIMARY KEY,
  data        TEXT,
  expires_at  INTEGER
);
```

### 2.10 `admin_events` ★ ADR-034 (find_error_v3)

```sql
CREATE TABLE admin_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category        TEXT NOT NULL CHECK (category IN ('menu','system')),
  event_type      TEXT NOT NULL,           -- 'SOLDOUT_ON' | 'SOLDOUT_OFF' | 'RECOMMEND_ON' | 'RECOMMEND_OFF' | 'PRICE_CHANGED' | 'BUSINESS_OPEN' | 'ADMIN_LOGIN' | 'AUTO_BACKUP'
  action_name     TEXT NOT NULL,           -- 한국어 라벨 ('품절 처리', '가격 변경', '장사 시작', '관리자 로그인', '자동 백업' 등)
  actor           TEXT NOT NULL,           -- 'admin' | 'system'
  operating_date  TEXT,                    -- 모든 기록 지점에서 채움 (history?type=system 노출에 필수)
  target_id       INTEGER,                 -- 메뉴 id 등
  target_name     TEXT,                    -- 메뉴 name 등
  before_value    TEXT,                    -- '17000' / 'false' 등 (PRICE_CHANGED/SOLDOUT_ON 등)
  after_value     TEXT,
  note            TEXT,                    -- AUTO_BACKUP의 zip 파일명 등
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_admin_events_created_at    ON admin_events(created_at);
CREATE INDEX idx_admin_events_category      ON admin_events(category);
CREATE INDEX idx_admin_events_operating_date ON admin_events(operating_date);
```

**기록 지점 (모두 `operating_date` 채움 — Codex P1-2 리뷰 2026-05-18):**

| 지점 | category | event_type | actor | operating_date | 추가 필드 |
|---|---|---|---|---|---|
| `POST /admin/login` 성공 | system | ADMIN_LOGIN | admin | `business_state.operating_date` | — |
| `POST /admin/api/business/open` 실제 전환 | system | BUSINESS_OPEN | admin | updated.operating_date | — |
| `POST /admin/api/menus/:id/toggle` soldOut 변경 | menu | SOLDOUT_ON/OFF | admin | 현재 op_date | target_id/_name, before/after `'true'/'false'` |
| 동 recommended | menu | RECOMMEND_ON/OFF | admin | 동 | 동 |
| 동 base_price | menu | PRICE_CHANGED | admin | 동 | before/after 가격 문자열 |
| `startAutoSnapshot.tick()` 성공 | system | AUTO_BACKUP | system | 현재 op_date | note=zip 파일명 |

**역행성:**
- before==after → row 미생성 (멱등 호출).
- `BUSINESS_OPEN`은 실제 CLOSED→OPEN 전환 시에만 (멱등 OPEN→OPEN skip).
- `ADMIN_LOGIN`은 PIN 일치 성공 시에만.
- `AUTO_BACKUP`은 ZIP 생성 성공 시에만.
- 메뉴 toggle + 로그 INSERT는 **단일 트랜잭션** (P2 보완) — 로그 실패 시 메뉴 변경도 ROLLBACK.

**조회:** `GET /admin/api/history?type=all|orders|menus|system` (API_DRAFT §2.27)는 `order_events`와 `admin_events`를 통합 응답으로 반환. type 별 source/category 필터.

### 2.10 `settlement_snapshots`

```sql
CREATE TABLE settlement_snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date       TEXT NOT NULL UNIQUE,
  closed_at           TEXT NOT NULL,
  closed_by_admin_id  INTEGER REFERENCES admins(id),
  summary_json        TEXT NOT NULL,                -- §12.2 항목들 직렬화
  deposit_total       INTEGER,
  deposit_diff        INTEGER,
  deposit_input_at    TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`summary_json` 예시:
```json
{
  "total_orders": 234,
  "total_canceled": 12,
  "subtotal_revenue": 1295000,
  "coupon_discount": 45000,
  "net_revenue": 1250000,
  "by_menu": [{"menu_id":1,"name":"후라이드","qty":87,"revenue":783000}],
  "by_hour": [{"hour":"16","count":8}],
  "coupons": {"used":23,"rejected_breakdown":{"format":2,"prefix":8}}
}
```

> 정산 시점 데이터를 *불변 스냅샷*으로 저장. 사후 메뉴·쿠폰 변경되어도 정산 결과 영향 없음.

### 2.11 `backup_downloads`

```sql
CREATE TABLE backup_downloads (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date     TEXT NOT NULL,
  filename          TEXT NOT NULL,
  source            TEXT NOT NULL CHECK (source IN ('manual','auto')),
  size_bytes        INTEGER NOT NULL,
  downloaded_by     INTEGER REFERENCES admins(id),  -- auto는 NULL
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_backup_date_source ON backup_downloads(business_date, source);
```

§12.5: 누가/언제 받았는지. ADR-022 자동 스냅샷도 동일 테이블에 source='auto'로 기록.

### 2.12 `_migrations`

```sql
CREATE TABLE _migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

부팅 시 `db/migrations/*.sql`을 정렬해 미적용분 실행 + 이 테이블에 기록.

### 2.13 `business_state` ★ G13 신규 (2026-05-13)

> 영업 상태 단일 행 토글 테이블. 관리자 "장사 시작"으로 OPEN, 정산 마감으로 자동 CLOSED.

```sql
CREATE TABLE business_state (
  id              INTEGER PRIMARY KEY CHECK (id = 1),    -- 단일 행 강제
  status          TEXT NOT NULL CHECK (status IN ('CLOSED', 'OPEN')),
  operating_date  TEXT,                                  -- 'YYYY-MM-DD', OPEN 시 today
  opened_at       TEXT,                                  -- 'YYYY-MM-DD HH:MM:SS'
  closed_at       TEXT,
  opened_by       INTEGER REFERENCES admins(id),         -- 누가 열었는지 추적
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- init.sql 시드: status='CLOSED' 단일 행
INSERT INTO business_state (id, status) VALUES (1, 'CLOSED');
```

**불변식 (애플리케이션 레이어):**
- `status='OPEN'`이면 `operating_date IS NOT NULL` AND `opened_at IS NOT NULL`
- 정산 마감 트리거 시 `status='CLOSED'` + `closed_at` 갱신 **같은 트랜잭션**
- 두 번째 행 INSERT 시도는 `CHECK (id = 1)` 위반으로 거부

### 2.14 `system_settings` ★ G14 신규 (2026-05-13)

> 운영 중 변경되는 단순 key-value 설정. 일자별 주문번호 시퀀스 등.

```sql
CREATE TABLE system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- init.sql 시드 (G14 일회성 운영 일정 — 5/20·5/21만)
INSERT INTO system_settings (key, value) VALUES
  ('operating_dates', '2026-05-20,2026-05-21'),
  ('business_open_time', '16:30'),
  ('auto_snapshot_interval_min', '120'),
  ('auto_snapshot_rotate', '6');
```

**용도:**
- 주문번호 일자별 reset 시퀀스 (Phase 2 — 현재는 orders 테이블 daily_no가 처리)
- 운영 가이드 설정 (`.env`와 중복 가능 — `.env`가 우선)
- 1차 운영 후 변경할 수 있는 *런타임 설정*

---

## 3. 인덱스 전체 목록

| 인덱스 | 용도 |
|---|---|
| `idx_menus_category` | 분류별 메뉴 조회, soft delete 제외 |
| `idx_orders_business_status` | 본부 대시보드 (오늘 + 상태) 핵심 쿼리 |
| `idx_orders_student` | 학생 조리 현황판 인증 (학번 매칭) |
| `idx_orders_external_token` | 외부인 조리 현황판 인증 (토큰 매칭) |
| `idx_orders_status_updated` | 5/10분 경고 (같은 상태 머문 시간) |
| `idx_order_items_order` | 주문 상세 화면 |
| `idx_order_items_menu` | 메뉴별 판매 집계 (정산) |
| `idx_used_coupons_used_at` | 쿠폰 사용 시간순 정렬 |
| `idx_rejected_attempted` | 거부 로그 시간순 |
| `idx_rejected_ip_time` | rate-limit IP 조회 |
| `idx_order_events_order` | 주문 이력 화면 |
| `idx_order_events_time` | 시간 범위 조회 |
| `idx_backup_date_source` | 일자별 자동/수동 백업 분리 조회 |

UNIQUE 제약(별도 인덱스 자동 생성):
- `orders(business_date, order_no)`
- `used_coupons(student_id)`
- `admins(username)`
- `settlement_snapshots(business_date)`

---

## 4. 자주 쓰이는 쿼리 (성능 검증용)

### 4.1 본부 대시보드 (가장 빈번)
```sql
SELECT id, order_no, status, customer_name, student_id, total,
       transfer_bank, transfer_alt_name, transfer_at,
       (julianday('now') - julianday(updated_at)) * 24 * 60 AS elapsed_minutes
FROM orders
WHERE business_date = ?
  AND status NOT IN ('DONE','CANCELED')
ORDER BY status, transfer_at NULLS FIRST, created_at;
```
인덱스: `idx_orders_business_status` 활용.

### 4.2 사용자 조리 현황판 (학생)
```sql
SELECT id, status, order_no, customer_name, total,
       paid_at, cooking_at, ready_at, done_at, canceled_at, hold_reason
FROM orders
WHERE business_date = ?
  AND order_no = ?
  AND student_id = ?;
```
인덱스: `(business_date, order_no)` UNIQUE 활용.

### 4.3 인기 랭킹 (5분 캐시)
```sql
SELECT m.id, m.name, SUM(oi.qty) AS sold_count
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN menus m ON oi.menu_id = m.id
WHERE o.business_date = ?
  AND o.status IN ('PAID','COOKING','READY','DONE')
GROUP BY m.id, m.name
ORDER BY sold_count DESC
LIMIT 3;
```
인덱스: `idx_order_items_menu` + `idx_orders_business_status`.

### 4.4 정산 마감 가드 (ADR-012 T3)
```sql
SELECT status, COUNT(*) AS cnt
FROM orders
WHERE business_date = ?
  AND status NOT IN ('DONE','CANCELED')
GROUP BY status;
```
결과가 비어있으면 마감 가능.

### 4.5 정산 메뉴별 집계
```sql
SELECT m.id, oi.menu_name_snap AS name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS revenue
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
LEFT JOIN menus m ON oi.menu_id = m.id
WHERE o.business_date = ?
  AND o.status = 'DONE'
GROUP BY m.id, oi.menu_name_snap
ORDER BY revenue DESC;
```

### 4.6 시간대별 주문량
```sql
SELECT strftime('%H', created_at, 'localtime') AS hour, COUNT(*) AS cnt
FROM orders
WHERE business_date = ?
  AND status = 'DONE'
GROUP BY hour
ORDER BY hour;
```

---

## 5. 마이그레이션 전략

### 5.1 파일 구조 — *2026-05-13 갱신*

```
src/db/
├── bootstrap.js            # 부팅 시 init 또는 마이그레이션 결정
├── init.sql                # ★ 신규 DB 첫 부팅 시 전체 스키마 + 시드 (§5.5)
└── migrations/
    ├── 001-init.sql        # init.sql과 동일 본문 (마이그 추적 첫 행)
    ├── 002-?               # 1차 운영 후 변경 시 추가 (운영 중 권장 X)
    └── ...
```

**init.sql vs migrations 분리 (사용자 요구 2026-05-13):**

- 사용자 명시: "서버 시작 시 init.sql이 작동해서 DB 구성"
- 신규 DB (volume 비어있음) → `init.sql` 단일 실행 (모든 CREATE TABLE + 시드)
- 기존 DB (volume에 db.sqlite 존재) → `migrations/` 미적용분만 실행
- 첫 부팅 후 `_migrations` 테이블에 `'001-init.sql'` 행 INSERT (재실행 방지)

### 5.2 부팅 시 적용 — *2026-05-13 갱신 (init.sql 흐름 추가)*

```javascript
// src/db/bootstrap.js (의사코드)
async function bootstrap(db) {
  // ① _migrations 테이블 존재 여부 = "기존 DB인지 신규 DB인지" 판단
  const isNew = !tableExists(db, '_migrations');

  if (isNew) {
    // 신규 DB: init.sql 일괄 실행 (모든 CREATE TABLE + 인덱스 + 시드)
    const sql = fs.readFileSync('src/db/init.sql', 'utf-8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare(`INSERT INTO _migrations (filename) VALUES (?)`)
        .run('001-init.sql');
      db.exec('COMMIT');
      logger.info('[bootstrap] Fresh DB created via init.sql');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    // ② 어드민 시드 (별도 트랜잭션, scrypt 해시는 JS에서)
    await seedAdmin(db);
  } else {
    // 기존 DB: migrations/ 미적용분만 실행
    await runMigrations(db);
  }
}

async function seedAdmin(db) {
  // admins 테이블 비어있으면 시드 (재부팅 시 skip)
  const count = db.prepare('SELECT COUNT(*) as n FROM admins').get().n;
  if (count > 0) return;

  const pin = process.env.DEFAULT_ADMIN_PIN || generateRandomPin(6);
  const pinHash = await scrypt(pin, generateSalt(), 64);
  db.prepare(`INSERT INTO admins (username, pin_hash, role)
              VALUES ('admin', ?, 'super_admin')`)
    .run(pinHash.toString('hex'));

  if (!process.env.DEFAULT_ADMIN_PIN) {
    logger.info(`[INIT] Generated admin PIN: ${pin} — 운영 시작 전 변경 권장`);
  }
}

function runMigrations(db) {
  const files = fs.readdirSync('src/db/migrations').filter(f => f.endsWith('.sql')).sort();
  const applied = new Set(db.prepare('SELECT filename FROM _migrations').all().map(r => r.filename));
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(`src/db/migrations/${f}`, 'utf-8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(f);
      db.exec('COMMIT');
      logger.info(`[migration] applied ${f}`);
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
```

**호출:** `server.js`에서 `app.listen()` 직전에 `await bootstrap(db)`. 실패 시 `process.exit(1)` → Docker `restart: always`가 재시도.

### 5.3 PRAGMA 설정

```javascript
db.pragma('journal_mode = WAL');           // 동시 읽기 최적화
db.pragma('synchronous = NORMAL');         // WAL+NORMAL이면 충돌 시 마지막 WAL만 손실 (수용)
db.pragma('foreign_keys = ON');            // FK 강제
db.pragma('cache_size = -32000');          // 32MB 캐시 (-는 KB 단위)
db.pragma('busy_timeout = 5000');          // 5초 대기 후 SQLITE_BUSY
```

### 5.4 1차 운영 변경 정책

운영 중 마이그레이션 권장 안 함. 변경 필요 시:
1. `docker compose down`
2. Volume 백업 (`tar`)
3. `db/migrations/NNN-name.sql` 추가
4. `docker compose up -d --build` (재가동 시 자동 적용)

> **운영 중 메뉴 가격 변경 금지** (ADR-020 해설). 변경 직후 주문이 새 가격, 직전 주문이 옛 가격 → 정산 혼란.

### 5.5 `init.sql` 본문 — *2026-05-13 신규*

> 신규 DB 첫 부팅 시 전체 스키마 + 초기 시드. 사용자 요구로 *단일 SQL 파일*로 통합.

```sql
-- src/db/init.sql
-- 신규 DB 첫 부팅 시 전체 스키마 + 시드 데이터
-- 호출자: src/db/bootstrap.js

PRAGMA foreign_keys = ON;

-- ─── 마이그레이션 추적 ────────────────────────────────────
CREATE TABLE _migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 도메인 핵심 테이블 (§2 정의 그대로) ───────────────────
-- (CREATE TABLE menu_categories, menus, orders, order_items,
--  used_coupons, rejected_coupons, order_events, admins,
--  admin_sessions, settlement_snapshots, backup_downloads,
--  business_state, system_settings — §2.1-§2.14 정의 그대로 INSERT)

-- ─── 모든 인덱스 (§3 정의 그대로) ─────────────────────────
-- (CREATE INDEX ... 전체)

-- ─── 초기 시드 데이터 ─────────────────────────────────────

-- 메뉴 카테고리 (G10 8개 메뉴 = 3 카테고리)
INSERT INTO menu_categories (slug, name, display_order) VALUES
  ('chicken', '치킨', 1),
  ('side',    '사이드', 2),
  ('drink',   '음료', 3);

-- 메뉴 8개 고정 (G10) — 가격은 사용자 확정 후 UPDATE 또는 마이그레이션
-- 메뉴 일러스트는 PUBG 회복 아이템 시각으로 매핑 (G10 + 2026-05-14 결정 b, DESIGN.md §10.5)
-- 이름은 본명 유지, 일러스트만 PUBG 아이템 시각 (사용자 PUBG 인게임 캡처 D-3 제공)
INSERT INTO menus (slug, name, category_id, price, is_recommended, is_soldout) VALUES
  ('fried',           '후라이드',         1, 18000, 1, 0),  -- 일러스트: 붕대 (Bandage)
  ('seasoned',        '양념',             1, 19000, 0, 0),  -- 일러스트: 구급상자 (First Aid Kit)
  ('bbringkle',       '뿌링클',           1, 20000, 1, 0),  -- 일러스트: 의료용 키트 (Medical Kit)
  ('chilis',          '칠리스',           1, 20000, 0, 0),  -- 일러스트: 아드레날린 주사기
  ('fries',           '감자튀김',         2,  4000, 0, 0),  -- 일러스트: 응급 지혈 주사 (Adrenaline Syringe)
  ('bbringkle_fries', '뿌링감자튀김',     2,  5000, 0, 0),  -- 일러스트: 자가제세동기 (Defibrillator)
  ('cola',            '콜라',             3,  2000, 0, 0),  -- 일러스트: 진통제 (Painkiller)
  ('cider',           '사이다',           3,  2000, 0, 0);  -- 일러스트: 에너지 드링크 (Energy Drink)
-- 일러스트 경로: menus.image_url 컬럼 (D-3 수령 시 UPDATE). 미수령 시 fallback (ADR-006 분류 이모지)

-- 영업 상태 단일 행 (G13)
INSERT INTO business_state (id, status) VALUES (1, 'CLOSED');

-- 시스템 설정 (G14)
INSERT INTO system_settings (key, value) VALUES
  ('operating_dates',           '2026-05-20,2026-05-21'),
  ('business_open_time',        '16:30'),
  ('auto_snapshot_interval_min', '120'),
  ('auto_snapshot_rotate',       '6');

-- 어드민은 init.sql에서 INSERT 안 함 (JS에서 scrypt 해시 후 INSERT, §5.2 seedAdmin)
```

**별도 처리 (init.sql 밖):**

- 어드민 PIN 해시 (scrypt) → JS에서 처리 (Node crypto 모듈)
- 운영 중 변경 (메뉴 가격·신규 admin) → 마이그레이션 파일

---

## 6. PII 분류 + 보존 정책 (ADR-027 변경, 2026-05-15)

**변경:** 자동 cron 잡 도입 보류. 일회성 2일 운영이므로 운영자 D+7일 수동 폐기로 대체. 절차: `docs/operations/pii-deletion.md`.

| 컬럼 | PII 등급 | 보존 정책 (수동 폐기) |
|---|---|---|
| `orders.student_id` | 높음 (개인 식별) | D+7일 수동 NULL 처리 |
| `orders.name` | 높음 | D+7일 수동 NULL/(폐기) 마킹 |
| `orders.bank`, `custom_bank`, `other_name`, `depositor_name` | 중간 | D+7일 수동 NULL |
| `orders.external_token`, `access_token` | 낮음 (랜덤) | D+7일 수동 NULL |
| `orders.table_no` | 낮음 | 보관 (집계용) |
| `used_coupons.*` | 높음 | D+7일 수동 DELETE |
| `order_events` (있을 시) | 낮음 | 보관 (인수인계 가치) |
| `settlement_snapshots.summary_json` | 중간 (집계 PII) | 영구 보관 — JSON에 학번/이름은 *집계 후 제외* |
| `backups/*.zip` (PII 포함) | 높음 | D+7일 학생회 클라우드 1년 보존 (감사 대비), 이후 폐기 |

**실행:** `docs/operations/pii-deletion.md` §4 sqlite3 명령 + named volume 백업 + 삭제.
~~`jobs/pii-purge.js`~~ — 자동 잡 도입 보류 (ADR-027).

---

## 7. 백업·복구

### 7.1 운영 중 (자동 ZIP, ADR-022)
- `jobs/auto-snapshot.js`가 30분 주기로 ZIP 생성
- DB 자체는 백업 안 함 (ZIP 안에 `orders.json`, `coupons.json`, `menu-snapshot.json`이 데이터)

### 7.2 운영 종료 후 (수동 정산 ZIP, §12.5)
- 정산 화면에서 `GET /admin/api/settlement/:date/zip`으로 다운로드
- USB·암호화 폴더 보관

### 7.3 호스트 디스크 손상 시
- Docker volume 외부 사본이 있으면 복원: `docker run --rm -v chickenedak-data:/data -v ${PWD}:/restore alpine tar xzf /restore/backup.tar.gz -C /`
- 자동 ZIP만 있으면: 수동으로 `orders.json`을 SQL INSERT로 변환해 신규 DB 부팅 (운영 가이드 작성 권장)

### 7.4 무결성 체크
부팅 시:
```javascript
const result = db.pragma('integrity_check', { simple: true });
if (result !== 'ok') {
  // pino error 로그 + 알림
  // 폴백: 마지막 자동 ZIP의 orders.json을 새 DB로 복원
}
```

---

## 8. 용량 추산

| 항목 | 값 |
|---|---|
| 평균 주문 1건 (orders + items 평균 2개 + events 5개) | ~2 KB |
| 5/20-21 양일 총 주문 200건 × 2 = 400건 | ~800 KB |
| 메뉴·카테고리·관리자 등 정적 데이터 | ~50 KB |
| 인덱스 오버헤드 | ~200 KB |
| **DB 총 용량 예상** | **< 2 MB** |
| 자동 ZIP 1개 (이미지 포함) | ~500 KB-1 MB |
| 자동 ZIP 6개 회전 | ~6 MB max |
| 메뉴 이미지 10개 × 200KB | ~2 MB |
| **Docker volume 총 사용량 예상** | **< 15 MB** |

학생회 노트북 디스크에 부담 0.

---

## 9. 변경 영향 추적

### 9.0 2026-05-13 갱신 사항

- **§2.5 used_coupons** — 쿠폰 학번 검증 정규식을 `prefix '202637'` → `\d{2}\d{2}37\d{3}` (학과 코드 37 매칭, ADR-019 변경)
- **§2.8 admins** — 어드민 자동 시드 정책 추가 (DEFAULT_ADMIN_PIN env 또는 랜덤 6자리 + stdout 출력)
- **§2.13 business_state 신규** — G13 영업 상태 단일 행 토글 테이블 (CLOSED/OPEN)
- **§2.14 system_settings 신규** — G14 일회성 운영 일정·자동 ZIP 주기·영업 시간 설정 저장
- **§5.1 파일 구조 갱신** — `src/db/init.sql` + `src/db/bootstrap.js` 신규 분리
- **§5.2 부팅 흐름 갱신** — bootstrap.js의 신규/기존 DB 분기 + seedAdmin() 흐름 명세
- **§5.5 init.sql 본문 신규** — 단일 SQL 파일로 전체 스키마 + 메뉴 8개 + 영업 상태 + 시스템 설정 시드 (사용자 요구 2026-05-13)
- **자동 ZIP 주기** — ADR-022 변경: 30분 → 2시간 (system_settings + .env 둘 다 반영)
- **메뉴 8개 고정** — G10: 후라이드·양념·뿌링클·칠리스·감자튀김·뿌링감자튀김·콜라·사이다 (가격은 사용자 확정 필요, 현재 init.sql 예시값)


| 결정 (ADR) | 영향받은 테이블/컬럼 |
|---|---|
| ADR-015 (조리 현황판 SSE) | `orders` 상태 컬럼은 그대로, `external_token` + `token_expires_at` 추가 |
| ADR-018 (다일 운영) | `(business_date, order_no)` UNIQUE 패턴 |
| ADR-019 (학번 prefix) | `used_coupons.student_id UNIQUE` (축제 전체 1회) |
| ADR-020 (Pattern B) | `order_items.unit_price_snap`, CHECK 무결성 |
| ADR-021 (학번+이름 필수) | `orders.student_id, customer_name, is_external, external_token` |
| ADR-022 (자동 ZIP) | `backup_downloads.source ('auto')` |
| ADR-023 (Docker) | volume 마운트 = `/app/data/db.sqlite` |

---

## 10. 미정·후속 검토

- **메뉴 이미지 저장:** 파일 시스템(`/app/data/images/`) vs DB BLOB. **추천: 파일 시스템** (간단·CDN 불필요).
- **PII purge 자동화:** 일회성 운영 — Phase 2 가정상 X. 운영자 수동 폐기 확정 (ADR-027).
- **`order_events` 채택 여부:** MVP 부담이면 Phase 2로 미룸. *추천: MVP 포함* (인수인계 가치 큼, 비용 INSERT 1건/상태변경).
- **`settlement_snapshots.summary_json` 스키마:** 변경 가능성 있음. JSON 안에 schema_version 필드 권장.

---

## §11. table_lock 라운드 스키마 변경 (2026-05-19)

### §11.1 orders 테이블 컬럼 추가

- `dining_at TEXT` — READY→DINING 전이 시 자동 기록 (`datetime('now')`). 식사 시작 시각.
- `settled_at TEXT` — DINING→SETTLED 전이 시 자동 기록. 테이블 정리 완료 시각.

orders.status CHECK enum에 `DINING`·`SETTLED` 추가; `DONE`은 레거시 보존 (dead status — 합법 전이 진입 없음).

### §11.2 table_locks 테이블 (신규)

```sql
CREATE TABLE table_locks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  table_no   INTEGER NOT NULL UNIQUE CHECK(table_no BETWEEN 1 AND 15),
  locked     INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0, 1)),
  locked_at  TEXT,
  unlocked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX uidx_table_locks_table_no ON table_locks(table_no);
CREATE INDEX idx_table_locks_locked ON table_locks(locked);
```

용도: 어드민이 특정 테이블을 수동 잠금(예: 청소 중, 예약). `locked=1`이면 주문 불가.

### §11.3 마이그레이션 정책

- 마이그레이션 X (init.sql 단일 갱신 방식). DB 초기화 후 재부팅 시 적용.
- 기존 운영 DB 업그레이드: `bootstrap.js` `applyPostInitMigrations()` 내 `006-table-lock` 마이그레이션이 idempotent ALTER TABLE + CREATE IF NOT EXISTS로 처리.
