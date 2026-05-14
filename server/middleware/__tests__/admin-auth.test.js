// Task 6.7/6.8 — admin-auth middleware + loginAdmin 회귀.
// req.session.adminId 없으면 401 UNAUTHORIZED.
// loginAdmin: PIN 일치 → admin.id / 불일치 → null / 시드 X → throw.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { requireAdmin, loginAdmin } from '../admin-auth.js';
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
