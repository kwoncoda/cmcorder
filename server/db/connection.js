// SQLite 연결 helper — better-sqlite3 동기 API.
// - DB_PATH env (없으면 ./data/order.sqlite). 디렉토리 없으면 생성.
// - WAL 모드 + foreign_keys ON (FK CASCADE 동작).
// - 호출자 책임: 종료 시 db.close() (Phase 6 후속에서 graceful shutdown 통합).
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export function openDatabase(dbPath = process.env.DB_PATH ?? './data/order.sqlite') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
