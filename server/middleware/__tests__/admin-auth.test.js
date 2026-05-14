// Task 6.8 — admin-auth middleware 회귀.
// req.session.adminId 없으면 401 UNAUTHORIZED.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAdmin } from '../admin-auth.js';

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
