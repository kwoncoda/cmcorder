// P1-6 (Codex 리뷰) — CSRF 토큰 미들웨어.
//
// 책임:
//   - 세션 기반 토큰 발급 + 검증 (session.csrfToken).
//   - mutation (POST/PUT/PATCH/DELETE)에 X-CSRF-Token 헤더 강제.
//   - GET·HEAD·OPTIONS는 검증 X (안전한 메서드).
//   - /admin/login 자체는 PIN 검증이라 CSRF 제외.
//
// 정책:
//   - 단발 운영(2일) + 동시 운영자 1명. 토큰 1세션 1개로 충분.
//   - SameSite=Lax 쿠키 + Helmet 헤더와 결합해 다중 방어.
//
// 사용 (server/app.js):
//   app.use(adminRoutes(db));  // 내부 /admin/api에 csrf 적용
import crypto from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 세션에 토큰이 없으면 생성 후 반환. 있으면 그대로 반환.
 */
export function ensureCsrfToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * 토큰 발급 핸들러 — GET /admin/api/csrf-token.
 */
export function csrfTokenHandler(req, res) {
  const token = ensureCsrfToken(req);
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '세션이 필요합니다.' });
  }
  return res.json({ token });
}

/**
 * mutation 검증 미들웨어 — req.session.csrfToken === X-CSRF-Token 검증.
 */
export function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const headerToken = req.get('x-csrf-token');
  const sessionToken = req.session?.csrfToken;
  if (!headerToken || !sessionToken) {
    return res.status(403).json({
      error: 'CSRF_INVALID',
      message: 'CSRF 토큰이 누락되었습니다.',
    });
  }
  // 길이 다르면 timingSafeEqual throw — 가드.
  if (headerToken.length !== sessionToken.length) {
    return res.status(403).json({ error: 'CSRF_INVALID', message: 'CSRF 토큰이 일치하지 않습니다.' });
  }
  try {
    const ok = crypto.timingSafeEqual(
      Buffer.from(headerToken),
      Buffer.from(sessionToken),
    );
    if (!ok) {
      return res.status(403).json({ error: 'CSRF_INVALID', message: 'CSRF 토큰이 일치하지 않습니다.' });
    }
    return next();
  } catch {
    return res.status(403).json({ error: 'CSRF_INVALID', message: 'CSRF 토큰 검증 실패.' });
  }
}
