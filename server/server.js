// 백엔드 부팅 엔트리.
// - dotenv/config: .env 자동 로드 (PORT, LOG_LEVEL, DEFAULT_ADMIN_PIN, DB_PATH 등).
// - DB 초기화(Task 6.1): openDatabase → bootstrapDatabase(init.sql) → seedAdmin.
// - Task 6.9: startAutoSnapshot — 2시간마다 ZIP 백업 (회전 6개).
// - listen + graceful shutdown(SIGTERM/SIGINT) — Docker compose stop 시 정상 종료.
import 'dotenv/config';
import { createApp } from './app.js';
import { openDatabase } from './db/connection.js';
import { bootstrapDatabase, seedAdmin } from './db/bootstrap.js';
import { startAutoSnapshot } from './jobs/auto-snapshot.js';
import { logger } from './lib/logger.js';

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? './data/order.sqlite';
// P0-1 (Codex 리뷰) — SPA 정적 서빙. Docker에서 frontend-build dist를 /app/dist로 복사.
const DIST_PATH = process.env.DIST_PATH ?? './dist';
// P1-2 (Codex v3 리뷰) — 자동 백업 Docker named volume 영속화.
// docker-compose.yml의 BACKUP_DIR=/data/backups가 named volume(chickenedak-data) 안쪽.
// 컨테이너 재생성/이미지 재빌드에도 백업 보존.
const BACKUP_DIR = process.env.BACKUP_DIR ?? './backups';

// DB 초기화 — 신규 DB면 init.sql 실행, 어드민 PIN 시드.
const db = openDatabase(DB_PATH);
bootstrapDatabase(db);
seedAdmin(db);

const app = createApp({ db, distPath: DIST_PATH });

// 자동 ZIP 백업 — 2시간 + 6개 회전 (ADR-022 변경). 테스트 환경에서는 disable.
const snapshotStop =
  process.env.NODE_ENV === 'test'
    ? () => {}
    : startAutoSnapshot(db, { dbPath: DB_PATH, dir: BACKUP_DIR });

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `[server] 치킨이닭 백엔드 가동 — http://localhost:${PORT}`);
});

// graceful shutdown — 10초 안에 server.close 완료 못 하면 강제 종료.
const shutdown = (signal) => {
  logger.info({ signal }, '[server] 종료 신호 수신 — graceful shutdown');
  snapshotStop();
  server.close(() => {
    try {
      db.close();
      logger.info('[server] DB 핸들 종료');
    } catch (err) {
      logger.warn({ err }, '[server] DB close 실패 (무시)');
    }
    logger.info('[server] HTTP 서버 종료 완료');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('[server] 강제 종료 (10s timeout)');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
