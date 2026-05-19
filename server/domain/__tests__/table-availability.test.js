// table-availability.test.js — TDD (table_lock 브랜치 Subagent 1)
// 테이블 사용 가능 여부 도메인 단위 테스트.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { openBusinessDay } from '../../repositories/business-state-repo.js';
import { lockTable } from '../../repositories/table-locks-repo.js';
import {
  getAvailability,
  getAdminTablesView,
  assertTableAvailable,
  TableNotAvailableError,
} from '../table-availability.js';

const OPERATING_DATE = '2026-05-20';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  openBusinessDay(db, { operating_date: OPERATING_DATE });
  return db;
}

/** 주문 1건 삽입 후 id 반환 */
function insertOrder(db, { table_no = 5, status = 'ORDERED', operating_date = OPERATING_DATE } = {}) {
  const result = db.prepare(
    `INSERT INTO orders (no, operating_date, status, name, student_id, delivery_type, table_no, total_price)
     VALUES (
       (SELECT COALESCE(MAX(no), 0) + 1 FROM orders WHERE operating_date = ?),
       ?, ?, '테스터', '202637001', 'dineIn', ?, 18000
     )`,
  ).run(operating_date, operating_date, status, table_no);
  return Number(result.lastInsertRowid);
}

// ─── getAvailability ──────────────────────────────────────────────────────

describe('getAvailability — 사용자용 (order_no 미포함)', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  it('빈 DB → 15행, 모두 available, order_no 키 없음', () => {
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows).toHaveLength(15);
    expect(rows.every((r) => r.status === 'available')).toBe(true);
    rows.forEach((r) => {
      expect(r).not.toHaveProperty('order_no');
      expect(r).not.toHaveProperty('dining_at');
      expect(r).not.toHaveProperty('locked_at');
    });
  });

  it('5번에 ORDERED 주문 → 5번 occupied', () => {
    insertOrder(db, { table_no: 5, status: 'ORDERED' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('occupied');
  });

  it('5번에 TRANSFER_REPORTED 주문 → 5번 occupied', () => {
    insertOrder(db, { table_no: 5, status: 'TRANSFER_REPORTED' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('occupied');
  });

  it('5번에 PAID 주문 → 5번 occupied', () => {
    insertOrder(db, { table_no: 5, status: 'PAID' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('occupied');
  });

  it('5번에 COOKING 주문 → 5번 occupied', () => {
    insertOrder(db, { table_no: 5, status: 'COOKING' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('occupied');
  });

  it('5번에 READY 주문 → 5번 occupied', () => {
    insertOrder(db, { table_no: 5, status: 'READY' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('occupied');
  });

  it('5번에 DINING 주문 → 5번 dining', () => {
    const id = insertOrder(db, { table_no: 5, status: 'ORDERED' });
    db.prepare("UPDATE orders SET status='DINING' WHERE id=?").run(id);
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('dining');
  });

  it('5번에 HOLD 주문 → 5번 occupied', () => {
    insertOrder(db, { table_no: 5, status: 'HOLD' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('occupied');
  });

  it('5번에 CANCELED 주문 → 5번 available', () => {
    insertOrder(db, { table_no: 5, status: 'CANCELED' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('available');
  });

  it('5번에 DONE 주문 → 5번 available (dead status 방어)', () => {
    const id = insertOrder(db, { table_no: 5, status: 'ORDERED' });
    db.prepare("UPDATE orders SET status='DONE' WHERE id=?").run(id);
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('available');
  });

  it('5번에 SETTLED 주문 → 5번 available', () => {
    const id = insertOrder(db, { table_no: 5, status: 'ORDERED' });
    db.prepare("UPDATE orders SET status='SETTLED' WHERE id=?").run(id);
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('available');
  });

  it('7번 잠금만 → 7번 locked, 나머지 available', () => {
    lockTable(db, 7);
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 7).status).toBe('locked');
    expect(rows.filter((r) => r.table_no !== 7).every((r) => r.status === 'available')).toBe(true);
  });

  it('5번 PAID + 7번 잠금 → 5번 occupied, 7번 locked', () => {
    insertOrder(db, { table_no: 5, status: 'PAID' });
    lockTable(db, 7);
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('occupied');
    expect(rows.find((r) => r.table_no === 7).status).toBe('locked');
  });

  it('5번 DINING + table_locks(5) 잠금 → 5번 dining (dining 우선)', () => {
    const id = insertOrder(db, { table_no: 5, status: 'ORDERED' });
    db.prepare("UPDATE orders SET status='DINING' WHERE id=?").run(id);
    lockTable(db, 5);
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('dining');
  });

  it('operating_date가 다른 5번 주문 → 5번 available (오늘 점유 아님)', () => {
    insertOrder(db, { table_no: 5, status: 'PAID', operating_date: '2026-05-19' });
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.find((r) => r.table_no === 5).status).toBe('available');
  });

  it('포장 주문(table_no=null) PAID → 모든 테이블 available', () => {
    db.prepare(
      `INSERT INTO orders (no, operating_date, status, name, student_id, delivery_type, table_no, total_price)
       VALUES (1, ?, 'PAID', '테스터', '202637001', 'takeout', NULL, 18000)`,
    ).run(OPERATING_DATE);
    const rows = getAvailability(db, { operating_date: OPERATING_DATE });
    expect(rows.every((r) => r.status === 'available')).toBe(true);
  });
});

// ─── getAdminTablesView ───────────────────────────────────────────────────

describe('getAdminTablesView — 어드민용 (order_no 포함)', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  it('5번 PAID → status occupied + order_no 포함', () => {
    const orderId = insertOrder(db, { table_no: 5, status: 'PAID' });
    // order.no 구하기
    const order = db.prepare('SELECT no FROM orders WHERE id = ?').get(orderId);
    const rows = getAdminTablesView(db, { operating_date: OPERATING_DATE });
    const row5 = rows.find((r) => r.table_no === 5);
    expect(row5.status).toBe('occupied');
    expect(row5.order_no).toBe(order.no);
  });

  it('5번 DINING → status dining + order_no 포함', () => {
    const orderId = insertOrder(db, { table_no: 5, status: 'ORDERED' });
    db.prepare("UPDATE orders SET status='DINING' WHERE id=?").run(orderId);
    const order = db.prepare('SELECT no FROM orders WHERE id = ?').get(orderId);
    const rows = getAdminTablesView(db, { operating_date: OPERATING_DATE });
    const row5 = rows.find((r) => r.table_no === 5);
    expect(row5.status).toBe('dining');
    expect(row5.order_no).toBe(order.no);
  });

  it('7번 잠금 → status locked + locked_at ISO 문자열', () => {
    lockTable(db, 7);
    const rows = getAdminTablesView(db, { operating_date: OPERATING_DATE });
    const row7 = rows.find((r) => r.table_no === 7);
    expect(row7.status).toBe('locked');
    expect(row7.locked_at).toBeTruthy();
  });
});

// ─── assertTableAvailable ─────────────────────────────────────────────────

describe('assertTableAvailable', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  it('table_no=0 → throws (out_of_range)', () => {
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 0 }))
      .toThrowError(TableNotAvailableError);
    try {
      assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 0 });
    } catch (e) {
      expect(e.reason).toBe('out_of_range');
    }
  });

  it('table_no=16 → throws (out_of_range)', () => {
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 16 }))
      .toThrowError(TableNotAvailableError);
  });

  it('table_no="abc" → throws (out_of_range)', () => {
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 'abc' }))
      .toThrowError(TableNotAvailableError);
  });

  it('table_no=null → throws (out_of_range)', () => {
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: null }))
      .toThrowError(TableNotAvailableError);
  });

  it('table_no=1, 주문 없음, 잠금 없음 → 통과', () => {
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 1 })).not.toThrow();
  });

  it('table_no=15, 주문 없음, 잠금 없음 → 통과', () => {
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 15 })).not.toThrow();
  });

  it('5번에 PAID 주문 → throws (reason: occupied)', () => {
    insertOrder(db, { table_no: 5, status: 'PAID' });
    try {
      assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 5 });
      expect.fail('에러가 발생해야 함');
    } catch (e) {
      expect(e).toBeInstanceOf(TableNotAvailableError);
      expect(e.reason).toBe('occupied');
    }
  });

  it('7번 잠금 → throws (reason: locked)', () => {
    lockTable(db, 7);
    try {
      assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 7 });
      expect.fail('에러가 발생해야 함');
    } catch (e) {
      expect(e).toBeInstanceOf(TableNotAvailableError);
      expect(e.reason).toBe('locked');
    }
  });

  it('5번에 CANCELED 주문 → 통과 (점유 해제)', () => {
    insertOrder(db, { table_no: 5, status: 'CANCELED' });
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 5 })).not.toThrow();
  });

  it('5번에 SETTLED 주문 → 통과 (점유 해제)', () => {
    const id = insertOrder(db, { table_no: 5, status: 'ORDERED' });
    db.prepare("UPDATE orders SET status='SETTLED' WHERE id=?").run(id);
    expect(() => assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 5 })).not.toThrow();
  });

  it('★ DINING 주문이 있는 5번 → reason: "dining" throws', () => {
    const id = insertOrder(db, { table_no: 5, status: 'ORDERED' });
    db.prepare("UPDATE orders SET status='DINING' WHERE id=?").run(id);
    try {
      assertTableAvailable(db, { operating_date: OPERATING_DATE, table_no: 5 });
      expect.fail('에러가 발생해야 함');
    } catch (e) {
      expect(e).toBeInstanceOf(TableNotAvailableError);
      expect(e.reason).toBe('dining');
    }
  });
});
