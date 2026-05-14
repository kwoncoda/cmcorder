// Task 6.5 — 메뉴 리포지토리.
//
// 책임:
//   - listMenus: 시드된 8개 메뉴 (id 오름차순)
//   - getMenu: id 단일 조회
//   - toggleMenu: soldOut · recommended · base_price 부분 업데이트
//
// 사용자/관리자 라우트에서 직접 호출. 도메인 검증(품절/존재 X)은 pricing이 담당.

/**
 * 메뉴 전체 목록 — id 오름차순.
 * @param {import('better-sqlite3').Database} db
 */
export function listMenus(db) {
  return db.prepare('SELECT * FROM menus ORDER BY id').all();
}

/**
 * 단일 메뉴 조회 — 없으면 undefined.
 * @param {import('better-sqlite3').Database} db
 * @param {number} id
 */
export function getMenu(db, id) {
  return db.prepare('SELECT * FROM menus WHERE id = ?').get(id);
}

/**
 * 메뉴 부분 패치. 빈 patch는 noop + 현재 행 반환.
 * @param {import('better-sqlite3').Database} db
 * @param {number} id
 * @param {{ soldOut?: boolean, recommended?: boolean, base_price?: number }} patch
 */
export function toggleMenu(db, id, patch) {
  const fields = [];
  const values = [];
  if (patch.soldOut !== undefined) {
    fields.push('sold_out = ?');
    values.push(patch.soldOut ? 1 : 0);
  }
  if (patch.recommended !== undefined) {
    fields.push('recommended = ?');
    values.push(patch.recommended ? 1 : 0);
  }
  if (patch.base_price !== undefined) {
    fields.push('base_price = ?');
    values.push(patch.base_price);
  }
  if (fields.length === 0) return getMenu(db, id);
  values.push(id);
  db.prepare(`UPDATE menus SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getMenu(db, id);
}
