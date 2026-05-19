// Task 6.4 — 정산 (ADR-012 가드 + G13 business_state 자동 트랜잭션).
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  canCloseSettlement,
  getSettlementSummary,
  closeSettlement,
  SettlementError,
} from '../settlement.js';
import { openBusiness, getBusinessState } from '../business-state.js';

let db;
const DATE = '2026-05-20';

beforeEach(() => {
  db = new Database(':memory:');
  bootstrapDatabase(db);
  openBusiness(db, { operating_date: DATE });
});

function insertOrder({ status, total = 18000, no = 1 }) {
  return db
    .prepare(
      `INSERT INTO orders (no, operating_date, status, name, total_price)
       VALUES (?, ?, ?, '테스트', ?)`,
    )
    .run(no, DATE, status, total);
}

describe('canCloseSettlement — ADR-012', () => {
  it('★ in_progress 0이면 true', () => {
    insertOrder({ status: 'SETTLED', no: 1 });
    insertOrder({ status: 'CANCELED', no: 2 });
    expect(canCloseSettlement(db, DATE)).toBe(true);
  });

  it('★ in_progress > 0이면 false (각 상태별)', () => {
    insertOrder({ status: 'ORDERED', no: 1 });
    expect(canCloseSettlement(db, DATE)).toBe(false);

    db.prepare('UPDATE orders SET status = ? WHERE id = 1').run(
      'TRANSFER_REPORTED',
    );
    expect(canCloseSettlement(db, DATE)).toBe(false);

    db.prepare('UPDATE orders SET status = ? WHERE id = 1').run('PAID');
    expect(canCloseSettlement(db, DATE)).toBe(false);

    db.prepare('UPDATE orders SET status = ? WHERE id = 1').run('COOKING');
    expect(canCloseSettlement(db, DATE)).toBe(false);

    db.prepare('UPDATE orders SET status = ? WHERE id = 1').run('READY');
    expect(canCloseSettlement(db, DATE)).toBe(false);

    db.prepare('UPDATE orders SET status = ? WHERE id = 1').run('HOLD');
    expect(canCloseSettlement(db, DATE)).toBe(false);
  });

  // ── table_lock 라운드 (2026-05-19, P1-2 Codex) ────────────────────
  it('★ table_lock — DINING 1건 있으면 마감 차단 (P1-2 회귀)', () => {
    insertOrder({ status: 'DINING', no: 1 });
    expect(canCloseSettlement(db, DATE)).toBe(false);
  });

  it('★ table_lock — SETTLED만 있으면 마감 가능 (P1-2 회귀)', () => {
    insertOrder({ status: 'SETTLED', no: 1 });
    insertOrder({ status: 'SETTLED', no: 2 });
    expect(canCloseSettlement(db, DATE)).toBe(true);
  });

  it('★ table_lock — SETTLED + 레거시 DONE 혼재 시에도 마감 가능 (P1-2 호환)', () => {
    insertOrder({ status: 'SETTLED', no: 1 });
    insertOrder({ status: 'DONE', no: 2 });
    expect(canCloseSettlement(db, DATE)).toBe(true);
  });

  it('★ 다른 일자의 in_progress는 무시', () => {
    insertOrder({ status: 'ORDERED', no: 1 });
    // 다른 일자
    db.prepare(
      `INSERT INTO orders (no, operating_date, status, name, total_price)
       VALUES (1, '2026-05-19', 'DONE', '테스트', 18000)`,
    ).run();
    expect(canCloseSettlement(db, '2026-05-19')).toBe(true);
    expect(canCloseSettlement(db, DATE)).toBe(false);
  });
});

describe('getSettlementSummary', () => {
  it('★ SETTLED 주문 합계 + in_progress count + closed 여부', () => {
    insertOrder({ status: 'SETTLED', total: 18000, no: 1 });
    insertOrder({ status: 'SETTLED', total: 21000, no: 2 });
    insertOrder({ status: 'CANCELED', total: 5000, no: 3 });
    insertOrder({ status: 'ORDERED', total: 7000, no: 4 });

    const s = getSettlementSummary(db, DATE);
    expect(s.total_orders).toBe(2); // SETTLED만
    expect(s.total_amount).toBe(39000);
    expect(s.in_progress_count).toBe(1);
    expect(s.is_closed).toBe(false);
  });

  // ── table_lock 라운드 (P1-2 Codex) ─────────────────────────────────
  it('★ table_lock — SETTLED + 레거시 DONE 합산 (P1-2 회귀)', () => {
    insertOrder({ status: 'SETTLED', total: 18000, no: 1 });
    insertOrder({ status: 'DONE', total: 21000, no: 2 });  // legacy
    insertOrder({ status: 'CANCELED', total: 5000, no: 3 });
    const s = getSettlementSummary(db, DATE);
    expect(s.total_orders).toBe(2);
    expect(s.total_amount).toBe(39000);
  });

  it('★ table_lock — DINING은 매출 집계 X (in_progress로 분류) (P1-2 회귀)', () => {
    insertOrder({ status: 'DINING', total: 18000, no: 1 });
    insertOrder({ status: 'SETTLED', total: 21000, no: 2 });
    const s = getSettlementSummary(db, DATE);
    expect(s.total_orders).toBe(1);       // SETTLED만 완료
    expect(s.total_amount).toBe(21000);
    expect(s.in_progress_count).toBe(1);   // DINING이 in_progress
  });

  it('★ 주문 없을 때 0 처리', () => {
    const s = getSettlementSummary(db, DATE);
    expect(s.total_orders).toBe(0);
    expect(s.total_amount).toBe(0);
    expect(s.in_progress_count).toBe(0);
  });

  // ── P1-3 (Codex 리뷰) 정산 보조 ──────────────────────────────
  it('★ P1-3 — coupon_count / coupon_discount_total 포함', () => {
    insertOrder({ status: 'SETTLED', total: 17000, no: 1 });
    insertOrder({ status: 'SETTLED', total: 17000, no: 2 });
    insertOrder({ status: 'SETTLED', total: 21000, no: 3 });
    // 쿠폰 사용 2건 (해당 일자)
    db.prepare(
      "INSERT INTO used_coupons (student_id, name, order_id) VALUES ('202637001', 'A', 1)",
    ).run();
    db.prepare(
      "INSERT INTO used_coupons (student_id, name, order_id) VALUES ('202637002', 'B', 2)",
    ).run();

    const s = getSettlementSummary(db, DATE);
    expect(s.coupon_count).toBe(2);
    expect(s.coupon_discount_total).toBe(2000); // 2건 × 1,000원 ADR-019
  });

  it('★ P1-3 — 쿠폰 0건 시 0 반환', () => {
    insertOrder({ status: 'SETTLED', total: 18000, no: 1 });
    const s = getSettlementSummary(db, DATE);
    expect(s.coupon_count).toBe(0);
    expect(s.coupon_discount_total).toBe(0);
  });
});

describe('closeSettlement — G13 자동 트랜잭션', () => {
  it('★ 가드 통과 시 settlements INSERT + business_state CLOSED 자동', () => {
    insertOrder({ status: 'SETTLED', total: 18000, no: 1 });
    insertOrder({ status: 'SETTLED', total: 21000, no: 2 });

    expect(getBusinessState(db).status).toBe('OPEN');
    const summary = closeSettlement(db, DATE);
    expect(summary.total_orders).toBe(2);
    expect(summary.total_amount).toBe(39000);

    // settlements 행 추가
    const row = db
      .prepare('SELECT * FROM settlements WHERE operating_date = ?')
      .get(DATE);
    expect(row).toBeDefined();
    expect(row.total_orders).toBe(2);
    expect(row.total_amount).toBe(39000);

    // G13 — business_state 자동 CLOSED
    expect(getBusinessState(db).status).toBe('CLOSED');
  });

  it('★ ADR-012 가드 — in_progress > 0 시 SettlementError', () => {
    insertOrder({ status: 'ORDERED', no: 1 });
    try {
      closeSettlement(db, DATE);
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(SettlementError);
      expect(err.code).toBe('IN_PROGRESS_EXISTS');
    }

    // 가드 실패 시 settlements 없음 (ROLLBACK)
    const row = db
      .prepare('SELECT * FROM settlements WHERE operating_date = ?')
      .get(DATE);
    expect(row).toBeUndefined();

    // G13 — business_state도 OPEN 유지 (ROLLBACK)
    expect(getBusinessState(db).status).toBe('OPEN');
  });

  it('★ 중복 마감 거부 (ALREADY_CLOSED)', () => {
    insertOrder({ status: 'SETTLED', no: 1 });
    closeSettlement(db, DATE);

    // 같은 일자 재마감 시도 — business_state 다시 OPEN 후 시도
    openBusiness(db, { operating_date: DATE });
    try {
      closeSettlement(db, DATE);
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(SettlementError);
      expect(err.code).toBe('ALREADY_CLOSED');
    }
  });
});
