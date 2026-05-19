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

// table_lock 라운드 (2026-05-19): DINING도 진행 중 상태로 본다.
// 식사 중 주문이 남아 있으면 정산 마감 차단 (ADR-012 회귀).
const IN_PROGRESS_STATES = [
  'ORDERED',
  'TRANSFER_REPORTED',
  'PAID',
  'COOKING',
  'READY',
  'DINING',
  'HOLD',
];

// table_lock 라운드: 완료 매출 집계는 SETTLED 우선 + 레거시 DONE 호환.
// 새 흐름은 READY → DINING → SETTLED 이므로 SETTLED가 정상 완료 상태.
// DONE은 dead status이지만 legacy 데이터가 있을 경우를 위해 포함.
const COMPLETED_STATES = ['SETTLED', 'DONE'];

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

// P1-3 (Codex 리뷰): ADR-019 쿠폰 정액 할인. 정산 요약에 합산용.
const COUPON_DISCOUNT_PER = 1000;

/**
 * 정산 요약 (마감 전 미리보기 / 마감 후 결과 공통).
 * P1-3: 쿠폰 사용 건수 + 총 할인액 포함.
 */
export function getSettlementSummary(db, operating_date) {
  // table_lock: 완료 집계는 SETTLED + 레거시 DONE.
  const completedPlaceholders = COMPLETED_STATES.map(() => '?').join(',');
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_price), 0) AS total_amount
       FROM orders WHERE operating_date = ? AND status IN (${completedPlaceholders})`,
    )
    .get(operating_date, ...COMPLETED_STATES);

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

  // P1-3: 해당 일자 쿠폰 사용 건수 — used_coupons.order_id를 orders.operating_date로 JOIN.
  const coupon = db
    .prepare(
      `SELECT COUNT(*) AS c FROM used_coupons uc
       JOIN orders o ON o.id = uc.order_id
       WHERE o.operating_date = ?`,
    )
    .get(operating_date);
  const couponCount = coupon?.c ?? 0;

  return {
    operating_date,
    total_orders: totals.total_orders,
    total_amount: totals.total_amount,
    in_progress_count: inProgress.c,
    is_closed: !!closed,
    coupon_count: couponCount,
    coupon_discount_total: couponCount * COUPON_DISCOUNT_PER,
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
