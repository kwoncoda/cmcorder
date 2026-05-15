// ============================================================
// Task 6.4 + P2-1 (Codex v3 2026-05-15) — BEST 메뉴 (어드민 토글 단일).
//
// 사용자 결정 (2026-05-15):
//   - 실시간 랭킹 X (동적 집계 X)
//   - 어드민이 메뉴 관리에서 recommended 토글로 BEST 직접 선택
//   - 판매 수 표시 X (응답에도 미포함)
//   - fallback("recommended 0개면 첫 N개") 제거 — 어드민 미선택 시 BEST 빈 배열
//
// ADR-017 변경 (2026-05-15): 동적 랭킹·판매 수·fallback 모두 폐기.
// 품절 메뉴는 항상 제외.
// ============================================================

/**
 * BEST 메뉴 반환 — 어드민이 토글한 recommended=1 메뉴 중 품절 제외.
 * @param {import('better-sqlite3').Database} db
 * @param {number} [limit=3]
 */
export function getPopularMenus(db, limit = 3) {
  if (limit <= 0) return [];

  return db
    .prepare(
      `SELECT id, code, name, category, base_price, image, sold_out, recommended
       FROM menus
       WHERE recommended = 1 AND sold_out = 0
       ORDER BY id LIMIT ?`,
    )
    .all(limit);
}
