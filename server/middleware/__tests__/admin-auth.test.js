// Task 6.7/6.8 — admin-auth middleware + loginAdmin 회귀.
// req.session.adminId 없으면 401 UNAUTHORIZED.
// loginAdmin: PIN 일치 → admin.id / 불일치 → null / 시드 X → throw.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { requireAdmin, loginAdmin, sessionMiddleware, buildSessionOptions } from '../admin-auth.js';
import { bootstrapDatabase, hashPin } from '../../db/bootstrap.js';

function makeApp({ session } = {}) {
  const app = express();
  // 세션 stub — 실제 express-session 없이 req.session만 주입
  app.use((req, _res, next) => {
    req.session = session ?? null;
    next();
  });
  app.use('/admin', requireAdmin);
  app.get('/admin/me', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('requireAdmin', () => {
  it('세션 X → 401 UNAUTHORIZED', async () => {
    const app = makeApp({ session: null });
    const res = await request(app).get('/admin/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('세션은 있지만 adminId 없음 → 401', async () => {
    const app = makeApp({ session: {} });
    const res = await request(app).get('/admin/me');
    expect(res.status).toBe(401);
  });

  it('adminId 있으면 통과', async () => {
    const app = makeApp({ session: { adminId: 1 } });
    const res = await request(app).get('/admin/me');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── P0-A (Codex 리뷰 v2) Docker production secure cookie ──────
// 근본 원인: secure: NODE_ENV==='production' 단일 조건은 전송 프로토콜과
// 환경 라벨을 혼동. Docker compose가 NODE_ENV=production + HTTP 로컬 운영
// 시 secure 쿠키가 발송 안 되어 admin 로그인이 실패함.
// 수정: SESSION_COOKIE_SECURE env 명시적 opt-in.
describe('sessionMiddleware — P0-A secure cookie env 분리', () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    // 매 테스트 깨끗한 상태
    delete process.env.NODE_ENV;
    delete process.env.SESSION_COOKIE_SECURE;
    delete process.env.SESSION_SECRET;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function makeAppWithSession() {
    const app = express();
    app.use(sessionMiddleware());
    // 세션 쓰기 트리거 — saveUninitialized=false면 빈 세션은 cookie 안 보냄
    app.get('/touch', (req, res) => {
      req.session.touched = true;
      res.json({ ok: true });
    });
    return app;
  }

  it('★ NODE_ENV=production + SESSION_COOKIE_SECURE 미설정 → HTTP에서 cookie 발송 (secure flag 없음)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'test-secret';
    const res = await request(makeAppWithSession()).get('/touch');
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/chickenedak\.sid/);
    expect(setCookie.toLowerCase()).not.toMatch(/;\s*secure/);
  });

  // express-session은 secure: true + HTTP request 시 Set-Cookie 자체를 안 보내므로
  // supertest로는 secure flag를 직접 검증 불가. buildSessionOptions 직접 검증.
  it('★ SESSION_COOKIE_SECURE=true → 옵션 cookie.secure=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_COOKIE_SECURE = 'true';
    process.env.SESSION_SECRET = 'test-secret';
    const opts = buildSessionOptions();
    expect(opts.cookie.secure).toBe(true);
  });

  it('★ SESSION_COOKIE_SECURE 미설정 → 옵션 cookie.secure=false (env가 production이어도)', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'test-secret';
    const opts = buildSessionOptions();
    expect(opts.cookie.secure).toBe(false);
  });

  it('★ NODE_ENV=development + SESSION_COOKIE_SECURE 미설정 → secure=false (개발 안전 기본)', () => {
    process.env.NODE_ENV = 'development';
    const opts = buildSessionOptions();
    expect(opts.cookie.secure).toBe(false);
  });
});

describe('loginAdmin', () => {
  function seededDb(pin = '111111') {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    db.prepare('INSERT INTO admins (pin_hash) VALUES (?)').run(hashPin(pin));
    return db;
  }

  it('일치 PIN → admin.id 반환', () => {
    const db = seededDb('111111');
    expect(loginAdmin(db, '111111')).toBe(1);
  });

  it('불일치 PIN → null', () => {
    const db = seededDb('111111');
    expect(loginAdmin(db, '000000')).toBeNull();
  });

  it('admins 시드 없음 → throw', () => {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    expect(() => loginAdmin(db, '111111')).toThrow();
  });
});
