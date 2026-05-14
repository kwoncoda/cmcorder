// ============================================================
// Task 6.4 — 정산 (ADR-012 + G13 business_state 자동 트랜잭션).
//
// 정산 마감 정책 (ADR-012, 절대 깨지면 안 됨 — CLAUDE.md):
//   - in_progress 주문(ORDERED·TRANSFER_REPORTED·PAID·COOKING·READY·HOLD) 0건일 때만 마감 가능
//   - 강제 마감 X
//
// G13: closeSettlement는 settlements INSERT + business_state CLOSED를
// 같은 트랜잭션으로 실행. 가드 실패 시 둘 다 ROLLBACK.
// ============================================================
import { closeBusiness } from './business-state.js';

export class SettlementError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SettlementError';
    this.code = code;
  }
}

const IN_PROGRESS_STATES = [
  'ORDERED',
  'TRANSFER_REPORTED',
  'PAID',
  'COOKING',
  'READY',
  'HOLD',
];

/**
 * 정산 마감 가능 여부 (ADR-012).
 * in_progress 주문이 0건이면 true.
 */
export function canCloseSettlement(db, operating_date) {
  const placeholders = IN_PROGRESS_STATES.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders
       WHERE operating_date = ? AND status IN (${placeholders})`,
    )
    .get(operating_date, ...IN_PROGRESS_STATES);
  return row.c === 0;
}

/**
 * 정산 요약 (마감 전 미리보기 / 마감 후 결과 공통).
 */
export function getSettlementSummary(db, operating_date) {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_price), 0) AS total_amount
       FROM orders WHERE operating_date = ? AND status = 'DONE'`,
    )
    .get(operating_date);

  const placeholders = IN_PROGRESS_STATES.map(() => '?').join(',');
  const inProgress = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders
       WHERE operating_date = ? AND status IN (${placeholders})`,
    )
    .get(operating_date, ...IN_PROGRESS_STATES);

  const closed = db
    .prepare('SELECT id FROM settlements WHERE operating_date = ?')
    .get(operating_date);

  return {
    operating_date,
    total_orders: totals.total_orders,
    total_amount: totals.total_amount,
    in_progress_count: inProgress.c,
    is_closed: !!closed,
  };
}

/**
 * 정산 마감 — settlements INSERT + business_state CLOSED (G13 자동 트랜잭션).
 * - 가드 실패 시 SettlementError + 전체 ROLLBACK.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} operating_date
 */
export function closeSettlement(db, operating_date) {
  const tx = db.transaction(() => {
    if (!canCloseSettlement(db, operating_date)) {
      throw new SettlementError(
        '진행 중 주문이 있어 마감할 수 없습니다 (ADR-012)',
        'IN_PROGRESS_EXISTS',
      );
    }
    const summary = getSettlementSummary(db, operating_date);
    if (summary.is_closed) {
      throw new SettlementError('이미 마감된 일자입니다', 'ALREADY_CLOSED');
    }
    db.prepare(
      `INSERT INTO settlements (operating_date, total_orders, total_amount)
       VALUES (?, ?, ?)`,
    ).run(operating_date, summary.total_orders, summary.total_amount);

    // G13 — 영업 상태 자동 CLOSED (같은 트랜잭션)
    closeBusiness(db);

    return summary;
  });
  return tx();
}
