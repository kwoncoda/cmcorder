// table-availability.js — 테이블 사용 가능 여부 도메인 (table_lock 브랜치 Subagent 1)
//
// OCCUPYING_STATUSES: 이 상태에 해당하는 주문이 있으면 테이블 점유.
//   - SETTLED / CANCELED → 비점유 (해제).
//   - DONE → dead status, 방어 차원에서 비점유로 처리.
//
// 상태 우선순위 (높을수록 우선):
//   dining > occupied > locked > available
//
// 내보내는 것:
//   OCCUPYING_STATUSES (Set)
//   TableNotAvailableError
//   getAvailability(db, { operating_date }) → [{ table_no, status }] 길이 15
//   getAdminTablesView(db, { operating_date }) → [{ table_no, status, order_no?, dining_at?, locked_at?, updated_at? }] 길이 15
//   assertTableAvailable(db, { operating_date, table_no }) → throws TableNotAvailableError

import { getLock } from '../repositories/table-locks-repo.js';

/** 테이블을 점유 중으로 간주하는 주문 상태 집합 */
export const OCCUPYING_STATUSES = new Set([
  'ORDERED',
  'TRANSFER_REPORTED',
  'PAID',
  'COOKING',
  'READY',
  'DINING',
  'HOLD',
]);

/**
 * 테이블 사용 불가 에러.
 * code = 'TABLE_NOT_AVAILABLE'
 * reason: 'occupied' | 'dining' | 'locked' | 'out_of_range'
 */
export class TableNotAvailableError extends Error {
  /**
   * @param {string} message
   * @param {'occupied'|'dining'|'locked'|'out_of_range'} reason
   */
  constructor(message, reason) {
    super(message);
    this.name = 'TableNotAvailableError';
    this.code = 'TABLE_NOT_AVAILABLE';
    this.reason = reason;
  }
}

/**
 * operating_date 기준 특정 table_no의 점유 주문 (최신 1건) 조회.
 * table_no IS NOT NULL 필터 — 포장 주문(NULL) 제외.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} operating_date
 * @param {number} table_no
 * @returns {{ order_no: number, status: string, dining_at: string|null } | null}
 */
function getOccupyingOrder(db, operating_date, table_no) {
  const statuses = [...OCCUPYING_STATUSES];
  const placeholders = statuses.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT no AS order_no, status, dining_at
         FROM orders
        WHERE operating_date = ?
          AND table_no = ?
          AND table_no IS NOT NULL
          AND status IN (${placeholders})
        ORDER BY id DESC
        LIMIT 1`,
    )
    .get(operating_date, table_no, ...statuses) ?? null;
}

/**
 * 사용자용 테이블 사용 가능 여부 배열 (order_no 미포함 — Q2).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ operating_date: string }} param
 * @returns {{ table_no: number, status: 'available'|'occupied'|'dining'|'locked' }[]}
 */
export function getAvailability(db, { operating_date }) {
  const result = [];
  for (let table_no = 1; table_no <= 15; table_no++) {
    const occupying = getOccupyingOrder(db, operating_date, table_no);
    let status;
    if (occupying?.status === 'DINING') {
      status = 'dining';
    } else if (occupying) {
      status = 'occupied';
    } else {
      const lock = getLock(db, table_no);
      status = lock?.locked === 1 ? 'locked' : 'available';
    }
    result.push({ table_no, status });
  }
  return result;
}

/**
 * 어드민용 테이블 뷰 (order_no / dining_at / locked_at 포함).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ operating_date: string }} param
 * @returns {object[]}
 */
export function getAdminTablesView(db, { operating_date }) {
  const result = [];
  for (let table_no = 1; table_no <= 15; table_no++) {
    const occupying = getOccupyingOrder(db, operating_date, table_no);
    const lock = getLock(db, table_no);

    let row = { table_no };

    if (occupying?.status === 'DINING') {
      row.status = 'dining';
      row.order_no = occupying.order_no;
      if (occupying.dining_at != null) row.dining_at = occupying.dining_at;
    } else if (occupying) {
      row.status = 'occupied';
      row.order_no = occupying.order_no;
    } else if (lock?.locked === 1) {
      row.status = 'locked';
      if (lock.locked_at != null) row.locked_at = lock.locked_at;
    } else {
      row.status = 'available';
    }

    if (lock?.updated_at != null) row.updated_at = lock.updated_at;

    result.push(row);
  }
  return result;
}

/**
 * 단일 테이블 사용 가능 여부 검증. 불가 시 TableNotAvailableError throw.
 * 점유 중인 경우 'occupied', 잠금 시 'locked', 범위 외 시 'out_of_range'.
 * DINING 상태는 'occupied' (점유의 세부 상태) — getAvailability와 달리 이 함수에서는 occupied로 통일.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ operating_date: string, table_no: number }} param
 * @throws {TableNotAvailableError}
 */
export function assertTableAvailable(db, { operating_date, table_no }) {
  // 범위 검증
  if (
    table_no === null ||
    table_no === undefined ||
    typeof table_no !== 'number' ||
    !Number.isInteger(table_no) ||
    table_no < 1 ||
    table_no > 15
  ) {
    throw new TableNotAvailableError(
      '테이블 번호는 1번부터 15번까지만 선택할 수 있어요.',
      'out_of_range',
    );
  }

  // 점유 검증
  const occupying = getOccupyingOrder(db, operating_date, table_no);
  if (occupying) {
    const reason = occupying.status === 'DINING' ? 'dining' : 'occupied';
    throw new TableNotAvailableError(
      '현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요.',
      reason,
    );
  }

  // 잠금 검증
  const lock = getLock(db, table_no);
  if (lock?.locked === 1) {
    throw new TableNotAvailableError(
      '현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요.',
      'locked',
    );
  }
}
