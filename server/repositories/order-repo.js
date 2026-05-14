// Task 6.5 — 주문 리포지토리.
//
// 책임:
//   - nextOrderNo: 일자별 시퀀스 (ADR-018) — MAX(no) + 1
//   - createOrder: 트랜잭션으로 orders + order_items 일괄 INSERT
//   - getOrder · listOrders: items 같이 조회
//   - updateOrderStatus: 상태 + 단계별 timestamp 자동 기록
//   - updateTransferInfo: 이체 신고 → TRANSFER_REPORTED 전이
//
// 상태 전이 검증은 호출자(라우트)에서 — Repository는 단순 UPDATE.

/**
 * 일자별 시퀀스 — 다음 no.
 * @param {import('better-sqlite3').Database} db
 * @param {string} operating_date
 */
export function nextOrderNo(db, operating_date) {
  const row = db
    .prepare(
      'SELECT COALESCE(MAX(no), 0) AS last FROM orders WHERE operating_date = ?',
    )
    .get(operating_date);
  return row.last + 1;
}

/**
 * 주문 생성 — orders + order_items 트랜잭션.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} meta — { items_priced, total_price, name, student_id, is_external, external_token, delivery_type, table_no, operating_date }
 */
export function createOrder(db, meta) {
  const tx = db.transaction(() => {
    const no = nextOrderNo(db, meta.operating_date);
    // P0-4 (Codex 리뷰): 모든 주문에 access_token 발급. 외부인은 external_token과
    // 동일 값 재사용(QR 공유 호환), 학생은 신규 UUID. token은 sessionStorage/URL로 전달.
    const access_token = meta.access_token ?? null;
    const result = db
      .prepare(
        `INSERT INTO orders
         (no, operating_date, name, student_id, is_external, external_token,
          access_token, delivery_type, table_no, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        no,
        meta.operating_date,
        meta.name,
        meta.student_id ?? null,
        meta.is_external ? 1 : 0,
        meta.external_token ?? null,
        access_token,
        meta.delivery_type ?? 'dineIn',
        meta.table_no ?? null,
        meta.total_price,
      );
    const orderId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, menu_id, name, base_price, quantity, category)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const item of meta.items_priced) {
      insertItem.run(
        orderId,
        item.menu_id,
        item.name,
        item.base_price,
        item.quantity,
        item.category,
      );
    }
    return getOrder(db, orderId);
  });
  return tx();
}

/**
 * 단일 주문 + items.
 * @param {import('better-sqlite3').Database} db
 * @param {number} id
 * @returns {object|null}
 */
export function getOrder(db, id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db
    .prepare(
      'SELECT menu_id, name, base_price, quantity, category FROM order_items WHERE order_id = ? ORDER BY id',
    )
    .all(id);
  return order;
}

/**
 * 주문 목록 + items. status·operating_date 필터 지원.
 * @param {import('better-sqlite3').Database} db
 * @param {{ status?: string|string[], operating_date?: string }} [filter]
 */
export function listOrders(db, { status, operating_date } = {}) {
  const conditions = [];
  const values = [];
  if (status) {
    if (Array.isArray(status)) {
      conditions.push(`status IN (${status.map(() => '?').join(',')})`);
      values.push(...status);
    } else {
      conditions.push('status = ?');
      values.push(status);
    }
  }
  if (operating_date) {
    conditions.push('operating_date = ?');
    values.push(operating_date);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orders = db
    .prepare(`SELECT * FROM orders ${where} ORDER BY no DESC`)
    .all(...values);
  const itemsStmt = db.prepare(
    'SELECT menu_id, name, base_price, quantity, category FROM order_items WHERE order_id = ? ORDER BY id',
  );
  for (const o of orders) {
    o.items = itemsStmt.all(o.id);
  }
  return orders;
}

const STATUS_TIME_FIELD = {
  TRANSFER_REPORTED: 'transferred_at',
  PAID: 'paid_at',
  COOKING: 'cooking_at',
  READY: 'ready_at',
  DONE: 'done_at',
};

/**
 * 상태 변경 — 단계별 timestamp 자동 기록.
 * 상태 전이 검증은 호출자에서 (order-state.js 사용).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} id
 * @param {string} newStatus
 * @param {object} [extraFields] — hold_reason · canceled_reason 등 보조 컬럼
 */
export function updateOrderStatus(db, id, newStatus, extraFields = {}) {
  const tx = db.transaction(() => {
    const setClauses = ['status = ?', "updated_at = datetime('now')"];
    const values = [newStatus];
    const timeField = STATUS_TIME_FIELD[newStatus];
    if (timeField) {
      setClauses.push(`${timeField} = datetime('now')`);
    }
    for (const [k, v] of Object.entries(extraFields)) {
      setClauses.push(`${k} = ?`);
      values.push(v);
    }
    values.push(id);
    db.prepare(`UPDATE orders SET ${setClauses.join(', ')} WHERE id = ?`).run(
      ...values,
    );
    return getOrder(db, id);
  });
  return tx();
}

/**
 * 이체 신고 — TRANSFER_REPORTED 전이 + 이체 정보 일괄 기록.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} id
 * @param {object} info — depositor_name · bank · custom_bank? · use_other_name? · other_name? · amount
 */
export function updateTransferInfo(db, id, info) {
  db.prepare(
    `UPDATE orders SET
       depositor_name = ?, bank = ?, custom_bank = ?,
       use_other_name = ?, other_name = ?, amount = ?,
       status = 'TRANSFER_REPORTED', transferred_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    info.depositor_name,
    info.bank,
    info.custom_bank ?? null,
    info.use_other_name ? 1 : 0,
    info.other_name ?? null,
    info.amount,
    id,
  );
  return getOrder(db, id);
}
