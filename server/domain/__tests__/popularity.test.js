// Task 6.4 + P2-1 (Codex v3 2026-05-15) — BEST 메뉴 (어드민 토글 단일).
//
// 사용자 결정 (2026-05-15):
//   - 실시간 랭킹 X (동적 집계 X)
//   - 어드민이 메뉴 관리에서 recommended 토글로 BEST 직접 선택
//   - 판매 수 표시 X
//   - fallback("recommended 0개면 첫 N개") 제거 — 어드민 미선택 시 BEST 영역 안 보임
//
// ADR-017 변경 (2026-05-15): 동적 랭킹/판매 수/fallback 모두 폐기.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { getPopularMenus } from '../popularity.js';

let db;

beforeEach(() => {
  db = new Database(':memory:');
  bootstrapDatabase(db);
});

describe('popularity — BEST 메뉴 (어드민 recommended 토글 단일)', () => {
  it('★ 기본 — recommended=true 메뉴만 반환 (init.sql 시드 기준)', () => {
    const r = getPopularMenus(db, 3);
    // init.sql 시드: BANDAGE·MED_KIT 가 recommended=1 (총 2개)
    expect(r).toHaveLength(2);
    const codes = r.map((m) => m.code);
    expect(codes).toContain('BANDAGE');
    expect(codes).toContain('MED_KIT');
    r.forEach((m) => expect(m.recommended).toBe(1));
  });

  it('★ P2-1 — recommended 0개일 때 빈 배열 (fallback 제거, ADR-017 변경 2026-05-15)', () => {
    db.prepare('UPDATE menus SET recommended = 0').run();
    const r = getPopularMenus(db, 3);
    expect(r).toEqual([]);
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

  it('★ P2-1 — 응답에 판매 수(sales_count) 필드 미포함', () => {
    const r = getPopularMenus(db, 3);
    r.forEach((m) => {
      expect(m.sales_count).toBeUndefined();
      expect(m.sold_count).toBeUndefined();
    });
  });
});
