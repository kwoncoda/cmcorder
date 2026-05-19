// table-locks-repo.test.js — TDD (table_lock 브랜치 Subagent 1)
// table_locks 리포지토리 단위 테스트.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  getLock,
  listLocks,
  lockTable,
  unlockTable,
} from '../table-locks-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

describe('table-locks-repo', () => {
  let db;
  beforeEach(() => {
    db = freshDb();
  });

  it('getLock — 행 없으면 null 반환', () => {
    expect(getLock(db, 5)).toBeNull();
  });

  it('lockTable — 잠금 시 locked=1, locked_at 설정', () => {
    lockTable(db, 5);
    const row = getLock(db, 5);
    expect(row).not.toBeNull();
    expect(row.locked).toBe(1);
    expect(row.locked_at).toBeTruthy();
    expect(row.table_no).toBe(5);
  });

  it('lockTable — 중복 호출 시 locked 유지, locked_at 갱신 (멱등)', () => {
    lockTable(db, 5);
    const first = getLock(db, 5);
    lockTable(db, 5);
    const second = getLock(db, 5);
    expect(second.locked).toBe(1);
    // locked_at이 갱신됐거나 동일 — 행 1개만 있어야 함
    const count = db.prepare('SELECT COUNT(*) AS c FROM table_locks WHERE table_no = 5').get().c;
    expect(count).toBe(1);
  });

  it('unlockTable — 잠금 해제 시 locked=0, unlocked_at 설정', () => {
    lockTable(db, 5);
    unlockTable(db, 5);
    const row = getLock(db, 5);
    expect(row.locked).toBe(0);
    expect(row.unlocked_at).toBeTruthy();
  });

  it('listLocks — 복수 잠금 후 전체 조회', () => {
    lockTable(db, 3);
    lockTable(db, 7);
    lockTable(db, 12);
    const locks = listLocks(db);
    expect(locks.length).toBe(3);
    const tableNos = locks.map((r) => r.table_no).sort((a, b) => a - b);
    expect(tableNos).toEqual([3, 7, 12]);
  });

  it('lockTable(db, 0) — CHECK 위반 → 에러', () => {
    expect(() => lockTable(db, 0)).toThrow();
  });

  it('lockTable(db, 16) — CHECK 위반 → 에러', () => {
    expect(() => lockTable(db, 16)).toThrow();
  });

  it('PRAGMA 회귀 — reason 컬럼 없음 (Q4 확정)', () => {
    // table_locks 테이블에 reason 컬럼이 없어야 한다.
    const cols = db.prepare('PRAGMA table_info(table_locks)').all();
    const names = cols.map((c) => c.name);
    expect(names).not.toContain('reason');
  });
});
