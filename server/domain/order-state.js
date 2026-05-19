// ============================================================
// Task 6.4 — 주문 상태 머신 (ADR-025).
//
// 15 합법 전이 + 9 불법 거부. 회귀 보호.
//
// 합법 전이:
//   ORDERED → TRANSFER_REPORTED      (사용자 이체 신고)
//   ORDERED → CANCELED               (운영자 취소)
//   TRANSFER_REPORTED → PAID         (운영자 이체 확인)
//   TRANSFER_REPORTED → HOLD         (운영자 보류 — 불일치)
//   TRANSFER_REPORTED → CANCELED
//   PAID → COOKING                   (운영자 조리 시작)
//   PAID → CANCELED
//   COOKING → READY                  (조리 완료)
//   COOKING → CANCELED
//   READY → DINING                   (전달 완료 → 식사 시작; table_lock 신규)
//   READY → CANCELED
//   DINING → SETTLED                 (테이블 준비 완료; table_lock 신규)
//   DINING → CANCELED
//   HOLD → PAID                      (운영자 재확인 — 일치)
//   HOLD → CANCELED
//
// 터미널 상태: SETTLED · CANCELED — 전이 X.
// DONE은 dead status — 레거시 보존 목적으로 enum에 유지하나 합법 진입 전이 없음.
// ============================================================

/**
 * @type {Record<string, string[]>}
 */
export const LEGAL_TRANSITIONS = {
  // Happy path
  ORDERED: ['TRANSFER_REPORTED', 'CANCELED'],
  TRANSFER_REPORTED: ['PAID', 'HOLD', 'CANCELED'],
  PAID: ['COOKING', 'CANCELED'],
  COOKING: ['READY', 'CANCELED'],
  READY: ['DINING', 'CANCELED'],       // READY → DONE 직접 전이 폐지 (table_lock)
  // table_lock 신규: DINING → SETTLED 흐름
  DINING: ['SETTLED', 'CANCELED'],
  // Side state
  HOLD: ['PAID', 'CANCELED'],
  // Terminals
  SETTLED: [],                           // 터미널 — 전이 X
  // DONE: dead status — 레거시 보존. 합법 전이 진입 없음, 시작도 불가.
  DONE: [],
  CANCELED: [],
};

export class StateTransitionError extends Error {
  constructor(from, to) {
    super(`불법 상태 전이: ${from} → ${to}`);
    this.name = 'StateTransitionError';
    this.code = 'ILLEGAL_TRANSITION';
    this.from = from;
    this.to = to;
  }
}

/**
 * 합법 여부만 반환 — throw하지 않는 가드.
 */
export function canTransition(from, to) {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 전이 검증 — 불법이면 StateTransitionError throw.
 * (상태 변경 자체는 호출부에서 SQL UPDATE — 본 함수는 검증만)
 */
export function transition(from, to) {
  if (!canTransition(from, to)) {
    throw new StateTransitionError(from, to);
  }
}
