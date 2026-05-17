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
