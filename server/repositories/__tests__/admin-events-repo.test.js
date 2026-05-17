// find_error_v3 — admin-events-repo 회귀.
//
// 신규 admin_events 테이블 (메뉴/시스템 이벤트). order_events와 분리:
//   - order_events: order_id NOT NULL, 주문 상태 변경 전용
//   - admin_events: category('menu'|'system'), order_id 없음, operating_date nullable
//
// 회귀:
//   - logAdminEvent: 한 행 INSERT + 모든 필드 보존 + id 반환
//   - listAdminEvents: operating_date 필터 + category 필터 + created_at DESC
//   - category CHECK 위반 시 throw
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { logAdminEvent, listAdminEvents } from '../admin-events-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

describe('admin-events-repo — logAdminEvent', () => {
  it('★ menu 이벤트 한 행 INSERT + 모든 필드 보존', () => {
    const db = freshDb();
    const id = logAdminEvent(db, {
      category: 'menu',
      event_type: 'SOLDOUT_ON',
      action_name: '품절 처리',
      actor: 'admin',
      operating_date: '2026-05-20',
      target_id: 1,
      target_name: '후라이드',
      before_value: 'false',
      after_value: 'true',
      note: null,
    });
    expect(id).toBeGreaterThan(0);
    const row = db.prepare('SELECT * FROM admin_events WHERE id = ?').get(id);
    expect(row.category).toBe('menu');
    expect(row.event_type).toBe('SOLDOUT_ON');
    expect(row.action_name).toBe('품절 처리');
    expect(row.actor).toBe('admin');
    expect(row.operating_date).toBe('2026-05-20');
    expect(row.target_id).toBe(1);
    expect(row.target_name).toBe('후라이드');
    expect(row.before_value).toBe('false');
    expect(row.after_value).toBe('true');
    expect(row.note).toBeNull();
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('★ system 이벤트 (target_id/before/after 없이) INSERT', () => {
    const db = freshDb();
    const id = logAdminEvent(db, {
      category: 'system',
      event_type: 'ADMIN_LOGIN',
      action_name: '관리자 로그인',
      actor: 'admin',
    });
    expect(id).toBeGreaterThan(0);
    const row = db.prepare('SELECT * FROM admin_events WHERE id = ?').get(id);
    expect(row.category).toBe('system');
    expect(row.event_type).toBe('ADMIN_LOGIN');
    expect(row.operating_date).toBeNull();
    expect(row.target_id).toBeNull();
    expect(row.target_name).toBeNull();
    expect(row.before_value).toBeNull();
    expect(row.after_value).toBeNull();
  });

  it('category CHECK 위반 → SQLite 에러 throw', () => {
    const db = freshDb();
    expect(() =>
      logAdminEvent(db, {
        category: 'illegal',
        event_type: 'NOPE',
        action_name: '잘못된 카테고리',
        actor: 'system',
      }),
    ).toThrow();
  });
});

describe('admin-events-repo — listAdminEvents', () => {
  it('★ 빈 결과 — operating_date만 주면 빈 배열', () => {
    const db = freshDb();
    expect(listAdminEvents(db, { operating_date: '2026-05-20' })).toEqual([]);
  });

  it('★ operating_date 필터 — 다른 날짜 이벤트는 제외 (NULL operating_date도 제외)', () => {
    const db = freshDb();
    logAdminEvent(db, {
      category: 'menu',
      event_type: 'SOLDOUT_ON',
      action_name: '품절 처리',
      actor: 'admin',
      operating_date: '2026-05-20',
      target_id: 1,
      target_name: '후라이드',
    });
    logAdminEvent(db, {
      category: 'menu',
      event_type: 'SOLDOUT_ON',
      action_name: '품절 처리',
      actor: 'admin',
      operating_date: '2026-05-21',
      target_id: 2,
      target_name: '양념',
    });
    // operating_date NULL인 시스템 이벤트는 날짜 필터에서 제외
    logAdminEvent(db, {
      category: 'system',
      event_type: 'ADMIN_LOGIN',
      action_name: '관리자 로그인',
      actor: 'admin',
    });
    const day20 = listAdminEvents(db, { operating_date: '2026-05-20' });
    expect(day20).toHaveLength(1);
    expect(day20[0].target_name).toBe('후라이드');
    const day21 = listAdminEvents(db, { operating_date: '2026-05-21' });
    expect(day21).toHaveLength(1);
    expect(day21[0].target_name).toBe('양념');
  });

  it('★ category 필터 — menu만 / system만', () => {
    const db = freshDb();
    logAdminEvent(db, {
      category: 'menu',
      event_type: 'SOLDOUT_ON',
      action_name: '품절 처리',
      actor: 'admin',
      operating_date: '2026-05-20',
      target_id: 1,
      target_name: '후라이드',
    });
    logAdminEvent(db, {
      category: 'system',
      event_type: 'BUSINESS_OPEN',
      action_name: '장사 시작',
      actor: 'admin',
      operating_date: '2026-05-20',
    });
    const menus = listAdminEvents(db, {
      operating_date: '2026-05-20',
      category: 'menu',
    });
    expect(menus).toHaveLength(1);
    expect(menus[0].category).toBe('menu');
    const systems = listAdminEvents(db, {
      operating_date: '2026-05-20',
      category: 'system',
    });
    expect(systems).toHaveLength(1);
    expect(systems[0].category).toBe('system');
  });

  it('★ created_at DESC 정렬', () => {
    const db = freshDb();
    logAdminEvent(db, {
      category: 'menu',
      event_type: 'SOLDOUT_ON',
      action_name: '품절 처리',
      actor: 'admin',
      operating_date: '2026-05-20',
      target_id: 1,
    });
    logAdminEvent(db, {
      category: 'menu',
      event_type: 'PRICE_CHANGED',
      action_name: '가격 변경',
      actor: 'admin',
      operating_date: '2026-05-20',
      target_id: 1,
      before_value: '18000',
      after_value: '19000',
    });
    logAdminEvent(db, {
      category: 'menu',
      event_type: 'RECOMMEND_ON',
      action_name: '추천 등록',
      actor: 'admin',
      operating_date: '2026-05-20',
      target_id: 2,
    });
    const list = listAdminEvents(db, { operating_date: '2026-05-20' });
    expect(list).toHaveLength(3);
    expect(list[0].event_type).toBe('RECOMMEND_ON');
    expect(list[1].event_type).toBe('PRICE_CHANGED');
    expect(list[2].event_type).toBe('SOLDOUT_ON');
  });
});
