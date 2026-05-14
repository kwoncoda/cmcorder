// Express 앱 팩토리 — 테스트는 listen 없이 인스턴스만 만들어 supertest에 전달.
// 실제 listen은 server.js가 담당하며 createApp은 부수효과(포트 점유, 시그널 핸들러) X.
//
// Task 6.5/6.6/6.8 결합:
//   - businessStateGuard (사용자 POST 423)
//   - customerRoutes (12 엔드포인트 중 6개)
//   - errorHandler (도메인 에러 → HTTP 상태)
//
// 옵션:
//   - db: 주입 시 사용자/관리자 API 마운트 / 부재 시 부트스트랩만.
//   - distPath: 주입 시 SPA 정적 서빙 + 비 API GET fallback. 부재 시 404 유지.
//     (P0-1 Codex 리뷰 — Docker 컨테이너에서 /menu 등 SPA 경로 접근)
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { logger } from './lib/logger.js';
import { businessStateGuard } from './middleware/business-state.js';
import { sessionMiddleware } from './middleware/admin-auth.js';
import { errorHandler } from './middleware/error.js';
import { customerRoutes } from './routes/customer.js';
import { adminRoutes } from './routes/admin.js';

// SPA fallback 제외 prefix — JSON API/헬스체크는 항상 JSON 응답 유지.
const API_PREFIXES = ['/api/', '/admin/api/', '/admin/login', '/admin/logout', '/healthz'];

function isApiPath(p) {
  return API_PREFIXES.some((pref) => p === pref.replace(/\/$/, '') || p.startsWith(pref));
}

export function createApp({ db, distPath } = {}) {
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

  // 관리자 세션 — /admin/login + 모든 /admin/api/* 보호 가드의 전제.
  app.use(sessionMiddleware());

  // 헬스체크 — DB·외부 의존 없이 프로세스 살아있음만 확인.
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // DB 주입 시에만 영업 가드 + 라우트 활성화.
  if (db) {
    app.use(businessStateGuard(db));
    app.use(customerRoutes(db));
    app.use(adminRoutes(db));
  }

  // SPA 정적 서빙 — distPath 주입 + 디렉토리 존재 시.
  // /assets, /favicon.ico 같은 직접 파일 요청은 express.static이 우선 처리.
  // 그 다음 비-API GET 요청은 index.html로 fallback (React Router 처리).
  const resolvedDist = distPath ? path.resolve(distPath) : null;
  if (resolvedDist && existsSync(resolvedDist)) {
    const indexHtml = path.join(resolvedDist, 'index.html');
    app.use(express.static(resolvedDist, { index: false, fallthrough: true }));
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET') return next();
      if (isApiPath(req.path)) return next();
      if (!existsSync(indexHtml)) return next();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexHtml);
    });
  }

  // 404 fallback — 등록되지 않은 모든 경로.
  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', path: req.path });
  });

  // 전역 에러 핸들러 — 도메인 에러를 HTTP 상태로 매핑.
  app.use(errorHandler);

  return app;
}
