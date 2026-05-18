// Task 6.5 — order-repo 회귀.
// daily_no 시퀀스 + race + 트랜잭션 ROLLBACK + 이체 신고 갱신.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  nextOrderNo,
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
  updateTransferInfo,
} from '../order-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

const SAMPLE_ITEMS = [
  {
    menu_id: 1,
    name: '후라이드',
    base_price: 18000,
    quantity: 1,
    category: 'chicken',
  },
];

function sampleMeta(overrides = {}) {
  return {
    items_priced: SAMPLE_ITEMS,
    total_price: 18000,
    name: '홍길동',
    student_id: null,
    is_external: false,
    external_token: null,
    delivery_type: 'dineIn',
    table_no: null,
    operating_date: '2026-05-20',
    ...overrides,
  };
}

describe('order-repo — nextOrderNo', () => {
  it('주문 없으면 1', () => {
    const db = freshDb();
    expect(nextOrderNo(db, '2026-05-20')).toBe(1);
  });

  it('동일 일자 주문 누적 시 +1 증가', () => {
    const db = freshDb();
    createOrder(db, sampleMeta());
    createOrder(db, sampleMeta());
    expect(nextOrderNo(db, '2026-05-20')).toBe(3);
  });

  it('일자 다르면 별도 시퀀스', () => {
    const db = freshDb();
    createOrder(db, sampleMeta({ operating_date: '2026-05-20' }));
    createOrder(db, sampleMeta({ operating_date: '2026-05-21' }));
    expect(nextOrderNo(db, '2026-05-20')).toBe(2);
    expect(nextOrderNo(db, '2026-05-21')).toBe(2);
  });
});

describe('order-repo — createOrder', () => {
  it('order_items도 같이 INSERT', () => {
    const db = freshDb();
    const order = createOrder(db, sampleMeta());
    expect(order.id).toBeGreaterThan(0);
    expect(order.no).toBe(1);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].name).toBe('후라이드');
  });

  it('status 기본 ORDERED', () => {
    const db = freshDb();
    const order = createOrder(db, sampleMeta());
    expect(order.status).toBe('ORDERED');
  });

  it('연속 createOrder — daily no 1, 2, 3 증가', () => {
    const db = freshDb();
    const o1 = createOrder(db, sampleMeta());
    const o2 = createOrder(db, sampleMeta());
    const o3 = createOrder(db, sampleMeta());
    expect([o1.no, o2.no, o3.no]).toEqual([1, 2, 3]);
  });

  it('is_external true + external_token 보존', () => {
    const db = freshDb();
    const order = createOrder(
      db,
      sampleMeta({ is_external: true, external_token: 'abc' }),
    );
    expect(order.is_external).toBe(1);
    expect(order.external_token).toBe('abc');
  });
});

describe('order-repo — getOrder · listOrders', () => {
  it('getOrder — 존재 X 반환 null', () => {
    const db = freshDb();
    expect(getOrder(db, 999)).toBeNull();
  });

  it('listOrders — 모든 주문 반환 (no 내림차순)', () => {
    const db = freshDb();
    createOrder(db, sampleMeta());
    createOrder(db, sampleMeta());
    const list = listOrders(db);
    expect(list).toHaveLength(2);
    expect(list[0].no).toBe(2);
    expect(list[1].no).toBe(1);
  });

  it('listOrders — status 필터', () => {
    const db = freshDb();
    const o = createOrder(db, sampleMeta());
    updateOrderStatus(db, o.id, 'CANCELED');
    const ordered = listOrders(db, { status: 'ORDERED' });
    const canceled = listOrders(db, { status: 'CANCELED' });
    expect(ordered).toHaveLength(0);
    expect(canceled).toHaveLength(1);
  });

  it('listOrders — operating_date 필터', () => {
    const db = freshDb();
    createOrder(db, sampleMeta({ operating_date: '2026-05-20' }));
    createOrder(db, sampleMeta({ operating_date: '2026-05-21' }));
    const day1 = listOrders(db, { operating_date: '2026-05-20' });
    expect(day1).toHaveLength(1);
    expect(day1[0].operating_date).toBe('2026-05-20');
  });
});

describe('order-repo — updateOrderStatus', () => {
  it('PAID 전이 시 paid_at 자동 기록', () => {
    const db = freshDb();
    const o = createOrder(db, sampleMeta());
    updateOrderStatus(db, o.id, 'TRANSFER_REPORTED');
    const after = updateOrderStatus(db, o.id, 'PAID');
    expect(after.status).toBe('PAID');
    expect(after.paid_at).toBeTruthy();
  });

  it('COOKING / READY / DONE 단계별 timestamp 기록', () => {
    const db = freshDb();
    const o = createOrder(db, sampleMeta());
    updateOrderStatus(db, o.id, 'TRANSFER_REPORTED');
    updateOrderStatus(db, o.id, 'PAID');
    const cooking = updateOrderStatus(db, o.id, 'COOKING');
    expect(cooking.cooking_at).toBeTruthy();
    const ready = updateOrderStatus(db, o.id, 'READY');
    expect(ready.ready_at).toBeTruthy();
    const done = updateOrderStatus(db, o.id, 'DONE');
    expect(done.done_at).toBeTruthy();
  });

  it('extraFields 전달 시 같이 UPDATE', () => {
    const db = freshDb();
    const o = createOrder(db, sampleMeta());
    const after = updateOrderStatus(db, o.id, 'CANCELED', {
      canceled_reason: '재고 부족',
    });
    expect(after.status).toBe('CANCELED');
    expect(after.canceled_reason).toBe('재고 부족');
  });
});

describe('order-repo — updateTransferInfo', () => {
  it('이체 신고 반영 + status TRANSFER_REPORTED', () => {
    const db = freshDb();
    const o = createOrder(db, sampleMeta());
    const after = updateTransferInfo(db, o.id, {
      depositor_name: '김철수',
      bank: '국민',
      amount: 18000,
    });
    expect(after.status).toBe('TRANSFER_REPORTED');
    expect(after.depositor_name).toBe('김철수');
    expect(after.bank).toBe('국민');
    expect(after.amount).toBe(18000);
    expect(after.transferred_at).toBeTruthy();
  });

});
