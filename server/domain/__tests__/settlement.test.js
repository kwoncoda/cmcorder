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
    insertOrder({ status: 'DONE', no: 1 });
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
  it('★ DONE 주문 합계 + in_progress count + closed 여부', () => {
    insertOrder({ status: 'DONE', total: 18000, no: 1 });
    insertOrder({ status: 'DONE', total: 21000, no: 2 });
    insertOrder({ status: 'CANCELED', total: 5000, no: 3 });
    insertOrder({ status: 'ORDERED', total: 7000, no: 4 });

    const s = getSettlementSummary(db, DATE);
    expect(s.total_orders).toBe(2); // DONE만
    expect(s.total_amount).toBe(39000);
    expect(s.in_progress_count).toBe(1);
    expect(s.is_closed).toBe(false);
  });

  it('★ 주문 없을 때 0 처리', () => {
    const s = getSettlementSummary(db, DATE);
    expect(s.total_orders).toBe(0);
    expect(s.total_amount).toBe(0);
    expect(s.in_progress_count).toBe(0);
  });
});

describe('closeSettlement — G13 자동 트랜잭션', () => {
  it('★ 가드 통과 시 settlements INSERT + business_state CLOSED 자동', () => {
    insertOrder({ status: 'DONE', total: 18000, no: 1 });
    insertOrder({ status: 'DONE', total: 21000, no: 2 });

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
    insertOrder({ status: 'DONE', no: 1 });
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
