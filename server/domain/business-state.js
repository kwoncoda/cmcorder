// ============================================================
// Task 6.4 — 영업 상태 머신 (G13 신규).
//
// 2-state: OPEN ↔ CLOSED.
//   - openBusiness: CLOSED → OPEN (운영자 명시적)
//   - closeBusiness: OPEN → CLOSED (정산 마감 시 자동, ADR-012 가드 후)
//
// 멱등성:
//   - openBusiness(OPEN) → 그대로 OPEN (operating_date 유지)
//   - closeBusiness(CLOSED) → 그대로 CLOSED
//
// 단일 행 강제: init.sql CHECK(id=1).
// ============================================================
import { logger } from '../lib/logger.js';

export class BusinessStateError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BusinessStateError';
    this.code = code;
  }
}

/**
 * 현재 영업 상태 조회.
 * @param {import('better-sqlite3').Database} db
 * @returns {{status: 'OPEN'|'CLOSED', operating_date: string, changed_at: string}}
 */
export function getBusinessState(db) {
  const row = db
    .prepare(
      'SELECT status, operating_date, changed_at FROM business_state WHERE id = 1',
    )
    .get();
  if (!row) {
    throw new BusinessStateError('business_state 행 누락', 'STATE_MISSING');
  }
  return row;
}

/**
 * 영업 시작 (CLOSED → OPEN). OPEN 상태에서 호출 시 멱등.
 * @param {import('better-sqlite3').Database} db
 * @param {{operating_date: string}} input
 */
export function openBusiness(db, { operating_date }) {
  const tx = db.transaction(() => {
    const current = getBusinessState(db);
    if (current.status === 'OPEN') {
      // 멱등 — 변경 없이 그대로 반환 (operating_date도 보존)
      return current;
    }
    db.prepare(
      `UPDATE business_state
       SET status = 'OPEN', operating_date = ?, changed_at = datetime('now')
       WHERE id = 1`,
    ).run(operating_date);
    logger.info({ operating_date }, '[business-state] 영업 시작 (OPEN)');
    return getBusinessState(db);
  });
  return tx();
}

/**
 * 영업 종료 (OPEN → CLOSED). CLOSED 상태에서 호출 시 멱등.
 * @param {import('better-sqlite3').Database} db
 */
export function closeBusiness(db) {
  const tx = db.transaction(() => {
    const current = getBusinessState(db);
    if (current.status === 'CLOSED') {
      return current; // 멱등
    }
    db.prepare(
      `UPDATE business_state
       SET status = 'CLOSED', changed_at = datetime('now')
       WHERE id = 1`,
    ).run();
    logger.info('[business-state] 영업 종료 (CLOSED)');
    return getBusinessState(db);
  });
  return tx();
}
