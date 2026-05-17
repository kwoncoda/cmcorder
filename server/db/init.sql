-- ============================================================
-- 치킨이닭 초기 스키마 — Task 6.1 (DB_DRAFT.md §5.5)
--
-- 신규 DB 첫 부팅 시 1회 실행. _migrations 테이블이 비어 있으면 bootstrap.js가
-- 본 파일을 단일 트랜잭션으로 exec — 부분 적용으로 인한 깨진 스키마 방지.
--
-- 가드:
--   - 메뉴 8개는 src/constants/menus.js (SoT)와 정합 (PUBG 매핑 ADR-006).
--   - business_state 단일 행 강제 (CHECK id=1, G13).
--   - 외부인 토큰 보존을 위해 student_id NULL 허용 + is_external 플래그.
--   - 가격은 정수 원 단위 (Float X — ADR-020).
-- ============================================================

-- ─── 마이그레이션 트래커 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 메뉴 ────────────────────────────────────────────────
-- code: PUBG 회복 아이템 코드 (ADR-006 — 일러스트 매핑·assets 키)
-- name: 본명 (G10) — 콜라/사이다 그대로, 리스킨 X
-- category: chicken / side / drink (영문 키 — MenuFallback 이모지 매핑과 일치)
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('chicken','side','drink')),
  base_price INTEGER NOT NULL CHECK(base_price > 0),
  image TEXT,
  sold_out INTEGER NOT NULL DEFAULT 0 CHECK(sold_out IN (0,1)),
  recommended INTEGER NOT NULL DEFAULT 0 CHECK(recommended IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 주문 ────────────────────────────────────────────────
-- no: 일자별 시퀀스 (ADR-018) — operating_date와 함께 UNIQUE
-- status: G2 6단계 + HOLD/CANCELED 보조 상태
-- total_price: ADR-020 서버 계산 결과 스냅샷 (정수 원)
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no INTEGER NOT NULL,
  operating_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ORDERED' CHECK(status IN (
    'ORDERED','TRANSFER_REPORTED','PAID','COOKING','READY','DONE','HOLD','CANCELED'
  )),
  student_id TEXT,
  name TEXT NOT NULL,
  is_external INTEGER NOT NULL DEFAULT 0 CHECK(is_external IN (0,1)),
  external_token TEXT,
  delivery_type TEXT NOT NULL DEFAULT 'dineIn' CHECK(delivery_type IN ('dineIn','takeout')),
  table_no INTEGER,
  total_price INTEGER NOT NULL CHECK(total_price >= 0),
  -- 이체 정보 (TRANSFER_REPORTED 시 채워짐)
  depositor_name TEXT,
  bank TEXT,
  custom_bank TEXT,
  use_other_name INTEGER DEFAULT 0,
  other_name TEXT,
  amount INTEGER,
  transferred_at TEXT,
  -- 상태별 타임스탬프
  paid_at TEXT,
  cooking_at TEXT,
  ready_at TEXT,
  done_at TEXT,
  hold_reason TEXT,
  canceled_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(operating_date, no)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_operating_date ON orders(operating_date);
CREATE INDEX IF NOT EXISTS idx_orders_no_date ON orders(operating_date, no);

-- ─── 주문 항목 ───────────────────────────────────────────
-- name, base_price: 주문 시점 스냅샷 (메뉴 변경 후 정산 안전)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id INTEGER NOT NULL REFERENCES menus(id),
  name TEXT NOT NULL,
  base_price INTEGER NOT NULL CHECK(base_price > 0),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  category TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ─── 쿠폰 사용 (ADR-019 / ADR-021) ───────────────────────
-- 학번 prefix 검증은 애플리케이션 레이어 (정규식). DB는 UNIQUE 만 보장.
CREATE TABLE IF NOT EXISTS used_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  name TEXT NOT NULL,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  used_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, name)
);

-- ─── 관리자 ──────────────────────────────────────────────
-- pin_hash: SHA-256 (bootstrap.js — hashPin)
-- bootstrap 시 admins 비어있으면 seedAdmin이 1행 INSERT.
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 영업 상태 (G13) ─────────────────────────────────────
-- 단일 행 강제 (CHECK id=1). 첫 부팅 시 CLOSED.
CREATE TABLE IF NOT EXISTS business_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  status TEXT NOT NULL DEFAULT 'CLOSED' CHECK(status IN ('OPEN','CLOSED')),
  operating_date TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 시스템 설정 (G14) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 정산 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operating_date TEXT NOT NULL UNIQUE,
  closed_at TEXT NOT NULL DEFAULT (datetime('now')),
  total_orders INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  zip_path TEXT
);

-- ─── 백업 메타 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('auto','manual','settlement')),
  path TEXT NOT NULL,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 시드 데이터
-- ============================================================

-- 메뉴 8개 — src/constants/menus.js (SoT)와 정합.
-- 가격: MED_KIT 21000 / SYRINGE 5000 / DEFIB 7000 (회귀 보호).
-- PUBG 매핑: BANDAGE 후라이드 / FIRST_AID 양념 / MED_KIT 뿌링클 /
--           SYRINGE 감자튀김 / DEFIB 뿌링감자튀김 / ADRENALINE 칠리스 /
--           PAINKILLER 콜라 / ENERGY 사이다 (ADR-006)
INSERT OR IGNORE INTO menus (id, code, name, category, base_price, image, sold_out, recommended) VALUES
  (1, 'BANDAGE',    '후라이드',       'chicken', 18000, '/items/bandage.webp',    0, 1),
  (2, 'FIRST_AID',  '양념',           'chicken', 19000, '/items/first-aid.webp',  0, 0),
  (3, 'MED_KIT',    '뿌링클',         'chicken', 21000, '/items/med-kit.webp',    0, 1),
  (4, 'SYRINGE',    '감자튀김',       'side',     5000, '/items/syringe.webp',    0, 0),
  (5, 'DEFIB',      '뿌링감자튀김',   'side',     7000, '/items/defib.webp',      1, 0),
  (6, 'ADRENALINE', '칠리스',         'side',     6000, '/items/adrenaline.webp', 0, 0),
  (7, 'PAINKILLER', '콜라',           'drink',    2000, '/items/painkiller.webp', 0, 0),
  (8, 'ENERGY',     '사이다',         'drink',    2000, '/items/energy.webp',     0, 0);

-- 영업 상태 — 첫 부팅은 CLOSED. operating_date는 일회성 운영 시작일.
INSERT OR IGNORE INTO business_state (id, status, operating_date) VALUES
  (1, 'CLOSED', '2026-05-20');

-- 시스템 설정 — G14 일회성 운영 일정 + 자동 ZIP 주기.
-- business_open_time: Bug 12 — 16:30 → 15:00 (사용자 결정으로 오픈 앞당김).
INSERT OR IGNORE INTO system_settings (key, value) VALUES
  ('operating_dates',            '2026-05-20,2026-05-21'),
  ('business_open_time',         '15:00'),
  ('auto_snapshot_interval_min', '120'),
  ('auto_snapshot_rotate',       '6');

-- 마이그레이션 마크 — 재부팅 시 init.sql 재실행 방지.
INSERT OR IGNORE INTO _migrations (name) VALUES ('001-init');
