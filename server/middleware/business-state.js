// Task 6.8 + 충돌-3 (Codex v2) — 영업 외 가드 middleware.
//
// 정책 (API_DRAFT.md §1.12 + FEATURE_LIST F-S-015 정합):
//   - /admin/* 모든 메서드: 통과 (관리자는 영업 외에도 작업)
//   - 사용자 POST/PUT/DELETE: CLOSED 시 423 BUSINESS_CLOSED
//   - 사용자 GET: CLOSED 시 302 redirect → /closed
//   - 단, 다음 GET 예외는 통과:
//       /closed                 — 자기 자신 무한 루프 방지
//       /healthz                — 모니터링
//       /api/business-state     — 사용자가 영업 상태 알아야 함 (SPA sync 진입점)
//       /assets/*               — Vite 해시 자산
//       /favicon.ico, /robots.txt — 단일 정적 자산
//       *.{png,jpg,webp,gif,svg,ico,css,js,map,woff,woff2,ttf,eot,webmanifest}
//                               — 일반 정적 자산 확장자 (2026-05-17 front_closed_design)
//                                 — /closed 페이지가 마스코트/웹로고/Tailwind CSS 등 로드 필요.
//                                   SPA 라우트는 확장자가 없으므로 충돌 위험 없음.
//
// SPA layout(P0-5)는 *이중 가드*로 유지 — 서버 redirect + SPA store sync.
import { getBusinessState } from '../domain/business-state.js';

const GET_PASSTHROUGH_PATHS = new Set(['/closed', '/healthz', '/api/business-state', '/api/tables/availability']);
const GET_PASSTHROUGH_PREFIXES = ['/assets/'];
const GET_PASSTHROUGH_EXACTS = new Set(['/favicon.ico', '/robots.txt']);
const STATIC_ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|ico|css|js|map|woff2?|ttf|eot|webmanifest)$/i;

function isGetPassthrough(path) {
  if (GET_PASSTHROUGH_PATHS.has(path)) return true;
  if (GET_PASSTHROUGH_EXACTS.has(path)) return true;
  if (GET_PASSTHROUGH_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (STATIC_ASSET_EXT.test(path)) return true;
  return false;
}

/**
 * 영업 상태 가드 factory.
 * @param {import('better-sqlite3').Database} db
 */
export function businessStateGuard(db) {
  return function businessStateMiddleware(req, res, next) {
    // /admin/* 통과 (모든 메서드)
    if (req.path.startsWith('/admin')) return next();

    const state = getBusinessState(db);
    if (state.status === 'OPEN') return next();

    // CLOSED 처리.
    if (req.method === 'GET') {
      if (isGetPassthrough(req.path)) return next();
      // 사용자 GET — /closed redirect.
      return res.redirect(302, '/closed');
    }

    // 사용자 POST/PUT/DELETE — 423.
    return res.status(423).json({
      error: 'BUSINESS_CLOSED',
      message: '영업이 종료되어 요청을 처리할 수 없습니다.',
    });
  };
}
