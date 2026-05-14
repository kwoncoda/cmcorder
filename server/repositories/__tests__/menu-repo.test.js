// Task 6.5 — menu-repo 회귀.
// 메뉴 8개 시드 정합 + soldOut·recommended·base_price patch.
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

  it('listMenus — 시드된 메뉴 8개 반환', () => {
    const rows = listMenus(db);
    expect(rows).toHaveLength(8);
    expect(rows[0].code).toBe('BANDAGE');
    expect(rows[7].code).toBe('ENERGY');
  });

  it('getMenu — id로 단일 메뉴 조회', () => {
    const m = getMenu(db, 1);
    expect(m).toBeDefined();
    expect(m.name).toBe('후라이드');
    expect(m.base_price).toBe(18000);
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
