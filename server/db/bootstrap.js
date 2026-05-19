// DB 부트스트랩 — Task 6.1 (DB_DRAFT.md §5.2 / 사용자 요구 2026-05-13).
//
// 책임:
//   1) bootstrapDatabase: 신규 DB(_migrations 없음/빈 상태) → init.sql 일괄 실행.
//      기존 DB(_migrations 마크 있음) → skip. 트랜잭션으로 부분 적용 방지.
//   2) seedAdmin: admins 비어있으면 PIN 1행 INSERT.
//      DEFAULT_ADMIN_PIN env (6자리 숫자) 우선 → 없으면 6자리 랜덤 + stdout 1회.
//   3) hashPin / verifyPin: SHA-256 + timingSafeEqual.
//      Phase 6 후속에서 scrypt 마이그레이션 가능 (현재 task 명세는 SHA-256 + timingSafeEqual).
//
// 호출 순서 (server.js):
//   const db = openDatabase();
//   bootstrapDatabase(db);
//   seedAdmin(db);
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * DB 부트스트랩.
 * - _migrations 테이블 없거나 비어 있으면 init.sql 실행.
 * - 이미 마이그레이션 있으면 skip.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ initialized: boolean }}
 */
export function bootstrapDatabase(db) {
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
    .get();

  if (!tableExists) {
    logger.info('[bootstrap] 신규 DB — init.sql 실행');
    runInitSql(db);
    applyPostInitMigrations(db);
    return { initialized: true };
  }

  // 테이블은 있는데 비어있다면 이전 부팅이 도중에 실패한 케이스 — 재실행.
  const count = db.prepare('SELECT COUNT(*) AS c FROM _migrations').get().c;
  if (count === 0) {
    logger.info('[bootstrap] _migrations 빈 상태 — init.sql 재실행');
    runInitSql(db);
    applyPostInitMigrations(db);
    return { initialized: true };
  }

  logger.info({ count }, '[bootstrap] 기존 마이그레이션 존재 — skip init.sql');
  applyPostInitMigrations(db);
  return { initialized: false };
}

/**
 * init.sql 이후 증분 마이그레이션 — 항상 idempotent.
 * - 002-access-token (P0-4 Codex 리뷰 2026-05-15): orders.access_token 추가.
 *   기존 행에 token 발급 (외부인은 external_token 재사용, 그 외 신규 UUID).
 * - 003-order-events (find_error_v2 2026-05-18): 주문 상태 변경 감사 로그
 *   테이블 + 인덱스. CREATE IF NOT EXISTS — 신규 DB에서는 init.sql이
 *   먼저 만들어 둔다(중복 무해). 기존 DB에서는 본 마이그레이션이 만든다.
 * - 004-coupon-student-unique (find_error_v3 2026-05-18): used_coupons UNIQUE
 *   기준을 (student_id, name) → (student_id)로 좁힘. 같은 학번이 이름을 바꿔
 *   쿠폰을 재사용하던 실사용 버그 차단. 기존 (student_id, name) 인덱스가 있으면
 *   table-rebuild로 마이그레이션. 잠재적 중복은 INSERT OR IGNORE로 안전 처리.
 * - 005-admin-events (find_error_v3 2026-05-18): admin_events 테이블 + 인덱스.
 *   메뉴/시스템 이벤트 통합 로그. order_events와 분리 (order_id 없음, category 컬럼).
 *   IF NOT EXISTS — 신규 DB는 init.sql이 만들어 두므로 noop, 기존 DB는 본 마이그레이션이 생성.
 *
 * @param {import('better-sqlite3').Database} db
 */
function applyPostInitMigrations(db) {
  const applied = (name) =>
    !!db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(name);

  if (!applied('002-access-token')) {
    const tx = db.transaction(() => {
      const cols = db.prepare('PRAGMA table_info(orders)').all();
      const hasCol = cols.some((c) => c.name === 'access_token');
      if (!hasCol) {
        db.exec('ALTER TABLE orders ADD COLUMN access_token TEXT');
      }
      const rows = db
        .prepare('SELECT id, external_token FROM orders WHERE access_token IS NULL')
        .all();
      const upd = db.prepare('UPDATE orders SET access_token = ? WHERE id = ?');
      for (const r of rows) {
        upd.run(r.external_token ?? crypto.randomUUID(), r.id);
      }
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('002-access-token');
    });
    tx();
    logger.info('[bootstrap] 마이그레이션 002-access-token 적용');
  }

  if (!applied('003-order-events')) {
    const tx = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS order_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL REFERENCES orders(id),
          event_type TEXT NOT NULL,
          from_status TEXT,
          to_status TEXT,
          action_name TEXT NOT NULL,
          actor TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events(created_at);
      `);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('003-order-events');
    });
    tx();
    logger.info('[bootstrap] 마이그레이션 003-order-events 적용');
  }

  if (!applied('004-coupon-student-unique')) {
    const tx = db.transaction(() => {
      // 기존 used_coupons unique index 목록 검사. 신규 DB는 init.sql이 이미
      // UNIQUE(student_id) 단일로 만들어 두므로 rebuild 불필요.
      const indexes = db
        .prepare('PRAGMA index_list(used_coupons)')
        .all();
      let needsRebuild = false;
      for (const idx of indexes) {
        if (idx.unique !== 1 || idx.origin !== 'u') continue;
        const cols = db
          .prepare(`PRAGMA index_info(${JSON.stringify(idx.name)})`)
          .all()
          .map((c) => c.name)
          .sort();
        // 이미 student_id 단일 UNIQUE면 신규 DB (init.sql 적용된 상태) — skip.
        if (cols.length === 1 && cols[0] === 'student_id') {
          needsRebuild = false;
          break;
        }
        // (student_id, name) 등 다른 조합 UNIQUE면 rebuild 필요.
        if (cols.includes('student_id')) {
          needsRebuild = true;
        }
      }

      if (needsRebuild) {
        // SQLite는 ALTER TABLE DROP CONSTRAINT 미지원 → table rebuild 패턴.
        // 같은 student_id에 여러 name이 남아있을 수 있으므로 INSERT OR IGNORE로
        // 학번 단위 1행만 살리고 나머지는 버린다 (운영 DB는 없으나 안전 가드).
        db.exec(`
          CREATE TABLE used_coupons_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            name TEXT NOT NULL,
            order_id INTEGER NOT NULL REFERENCES orders(id),
            used_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(student_id)
          );
          INSERT OR IGNORE INTO used_coupons_new (id, student_id, name, order_id, used_at)
            SELECT id, student_id, name, order_id, used_at
              FROM used_coupons
              ORDER BY id;
          DROP TABLE used_coupons;
          ALTER TABLE used_coupons_new RENAME TO used_coupons;
        `);
      }

      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('004-coupon-student-unique');
    });
    tx();
    logger.info('[bootstrap] 마이그레이션 004-coupon-student-unique 적용');
  }

  if (!applied('005-admin-events')) {
    const tx = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL CHECK(category IN ('menu','system')),
          event_type TEXT NOT NULL,
          action_name TEXT NOT NULL,
          actor TEXT NOT NULL,
          operating_date TEXT,
          target_id INTEGER,
          target_name TEXT,
          before_value TEXT,
          after_value TEXT,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON admin_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_admin_events_category ON admin_events(category);
        CREATE INDEX IF NOT EXISTS idx_admin_events_operating_date ON admin_events(operating_date);
      `);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('005-admin-events');
    });
    tx();
    logger.info('[bootstrap] 마이그레이션 005-admin-events 적용');
  }

  // 006-table-lock (table_lock 라운드 2026-05-19, P1-3 Codex 갱신 + P2 재리뷰 보완):
  //   - orders.dining_at, orders.settled_at 컬럼 추가
  //   - orders.status CHECK enum에 DINING·SETTLED 포함되게 *table rebuild*
  //     (SQLite는 ALTER로 CHECK 변경 불가 → 새 테이블 생성 + INSERT SELECT + 교체).
  //     기존 DB의 CHECK에 DINING/SETTLED가 없으면 READY → DINING UPDATE가 실패한다.
  //   - table_locks 테이블 + 인덱스 신설
  //   - idempotent: rebuild는 sqlite_master에서 기존 CHECK 문자열을 점검 후 *필요할 때만* 실행.
  //
  // ★ P2 재리뷰 보완 (Codex 2026-05-19) — 단순 _migrations skip 금지.
  //   예전 *불완전* 006-table-lock이 이미 _migrations에 기록된 DB는
  //   orders.status CHECK가 여전히 옛 enum일 수 있다.
  //   → _migrations 마크와 *별개로* 실제 schema 상태를 매번 확인하고,
  //     enum이 불완전하면 rebuild를 *항상* 실행한다.
  //   → _migrations 마크는 *최초 1회만* INSERT (이미 있으면 skip).
  {
    const has006Mark = applied('006-table-lock');
    const ordersDdl = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'")
      .get()?.sql ?? '';
    const checkAcceptsNewStates =
      ordersDdl.includes("'DINING'") && ordersDdl.includes("'SETTLED'");

    // 둘 다 OK면 fast skip (정상 신규 DB 또는 이미 rebuild 완료된 기존 DB).
    if (has006Mark && checkAcceptsNewStates) {
      // no-op — 다음 마이그레이션으로.
    } else {
      const tx = db.transaction(() => {

      if (!checkAcceptsNewStates) {
        // 기존 DB에 CHECK가 오래된 enum만 허용 → orders 테이블 rebuild.
        // SQLite 권장 패턴: foreign_keys 임시 비활성화는 우리 스키마에서는 불필요
        // (order_items가 orders.id FK이지만 INSERT 순서를 유지하고 row id 보존).
        // PRAGMA defer_foreign_keys: tx 안 활성화로 안전.
        db.exec('PRAGMA defer_foreign_keys = ON');

        // 기존 컬럼 목록(미마이그레이션 dining_at/settled_at 누락 가능 → COALESCE NULL).
        const existingCols = db
          .prepare('PRAGMA table_info(orders)')
          .all()
          .map((c) => c.name);

        // 새 테이블 정의 — init.sql 최신 형태와 동일.
        db.exec(`
          CREATE TABLE orders_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            no INTEGER NOT NULL,
            operating_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ORDERED' CHECK(status IN (
              'ORDERED','TRANSFER_REPORTED','PAID','COOKING','READY',
              'DINING','DONE','SETTLED','HOLD','CANCELED'
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
            dining_at TEXT,
            settled_at TEXT,
            done_at TEXT,
            hold_reason TEXT,
            canceled_reason TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT,
            UNIQUE(operating_date, no)
          )
        `);

        // INSERT SELECT — 기존 컬럼만 복사. 누락된 dining_at/settled_at은 NULL로.
        // access_token 같은 옛 마이그레이션 컬럼도 있을 수 있으므로 동적 컬럼 목록 사용.
        const transferableCols = [
          'id','no','operating_date','status','student_id','name','is_external',
          'external_token','access_token','delivery_type','table_no','total_price',
          'depositor_name','bank','custom_bank','use_other_name','other_name','amount',
          'transferred_at','paid_at','cooking_at','ready_at','dining_at','settled_at',
          'done_at','hold_reason','canceled_reason','created_at','updated_at',
        ].filter((c) => existingCols.includes(c));
        const colList = transferableCols.join(', ');
        db.exec(`INSERT INTO orders_new (${colList}) SELECT ${colList} FROM orders`);

        // 교체.
        db.exec('DROP TABLE orders');
        db.exec('ALTER TABLE orders_new RENAME TO orders');

        // 인덱스 재생성 — init.sql 정의와 동일.
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
          CREATE INDEX IF NOT EXISTS idx_orders_operating_date ON orders(operating_date);
          CREATE INDEX IF NOT EXISTS idx_orders_no_date ON orders(operating_date, no);
        `);
      } else {
        // 신규 DB(init.sql 적용 완료) — 컬럼만 idempotent 추가.
        const cols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
        if (!cols.includes('dining_at')) {
          db.exec('ALTER TABLE orders ADD COLUMN dining_at TEXT');
        }
        if (!cols.includes('settled_at')) {
          db.exec('ALTER TABLE orders ADD COLUMN settled_at TEXT');
        }
      }

      // table_locks 테이블 — 잠금 상태 영구 저장 (idempotent).
      db.exec(`
        CREATE TABLE IF NOT EXISTS table_locks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_no INTEGER NOT NULL UNIQUE CHECK(table_no BETWEEN 1 AND 15),
          locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0, 1)),
          locked_at TEXT,
          unlocked_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uidx_table_locks_table_no ON table_locks(table_no);
        CREATE INDEX IF NOT EXISTS idx_table_locks_locked ON table_locks(locked);
      `);
      // _migrations 마크는 최초 1회만 — 이미 있으면 skip (보정 재실행이라도 중복 INSERT X).
      if (!has006Mark) {
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('006-table-lock');
      }
      });
      tx();
      logger.info(
        { repaired: !checkAcceptsNewStates && has006Mark },
        '[bootstrap] 마이그레이션 006-table-lock 적용',
      );
    }
  }
}

function runInitSql(db) {
  const sqlPath = path.resolve(__dirname, 'init.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  const tx = db.transaction(() => {
    db.exec(sql);
  });
  try {
    tx();
    logger.info('[bootstrap] init.sql 실행 완료');
  } catch (err) {
    logger.error({ err }, '[bootstrap] init.sql 실패 — ROLLBACK');
    throw err;
  }
}

/**
 * 관리자 PIN 시드.
 * - admins 비어있을 때만 동작 (재부팅 시 skip).
 * - DEFAULT_ADMIN_PIN env (정확히 6자리 숫자) 우선 — 형식 위반 시 무시.
 * - env 없으면 6자리 랜덤 생성 + stdout 1회 출력 (운영자 첫 부팅 확인용).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {string|null} 생성된 PIN (env 사용 시 null — stdout 출력 X)
 */
export function seedAdmin(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count > 0) {
    logger.info('[seedAdmin] 관리자 이미 존재 — skip');
    return null;
  }

  const envPin = process.env.DEFAULT_ADMIN_PIN;
  let pin;
  let generated;
  if (envPin && /^\d{6}$/.test(envPin)) {
    pin = envPin;
    generated = false;
  } else {
    // crypto.randomInt(0, 1_000_000) → 0~999999 균등 분포. padStart로 6자리 보존.
    pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    generated = true;
  }

  const hash = hashPin(pin);
  db.prepare('INSERT INTO admins (pin_hash) VALUES (?)').run(hash);

  if (generated) {
    // stdout 1회 — 운영자가 첫 부팅 시 PIN 확보.
    // pino logger도 사용하되, console.log로 강조 출력 (구조화 로그에 묻히지 않게).
    console.log(
      `\n${'='.repeat(60)}\n[INIT] Generated admin PIN: ${pin}\n  ↑ 운영 시작 전 변경 권장\n${'='.repeat(60)}\n`,
    );
    logger.info({ generatedPin: pin }, '[seedAdmin] 신규 관리자 PIN 생성');
  } else {
    logger.info('[seedAdmin] env(DEFAULT_ADMIN_PIN) 사용');
  }

  return generated ? pin : null;
}

/**
 * PIN을 SHA-256 hex로 해시.
 * - 현재는 단순 해시 (Task 6.1 명세). 운영 마이그레이션 시 scrypt 도입 가능 (DB_DRAFT §2.8 주석).
 *
 * @param {string} pin
 * @returns {string} 64자 hex
 */
export function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

/**
 * PIN 해시 검증 — timingSafeEqual로 타이밍 공격 방어.
 * - 빈 입력·길이 불일치는 항상 false.
 *
 * @param {string} pin
 * @param {string} hash
 * @returns {boolean}
 */
export function verifyPin(pin, hash) {
  if (!pin || !hash) return false;
  const computed = hashPin(pin);
  // 길이 다르면 Buffer.from 후 timingSafeEqual이 throw — 가드.
  if (computed.length !== hash.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}
