// find_error_v2 — order-events-repo 회귀.
//   - logOrderEvent: 한 행 INSERT + 모든 필드 보존
//   - listOrderEvents: operating_date 필터 + orders JOIN(order_no) + created_at DESC
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { createOrder } from '../order-repo.js';
import { logOrderEvent, listOrderEvents } from '../order-events-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

const SAMPLE_ITEMS = [
  { menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1, category: 'chicken' },
];

function seedOrder(db, operating_date = '2026-05-20') {
  return createOrder(db, {
    items_priced: SAMPLE_ITEMS,
    total_price: 18000,
    name: '홍길동',
    student_id: null,
    is_external: false,
    external_token: null,
    delivery_type: 'dineIn',
    table_no: null,
    operating_date,
  });
}

describe('order-events-repo — logOrderEvent', () => {
  it('★ 모든 필드 보존하여 한 행 INSERT', () => {
    const db = freshDb();
    const order = seedOrder(db);
    const id = logOrderEvent(db, {
      order_id: order.id,
      event_type: 'PAID',
      from_status: 'TRANSFER_REPORTED',
      to_status: 'PAID',
      action_name: '이체 확인',
      actor: 'admin',
      note: null,
    });
    expect(id).toBeGreaterThan(0);
    const row = db.prepare('SELECT * FROM order_events WHERE id = ?').get(id);
    expect(row.order_id).toBe(order.id);
    expect(row.event_type).toBe('PAID');
    expect(row.from_status).toBe('TRANSFER_REPORTED');
    expect(row.to_status).toBe('PAID');
    expect(row.action_name).toBe('이체 확인');
    expect(row.actor).toBe('admin');
    expect(row.note).toBeNull();
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('CREATED 이벤트는 from_status null 허용', () => {
    const db = freshDb();
    const order = seedOrder(db);
    const id = logOrderEvent(db, {
      order_id: order.id,
      event_type: 'CREATED',
      from_status: null,
      to_status: 'ORDERED',
      action_name: '주문 접수',
      actor: 'customer',
    });
    const row = db.prepare('SELECT * FROM order_events WHERE id = ?').get(id);
    expect(row.from_status).toBeNull();
    expect(row.to_status).toBe('ORDERED');
  });
});

describe('order-events-repo — listOrderEvents', () => {
  it('★ operating_date 필터 — 같은 날짜 주문의 이벤트만 반환', () => {
    const db = freshDb();
    const day1 = seedOrder(db, '2026-05-20');
    const day2 = seedOrder(db, '2026-05-21');
    logOrderEvent(db, {
      order_id: day1.id,
      event_type: 'CREATED',
      from_status: null,
      to_status: 'ORDERED',
      action_name: '주문 접수',
      actor: 'customer',
    });
    logOrderEvent(db, {
      order_id: day2.id,
      event_type: 'CREATED',
      from_status: null,
      to_status: 'ORDERED',
      action_name: '주문 접수',
      actor: 'customer',
    });
    const list20 = listOrderEvents(db, { operating_date: '2026-05-20' });
    expect(list20).toHaveLength(1);
    expect(list20[0].order_id).toBe(day1.id);
    expect(list20[0].order_no).toBe(day1.no);
    const list21 = listOrderEvents(db, { operating_date: '2026-05-21' });
    expect(list21).toHaveLength(1);
    expect(list21[0].order_id).toBe(day2.id);
  });

  it('★ created_at DESC 정렬', () => {
    const db = freshDb();
    const order = seedOrder(db);
    // 같은 datetime('now') 분해능이 1초이므로 id로 안정 정렬도 함께 검증.
    logOrderEvent(db, {
      order_id: order.id, event_type: 'CREATED', from_status: null,
      to_status: 'ORDERED', action_name: '주문 접수', actor: 'customer',
    });
    logOrderEvent(db, {
      order_id: order.id, event_type: 'TRANSFER_REPORTED', from_status: 'ORDERED',
      to_status: 'TRANSFER_REPORTED', action_name: '이체 완료 요청', actor: 'customer',
    });
    logOrderEvent(db, {
      order_id: order.id, event_type: 'PAID', from_status: 'TRANSFER_REPORTED',
      to_status: 'PAID', action_name: '이체 확인', actor: 'admin',
    });
    const list = listOrderEvents(db, { operating_date: '2026-05-20' });
    expect(list).toHaveLength(3);
    // 최신(PAID) 먼저.
    expect(list[0].event_type).toBe('PAID');
    expect(list[1].event_type).toBe('TRANSFER_REPORTED');
    expect(list[2].event_type).toBe('CREATED');
  });

  it('주문 없는 날짜 → 빈 배열', () => {
    const db = freshDb();
    expect(listOrderEvents(db, { operating_date: '2026-05-20' })).toEqual([]);
  });
});
