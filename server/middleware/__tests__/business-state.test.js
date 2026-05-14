// Task 6.8 — business-state middleware 회귀.
// 사용자 POST → CLOSED 시 423 BUSINESS_CLOSED.
// /admin/* 경로는 영향 X. GET 통과.
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { businessStateGuard } from '../business-state.js';
import { openBusinessDay, closeBusinessDay } from '../../repositories/business-state-repo.js';

function makeApp(db) {
  const app = express();
  app.use(express.json());
  app.use(businessStateGuard(db));
  app.get('/api/menus', (_req, res) => res.json({ ok: true }));
  app.post('/api/orders', (_req, res) => res.json({ ok: true }));
  app.post('/admin/anything', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('businessStateGuard', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    bootstrapDatabase(db);
  });

  it('OPEN — 사용자 POST 통과', async () => {
    openBusinessDay(db, { operating_date: '2026-05-20' });
    const app = makeApp(db);
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(200);
  });

  it('CLOSED — 사용자 POST → 423 BUSINESS_CLOSED', async () => {
    // 첫 부팅이 CLOSED — 그대로 호출
    const app = makeApp(db);
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(423);
    expect(res.body.error).toBe('BUSINESS_CLOSED');
  });

  it('CLOSED — GET 요청은 통과 (조회는 항상 허용)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/api/menus');
    expect(res.status).toBe(200);
  });

  it('CLOSED — /admin/* POST 통과', async () => {
    const app = makeApp(db);
    const res = await request(app).post('/admin/anything').send({});
    expect(res.status).toBe(200);
  });

  it('OPEN → CLOSED 후 사용자 POST 차단', async () => {
    openBusinessDay(db, { operating_date: '2026-05-20' });
    const app = makeApp(db);
    const open = await request(app).post('/api/orders').send({});
    expect(open.status).toBe(200);

    closeBusinessDay(db);
    const closed = await request(app).post('/api/orders').send({});
    expect(closed.status).toBe(423);
  });
});
