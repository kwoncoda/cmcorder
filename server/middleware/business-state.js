// Task 6.8 — 영업 외 가드 middleware.
//
// 정책:
//   - 사용자 GET: 항상 통과 (조회는 영업 외에도 허용 — /closed 안내 페이지 등)
//   - 사용자 POST/PUT/DELETE: CLOSED 시 423 BUSINESS_CLOSED
//   - /admin/* 모든 메서드: 통과 (관리자는 영업 외에도 작업)
import { getBusinessState } from '../domain/business-state.js';

/**
 * 영업 상태 가드 factory.
 * @param {import('better-sqlite3').Database} db
 */
export function businessStateGuard(db) {
  return function businessStateMiddleware(req, res, next) {
    // /admin/* 통과
    if (req.path.startsWith('/admin')) return next();
    // GET 통과 — 조회는 항상 허용
    if (req.method === 'GET') return next();

    const state = getBusinessState(db);
    if (state.status !== 'OPEN') {
      return res.status(423).json({
        error: 'BUSINESS_CLOSED',
        message: '영업이 종료되어 요청을 처리할 수 없습니다.',
      });
    }
    return next();
  };
}
