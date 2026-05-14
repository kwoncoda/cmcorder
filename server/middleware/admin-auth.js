// Task 6.8 — 관리자 세션 가드.
//
// 세션 인프라(express-session)는 Task 6.7에서 결합. 본 미들웨어는 req.session 의존만 한다.

/**
 * 관리자 로그인 필수 — req.session.adminId 없으면 401.
 */
export function requireAdmin(req, res, next) {
  if (!req.session?.adminId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: '로그인이 필요합니다.',
    });
  }
  return next();
}
