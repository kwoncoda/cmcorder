// Task 6.5 — menu-repo 회귀.
// menu_update 라운드 (2026-05-20): 메뉴 8 → 10 + 가격 갱신 + 신규 메뉴 회귀.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { listMenus, getMenu, toggleMenu } from '../menu-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

describe('menu-repo', () => {
  let db;
  beforeEach(() => {
    db = freshDb();
  });

  it('listMenus — 시드된 메뉴 10개 반환 (menu_update — 신규 2종 추가)', () => {
    const rows = listMenus(db);
    expect(rows).toHaveLength(10);
    expect(rows[0].code).toBe('BANDAGE');
    expect(rows[7].code).toBe('ENERGY');
    expect(rows[8].code).toBe('bluezone');
    expect(rows[9].code).toBe('fuel');
  });

  it('getMenu — id로 단일 메뉴 조회 (menu_update 가격 갱신)', () => {
    const m = getMenu(db, 1);
    expect(m).toBeDefined();
    expect(m.name).toBe('후라이드');
    expect(m.base_price).toBe(8000);
  });

  it('★ menu_update — 신규 메뉴 id=9 생수 / id=10 양념 소스', () => {
    const m9 = getMenu(db, 9);
    expect(m9).toBeDefined();
    expect(m9.code).toBe('bluezone');
    expect(m9.name).toBe('생수');
    expect(m9.base_price).toBe(1000);
    expect(m9.category).toBe('side');
    expect(m9.image).toBe('/items/bluezone.webp');

    const m10 = getMenu(db, 10);
    expect(m10).toBeDefined();
    expect(m10.code).toBe('fuel');
    expect(m10.name).toBe('양념 소스');
    expect(m10.base_price).toBe(500);
    expect(m10.category).toBe('side');
    expect(m10.image).toBe('/items/fuel.webp');
  });

  it('★ menu_update — 모든 시드 메뉴 기본 판매 가능 (sold_out=0)', () => {
    const rows = listMenus(db);
    for (const m of rows) {
      expect(m.sold_out).toBe(0);
    }
  });

  it('getMenu — 존재하지 않으면 undefined', () => {
    expect(getMenu(db, 9999)).toBeUndefined();
  });

  it('toggleMenu — soldOut 토글 가능', () => {
    const before = getMenu(db, 1);
    expect(before.sold_out).toBe(0);

    const after = toggleMenu(db, 1, { soldOut: true });
    expect(after.sold_out).toBe(1);

    const reverted = toggleMenu(db, 1, { soldOut: false });
    expect(reverted.sold_out).toBe(0);
  });

  it('toggleMenu — recommended 토글', () => {
    const after = toggleMenu(db, 2, { recommended: true });
    expect(after.recommended).toBe(1);
  });

  it('toggleMenu — base_price 변경', () => {
    const after = toggleMenu(db, 1, { base_price: 20000 });
    expect(after.base_price).toBe(20000);
  });

  it('toggleMenu — 빈 patch는 그대로 반환', () => {
    const before = getMenu(db, 1);
    const after = toggleMenu(db, 1, {});
    expect(after.base_price).toBe(before.base_price);
    expect(after.sold_out).toBe(before.sold_out);
  });
});
