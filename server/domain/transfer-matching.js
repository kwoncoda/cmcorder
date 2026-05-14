// ============================================================
// Task 6.4 — 이체 매칭 (4요소: 이름·은행·금액·시각 ±5분).
//
// candidates는 orders 테이블에서 status='TRANSFER_REPORTED' 행을 미리 가져온 배열.
// - 이름: depositor_name OR (use_other_name=1 시 other_name)
// - 은행: bank OR custom_bank (기타)
// - 금액: 정확 일치
// - 시각: ±5분 (300_000ms)
// ============================================================

const FIVE_MIN_MS = 5 * 60 * 1000;

/**
 * 이체 매칭 — 4요소 일치 후보 필터링.
 * @param {object} reported
 * @param {string} reported.depositorName
 * @param {string} reported.bank
 * @param {number} reported.amount
 * @param {string} reported.transferredAt — ISO timestamp
 * @param {Array<object>} candidates
 * @returns {Array<object>} 매칭된 후보 부분 집합
 */
export function matchTransfer(
  { depositorName, bank, amount, transferredAt },
  candidates,
) {
  const reportedTime = new Date(transferredAt).getTime();
  const targetName = depositorName?.trim();

  return candidates.filter((c) => {
    // 이름 — depositor_name 또는 other_name(use_other_name=1 시)
    const candidateName = c.use_other_name
      ? c.other_name?.trim()
      : c.depositor_name?.trim();
    const sameName = candidateName === targetName;

    // 은행 — bank 또는 custom_bank (기타 은행)
    const sameBank = c.bank === bank || c.custom_bank === bank;

    // 금액
    const sameAmount = c.amount === amount;

    // 시각 ±5분
    const cTime = new Date(c.transferred_at).getTime();
    const sameTime = Math.abs(reportedTime - cTime) <= FIVE_MIN_MS;

    return sameName && sameBank && sameAmount && sameTime;
  });
}
