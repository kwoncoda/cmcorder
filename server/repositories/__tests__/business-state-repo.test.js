// Task 6.5 — business-state-repo 회귀.
// 단일 행 강제 (CHECK id=1) + 도메인 wrapper.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  getCurrentState,
  openBusinessDay,
  closeBusinessDay,
} from '../business-state-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

describe('business-state-repo', () => {
  let db;
  beforeEach(() => {
    db = freshDb();
  });

  it('getCurrentState — 첫 부팅 시 CLOSED', () => {
    const s = getCurrentState(db);
    expect(s.status).toBe('CLOSED');
    expect(s.operating_date).toBeTruthy();
  });

  it('openBusinessDay — CLOSED → OPEN 전이', () => {
    const opened = openBusinessDay(db, { operating_date: '2026-05-20' });
    expect(opened.status).toBe('OPEN');
    expect(opened.operating_date).toBe('2026-05-20');
  });

  it('openBusinessDay — 멱등 (이미 OPEN이면 그대로)', () => {
    openBusinessDay(db, { operating_date: '2026-05-20' });
    const again = openBusinessDay(db, { operating_date: '2026-05-21' });
    expect(again.status).toBe('OPEN');
    // 멱등 보장 — operating_date 보존
    expect(again.operating_date).toBe('2026-05-20');
  });

  it('closeBusinessDay — OPEN → CLOSED', () => {
    openBusinessDay(db, { operating_date: '2026-05-20' });
    const closed = closeBusinessDay(db);
    expect(closed.status).toBe('CLOSED');
  });

  it('단일 행 보장 — INSERT 추가 시 CHECK 위반', () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO business_state (id, status, operating_date) VALUES (2, 'OPEN', '2026-05-20')",
        )
        .run(),
    ).toThrow();
  });
});
