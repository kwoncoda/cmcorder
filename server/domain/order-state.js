// ============================================================
// Task 6.4 — 주문 상태 머신 (ADR-025).
//
// 13 합법 전이 + 5 불법 거부. 회귀 보호.
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
//   READY → DONE                     (수령 완료)
//   READY → CANCELED
//   HOLD → PAID                      (운영자 재확인 — 일치)
//   HOLD → CANCELED
//
// 터미널 상태: DONE · CANCELED — 전이 X.
// ============================================================

/**
 * @type {Record<string, string[]>}
 */
export const LEGAL_TRANSITIONS = {
  ORDERED: ['TRANSFER_REPORTED', 'CANCELED'],
  TRANSFER_REPORTED: ['PAID', 'HOLD', 'CANCELED'],
  PAID: ['COOKING', 'CANCELED'],
  COOKING: ['READY', 'CANCELED'],
  READY: ['DONE', 'CANCELED'],
  HOLD: ['PAID', 'CANCELED'],
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
