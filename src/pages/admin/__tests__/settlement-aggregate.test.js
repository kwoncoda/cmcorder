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
  aggregateMenuSales,
  fetchAggregateMenuSales,
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

// ── adjustment 라운드 Subagent 4 + menu_update 라운드 (2026-05-20) — 메뉴별 판매 합산 ────
describe('aggregateMenuSales (adjustment Subagent 4 + menu_update 10행)', () => {
  const dayA = [
    { menu_id:  1, code: 'BANDAGE',    name: '후라이드',     category: 'chicken', base_price:  8000, quantity: 10, revenue:  80000 },
    { menu_id:  2, code: 'FIRST_AID',  name: '양념',         category: 'chicken', base_price:  9000, quantity:  5, revenue:  45000 },
    { menu_id:  3, code: 'MED_KIT',    name: '뿌링클',       category: 'chicken', base_price: 11000, quantity:  0, revenue:      0 },
    { menu_id:  4, code: 'SYRINGE',    name: '감자튀김',     category: 'side',    base_price:  4000, quantity:  3, revenue:  12000 },
    { menu_id:  5, code: 'DEFIB',      name: '뿌링감자튀김', category: 'side',    base_price:  5000, quantity:  0, revenue:      0 },
    { menu_id:  6, code: 'ADRENALINE', name: '칠리스',       category: 'side',    base_price:  4500, quantity:  2, revenue:   9000 },
    { menu_id:  7, code: 'PAINKILLER', name: '콜라',         category: 'drink',   base_price:  2000, quantity:  4, revenue:   8000 },
    { menu_id:  8, code: 'ENERGY',     name: '사이다',       category: 'drink',   base_price:  2000, quantity:  1, revenue:   2000 },
    { menu_id:  9, code: 'bluezone',   name: '생수',         category: 'side',    base_price:  1000, quantity:  6, revenue:   6000 },
    { menu_id: 10, code: 'fuel',       name: '양념 소스',    category: 'side',    base_price:   500, quantity:  8, revenue:   4000 },
  ];
  const dayB = dayA.map((m) => ({ ...m, quantity: m.quantity + 1, revenue: m.revenue + m.base_price }));

  it('★ 두 일자 합산 — 10행, menu_id 순, quantity + revenue 합 (menu_update)', () => {
    const r = aggregateMenuSales([dayA, dayB]);
    expect(r).toHaveLength(10);
    expect(r[0].menu_id).toBe(1);
    expect(r[9].menu_id).toBe(10);
    expect(r[0].quantity).toBe(10 + 11);
    expect(r[0].revenue).toBe(80000 + 88000);
    // name/code/category/base_price는 첫 row 기준 보존
    expect(r[0].name).toBe('후라이드');
    expect(r[0].code).toBe('BANDAGE');
    expect(r[0].base_price).toBe(8000);
    // ★ menu_update — 신규 메뉴 합산도 정상
    expect(r[9].name).toBe('양념 소스');
    expect(r[9].code).toBe('fuel');
    expect(r[9].quantity).toBe(8 + 9);
  });

  it('★ 0건 메뉴는 합산 후에도 row 유지', () => {
    const r = aggregateMenuSales([dayA, dayA]);
    const m5 = r.find((m) => m.menu_id === 5);
    expect(m5).toBeDefined();
    expect(m5.quantity).toBe(0);
    expect(m5.revenue).toBe(0);
  });

  it('빈 배열 입력 시 빈 결과', () => {
    expect(aggregateMenuSales([])).toEqual([]);
  });
});

describe('fetchAggregateMenuSales (adjustment Subagent 4 + menu_update 10행)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('★ 두 일자 fetch + 합산 (menu_update — 10행)', async () => {
    const dayA = [
      { menu_id:  1, code: 'BANDAGE',    name: '후라이드',     category: 'chicken', base_price:  8000, quantity: 10, revenue:  80000 },
      { menu_id:  2, code: 'FIRST_AID',  name: '양념',         category: 'chicken', base_price:  9000, quantity:  5, revenue:  45000 },
      { menu_id:  3, code: 'MED_KIT',    name: '뿌링클',       category: 'chicken', base_price: 11000, quantity:  0, revenue:      0 },
      { menu_id:  4, code: 'SYRINGE',    name: '감자튀김',     category: 'side',    base_price:  4000, quantity:  0, revenue:      0 },
      { menu_id:  5, code: 'DEFIB',      name: '뿌링감자튀김', category: 'side',    base_price:  5000, quantity:  0, revenue:      0 },
      { menu_id:  6, code: 'ADRENALINE', name: '칠리스',       category: 'side',    base_price:  4500, quantity:  0, revenue:      0 },
      { menu_id:  7, code: 'PAINKILLER', name: '콜라',         category: 'drink',   base_price:  2000, quantity:  0, revenue:      0 },
      { menu_id:  8, code: 'ENERGY',     name: '사이다',       category: 'drink',   base_price:  2000, quantity:  0, revenue:      0 },
      { menu_id:  9, code: 'bluezone',   name: '생수',         category: 'side',    base_price:  1000, quantity:  0, revenue:      0 },
      { menu_id: 10, code: 'fuel',       name: '양념 소스',    category: 'side',    base_price:   500, quantity:  0, revenue:      0 },
    ];
    const dayB = dayA.map((m) => ({ ...m, quantity: m.quantity + 2, revenue: m.revenue + 2 * m.base_price }));
    apiFetch.mockResolvedValueOnce(dayA).mockResolvedValueOnce(dayB);
    const r = await fetchAggregateMenuSales();
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch.mock.calls[0][0]).toBe('/admin/api/settlement/menu-sales?date=2026-05-20');
    expect(apiFetch.mock.calls[1][0]).toBe('/admin/api/settlement/menu-sales?date=2026-05-21');
    expect(r).toHaveLength(10);
    // dayA quantity=10 + dayB quantity=(10+2)=12 → 22
    expect(r[0].quantity).toBe(22);
  });
});
