// P0-1 (Codex Review) — Express SPA 정적 서빙 회귀.
//
// 책임:
//   - 운영 환경(Docker)에서 dist/index.html을 / 와 모든 사용자 SPA 경로에 서빙.
//   - /api/* · /admin/api/* · /healthz 는 기존 응답(JSON / 404) 유지.
//
// 검증 방법:
//   - createApp({ db, distPath }) 옵션으로 임시 dist 디렉토리를 주입.
//   - dist 미존재 시 createApp은 기존 404 동작 유지 (테스트 격리).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../app.js';

function makeTempDist() {
  const dir = mkdtempSync(path.join(tmpdir(), 'chickenedak-dist-'));
  mkdirSync(path.join(dir, 'assets'), { recursive: true });
  writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><title>치킨이닭</title></head><body><div id="root"></div></body></html>',
    'utf8',
  );
  writeFileSync(
    path.join(dir, 'assets', 'app-test.js'),
    '/* test asset */',
    'utf8',
  );
  return dir;
}

describe('SPA 정적 서빙 — dist 존재 시', () => {
  let distPath;
  let app;

  beforeEach(() => {
    distPath = makeTempDist();
    app = createApp({ distPath });
  });

  afterEach(() => {
    rmSync(distPath, { recursive: true, force: true });
  });

  it('GET / → 200 HTML index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
  });

  it('GET /menu → 200 HTML (SPA fallback)', async () => {
    const res = await request(app).get('/menu');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
  });

  it('GET /orders/123/status → 200 HTML (deep route SPA fallback)', async () => {
    const res = await request(app).get('/orders/123/status');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('GET /admin/dashboard → 200 HTML (admin SPA 경로)', async () => {
    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('GET /assets/app-test.js → 200 + JS 자원', async () => {
    const res = await request(app).get('/assets/app-test.js');
    expect(res.status).toBe(200);
    expect(res.text).toContain('test asset');
  });

  it('GET /healthz → 200 JSON (정적 서빙에 가로채지 X)', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /api/nonexistent → 404 JSON (API 네임스페이스는 SPA fallback 제외)', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('GET /admin/api/nonexistent → 404 JSON (admin API 네임스페이스 제외)', async () => {
    const res = await request(app).get('/admin/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('SPA 정적 서빙 — dist 미존재 시 (테스트 환경 기본)', () => {
  it('GET / → 404 (기존 동작 유지)', async () => {
    const app = createApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
  });
});
