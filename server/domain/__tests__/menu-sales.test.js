// adjustment 라운드 — Subagent 1: 메뉴별 판매 집계 도메인 함수 회귀.
//
// 대상: server/domain/settlement.js::getMenuSales(db, operating_date)
//
// 절대 깨지면 안 됨:
//   - 매출 집계 상태는 SETTLED + 레거시 DONE 합산 (COMPLETED_STATES)
//   - CANCELED / HOLD / DINING / READY / COOKING / PAID / TRANSFER_REPORTED / ORDERED 제외
//   - menu_update 라운드 (2026-05-20): 메뉴 10행 고정 (LEFT JOIN). 0건 메뉴도 quantity=0/revenue=0 으로 포함
//   - ORDER BY m.id ASC — 응답 첫 row menu_id=1, 마지막 menu_id=10
//   - operating_date 필터 — 타 일자 주문은 무시
//   - 정합성: revenue 총합 === getSettlementSummary(db, date).total_amount (쿠폰 할인 전 매출)
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { getMenuSales, getSettlementSummary } from '../settlement.js';
import { openBusiness } from '../business-state.js';

let db;
const DATE = '2026-05-20';

beforeEach(() => {
  db = new Database(':memory:');
  bootstrapDatabase(db);
  openBusiness(db, { operating_date: DATE });
});

// 헬퍼: 주문 + 주문 항목을 한 번에 시드.
// items = [{ menu_id, quantity }] — base_price는 menus 시드에서 가져온다 (스냅샷).
function insertOrderWithItems({ status, no, items, operating_date = DATE }) {
  const totalPrice = items.reduce((sum, it) => {
    const m = db.prepare('SELECT base_price FROM menus WHERE id = ?').get(it.menu_id);
    return sum + m.base_price * it.quantity;
  }, 0);
  const info = db
    .prepare(
      `INSERT INTO orders (no, operating_date, status, name, total_price)
       VALUES (?, ?, ?, '테스트', ?)`,
    )
    .run(no, operating_date, status, totalPrice);
  const orderId = info.lastInsertRowid;
  for (const it of items) {
    const m = db
      .prepare('SELECT name, base_price, category FROM menus WHERE id = ?')
      .get(it.menu_id);
    db.prepare(
      `INSERT INTO order_items (order_id, menu_id, name, base_price, quantity, category)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(orderId, it.menu_id, m.name, m.base_price, it.quantity, m.category);
  }
  return orderId;
}

describe('getMenuSales — adjustment 라운드 (Subagent 1)', () => {
  it('★ SETTLED 주문 1건 — 후라이드 2 + 콜라 3 집계 (menu_update 가격 갱신)', () => {
    insertOrderWithItems({
      status: 'SETTLED',
      no: 1,
      items: [
        { menu_id: 1, quantity: 2 }, // 후라이드 8,000 × 2 = 16,000
        { menu_id: 7, quantity: 3 }, // 콜라     2,000 × 3 =  6,000
      ],
    });
    const rows = getMenuSales(db, DATE);
    const byId = Object.fromEntries(rows.map((r) => [r.menu_id, r]));
    expect(byId[1].quantity).toBe(2);
    expect(byId[1].revenue).toBe(16000);
    expect(byId[7].quantity).toBe(3);
    expect(byId[7].revenue).toBe(6000);
    // 나머지 8개(메뉴 10개 - 매칭 2개)는 0
    for (const id of [2, 3, 4, 5, 6, 8, 9, 10]) {
      expect(byId[id].quantity).toBe(0);
      expect(byId[id].revenue).toBe(0);
    }
  });

  it('★ 레거시 DONE 주문 포함 — DONE 1건(뿌링클) + SETTLED 1건(후라이드) 합산 (menu_update)', () => {
    insertOrderWithItems({
      status: 'DONE',
      no: 1,
      items: [{ menu_id: 3, quantity: 1 }], // 뿌링클 11,000 (menu_update)
    });
    insertOrderWithItems({
      status: 'SETTLED',
      no: 2,
      items: [{ menu_id: 1, quantity: 1 }], // 후라이드 8,000 (menu_update)
    });
    const rows = getMenuSales(db, DATE);
    const byId = Object.fromEntries(rows.map((r) => [r.menu_id, r]));
    expect(byId[1].quantity).toBe(1);
    expect(byId[1].revenue).toBe(8000);
    expect(byId[3].quantity).toBe(1);
    expect(byId[3].revenue).toBe(11000);
  });

  it('★ CANCELED 주문 제외 — CANCELED 1건(후라이드 99) 단독이면 모든 quantity=0', () => {
    insertOrderWithItems({
      status: 'CANCELED',
      no: 1,
      items: [{ menu_id: 1, quantity: 99 }],
    });
    const rows = getMenuSales(db, DATE);
    for (const r of rows) {
      expect(r.quantity).toBe(0);
      expect(r.revenue).toBe(0);
    }
  });

  it('★ HOLD/DINING/READY/COOKING/PAID/TRANSFER_REPORTED/ORDERED 진행 중 상태 제외', () => {
    const inProgress = [
      'ORDERED',
      'TRANSFER_REPORTED',
      'PAID',
      'COOKING',
      'READY',
      'DINING',
      'HOLD',
    ];
    inProgress.forEach((status, idx) => {
      insertOrderWithItems({
        status,
        no: idx + 1,
        items: [{ menu_id: 1, quantity: 5 }],
      });
    });
    const rows = getMenuSales(db, DATE);
    for (const r of rows) {
      expect(r.quantity).toBe(0);
      expect(r.revenue).toBe(0);
    }
  });

  it('★ 응답 길이 === 10 (메뉴 10종 모두 포함 — menu_update 라운드)', () => {
    const rows = getMenuSales(db, DATE);
    expect(rows).toHaveLength(10);
  });

  it('★ 0건 메뉴도 row 포함 (LEFT JOIN) — menu_id=5 뿌링감자튀김 quantity=0', () => {
    // 후라이드만 1건 — 5번 메뉴는 시드 없음
    insertOrderWithItems({
      status: 'SETTLED',
      no: 1,
      items: [{ menu_id: 1, quantity: 1 }],
    });
    const rows = getMenuSales(db, DATE);
    const row5 = rows.find((r) => r.menu_id === 5);
    expect(row5).toBeDefined();
    expect(row5.name).toBe('뿌링감자튀김');
    expect(row5.quantity).toBe(0);
    expect(row5.revenue).toBe(0);
  });

  it('★ menu_update — 0건 신규 메뉴(bluezone/fuel)도 row 포함', () => {
    insertOrderWithItems({
      status: 'SETTLED',
      no: 1,
      items: [{ menu_id: 1, quantity: 1 }],
    });
    const rows = getMenuSales(db, DATE);
    const row9 = rows.find((r) => r.menu_id === 9);
    const row10 = rows.find((r) => r.menu_id === 10);
    expect(row9).toBeDefined();
    expect(row9.name).toBe('생수');
    expect(row9.code).toBe('bluezone');
    expect(row9.quantity).toBe(0);
    expect(row10).toBeDefined();
    expect(row10.name).toBe('양념 소스');
    expect(row10.code).toBe('fuel');
    expect(row10.quantity).toBe(0);
  });

  it('★ menu_update — 신규 메뉴 SETTLED 주문 시 매출 반영', () => {
    insertOrderWithItems({
      status: 'SETTLED',
      no: 1,
      items: [
        { menu_id: 9, quantity: 1 },  // 생수 1,000
        { menu_id: 10, quantity: 2 }, // 양념 소스 500 × 2 = 1,000
      ],
    });
    const rows = getMenuSales(db, DATE);
    const byId = Object.fromEntries(rows.map((r) => [r.menu_id, r]));
    expect(byId[9].quantity).toBe(1);
    expect(byId[9].revenue).toBe(1000);
    expect(byId[10].quantity).toBe(2);
    expect(byId[10].revenue).toBe(1000);
  });

  it('★ ORDER BY m.id ASC — 응답[0].menu_id === 1, 응답[9].menu_id === 10 (menu_update)', () => {
    const rows = getMenuSales(db, DATE);
    expect(rows[0].menu_id).toBe(1);
    expect(rows[9].menu_id).toBe(10);
    // 모든 row 가 오름차순
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].menu_id).toBeGreaterThan(rows[i - 1].menu_id);
    }
  });

  it('★ 정합성 회귀 — 모든 row의 revenue 합 === getSettlementSummary.total_amount (쿠폰 할인 전)', () => {
    // 여러 메뉴 섞은 SETTLED 2건 + 레거시 DONE 1건. order_items.base_price 스냅샷 기반이라 정합.
    // menu_update 가격 갱신:
    //   후라이드 8000 · 양념 9000 · 뿌링클 11000 · 감자튀김 4000 · 콜라 2000
    insertOrderWithItems({
      status: 'SETTLED',
      no: 1,
      items: [
        { menu_id: 1, quantity: 2 }, // 16000 = 8000 × 2
        { menu_id: 4, quantity: 1 }, //  4000
      ],
    });
    insertOrderWithItems({
      status: 'SETTLED',
      no: 2,
      items: [
        { menu_id: 3, quantity: 1 }, // 11000
        { menu_id: 7, quantity: 2 }, //  4000 = 2000 × 2
      ],
    });
    insertOrderWithItems({
      status: 'DONE', // 레거시 합산
      no: 3,
      items: [{ menu_id: 2, quantity: 1 }], // 9000
    });
    const rows = getMenuSales(db, DATE);
    const revenueSum = rows.reduce((sum, r) => sum + r.revenue, 0);
    const summary = getSettlementSummary(db, DATE);
    expect(revenueSum).toBe(summary.total_amount);
    // 신뢰성 검증 (menu_update): 총합 = 16000 + 4000 + 11000 + 4000 + 9000 = 44000
    expect(revenueSum).toBe(44000);
  });

  it('★ operating_date 필터 — 5/20 주문만 시드 후 5/21 조회 시 모든 quantity=0 (menu_update — 10행)', () => {
    insertOrderWithItems({
      status: 'SETTLED',
      no: 1,
      items: [{ menu_id: 1, quantity: 2 }],
      operating_date: DATE, // 5/20
    });
    const rows = getMenuSales(db, '2026-05-21');
    expect(rows).toHaveLength(10);
    for (const r of rows) {
      expect(r.quantity).toBe(0);
      expect(r.revenue).toBe(0);
    }
  });

  it('★ 응답 row 구조 — menu_id/code/name/category/base_price/quantity/revenue 필드 모두 존재 (menu_update 가격)', () => {
    const rows = getMenuSales(db, DATE);
    const row1 = rows[0];
    expect(row1.menu_id).toBe(1);
    expect(row1.code).toBe('BANDAGE');
    expect(row1.name).toBe('후라이드');
    expect(row1.category).toBe('chicken');
    expect(row1.base_price).toBe(8000);
    expect(row1.quantity).toBe(0);
    expect(row1.revenue).toBe(0);
  });
});
