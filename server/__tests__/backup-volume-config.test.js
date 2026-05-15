// P1-2 (Codex v3 2026-05-15) — 자동 백업 Docker volume 경로 회귀.
//
// 문제:
//   - ADR-022/023: db·backups·images·logs를 named volume에 영속화.
//   - docker-compose.yml은 /data만 volume 마운트, BACKUP_DIR 환경변수 없음.
//   - auto-snapshot 기본 ./backups → 컨테이너 내부 임시 경로 → 재생성 시 손실.
//
// 회귀:
//   1) docker-compose.yml에 BACKUP_DIR=/data/backups 환경변수 명시
//   2) auto-snapshot이 dir 옵션을 받으면 해당 디렉터리에 ZIP 생성
//   3) server.js가 BACKUP_DIR을 startAutoSnapshot에 전달 (코드 grep)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../db/bootstrap.js';
import { startAutoSnapshot } from '../jobs/auto-snapshot.js';

describe('P1-2 — docker-compose.yml backup volume 설정', () => {
  const composeYml = readFileSync(
    path.resolve(process.cwd(), 'docker-compose.yml'),
    'utf-8',
  );

  it('★ BACKUP_DIR=/data/backups 환경변수 명시', () => {
    expect(composeYml).toMatch(/BACKUP_DIR:\s*["']?\/data\/backups["']?/);
  });

  it('★ /data named volume 마운트 (이미 존재)', () => {
    expect(composeYml).toMatch(/chickenedak-data:\/data/);
  });

  it('★ DB_PATH도 /data 내부 (named volume 안)', () => {
    expect(composeYml).toMatch(/DB_PATH:\s*\/data\/order\.sqlite/);
  });
});

describe('P1-2 — server.js에서 BACKUP_DIR 명시 전달', () => {
  const serverJs = readFileSync(
    path.resolve(process.cwd(), 'server/server.js'),
    'utf-8',
  );

  it('★ server.js가 BACKUP_DIR env를 읽어 startAutoSnapshot에 dir로 전달', () => {
    expect(serverJs).toMatch(/BACKUP_DIR/);
    expect(serverJs).toMatch(/startAutoSnapshot\([^)]*dir/s);
  });
});

describe('P1-2 — startAutoSnapshot이 dir 옵션 경로에 ZIP 생성', () => {
  it('★ dir 옵션 경로에 auto-*.zip 생성', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'p1-2-'));
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    try {
      const stop = startAutoSnapshot(db, {
        dbPath: '',
        dir,
        intervalMs: 50,
        maxBackups: 6,
      });
      // intervalMs=50 후 첫 tick 발생까지 대기.
      await new Promise((r) => setTimeout(r, 200));
      stop();
      const files = readdirSync(dir).filter((f) => f.endsWith('.zip'));
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/^auto-/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      db.close();
    }
  });
});
