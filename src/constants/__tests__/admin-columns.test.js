// admin-columns 상수 단위 테스트.
// 7컬럼 정의 + DINING 위치 + groupOrdersByStatus 동작 검증.
import { describe, it, expect } from 'vitest';
import { ADMIN_COLUMNS, groupOrdersByStatus } from '../admin-columns.js';

describe('ADMIN_COLUMNS', () => {
  it('컬럼이 7개다', () => {
    expect(ADMIN_COLUMNS).toHaveLength(7);
  });

  it('DINING 컬럼이 존재한다', () => {
    const dining = ADMIN_COLUMNS.find((c) => c.status === 'DINING');
    expect(dining).toBeDefined();
    expect(dining.title).toBe('식사중');
  });

  it('DINING는 READY 바로 다음 위치다', () => {
    const readyIdx = ADMIN_COLUMNS.findIndex((c) => c.status === 'READY');
    const diningIdx = ADMIN_COLUMNS.findIndex((c) => c.status === 'DINING');
    expect(diningIdx).toBe(readyIdx + 1);
  });

  it('HOLD는 DINING 바로 다음 위치다', () => {
    const diningIdx = ADMIN_COLUMNS.findIndex((c) => c.status === 'DINING');
    const holdIdx = ADMIN_COLUMNS.findIndex((c) => c.status === 'HOLD');
    expect(holdIdx).toBe(diningIdx + 1);
  });

  it('모든 컬럼이 status, title, color 필드를 가진다', () => {
    for (const col of ADMIN_COLUMNS) {
      expect(col).toHaveProperty('status');
      expect(col).toHaveProperty('title');
      expect(col).toHaveProperty('color');
    }
  });
});

describe('groupOrdersByStatus', () => {
  it('DINING 상태 주문을 DINING 키에 그룹화한다', () => {
    const orders = [
      { id: 1, status: 'DINING' },
      { id: 2, status: 'DINING' },
      { id: 3, status: 'READY' },
    ];
    const grouped = groupOrdersByStatus(orders);
    expect(grouped.DINING).toHaveLength(2);
    expect(grouped.DINING[0].id).toBe(1);
    expect(grouped.DINING[1].id).toBe(2);
    expect(grouped.READY).toHaveLength(1);
  });

  it('반환 객체가 7개 키를 항상 포함한다', () => {
    const grouped = groupOrdersByStatus([]);
    expect(Object.keys(grouped)).toHaveLength(7);
    expect(grouped).toHaveProperty('DINING');
  });

  it('알 수 없는 status 는 무시한다', () => {
    const orders = [{ id: 1, status: 'UNKNOWN_STATE' }];
    const grouped = groupOrdersByStatus(orders);
    expect(Object.keys(grouped)).not.toContain('UNKNOWN_STATE');
    // DINING 키는 여전히 빈 배열로 존재한다.
    expect(grouped.DINING).toEqual([]);
  });

  it('orders 가 null/undefined 이면 빈 그룹 반환', () => {
    expect(groupOrdersByStatus(null).DINING).toEqual([]);
    expect(groupOrdersByStatus(undefined).DINING).toEqual([]);
  });
});
