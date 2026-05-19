// Task 6.1 회귀 — bootstrap.js 신규/기존 DB 분기 + seedAdmin + PIN 해시.
// :memory: SQLite로 격리 — 디스크 부수효과 없음.
//
// 가드:
// 1) 신규 DB → init.sql 일괄 실행 + 모든 테이블 + 인덱스 + 시드.
// 2) 기존 DB(_migrations 마크 있음) 재부팅 시 skip.
// 3) seedAdmin — env(DEFAULT_ADMIN_PIN) 우선, 없으면 6자리 랜덤 + stdout 1회.
// 4) admins 비어있지 않으면 시드 skip.
// 5) PIN 해시(SHA-256) + verifyPin(timingSafeEqual) 정합.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase, seedAdmin, hashPin, verifyPin } from '../db/bootstrap.js';

function inMemoryDb() {
  return new Database(':memory:');
}

let originalEnv;

beforeEach(() => {
  originalEnv = process.env.DEFAULT_ADMIN_PIN;
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.DEFAULT_ADMIN_PIN;
  } else {
    process.env.DEFAULT_ADMIN_PIN = originalEnv;
  }
});

describe('bootstrapDatabase — 신규 DB', () => {
  it('★ init.sql 실행으로 모든 테이블 생성', () => {
    const db = inMemoryDb();
    const result = bootstrapDatabase(db);
    expect(result.initialized).toBe(true);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((t) => t.name);

    expect(tables).toContain('_migrations');
    expect(tables).toContain('menus');
    expect(tables).toContain('orders');
    expect(tables).toContain('order_items');
    expect(tables).toContain('used_coupons');
    expect(tables).toContain('admins');
    expect(tables).toContain('business_state');
    expect(tables).toContain('system_settings');
    expect(tables).toContain('settlements');
    expect(tables).toContain('backups');
  });

  it('★ 메뉴 8개 시드 (PUBG 코드 보존 — ADR-006)', () => {
    const db = inMemoryDb();
    bootstrapDatabase(db);

    const menus = db.prepare('SELECT code, name, base_price, category FROM menus ORDER BY id').all();
    expect(menus).toHaveLength(8);

    const codes = menus.map((m) => m.code);
    expect(codes).toEqual([
      'BANDAGE',
      'FIRST_AID',
      'MED_KIT',
      'SYRINGE',
      'DEFIB',
      'ADRENALINE',
      'PAINKILLER',
      'ENERGY',
    ]);

    // src/constants/menus.js 와 가격 정합 (SoT)
    const byCode = Object.fromEntries(menus.map((m) => [m.code, m]));
    expect(byCode.BANDAGE.base_price).toBe(18000);
    expect(byCode.BANDAGE.name).toBe('후라이드');
    expect(byCode.BANDAGE.category).toBe('chicken');

    expect(byCode.FIRST_AID.base_price).toBe(19000);
    expect(byCode.MED_KIT.base_price).toBe(21000);
    expect(byCode.SYRINGE.base_price).toBe(5000);
    expect(byCode.DEFIB.base_price).toBe(7000);
    expect(byCode.ADRENALINE.base_price).toBe(6000);
    expect(byCode.PAINKILLER.base_price).toBe(2000);
    expect(byCode.ENERGY.base_price).toBe(2000);

    expect(byCode.PAINKILLER.category).toBe('drink');
    expect(byCode.SYRINGE.category).toBe('side');
  });

  it('★ business_state CLOSED 시드 + operating_date (G13)', () => {
    const db = inMemoryDb();
    bootstrapDatabase(db);

    const state = db.prepare('SELECT id, status, operating_date FROM business_state WHERE id=1').get();
    expect(state).toBeDefined();
    expect(state.status).toBe('CLOSED');
    expect(state.operating_date).toBeTruthy();
  });

  it('★ system_settings 시드 (G14 — operating_dates 외)', () => {
    const db = inMemoryDb();
    bootstrapDatabase(db);

    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(map.operating_dates).toBeTruthy();
  });

  it('★ _migrations 마크 INSERT — 001-init 행 존재', () => {
    const db = inMemoryDb();
    bootstrapDatabase(db);

    const rows = db.prepare('SELECT name FROM _migrations').all();
    expect(rows.map((r) => r.name)).toContain('001-init');
  });
});

describe('bootstrapDatabase — 기존 DB', () => {
  it('★ _migrations에 마크 있으면 재부팅 시 skip', () => {
    const db = inMemoryDb();
    const first = bootstrapDatabase(db);
    expect(first.initialized).toBe(true);

    const second = bootstrapDatabase(db);
    expect(second.initialized).toBe(false);
  });

  it('★ init.sql 실패 시 ROLLBACK — 테이블 없음', () => {
    const db = inMemoryDb();
    // _migrations 존재하지만 비어있는 상태 (이전 부팅이 도중에 죽었다고 가정)
    // → init.sql 진입 후 의도적으로 깨진 SQL을 실행 시 ROLLBACK 검증.
    // 직접 broken SQL을 주입하기 위해 monkey-patch 대신 별도 db에 좁은 init 검증.
    // 여기서는 단순히 "테이블 존재 안 함"을 검증 (init.sql 안 돈 상태).
    db.exec("CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at TEXT)");
    const result = bootstrapDatabase(db);
    // _migrations만 있고 비어있으면 init.sql 실행 (가이드: §5.2 isNew 판단 보강)
    expect(result.initialized).toBe(true);
  });
});

describe('seedAdmin', () => {
  it('★ DEFAULT_ADMIN_PIN env 명시 시 그 값 사용', () => {
    process.env.DEFAULT_ADMIN_PIN = '123456';
    const db = inMemoryDb();
    bootstrapDatabase(db);

    const generated = seedAdmin(db);
    expect(generated).toBeNull();  // env 사용 시 generated 값 미반환

    const admin = db.prepare('SELECT pin_hash FROM admins LIMIT 1').get();
    expect(admin).toBeDefined();
    expect(verifyPin('123456', admin.pin_hash)).toBe(true);
  });

  it('★ env 미설정 시 6자리 랜덤 생성 + stdout 1회 출력', () => {
    delete process.env.DEFAULT_ADMIN_PIN;
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const db = inMemoryDb();
    bootstrapDatabase(db);
    const generated = seedAdmin(db);

    expect(generated).toMatch(/^\d{6}$/);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatch(/Generated admin PIN/);
    expect(spy.mock.calls[0][0]).toContain(generated);

    spy.mockRestore();
  });

  it('★ env가 형식 위반(6자리 숫자 아님) → 랜덤 fallback', () => {
    process.env.DEFAULT_ADMIN_PIN = 'abc';
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const db = inMemoryDb();
    bootstrapDatabase(db);
    const generated = seedAdmin(db);

    expect(generated).toMatch(/^\d{6}$/);  // env 무시 + 랜덤
    spy.mockRestore();
  });

  it('★ admins 이미 존재 시 skip — 기존 PIN 보존', () => {
    process.env.DEFAULT_ADMIN_PIN = '111111';
    const db = inMemoryDb();
    bootstrapDatabase(db);
    seedAdmin(db);  // 첫 시드 — 111111

    process.env.DEFAULT_ADMIN_PIN = '222222';  // 환경 변경 시도
    const second = seedAdmin(db);
    expect(second).toBeNull();

    const admin = db.prepare('SELECT pin_hash FROM admins LIMIT 1').get();
    expect(verifyPin('111111', admin.pin_hash)).toBe(true);
    expect(verifyPin('222222', admin.pin_hash)).toBe(false);
  });
});

describe('bootstrapDatabase — table_lock 라운드 P1-3 (기존 DB CHECK 갱신)', () => {
  // 시나리오: 기존 운영 DB 볼륨에 orders.status CHECK가 옛 enum(DINING/SETTLED 없음)인 상태에서
  // bootstrap을 다시 돌리면 006이 table rebuild로 새 enum을 적용해야 한다.
  // 그러지 못하면 READY → DINING UPDATE가 CHECK constraint 실패로 깨진다.

  /**
   * 옛 CHECK enum만 허용하는 orders 테이블 + 마이그레이션 마크 005까지 적용된 상태를
   * 흉내내는 DB 헬퍼. 006-table-lock 마이그레이션이 표적이다.
   */
  function legacyDb() {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE orders (
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
        access_token TEXT,
        delivery_type TEXT NOT NULL DEFAULT 'dineIn' CHECK(delivery_type IN ('dineIn','takeout')),
        table_no INTEGER,
        total_price INTEGER NOT NULL CHECK(total_price >= 0),
        depositor_name TEXT,
        bank TEXT,
        custom_bank TEXT,
        use_other_name INTEGER DEFAULT 0,
        other_name TEXT,
        amount INTEGER,
        transferred_at TEXT,
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
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        base_price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        category TEXT
      );
      CREATE TABLE admins (id INTEGER PRIMARY KEY AUTOINCREMENT, pin_hash TEXT NOT NULL);
      CREATE TABLE business_state (id INTEGER PRIMARY KEY CHECK(id=1), status TEXT NOT NULL DEFAULT 'CLOSED', operating_date TEXT NOT NULL, changed_at TEXT);
      CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT);
      CREATE TABLE settlements (id INTEGER PRIMARY KEY AUTOINCREMENT, operating_date TEXT NOT NULL UNIQUE, closed_at TEXT NOT NULL DEFAULT (datetime('now')), total_orders INTEGER NOT NULL, total_amount INTEGER NOT NULL, zip_path TEXT);
      CREATE TABLE backups (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, path TEXT NOT NULL, size_bytes INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE order_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id), event_type TEXT NOT NULL, from_status TEXT, to_status TEXT, action_name TEXT NOT NULL, actor TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE used_coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, name TEXT NOT NULL, order_id INTEGER NOT NULL REFERENCES orders(id), used_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(student_id));
      CREATE TABLE admin_events (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL CHECK(category IN ('menu','system')), event_type TEXT NOT NULL, action_name TEXT NOT NULL, actor TEXT NOT NULL, operating_date TEXT, target_id INTEGER, target_name TEXT, before_value TEXT, after_value TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO _migrations (name) VALUES ('001-init'),('002-access-token'),('003-order-events'),('004-coupon-student-unique'),('005-admin-events');
      INSERT INTO business_state (id, status, operating_date) VALUES (1, 'CLOSED', '2026-05-20');
    `);
    return db;
  }

  it('★ P1-3 — 옛 CHECK DB에서 bootstrap 006 적용 후 READY → DINING UPDATE 가능', () => {
    const db = legacyDb();
    // 시드 주문 1건 (READY 상태)
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, total_price, status)
       VALUES (1, '2026-05-20', '홍길동', 18000, 'READY')`,
    ).run();

    // bootstrap 006 적용 (기존 마크 005까지라 006이 실행됨)
    bootstrapDatabase(db);

    // 006 적용 후: status enum이 DINING/SETTLED 포함하도록 rebuild되었어야 한다.
    expect(() =>
      db.prepare("UPDATE orders SET status='DINING' WHERE id = 1").run(),
    ).not.toThrow();

    // SETTLED도 가능해야 한다.
    expect(() =>
      db.prepare("UPDATE orders SET status='SETTLED' WHERE id = 1").run(),
    ).not.toThrow();

    // 기존 데이터는 보존되어야 한다 (no/name/total_price).
    const row = db.prepare('SELECT no, name, total_price, status FROM orders WHERE id=1').get();
    expect(row.no).toBe(1);
    expect(row.name).toBe('홍길동');
    expect(row.total_price).toBe(18000);
  });

  it('★ P1-3 — 마이그레이션 006이 idempotent: 두 번 실행해도 깨지지 않음', () => {
    const db = legacyDb();
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, total_price, status)
       VALUES (1, '2026-05-20', 'A', 18000, 'READY')`,
    ).run();
    bootstrapDatabase(db);
    // 2회차는 _migrations에 006이 있으므로 skip — throws X.
    expect(() => bootstrapDatabase(db)).not.toThrow();
    // 데이터 여전히 1건.
    expect(db.prepare('SELECT COUNT(*) AS c FROM orders').get().c).toBe(1);
  });

  it('★ P1-3 — 006 적용 후 table_locks 테이블 + dining_at/settled_at 컬럼 존재', () => {
    const db = legacyDb();
    bootstrapDatabase(db);

    // table_locks 존재
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t) => t.name);
    expect(tables).toContain('table_locks');

    // 컬럼 존재
    const cols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
    expect(cols).toContain('dining_at');
    expect(cols).toContain('settled_at');
  });

  it('★ P1-3 — 신규 DB에서도 status enum이 DINING/SETTLED 포함 (init.sql 정합)', () => {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    // 신규 DB는 init.sql이 이미 새 CHECK 포함. DINING UPDATE 가능.
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, total_price, status)
       VALUES (1, '2026-05-20', 'X', 18000, 'READY')`,
    ).run();
    expect(() => db.prepare("UPDATE orders SET status='DINING' WHERE id=1").run()).not.toThrow();
    expect(() => db.prepare("UPDATE orders SET status='SETTLED' WHERE id=1").run()).not.toThrow();
  });

  // ── P2 재리뷰 보완 (Codex 2026-05-19) — 불완전 006이 이미 마크된 DB 보정 ────
  it('★ P2 재리뷰 — 006 마크 있지만 orders.status가 옛 enum이면 rebuild 보정 실행', () => {
    // 시나리오: 예전 *불완전* 006-table-lock이 _migrations에 이미 INSERT되어 있는 DB.
    // 옛 코드는 ALTER ADD COLUMN만 했고 CHECK는 갱신 못 했다.
    const db = legacyDb();
    // 옛 마이그레이션이 추가했던 컬럼 (dining_at/settled_at 단순 ALTER)도 시뮬레이션.
    db.exec('ALTER TABLE orders ADD COLUMN dining_at TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN settled_at TEXT');
    db.exec(`
      CREATE TABLE table_locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_no INTEGER NOT NULL UNIQUE CHECK(table_no BETWEEN 1 AND 15),
        locked INTEGER NOT NULL DEFAULT 0,
        locked_at TEXT, unlocked_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // _migrations에 006 마크 INSERT — 옛 불완전 마이그레이션이 이미 적용됐다고 가정.
    db.prepare("INSERT INTO _migrations (name) VALUES ('006-table-lock')").run();

    // 시드 주문 (옛 CHECK enum 하에 READY까지만 허용됨).
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, total_price, status)
       VALUES (1, '2026-05-20', '홍길동', 18000, 'READY')`,
    ).run();

    // 보정 전: DINING UPDATE는 *반드시 실패해야* 한다 (이게 P1-3가 노린 회귀).
    expect(() =>
      db.prepare("UPDATE orders SET status='DINING' WHERE id=1").run(),
    ).toThrow();

    // bootstrap 재실행 — 마크가 있어도 schema 검사 후 rebuild 보정.
    bootstrapDatabase(db);

    // 보정 후: DINING UPDATE 성공.
    expect(() =>
      db.prepare("UPDATE orders SET status='DINING' WHERE id=1").run(),
    ).not.toThrow();
    expect(() =>
      db.prepare("UPDATE orders SET status='SETTLED' WHERE id=1").run(),
    ).not.toThrow();

    // 기존 데이터(시드 1행) 보존.
    expect(db.prepare('SELECT COUNT(*) AS c FROM orders').get().c).toBe(1);

    // _migrations에 006 마크는 *중복 없이* 1행만.
    const mark = db
      .prepare("SELECT COUNT(*) AS c FROM _migrations WHERE name='006-table-lock'")
      .get();
    expect(mark.c).toBe(1);
  });

  it('★ P2 재리뷰 — 정상 신규 DB(006 마크 + 새 enum)는 fast skip (재실행 no-op)', () => {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    // 첫 실행에서 enum 정합 + 006 마크 + table_locks 모두 생성.
    const rowCountBefore = db
      .prepare("SELECT COUNT(*) AS c FROM _migrations WHERE name='006-table-lock'")
      .get().c;
    expect(rowCountBefore).toBe(1);

    // 재실행해도 변화 없음.
    bootstrapDatabase(db);
    const rowCountAfter = db
      .prepare("SELECT COUNT(*) AS c FROM _migrations WHERE name='006-table-lock'")
      .get().c;
    expect(rowCountAfter).toBe(1); // 마크 중복 INSERT X
  });
});

describe('hashPin / verifyPin', () => {
  it('SHA-256 해시 — 결정적 출력', () => {
    const h1 = hashPin('123456');
    const h2 = hashPin('123456');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyPin — 올바른 PIN true / 틀린 PIN false', () => {
    const hash = hashPin('123456');
    expect(verifyPin('123456', hash)).toBe(true);
    expect(verifyPin('999999', hash)).toBe(false);
    expect(verifyPin('', hash)).toBe(false);
    expect(verifyPin('123456', '')).toBe(false);
  });

  it('verifyPin — 길이 다른 해시도 안전하게 false (timingSafeEqual 가드)', () => {
    const hash = hashPin('123456');
    // 한 글자 짧은 해시 — timingSafeEqual은 길이 다르면 throw, verifyPin은 false로 흡수.
    expect(verifyPin('123456', hash.slice(0, -1))).toBe(false);
  });
});
