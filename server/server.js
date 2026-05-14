// 백엔드 부팅 엔트리.
// - dotenv/config: .env 자동 로드 (PORT, LOG_LEVEL, DEFAULT_ADMIN_PIN, DB_PATH 등).
// - DB 초기화(Task 6.1): openDatabase → bootstrapDatabase(init.sql) → seedAdmin.
// - listen + graceful shutdown(SIGTERM/SIGINT) — Docker compose stop 시 정상 종료.
import 'dotenv/config';
import { createApp } from './app.js';
import { openDatabase } from './db/connection.js';
import { bootstrapDatabase, seedAdmin } from './db/bootstrap.js';
import { logger } from './lib/logger.js';

const PORT = Number(process.env.PORT ?? 3000);

// DB 초기화 — 신규 DB면 init.sql 실행, 어드민 PIN 시드.
const db = openDatabase();
bootstrapDatabase(db);
seedAdmin(db);

const app = createApp({ db });

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `[server] 치킨이닭 백엔드 가동 — http://localhost:${PORT}`);
});

// graceful shutdown — 10초 안에 server.close 완료 못 하면 강제 종료.
const shutdown = (signal) => {
  logger.info({ signal }, '[server] 종료 신호 수신 — graceful shutdown');
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
