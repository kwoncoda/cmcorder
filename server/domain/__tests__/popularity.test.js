// Task 6.4 — 정적 BEST (결정 E).
// recommended=true 우선 + 부족 시 첫 N개 fallback.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { getPopularMenus } from '../popularity.js';

let db;

beforeEach(() => {
  db = new Database(':memory:');
  bootstrapDatabase(db);
});

describe('popularity — 결정 E (정적 BEST TOP 3)', () => {
  it('★ 기본 — recommended=true 메뉴 우선 (init.sql 시드 기준)', () => {
    const r = getPopularMenus(db, 3);
    expect(r).toHaveLength(3);
    // init.sql 시드: BANDAGE·MED_KIT 가 recommended=1 (총 2개)
    const codes = r.map((m) => m.code);
    expect(codes).toContain('BANDAGE');
    expect(codes).toContain('MED_KIT');
  });

  it('★ recommended 0개일 때 — 첫 3개 fallback', () => {
    db.prepare('UPDATE menus SET recommended = 0').run();
    const r = getPopularMenus(db, 3);
    expect(r).toHaveLength(3);
  });

  it('★ recommended가 limit 이상이면 limit개만 반환', () => {
    db.prepare('UPDATE menus SET recommended = 1').run();
    const r = getPopularMenus(db, 3);
    expect(r).toHaveLength(3);
    r.forEach((m) => expect(m.recommended).toBe(1));
  });

  it('★ 품절 메뉴 제외', () => {
    db.prepare('UPDATE menus SET sold_out = 1 WHERE id = 1').run(); // BANDAGE 품절
    const r = getPopularMenus(db, 3);
    const codes = r.map((m) => m.code);
    expect(codes).not.toContain('BANDAGE');
  });

  it('★ limit 0 — 빈 배열', () => {
    const r = getPopularMenus(db, 0);
    expect(r).toEqual([]);
  });
});
