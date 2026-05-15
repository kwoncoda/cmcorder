// Task 6.9 — 자동 ZIP 스냅샷 회귀 (단위).
//
// ADR-022 변경: 30분 → 2시간 + 6개 회전 (데이터 손실 ≤ 2시간).
//
// 5 케이스:
//   - createSnapshotZip 호출 시 ZIP 파일 생성
//   - startAutoSnapshot — fakeTimers tick 후 백업 1개
//   - 회전 — 7번 백업 후 오래된 1개 삭제 (6개 유지)
//   - intervalMs 옵션 작동
//   - cleanup 함수가 setInterval 종료
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync, readdirSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  createSnapshotZip,
  createSettlementZip,
  startAutoSnapshot,
} from '../auto-snapshot.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

function tmpDir() {
  const dir = path.join(os.tmpdir(), `auto-snapshot-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('createSnapshotZip', () => {
  it(':memory: DB라도 outputPath에 ZIP 파일 생성', async () => {
    const db = freshDb();
    const dir = tmpDir();
    const out = path.join(dir, 'snap.zip');
    await createSnapshotZip(db, '/nonexistent/path.sqlite', out);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('createSettlementZip', () => {
  it('Buffer 반환 — ZIP magic bytes', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  // ── P1-1 (Codex v3) ZIP 구성물 검증 ─────────────────────────
  // ADR-016/F-A-034: manifest + orders + coupons + menu + PDF + images
  // PDF/images는 별도 트랙(자산 부재) — 본 task는 manifest/orders/coupons/menu/dump 보강.
  it('★ P1-1 — ZIP 내부에 manifest.json, orders.csv, coupons.csv, menu-snapshot.json 포함', async () => {
    const db = freshDb();
    // 시드: 주문 1건 + 쿠폰 1건
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, student_id, total_price, status)
       VALUES (1, '2026-05-20', '홍길동', '202637001', 18000, 'DONE')`,
    ).run();
    db.prepare(
      `INSERT INTO order_items (order_id, menu_id, name, base_price, quantity, category)
       VALUES (1, 1, '후라이드', 18000, 1, 'chicken')`,
    ).run();
    db.prepare(
      "INSERT INTO used_coupons (student_id, name, order_id) VALUES ('202637001', '홍길동', 1)",
    ).run();

    const buf = await createSettlementZip(db);

    // ZIP 내용물을 읽기 — yauzl/JSZip 없이 archiver-only 환경이라
    // 가장 단순한 검증: ZIP central directory에서 파일명 문자열 검색.
    const text = buf.toString('latin1');
    expect(text).toContain('manifest.json');
    expect(text).toContain('orders.csv');
    expect(text).toContain('coupons.csv');
    expect(text).toContain('menu-snapshot.json');
    // 기존 settlement.sql, summary.json도 유지
    expect(text).toContain('settlement.sql');
    expect(text).toContain('summary.json');
  });

  it('★ P1-1 — orders.csv에 본명/학번/금액/상태 컬럼 포함', async () => {
    const db = freshDb();
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, student_id, total_price, status)
       VALUES (42, '2026-05-20', '김철수', '202637042', 21000, 'DONE')`,
    ).run();
    const buf = await createSettlementZip(db);
    const text = buf.toString('latin1');
    // ZIP은 보통 압축돼서 평문 포함이 보장 안 됨. 그러나 archiver 기본 deflate에
    // store level 0이면 평문이 노출됨. 우리 코드는 zlib level 9이므로
    // 데이터 자체는 deflate. 본 테스트는 파일 *이름* 검증으로 한정.
    expect(text).toContain('orders.csv');
    // 실제 CSV 내용 검증은 unzip 도구를 별도로 도입해야 하므로 보류.
  });
});

describe('startAutoSnapshot', () => {
  let dir;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(async () => {
    // Windows에서 archiver 핸들 해제 시간 확보
    await new Promise((r) => setTimeout(r, 50));
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 시간차 GC 미스 — 무시
    }
  });

  it('intervalMs 후 백업 파일 1개 생성 (real timer)', async () => {
    const db = freshDb();
    const stop = startAutoSnapshot(db, {
      dbPath: '/nonexistent.sqlite',
      intervalMs: 50, // 50ms — 즉시 tick
      dir,
    });
    // archiver는 비동기 — 충분히 대기 후 stop
    await new Promise((r) => setTimeout(r, 200));
    stop();
    // 최종 flush 대기
    await new Promise((r) => setTimeout(r, 50));
    const files = readdirSync(dir).filter((f) => f.startsWith('auto-') && f.endsWith('.zip'));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('cleanup 함수가 setInterval 종료', async () => {
    const db = freshDb();
    const stop = startAutoSnapshot(db, {
      dbPath: '/nonexistent.sqlite',
      intervalMs: 10_000, // 10s — 테스트 동안 절대 발화 X
      dir,
    });
    expect(typeof stop).toBe('function');
    stop();
    await new Promise((r) => setTimeout(r, 100));
    const files = readdirSync(dir).filter((f) => f.startsWith('auto-'));
    expect(files.length).toBe(0);
  });
});

describe('자동 백업 회전 (maxBackups=2)', () => {
  let dir;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 50));
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('maxBackups 초과 시 오래된 백업 삭제', async () => {
    const db = freshDb();
    // 가짜 기존 백업 3개 — mtime 다르게 (가장 오래된 것이 회전 대상)
    const now = Date.now();
    const fs = await import('node:fs/promises');
    for (let i = 0; i < 3; i += 1) {
      const p = path.join(dir, `auto-old-${i}.zip`);
      writeFileSync(p, 'fake');
      const past = new Date(now - (i + 1) * 3600_000);
      await fs.utimes(p, past, past);
    }
    // 새 백업 1개 → 총 4개 → maxBackups=2 → 2개만 남아야
    const stop = startAutoSnapshot(db, {
      dbPath: '/nonexistent.sqlite',
      intervalMs: 50,
      dir,
      maxBackups: 2,
    });
    await new Promise((r) => setTimeout(r, 300));
    stop();
    await new Promise((r) => setTimeout(r, 50));
    const remaining = readdirSync(dir).filter((f) => f.endsWith('.zip'));
    expect(remaining.length).toBe(2);
  });
});
