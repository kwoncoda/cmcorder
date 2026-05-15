// Task 6.8 + 충돌-3 (Codex v2) — business-state middleware 회귀.
// 정책:
//   - OPEN: 모든 요청 통과.
//   - CLOSED + 사용자 POST/PUT/DELETE: 423 BUSINESS_CLOSED.
//   - CLOSED + 사용자 GET (SPA HTML 경로): 302 redirect → /closed.
//   - CLOSED + 예외 GET (/api/business-state, /healthz, /closed 자체,
//                          /admin/*, 정적 자산 /assets/*, /favicon.ico): 통과.
//   - /admin/* 모든 메서드: 통과.
//
// API_DRAFT.md §1.12 + FEATURE_LIST F-S-015 명세 정합 (서버 redirect 요구).
// SPA layout(P0-5)은 *이중 가드*로 유지 — JS 비활성 환경 보호 + 일관성.
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
  // 사용자 GET (SPA 경로) — 정상 응답 시 200.
  app.get('/menu', (_req, res) => res.json({ ok: true }));
  app.get('/cart', (_req, res) => res.json({ ok: true }));
  app.get('/api/menus', (_req, res) => res.json({ ok: true }));
  app.get('/api/business-state', (_req, res) => res.json({ status: 'CLOSED' }));
  app.get('/closed', (_req, res) => res.json({ closed: true }));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/assets/foo.js', (_req, res) => res.send('asset'));
  app.get('/favicon.ico', (_req, res) => res.send(''));
  app.post('/api/orders', (_req, res) => res.json({ ok: true }));
  app.post('/admin/anything', (_req, res) => res.json({ ok: true }));
  app.get('/admin/dashboard', (_req, res) => res.json({ ok: true }));
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
    const app = makeApp(db);
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(423);
    expect(res.body.error).toBe('BUSINESS_CLOSED');
  });

  // ── 충돌-3 (Codex v2) CLOSED 사용자 GET 서버 redirect ───────────
  it('★ CLOSED — 사용자 GET /menu → 302 /closed (API_DRAFT §1.12 정합)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/menu');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/closed');
  });

  it('★ CLOSED — GET /api/menus → 302 (조회 API도 차단)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/api/menus');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/closed');
  });

  it('★ CLOSED — GET /api/business-state → 200 (사용자가 영업 상태 알아야 함)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/api/business-state');
    expect(res.status).toBe(200);
  });

  it('★ CLOSED — GET /closed → 200 (자기 자신 redirect 무한 루프 방지)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/closed');
    expect(res.status).toBe(200);
  });

  it('★ CLOSED — GET /healthz → 200 (모니터링)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
  });

  it('★ CLOSED — GET /assets/foo.js → 200 (정적 자산 — /closed 페이지도 로드 필요)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/assets/foo.js');
    expect(res.status).toBe(200);
  });

  it('★ CLOSED — GET /favicon.ico → 200 (정적 자산)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/favicon.ico');
    expect(res.status).toBe(200);
  });

  it('CLOSED — /admin/* POST 통과', async () => {
    const app = makeApp(db);
    const res = await request(app).post('/admin/anything').send({});
    expect(res.status).toBe(200);
  });

  it('CLOSED — /admin/* GET 통과 (관리자는 영업 외 작업 가능)', async () => {
    const app = makeApp(db);
    const res = await request(app).get('/admin/dashboard');
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
