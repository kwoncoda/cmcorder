// Task 6.5 — coupon-repo race 회귀.
// UNIQUE 제약을 race condition에서 검증 (better-sqlite3는 동기 — 진정한 동시성은 아니지만
// Promise.all로 multiple call 흐름을 모의).
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  hasCouponBeenUsed,
  listUsedCoupons,
  countUsedCoupons,
} from '../coupon-repo.js';
import { consumeCoupon, CouponError } from '../../domain/coupon.js';
import { createOrder } from '../order-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

function makeOrder(db) {
  return createOrder(db, {
    items_priced: [
      {
        menu_id: 1,
        name: '후라이드',
        base_price: 18000,
        quantity: 1,
        category: 'chicken',
      },
    ],
    total_price: 18000,
    name: '홍길동',
    student_id: '202637001',
    is_external: false,
    external_token: null,
    delivery_type: 'dineIn',
    table_no: null,
    operating_date: '2026-05-20',
  });
}

describe('coupon-repo', () => {
  let db;
  beforeEach(() => {
    db = freshDb();
  });

  it('hasCouponBeenUsed — 처음에는 false', () => {
    expect(hasCouponBeenUsed(db, '202637001', '홍길동')).toBe(false);
  });

  it('consumeCoupon 후 hasCouponBeenUsed true', () => {
    const order = makeOrder(db);
    consumeCoupon(
      { studentId: '202637001', name: '홍길동', orderId: order.id },
      db,
    );
    expect(hasCouponBeenUsed(db, '202637001', '홍길동')).toBe(true);
  });

  it('listUsedCoupons — 누적 행 반환', () => {
    const o1 = makeOrder(db);
    consumeCoupon(
      { studentId: '202637001', name: '홍길동', orderId: o1.id },
      db,
    );
    const rows = listUsedCoupons(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].student_id).toBe('202637001');
    expect(rows[0].order_id).toBe(o1.id);
  });

  it('countUsedCoupons — 누적 카운트', () => {
    const o1 = makeOrder(db);
    consumeCoupon(
      { studentId: '202637001', name: '홍길동', orderId: o1.id },
      db,
    );
    expect(countUsedCoupons(db)).toBe(1);
  });

  it('★ UNIQUE race — 동일 학번+이름 두 번째는 ALREADY_USED', () => {
    const order1 = makeOrder(db);
    const order2 = makeOrder(db);
    consumeCoupon(
      { studentId: '202637001', name: '홍길동', orderId: order1.id },
      db,
    );
    expect(() =>
      consumeCoupon(
        { studentId: '202637001', name: '홍길동', orderId: order2.id },
        db,
      ),
    ).toThrow(CouponError);
  });

  it('★ Promise.all 5 동시 → 1 성공 4 실패', async () => {
    // 5개 주문을 먼저 만들고 동시에 같은 쿠폰을 소비 시도
    const orders = Array.from({ length: 5 }, () => makeOrder(db));
    const results = await Promise.allSettled(
      orders.map((o) =>
        Promise.resolve().then(() =>
          consumeCoupon(
            { studentId: '202637001', name: '홍길동', orderId: o.id },
            db,
          ),
        ),
      ),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(rejected.every((r) => r.reason instanceof CouponError)).toBe(true);
  });
});
