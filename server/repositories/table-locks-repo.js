// table-locks-repo.js — 테이블 잠금 리포지토리 (table_lock 브랜치 Subagent 1)
//
// reason 컬럼 없음 (Q4 확정 — 단순 잠금/해제 토글).
// UNIQUE(table_no) 이용 UPSERT 패턴.
//
// 내보내는 함수:
//   getLock(db, table_no) → row | null
//   listLocks(db) → row[]
//   lockTable(db, table_no) → void
//   unlockTable(db, table_no) → void

/**
 * 특정 테이블 잠금 행 조회.
 * @param {import('better-sqlite3').Database} db
 * @param {number} table_no
 * @returns {object|null}
 */
export function getLock(db, table_no) {
  return (
    db.prepare('SELECT * FROM table_locks WHERE table_no = ?').get(table_no) ?? null
  );
}

/**
 * 모든 테이블 잠금 행 조회.
 * @param {import('better-sqlite3').Database} db
 * @returns {object[]}
 */
export function listLocks(db) {
  return db.prepare('SELECT * FROM table_locks ORDER BY table_no').all();
}

/**
 * 테이블 잠금 (locked=1). UPSERT — 행 없으면 INSERT, 있으면 UPDATE.
 * table_no BETWEEN 1 AND 15 CHECK는 DB가 강제.
 * @param {import('better-sqlite3').Database} db
 * @param {number} table_no
 */
export function lockTable(db, table_no) {
  db.prepare(
    `INSERT INTO table_locks (table_no, locked, locked_at, updated_at)
       VALUES (?, 1, datetime('now'), datetime('now'))
     ON CONFLICT(table_no) DO UPDATE SET
       locked = 1,
       locked_at = datetime('now'),
       updated_at = datetime('now')`,
  ).run(table_no);
}

/**
 * 테이블 잠금 해제 (locked=0). UPSERT.
 * @param {import('better-sqlite3').Database} db
 * @param {number} table_no
 */
export function unlockTable(db, table_no) {
  db.prepare(
    `INSERT INTO table_locks (table_no, locked, unlocked_at, updated_at)
       VALUES (?, 0, datetime('now'), datetime('now'))
     ON CONFLICT(table_no) DO UPDATE SET
       locked = 0,
       unlocked_at = datetime('now'),
       updated_at = datetime('now')`,
  ).run(table_no);
}
