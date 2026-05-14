// ============================================================
// Task 6.4 — 정적 BEST (결정 E).
//
// 백엔드는 단순 "recommended=1 우선 N개" + 부족 시 첫 N개 fallback.
// 동적 집계 X — 정적 추천 토글만 사용.
// 품절 메뉴는 항상 제외.
// ============================================================

/**
 * 인기 메뉴 N개 반환 (정적 BEST).
 * @param {import('better-sqlite3').Database} db
 * @param {number} [limit=3]
 */
export function getPopularMenus(db, limit = 3) {
  if (limit <= 0) return [];

  const recommended = db
    .prepare(
      `SELECT * FROM menus
       WHERE recommended = 1 AND sold_out = 0
       ORDER BY id LIMIT ?`,
    )
    .all(limit);

  if (recommended.length >= limit) return recommended;

  const fillCount = limit - recommended.length;
  const fillIds = recommended.map((m) => m.id);
  const placeholders =
    fillIds.length > 0 ? `AND id NOT IN (${fillIds.map(() => '?').join(',')})` : '';
  const filler = db
    .prepare(
      `SELECT * FROM menus
       WHERE sold_out = 0 ${placeholders}
       ORDER BY id LIMIT ?`,
    )
    .all(...fillIds, fillCount);

  return [...recommended, ...filler];
}
