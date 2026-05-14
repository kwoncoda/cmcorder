// 백엔드 부팅 엔트리.
// - dotenv/config: .env 자동 로드 (PORT, LOG_LEVEL 등).
// - listen + graceful shutdown(SIGTERM/SIGINT) — Docker compose stop 시 정상 종료.
// - 부트스트랩 단계라 DB 핸들·SSE 클라이언트 정리는 Phase 6에서 추가.
import 'dotenv/config';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `[server] 치킨이닭 백엔드 가동 — http://localhost:${PORT}`);
});

// graceful shutdown — 10초 안에 server.close 완료 못 하면 강제 종료.
const shutdown = (signal) => {
  logger.info({ signal }, '[server] 종료 신호 수신 — graceful shutdown');
  server.close(() => {
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
