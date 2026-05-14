// 부트스트랩 회귀 — /healthz 200 응답 + 알 수 없는 경로 404.
// Express 앱 팩토리(createApp)를 listen 없이 supertest로 직접 검증한다.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('GET /healthz', () => {
  it('200 { ok: true } 응답', async () => {
    const app = createApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('알 수 없는 경로는 404 NOT_FOUND', async () => {
    const app = createApp();
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
