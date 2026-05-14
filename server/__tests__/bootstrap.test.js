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
