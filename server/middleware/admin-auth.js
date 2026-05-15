// Task 6.7/6.8 + P0-A (Codex v2) — 관리자 세션 인프라 + 가드.
//
// express-session 메모리 store (단순 — 단일 부스 환경) + requireAdmin 가드.
//
// 보안:
//   - httpOnly + sameSite=lax (CSRF 완화)
//   - secure 플래그: SESSION_COOKIE_SECURE='true' 명시적 opt-in (HTTPS proxy 가정)
//     * P0-A 사유: NODE_ENV=production + HTTP 로컬 운영 시 secure 쿠키가 발송 안 되어
//       admin 로그인 200이지만 세션 유실. 환경 라벨(NODE_ENV)과 전송 프로토콜(HTTPS)을 분리.
//     * Docker compose는 SESSION_COOKIE_SECURE=false 기본, HTTPS proxy 운영 시 true.
//   - 세션 시크릿: SESSION_SECRET env 우선, fallback은 dev-only 경고
//   - PIN 검증은 verifyPin (timingSafeEqual)
import session from 'express-session';
import { verifyPin } from '../db/bootstrap.js';
import { logger } from '../lib/logger.js';

/**
 * 세션 옵션 빌더 — env 기반 옵션 객체 생성. P0-A 회귀 검증용 별도 export.
 */
export function buildSessionOptions() {
  const secret = process.env.SESSION_SECRET ?? 'dev-secret-change-me';
  if (secret === 'dev-secret-change-me' && process.env.NODE_ENV === 'production') {
    logger.warn('[session] SESSION_SECRET 미설정 — 운영 환경에서 dev fallback 사용 중');
  }
  // P0-A: secure 명시적 opt-in. NODE_ENV와 분리.
  const secureCookie = process.env.SESSION_COOKIE_SECURE === 'true';
  return {
    name: 'chickenedak.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie,
      maxAge: 1000 * 60 * 60 * 12, // 12시간
    },
  };
}

/**
 * express-session 미들웨어 팩토리.
 * - 메모리 store (단일 프로세스, 단발 운영 — 영속성 불필요)
 * - 12시간 maxAge (운영 1일 + 여유)
 */
export function sessionMiddleware() {
  return session(buildSessionOptions());
}

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

/**
 * PIN 검증 — admins 테이블 1행과 verifyPin.
 * - 시드된 관리자가 없으면 throw (운영 셋업 실수)
 * - PIN 일치 시 admin.id 반환, 불일치 시 null
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} pin
 * @returns {number|null}
 */
export function loginAdmin(db, pin) {
  const admin = db.prepare('SELECT id, pin_hash FROM admins LIMIT 1').get();
  if (!admin) {
    throw new Error('관리자가 시드되지 않았습니다.');
  }
  return verifyPin(pin, admin.pin_hash) ? admin.id : null;
}
