// P1-5 (Codex v3) — settlement-aggregate 헬퍼 단위 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch } from '../../../api/client.js';
import {
  OPERATING_DATES,
  DATE_OPTIONS,
  settlementUrl,
  aggregateSettlements,
  fetchAggregateSettlement,
} from '../settlement-aggregate.js';

describe('OPERATING_DATES / DATE_OPTIONS', () => {
  it('운영 일자 5/20, 5/21', () => {
    expect(OPERATING_DATES).toEqual(['2026-05-20', '2026-05-21']);
  });
  it('select 옵션 3개 (5/20, 5/21, all)', () => {
    expect(DATE_OPTIONS.map((o) => o.value)).toEqual(['2026-05-20', '2026-05-21', 'all']);
  });
});

describe('settlementUrl', () => {
  it('?date= query encode', () => {
    expect(settlementUrl('2026-05-21')).toBe('/admin/api/settlement?date=2026-05-21');
  });
});

describe('aggregateSettlements (P1-5 합산)', () => {
  const a = {
    operating_date: '2026-05-20', total_orders: 30, total_amount: 500_000,
    in_progress_count: 0, is_closed: true, coupon_count: 3, coupon_discount_total: 3000,
  };
  const b = {
    operating_date: '2026-05-21', total_orders: 50, total_amount: 900_000,
    in_progress_count: 0, is_closed: true, coupon_count: 7, coupon_discount_total: 7000,
  };

  it('★ 합산 — total_orders/total_amount/coupon 합', () => {
    const r = aggregateSettlements([a, b]);
    expect(r.total_orders).toBe(80);
    expect(r.total_amount).toBe(1_400_000);
    expect(r.coupon_count).toBe(10);
    expect(r.coupon_discount_total).toBe(10_000);
  });

  it('★ is_closed — 모두 마감되어야 true', () => {
    expect(aggregateSettlements([a, b]).is_closed).toBe(true);
    expect(aggregateSettlements([a, { ...b, is_closed: false }]).is_closed).toBe(false);
  });

  it('★ in_progress_count — 합', () => {
    expect(aggregateSettlements([{ ...a, in_progress_count: 2 }, b]).in_progress_count).toBe(2);
  });

  it('★ operating_date = "all"', () => {
    expect(aggregateSettlements([a, b]).operating_date).toBe('all');
  });

  it('★ undefined 필드는 0 처리 (null-safety)', () => {
    const r = aggregateSettlements([{ ...a, coupon_count: undefined }, b]);
    expect(r.coupon_count).toBe(7);
  });
});

describe('fetchAggregateSettlement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('★ 두 일자 fetch + 합산', async () => {
    apiFetch
      .mockResolvedValueOnce({
        operating_date: '2026-05-20', total_orders: 30, total_amount: 500_000,
        in_progress_count: 0, is_closed: true, coupon_count: 3, coupon_discount_total: 3000,
      })
      .mockResolvedValueOnce({
        operating_date: '2026-05-21', total_orders: 50, total_amount: 900_000,
        in_progress_count: 0, is_closed: true, coupon_count: 7, coupon_discount_total: 7000,
      });
    const r = await fetchAggregateSettlement();
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch.mock.calls[0][0]).toBe('/admin/api/settlement?date=2026-05-20');
    expect(apiFetch.mock.calls[1][0]).toBe('/admin/api/settlement?date=2026-05-21');
    expect(r.total_orders).toBe(80);
    expect(r.total_amount).toBe(1_400_000);
  });
});
