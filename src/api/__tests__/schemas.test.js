// Task 3.2 — zod 스키마 단위 테스트.
//
// 회귀 포인트:
//  - MenuSchema (id 양수·category enum·basePrice 양수)
//  - OrderStatusSchema 8개 상태 + 알 수 없는 상태 거부
//  - BusinessStateSchema (OPEN/CLOSED만)
//  - OrderSchema 최소 유효 케이스
import { describe, it, expect } from 'vitest';
import {
  MenuSchema,
  MenuListSchema,
  OrderSchema,
  OrderStatusSchema,
  BusinessStateSchema,
  ApiErrorSchema,
} from '../schemas.js';

describe('MenuSchema', () => {
  it('유효한 메뉴 통과', () => {
    expect(
      MenuSchema.safeParse({
        id: 1,
        code: 'X',
        name: 'A',
        category: 'chicken',
        basePrice: 1000,
      }).success,
    ).toBe(true);
  });

  it('id 음수 거부', () => {
    expect(
      MenuSchema.safeParse({
        id: -1,
        code: 'X',
        name: 'A',
        category: 'chicken',
        basePrice: 1000,
      }).success,
    ).toBe(false);
  });

  it('category enum 외 거부', () => {
    expect(
      MenuSchema.safeParse({
        id: 1,
        code: 'X',
        name: 'A',
        category: 'WEIRD',
        basePrice: 1000,
      }).success,
    ).toBe(false);
  });

  it('basePrice 0 또는 음수 거부', () => {
    expect(
      MenuSchema.safeParse({
        id: 1,
        code: 'X',
        name: 'A',
        category: 'chicken',
        basePrice: 0,
      }).success,
    ).toBe(false);
  });

  it('MenuListSchema — 배열 통과', () => {
    expect(
      MenuListSchema.safeParse([
        { id: 1, code: 'X', name: 'A', category: 'chicken', basePrice: 1000 },
        { id: 2, code: 'Y', name: 'B', category: 'drink', basePrice: 2000 },
      ]).success,
    ).toBe(true);
  });
});

describe('OrderStatusSchema', () => {
  it('10개 상태 모두 통과 (table_lock: DINING, SETTLED 포함)', () => {
    [
      'ORDERED',
      'TRANSFER_REPORTED',
      'PAID',
      'COOKING',
      'READY',
      'DINING',
      'SETTLED',
      'DONE',
      'HOLD',
      'CANCELED',
    ].forEach((status) => {
      expect(OrderStatusSchema.safeParse(status).success).toBe(true);
    });
  });

  it('★ table_lock — DINING 허용 (P1-1 회귀)', () => {
    expect(OrderStatusSchema.safeParse('DINING').success).toBe(true);
  });

  it('★ table_lock — SETTLED 허용 (P1-1 회귀)', () => {
    expect(OrderStatusSchema.safeParse('SETTLED').success).toBe(true);
  });

  it('알 수 없는 상태 거부', () => {
    expect(OrderStatusSchema.safeParse('WEIRD').success).toBe(false);
  });
});

describe('BusinessStateSchema', () => {
  it('OPEN 통과', () => {
    expect(
      BusinessStateSchema.safeParse({
        status: 'OPEN',
        operating_date: '2026-05-20',
      }).success,
    ).toBe(true);
  });

  it('CLOSED 통과', () => {
    expect(
      BusinessStateSchema.safeParse({
        status: 'CLOSED',
        operating_date: '2026-05-20',
      }).success,
    ).toBe(true);
  });

  it('알 수 없는 status 거부', () => {
    expect(
      BusinessStateSchema.safeParse({
        status: 'WEIRD',
        operating_date: '2026-05-20',
      }).success,
    ).toBe(false);
  });
});

describe('OrderSchema', () => {
  it('최소 유효 주문 통과', () => {
    expect(
      OrderSchema.safeParse({
        id: 1,
        no: 100,
        operating_date: '2026-05-20',
        status: 'ORDERED',
        items: [
          { menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 },
        ],
        total_price: 18000,
      }).success,
    ).toBe(true);
  });

  it('items 비어있어도 통과 (배열만 강제)', () => {
    expect(
      OrderSchema.safeParse({
        id: 1,
        no: 100,
        operating_date: '2026-05-20',
        status: 'ORDERED',
        items: [],
        total_price: 0,
      }).success,
    ).toBe(true);
  });

  it('★ table_lock — status=DINING + dining_at 통과 (P1-1 회귀)', () => {
    expect(
      OrderSchema.safeParse({
        id: 1,
        no: 100,
        operating_date: '2026-05-20',
        status: 'DINING',
        items: [{ menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 }],
        total_price: 18000,
        dining_at: '2026-05-20T07:30:00Z',
      }).success,
    ).toBe(true);
  });

  it('★ table_lock — status=SETTLED + settled_at 통과 (P1-1 회귀)', () => {
    expect(
      OrderSchema.safeParse({
        id: 1,
        no: 100,
        operating_date: '2026-05-20',
        status: 'SETTLED',
        items: [{ menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 }],
        total_price: 18000,
        dining_at: '2026-05-20T07:30:00Z',
        settled_at: '2026-05-20T08:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('★ table_lock — dining_at/settled_at null 허용', () => {
    expect(
      OrderSchema.safeParse({
        id: 1,
        no: 100,
        operating_date: '2026-05-20',
        status: 'READY',
        items: [{ menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 }],
        total_price: 18000,
        dining_at: null,
        settled_at: null,
      }).success,
    ).toBe(true);
  });
});

describe('ApiErrorSchema', () => {
  it('error 필드만으로도 통과', () => {
    expect(
      ApiErrorSchema.safeParse({ error: 'BUSINESS_CLOSED' }).success,
    ).toBe(true);
  });
});
