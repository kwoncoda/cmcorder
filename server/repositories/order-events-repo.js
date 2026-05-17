// find_error_v2 — 주문 이벤트 감사 로그 리포지토리.
//
// 책임:
//   - logOrderEvent: 주문 상태 변경/생성 한 행 INSERT (트랜잭션은 호출자가 관리)
//   - listOrderEvents: operating_date로 filter 후 orders JOIN — order_no 동봉.
//
// 범위: 주문 상태 변경만. 메뉴/로그인/시스템 이벤트는 본 task 범위 외.
//
// 행 스키마:
//   { id, order_id, event_type, from_status, to_status, action_name, actor, note, created_at }
// actor ∈ {'customer','admin','system'}.

/**
 * 단일 이벤트 INSERT.
 * 호출자가 트랜잭션 안에서 호출 가능하도록 단순 INSERT만 수행 (자체 트랜잭션 X).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} evt
 * @param {number} evt.order_id
 * @param {string} evt.event_type   - 'CREATED' 또는 새 상태 이름
 * @param {string|null} evt.from_status
 * @param {string} evt.to_status
 * @param {string} evt.action_name  - 한국어 라벨
 * @param {string} evt.actor        - 'customer' | 'admin' | 'system'
 * @param {string|null} [evt.note]
 * @returns {number} 신규 row id
 */
export function logOrderEvent(db, evt) {
  const result = db
    .prepare(
      `INSERT INTO order_events
         (order_id, event_type, from_status, to_status, action_name, actor, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      evt.order_id,
      evt.event_type,
      evt.from_status ?? null,
      evt.to_status,
      evt.action_name,
      evt.actor,
      evt.note ?? null,
    );
  return Number(result.lastInsertRowid);
}

/**
 * operating_date의 이벤트 목록 — orders JOIN으로 order_no 동봉.
 * 정렬: created_at DESC.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ operating_date: string }} params
 * @returns {Array<object>}
 */
export function listOrderEvents(db, { operating_date }) {
  return db
    .prepare(
      `SELECT e.id, e.order_id, o.no AS order_no, e.event_type,
              e.from_status, e.to_status, e.action_name, e.actor,
              e.note, e.created_at
         FROM order_events e
         JOIN orders o ON o.id = e.order_id
        WHERE o.operating_date = ?
        ORDER BY e.created_at DESC, e.id DESC`,
    )
    .all(operating_date);
}
