// find_error_v3 — 관리자 이벤트 (메뉴/시스템) 감사 로그 리포지토리.
//
// order_events와 분리:
//   - order_events: 주문 상태 변경 (order_id NOT NULL)
//   - admin_events: 메뉴 토글/가격, 장사 시작, 관리자 로그인, 자동 백업
//
// 책임:
//   - logAdminEvent: 한 행 INSERT (호출자가 트랜잭션 관리)
//   - listAdminEvents: operating_date 필터 + category 필터 + created_at DESC
//
// 행 스키마:
//   { id, category, event_type, action_name, actor,
//     operating_date, target_id, target_name,
//     before_value, after_value, note, created_at }
// category ∈ {'menu','system'}; actor ∈ {'admin','system'}.

/**
 * 단일 이벤트 INSERT. 자체 트랜잭션 X — 호출자가 묶을 수 있게.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} evt
 * @param {'menu'|'system'} evt.category
 * @param {string} evt.event_type
 * @param {string} evt.action_name
 * @param {string} evt.actor                - 'admin' | 'system'
 * @param {string|null} [evt.operating_date]
 * @param {number|null} [evt.target_id]
 * @param {string|null} [evt.target_name]
 * @param {string|null} [evt.before_value]
 * @param {string|null} [evt.after_value]
 * @param {string|null} [evt.note]
 * @returns {number} 신규 row id
 */
export function logAdminEvent(db, evt) {
  const result = db
    .prepare(
      `INSERT INTO admin_events
         (category, event_type, action_name, actor,
          operating_date, target_id, target_name,
          before_value, after_value, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      evt.category,
      evt.event_type,
      evt.action_name,
      evt.actor,
      evt.operating_date ?? null,
      evt.target_id ?? null,
      evt.target_name ?? null,
      evt.before_value ?? null,
      evt.after_value ?? null,
      evt.note ?? null,
    );
  return Number(result.lastInsertRowid);
}

/**
 * 이벤트 목록 조회.
 * - operating_date 필터: 정확히 일치하는 행만. NULL operating_date 행은 항상 제외.
 *   (find_error_v3 P1-2 (Codex 리뷰 2026-05-18): ADMIN_LOGIN도 operating_date를 채워
 *    저장하므로 system 탭에서 노출된다. 모든 admin_events 기록 지점은 operating_date를
 *    필수로 채워 넣어야 한다.)
 * - category 필터: 'menu' | 'system'. 생략 시 전체.
 * - 정렬: created_at DESC, id DESC.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ operating_date: string, category?: 'menu'|'system' }} params
 */
export function listAdminEvents(db, { operating_date, category }) {
  const where = ['operating_date = ?'];
  const args = [operating_date];
  if (category) {
    where.push('category = ?');
    args.push(category);
  }
  return db
    .prepare(
      `SELECT id, category, event_type, action_name, actor,
              operating_date, target_id, target_name,
              before_value, after_value, note, created_at
         FROM admin_events
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC, id DESC`,
    )
    .all(...args);
}
