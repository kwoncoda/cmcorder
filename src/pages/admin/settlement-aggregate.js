// P1-5 (Codex v3 2026-05-15) — 일자별 정산 합산 헬퍼.
//
// SettlementPage가 ≤120줄을 지키도록 합산 로직 분리.
// 운영 일정 (`src/store/businessState.js` SCHEDULE):
//   - 2026-05-20, 2026-05-21
// 합산 모드는 두 일자 결과를 클라가 sum.
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';

export const OPERATING_DATES = ['2026-05-20', '2026-05-21'];
export const DATE_OPTIONS = [
  { value: '2026-05-20', label: '5/20 (수)' },
  { value: '2026-05-21', label: '5/21 (목)' },
  { value: 'all', label: '합산 (5/20 + 5/21)' },
];

export function settlementUrl(date) {
  return `${API.ADMIN_SETTLEMENT_BASE}?date=${encodeURIComponent(date)}`;
}

/**
 * 두 일자 결과를 받아 합산 객체 반환.
 * - is_closed: 두 일자 모두 마감되어야 true.
 * - in_progress_count: 합.
 */
export function aggregateSettlements(list) {
  const sum = (k) => list.reduce((acc, s) => acc + (Number(s?.[k]) || 0), 0);
  return {
    operating_date: 'all',
    total_orders: sum('total_orders'),
    total_amount: sum('total_amount'),
    in_progress_count: sum('in_progress_count'),
    is_closed: list.every((s) => s?.is_closed === true),
    coupon_count: sum('coupon_count'),
    coupon_discount_total: sum('coupon_discount_total'),
  };
}

/**
 * 합산 모드 fetch — 모든 운영 일자에 대해 settlement 조회 후 합산.
 * @param {AbortSignal} [signal]
 */
export async function fetchAggregateSettlement(signal) {
  const results = await Promise.all(
    OPERATING_DATES.map((d) => apiFetch(settlementUrl(d), { signal })),
  );
  return aggregateSettlements(results);
}

// ── adjustment 라운드 Subagent 4 — 메뉴별 판매 합산 ─────────────
// 합산 모드 menu-sales: 같은 menu_id 끼리 quantity + revenue 합산.
// name/code/category/base_price 는 첫 번째 등장 row 기준 보존.
// 응답 길이 8 보장(LEFT JOIN 회귀: 0건 메뉴 row 도 합산 후 유지).

export function aggregateMenuSales(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const merged = new Map();
  for (const day of list) {
    if (!Array.isArray(day)) continue;
    for (const row of day) {
      if (!row || row.menu_id == null) continue;
      const cur = merged.get(row.menu_id);
      if (!cur) {
        merged.set(row.menu_id, {
          menu_id: row.menu_id,
          code: row.code,
          name: row.name,
          category: row.category,
          base_price: row.base_price,
          quantity: Number(row.quantity || 0),
          revenue: Number(row.revenue || 0),
        });
      } else {
        cur.quantity += Number(row.quantity || 0);
        cur.revenue += Number(row.revenue || 0);
      }
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.menu_id - b.menu_id);
}

/**
 * 합산 모드 fetch — 메뉴별 판매. 모든 운영 일자에 대해 호출 후 합산.
 * @param {AbortSignal} [signal]
 */
export async function fetchAggregateMenuSales(signal) {
  const results = await Promise.all(
    OPERATING_DATES.map((d) =>
      apiFetch(`${API.ADMIN_SETTLEMENT_MENU_SALES}?date=${encodeURIComponent(d)}`, { signal }),
    ),
  );
  return aggregateMenuSales(results);
}
