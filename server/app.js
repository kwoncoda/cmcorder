// Express 앱 팩토리 — 테스트는 listen 없이 인스턴스만 만들어 supertest에 전달.
// 실제 listen은 server.js가 담당하며 createApp은 부수효과(포트 점유, 시그널 핸들러) X.
//
// 이번 Task(0.5)는 부트스트랩만: /healthz · 404 fallback · 글로벌 에러 핸들러 3종.
// API 라우트(/api/menus 등)는 Phase 6에서 추가된다.
//
// Task 6.1: db 옵션 추가 — server.js가 better-sqlite3 핸들을 주입하면
// 라우트에서 req.app.locals.db로 접근. 테스트(supertest)는 db 없이 호출 가능.
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger.js';

export function createApp({ db } = {}) {
  const app = express();
  app.locals.db = db;

  // 보안 헤더. CSP는 Phase 6 SPA 정적 호스팅 시 dist 경로·인라인 정책 함께 결정.
  app.use(helmet({ contentSecurityPolicy: false }));

  // 요청 로깅. /healthz는 부스 모니터링용으로 자주 호출되므로 autoLogging에서 제외.
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/healthz',
      },
    }),
  );

  // 64KB 상한 — 주문/메뉴 payload는 모두 수십~수백 바이트.
  app.use(express.json({ limit: '64kb' }));

  // 헬스체크 — DB·외부 의존 없이 프로세스 살아있음만 확인.
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // 404 fallback — 등록되지 않은 모든 경로.
  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', path: req.path });
  });

  // 전역 에러 핸들러 — Phase 6에서 도메인 에러 코드별 분기 확장.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error({ err }, '미처리 에러');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });

  return app;
}
