// P1-3 (Codex v3 리뷰 2026-05-15) — pino logger redaction 회귀.
//
// 문제:
//   - access_token이 PII (docs/operations/pii-deletion.md)
//   - 클라가 URL query로 token을 보냄 (?token=<UUID>)
//   - pino-http 기본 logger는 req.url, req.query를 그대로 출력
//   - Docker logs, 운영 로그 공유 시 token 유출
//
// 수정 방향:
//   - logger.redact.paths에 query.token, req.url의 token 쿼리 마스킹
//   - censor 함수로 URL에서 `token=...` 부분만 [REDACTED] 처리
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import { createLogger, pinoHttpRedactOptions } from '../logger.js';

function captureLogs() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, stream };
}

describe('logger redaction (P1-3)', () => {
  it('★ req.query.token이 [REDACTED] 처리됨', () => {
    const { lines, stream } = captureLogs();
    const log = createLogger({ stream });
    log.info(
      { req: { url: '/api/orders/1', query: { token: 'secret-uuid-12345' } } },
      'order fetch',
    );
    const out = lines.join('');
    expect(out).not.toContain('secret-uuid-12345');
    expect(out).toContain('[REDACTED]');
  });

  it('★ req.url의 ?token=... query string이 마스킹됨', () => {
    const { lines, stream } = captureLogs();
    const log = createLogger({ stream });
    log.info(
      { req: { url: '/api/orders/1?token=top-secret-abc&foo=bar' } },
      'request',
    );
    const out = lines.join('');
    expect(out).not.toContain('top-secret-abc');
    // foo=bar 같은 다른 query는 보존
    expect(out).toContain('foo=bar');
  });

  it('★ token 없는 정상 URL은 그대로 출력', () => {
    const { lines, stream } = captureLogs();
    const log = createLogger({ stream });
    log.info({ req: { url: '/api/menus?category=chicken' } }, 'request');
    const out = lines.join('');
    expect(out).toContain('/api/menus?category=chicken');
    expect(out).not.toContain('[REDACTED]');
  });

  it('★ body나 일반 메시지는 redaction 영향 X', () => {
    const { lines, stream } = captureLogs();
    const log = createLogger({ stream });
    log.info({ msg: '주문 처리 완료', orderId: 42 }, 'order ok');
    const out = lines.join('');
    expect(out).toContain('orderId');
    expect(out).toContain('42');
  });
});

// ── pino-http 통합 회귀 (P1-3) ────────────────────────────────
describe('pino-http 통합 — req.url의 token query 마스킹', async () => {
  const express = (await import('express')).default;
  const request = (await import('supertest')).default;
  const pinoHttp = (await import('pino-http')).default;

  it('★ supertest GET /api/orders/1?token=secret → 로그에 token 미노출', async () => {
    const { lines, stream } = captureLogs();
    const log = createLogger({ stream });
    const app = express();
    app.use(pinoHttp({ logger: log, ...pinoHttpRedactOptions() }));
    app.get('/api/orders/:id', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/api/orders/1?token=top-secret-xyz');
    expect(res.status).toBe(200);

    const out = lines.join('');
    expect(out).not.toContain('top-secret-xyz');
    expect(out).toContain('[REDACTED]');
  });
});
