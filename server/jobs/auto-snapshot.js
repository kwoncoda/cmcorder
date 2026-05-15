// Task 6.9 — 자동 ZIP 스냅샷 (ADR-022 변경 — 30분 → 2시간, 6개 회전).
//
// 책임:
//   - createSnapshotZip: SQLite DB → ZIP 파일로 압축 (file system)
//   - createSettlementZip: SQLite dump + summary.json → ZIP Buffer (HTTP 응답용)
//   - startAutoSnapshot: setInterval 2시간 + 6개 회전 cleanup
//
// 동작 세부:
//   - better-sqlite3는 동기 — 트랜잭션 시점 일관성
//   - WAL checkpoint(TRUNCATE)로 main DB에 모든 변경 flush
//   - 회전: 최신 N개 유지, 오래된 것 unlinkSync
//   - 즉시 1회 실행 X — startup 부담 회피 (첫 tick은 intervalMs 후)
import {
  createWriteStream,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { logger } from '../lib/logger.js';

const DEFAULT_INTERVAL_MS =
  (Number(process.env.AUTO_SNAPSHOT_INTERVAL_MIN) || 120) * 60 * 1000;
const DEFAULT_MAX_BACKUPS =
  Number(process.env.AUTO_SNAPSHOT_ROTATE) || 6;
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR ?? './backups';

/**
 * DB를 ZIP 파일로 압축. dbPath 존재 시 raw 파일 포함,
 * 부재 시 :memory: DB 대비 .sql dump 생성.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} dbPath
 * @param {string} outputPath
 * @returns {Promise<string>} 생성된 ZIP 경로
 */
export async function createSnapshotZip(db, dbPath, outputPath) {
  const dir = path.dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // WAL checkpoint → main DB로 flush (스냅샷 일관성)
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    // :memory: DB는 WAL 미지원 — 무시
    logger.debug({ err: err.message }, '[auto-snapshot] WAL checkpoint skip');
  }

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve(outputPath));
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    if (existsSync(dbPath)) {
      archive.file(dbPath, { name: 'order.sqlite' });
    } else {
      // :memory: DB 또는 dbPath 부재 — .sql dump
      const dump = serializeDb(db);
      archive.append(dump, { name: 'order.sql' });
    }
    archive.finalize();
  });
}

/**
 * 정산용 ZIP — Buffer 즉시 반환 (HTTP 응답 다운로드).
 *
 * P1-1 (Codex v3 2026-05-15): ADR-016/F-A-034 요구 구성물 보강.
 *   - manifest.json: 운영 일자/생성 시각/파일 목록 (회계 자료 식별)
 *   - orders.csv: 운영자/회계용 (Excel 호환 UTF-8 BOM)
 *   - coupons.csv: 학번·이름·시각·주문 매핑
 *   - menu-snapshot.json: 메뉴 8개 시드 상태 (가격/품절/추천)
 *   - settlement.sql: 전체 dump (기존)
 *   - summary.json: 집계 (기존)
 *
 * PDF/images는 별도 트랙 (자산 부재 — 운영 폴더 별도 보관).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {Promise<Buffer>}
 */
export async function createSettlementZip(db) {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    const summary = exportSummary(db);
    const filesIncluded = [
      'manifest.json',
      'summary.json',
      'orders.csv',
      'coupons.csv',
      'menu-snapshot.json',
      'settlement.sql',
    ];
    const manifest = {
      generated_at: new Date().toISOString(),
      operating_date: summary.operating_date,
      files: filesIncluded,
      adr: ['ADR-016', 'ADR-022', 'ADR-027 — PII 폐기 절차 참조'],
      note: 'PDF / images 자산은 운영 폴더 별도 보관. PII는 D+7일 수동 폐기 (docs/operations/pii-deletion.md).',
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(JSON.stringify(summary, null, 2), { name: 'summary.json' });
    archive.append(exportOrdersCsv(db), { name: 'orders.csv' });
    archive.append(exportCouponsCsv(db), { name: 'coupons.csv' });
    archive.append(exportMenuSnapshot(db), { name: 'menu-snapshot.json' });
    archive.append(serializeDb(db), { name: 'settlement.sql' });
    archive.finalize();
  });
}

// ── P1-1 helpers ─────────────────────────────────────────────────
// Excel 한글 호환 — UTF-8 BOM 선두 부착.
const UTF8_BOM = '﻿';

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers, rows) {
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')).join('\n');
  return `${UTF8_BOM}${head}\n${body}\n`;
}

function exportOrdersCsv(db) {
  const headers = [
    'id', 'no', 'operating_date', 'status', 'name', 'student_id', 'is_external',
    'delivery_type', 'table_no', 'total_price', 'depositor_name', 'bank',
    'amount', 'created_at', 'transferred_at', 'paid_at', 'cooking_at',
    'ready_at', 'done_at',
  ];
  const rows = db.prepare(`SELECT ${headers.join(', ')} FROM orders ORDER BY operating_date, no`).all();
  return rowsToCsv(headers, rows);
}

function exportCouponsCsv(db) {
  const headers = ['id', 'student_id', 'name', 'order_id', 'used_at'];
  const rows = db.prepare(`SELECT ${headers.join(', ')} FROM used_coupons ORDER BY id`).all();
  return rowsToCsv(headers, rows);
}

function exportMenuSnapshot(db) {
  const menus = db
    .prepare('SELECT id, code, name, category, base_price, sold_out, recommended FROM menus ORDER BY id')
    .all();
  return JSON.stringify({ generated_at: new Date().toISOString(), menus }, null, 2);
}

/**
 * SQLite .dump 시뮬레이션 — 모든 사용자 테이블 INSERT문 export.
 */
function serializeDb(db) {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  let sql = '';
  for (const { name } of tables) {
    sql += `-- ${name}\n`;
    const rows = db.prepare(`SELECT * FROM ${name}`).all();
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = Object.values(row).map((v) => {
        if (v === null) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${name} (${cols.join(',')}) VALUES (${vals.join(',')});\n`;
    }
  }
  return sql;
}

/**
 * 정산 요약 — summary.json 생성용.
 */
function exportSummary(db) {
  return {
    operating_date: db
      .prepare('SELECT operating_date FROM business_state WHERE id=1')
      .get()?.operating_date,
    total_orders: db
      .prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'DONE'")
      .get().c,
    total_amount: db
      .prepare(
        "SELECT COALESCE(SUM(total_price), 0) AS s FROM orders WHERE status = 'DONE'",
      )
      .get().s,
    generated_at: new Date().toISOString(),
  };
}

/**
 * 자동 스냅샷 시작 — setInterval (운영 환경 server.js에서 호출).
 * - 회전: 최신 maxBackups 개 유지, 나머지 삭제
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} [opts]
 * @param {string} [opts.dbPath]
 * @param {number} [opts.intervalMs]
 * @param {string} [opts.dir]
 * @param {number} [opts.maxBackups]
 * @returns {() => void} cleanup 함수
 */
export function startAutoSnapshot(
  db,
  {
    dbPath,
    intervalMs = DEFAULT_INTERVAL_MS,
    dir = DEFAULT_BACKUP_DIR,
    maxBackups = DEFAULT_MAX_BACKUPS,
  } = {},
) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tick = async () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(dir, `auto-${ts}.zip`);
    try {
      await createSnapshotZip(db, dbPath, outputPath);
      logger.info({ outputPath }, '[auto-snapshot] 백업 생성');
      rotateBackups(dir, maxBackups);
    } catch (err) {
      logger.error({ err }, '[auto-snapshot] 백업 실패');
    }
  };

  const interval = setInterval(tick, intervalMs);
  return () => clearInterval(interval);
}

/**
 * 회전 — auto-*.zip 중 mtime 기준 최신 maxBackups 개만 유지.
 */
function rotateBackups(dir, maxBackups) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => ({
      f,
      path: path.join(dir, f),
      mtime: statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length > maxBackups) {
    for (const old of files.slice(maxBackups)) {
      try {
        unlinkSync(old.path);
        logger.info({ removed: old.f }, '[auto-snapshot] 오래된 백업 삭제');
      } catch (err) {
        logger.warn({ err, file: old.f }, '[auto-snapshot] 삭제 실패 (무시)');
      }
    }
  }
}
