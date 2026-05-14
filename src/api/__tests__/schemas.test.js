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
  it('8개 상태 모두 통과', () => {
    [
      'ORDERED',
      'TRANSFER_REPORTED',
      'PAID',
      'COOKING',
      'READY',
      'DONE',
      'HOLD',
      'CANCELED',
    ].forEach((status) => {
      expect(OrderStatusSchema.safeParse(status).success).toBe(true);
    });
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
});

describe('ApiErrorSchema', () => {
  it('error 필드만으로도 통과', () => {
    expect(
      ApiErrorSchema.safeParse({ error: 'BUSINESS_CLOSED' }).success,
    ).toBe(true);
  });
});
