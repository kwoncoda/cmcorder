// Task 6.7 — 관리자 API 통합 회귀 (supertest + express-session).
//
// 16 핵심 엔드포인트:
//   POST /admin/login · POST /admin/logout
//   GET  /admin/api/business/state · POST /admin/api/business/open
//   GET  /admin/api/menus · POST /admin/api/menus/:id/toggle
//   GET  /admin/api/orders · GET /admin/api/orders/:id
//   POST /admin/api/orders/:id/transition
//   GET  /admin/api/transfers
//   GET  /admin/api/settlement · POST /admin/api/settlement/close
//   GET  /admin/api/settlement/zip
//
// 절대 깨지면 안 되는 ADR:
//   - ADR-012 정산 마감 가드 (in_progress 0건만)
//   - ADR-025 13 합법 전이만 (불법 409)
//   - G13 settlement/close 시 business_state 자동 CLOSED
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { bootstrapDatabase, seedAdmin, hashPin } from '../../db/bootstrap.js';
import { createApp } from '../../app.js';
import { openBusinessDay } from '../../repositories/business-state-repo.js';

const SEED_PIN = '654321';

function freshDb({ open = true } = {}) {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  // admins 비어있을 때 알려진 PIN으로 직접 시드 (seedAdmin 우회)
  db.prepare('INSERT INTO admins (pin_hash) VALUES (?)').run(hashPin(SEED_PIN));
  if (open) openBusinessDay(db, { operating_date: '2026-05-20' });
  return db;
}

async function loginAgent(app, pin = SEED_PIN) {
  const agent = request.agent(app);
  const res = await agent.post('/admin/login').send({ pin });
  // P1-6: CSRF 토큰 미리 받아 두기 (mutation 호출 시 자동 set).
  const t = await agent.get('/admin/api/csrf-token');
  return { agent, res, csrfToken: t.body?.token ?? null };
}

// P1-6: mutation 호출 헬퍼 — X-CSRF-Token 자동 주입.
function withCsrf(req, token) {
  return token ? req.set('X-CSRF-Token', token) : req;
}

// ── P1-6 (Codex 리뷰) CSRF 토큰 보호 ──────────────────────────
describe('CSRF 보호 — P1-6', () => {
  it('★ 미들웨어 — POST /admin/api/menus/:id/toggle X-CSRF-Token 없으면 403', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.post('/admin/api/menus/1/toggle').send({ soldOut: true });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_INVALID');
  });

  it('★ GET /admin/api/csrf-token → 토큰 발급 + 동일 토큰으로 mutation 통과', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const token = await agent.get('/admin/api/csrf-token');
    expect(token.status).toBe(200);
    expect(typeof token.body.token).toBe('string');
    expect(token.body.token.length).toBeGreaterThan(10);

    const ok = await agent
      .post('/admin/api/menus/1/toggle')
      .set('X-CSRF-Token', token.body.token)
      .send({ soldOut: true });
    expect(ok.status).toBe(200);
  });

  it('★ X-CSRF-Token 불일치 시 403', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    await agent.get('/admin/api/csrf-token'); // 토큰 발급 받지만
    const res = await agent
      .post('/admin/api/menus/1/toggle')
      .set('X-CSRF-Token', 'wrong-value')
      .send({ soldOut: true });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_INVALID');
  });

  it('★ GET 요청은 CSRF 검증 X (안전한 메서드)', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    // GET /admin/api/menus — 토큰 없이도 통과 (안전한 read-only)
    const res = await agent.get('/admin/api/menus');
    expect(res.status).toBe(200);
  });
});

describe('POST /admin/login', () => {
  it('정상 PIN → 200 + 세션 쿠키 설정', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/admin/login').send({ pin: SEED_PIN });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers['set-cookie']?.[0]).toMatch(/chickenedak\.sid/);
  });

  it('잘못된 PIN → 401 INVALID_PIN', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/admin/login').send({ pin: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_PIN');
  });

  it('PIN 형식 위반 (5자리) → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/admin/login').send({ pin: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('보호된 라우트 — 세션 없으면 401', () => {
  it('GET /admin/api/business/state — 401', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/admin/api/business/state');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('GET /admin/api/menus — 401', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/admin/api/menus');
    expect(res.status).toBe(401);
  });
});

describe('POST /admin/logout', () => {
  it('로그아웃 후 보호 라우트 401', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    // 로그인 후 200 확인
    const before = await agent.get('/admin/api/business/state');
    expect(before.status).toBe(200);
    await agent.post('/admin/logout');
    const after = await agent.get('/admin/api/business/state');
    expect(after.status).toBe(401);
  });
});

describe('GET /admin/api/business/state', () => {
  it('200 + OPEN 상태', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/business/state');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.operating_date).toBe('2026-05-20');
  });
});

describe('POST /admin/api/business/open', () => {
  it('CLOSED → OPEN 전환', async () => {
    const app = createApp({ db: freshDb({ open: false }) });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.post('/admin/api/business/open'), csrfToken)
      .send({ operating_date: '2026-05-21' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.operating_date).toBe('2026-05-21');
  });

  it('멱등 — 이미 OPEN이어도 200 (operating_date 유지)', async () => {
    const app = createApp({ db: freshDb() });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.post('/admin/api/business/open'), csrfToken).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
  });
});

describe('GET /admin/api/menus', () => {
  it('메뉴 8개 (basePrice / soldOut / recommended 노출)', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/menus');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
    expect(typeof res.body[0].basePrice).toBe('number');
    expect(typeof res.body[0].soldOut).toBe('boolean');
    expect(typeof res.body[0].recommended).toBe('boolean');
  });
});

describe('POST /admin/api/menus/:id/toggle', () => {
  it('soldOut 토글', async () => {
    const app = createApp({ db: freshDb() });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken)
      .send({ soldOut: true });
    expect(res.status).toBe(200);
    expect(res.body.soldOut).toBe(true);
  });

  it('recommended 토글', async () => {
    const app = createApp({ db: freshDb() });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.post('/admin/api/menus/2/toggle'), csrfToken)
      .send({ recommended: true });
    expect(res.status).toBe(200);
    expect(res.body.recommended).toBe(true);
  });

  it('존재하지 않는 메뉴 → 404', async () => {
    const app = createApp({ db: freshDb() });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.post('/admin/api/menus/9999/toggle'), csrfToken)
      .send({ soldOut: true });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MENU_NOT_FOUND');
  });
});

describe('GET /admin/api/orders', () => {
  it('주문 목록 (빈 배열)', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('주문 1건 생성 후 조회', async () => {
    const db = freshDb();
    const app = createApp({ db });
    // 사용자 API로 주문 1건
    await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
      });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('홍길동');
    expect(res.body[0].total_price).toBe(18000);
  });

  it('status 필터 (ORDERED만)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
      });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/orders?status=ORDERED');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const other = await agent.get('/admin/api/orders?status=DONE');
    expect(other.body).toHaveLength(0);
  });
});

describe('GET /admin/api/orders/:id', () => {
  it('단일 주문 + items 포함', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 2 }],
        name: '홍길동',
        student_id: '202637001',
      });
    const { agent } = await loginAgent(app);
    const res = await agent.get(`/admin/api/orders/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(create.body.id);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(2);
  });

  it('존재 X → 404 ORDER_NOT_FOUND', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/orders/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');
  });

  it('★ Bug 8 회귀 — is_external 은 SQLite 0/1이 아니라 boolean 으로 직렬화', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent } = await loginAgent(app);
    const res = await agent.get(`/admin/api/orders/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.is_external).toBe('boolean');
    expect(res.body.is_external).toBe(false);
  });

  it('★ Bug 8 회귀 — 외부인 주문 is_external=true', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '외부인', is_external: true });
    const { agent } = await loginAgent(app);
    const res = await agent.get(`/admin/api/orders/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.is_external).toBe(true);
  });

  it('★ Bug 8 회귀 — OrderSchema(zod)로 admin 응답 검증 통과', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent } = await loginAgent(app);
    const res = await agent.get(`/admin/api/orders/${create.body.id}`);
    // 동적 import로 OrderSchema 검증 — server 측 테스트가 client 스키마와 정합 확인.
    const { OrderSchema } = await import('../../../src/api/schemas.js');
    expect(() => OrderSchema.parse(res.body)).not.toThrow();
  });

  it('★ Bug 7 회귀 — admin 주문 응답 timestamps ISO 8601 UTC (T...Z)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent } = await loginAgent(app);
    const res = await agent.get(`/admin/api/orders/${create.body.id}`);
    expect(res.status).toBe(200);
    // created_at은 'YYYY-MM-DDTHH:MM:SSZ' 형식이어야 한다 — 브라우저 KST 540분 오차 방어.
    expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe('POST /admin/api/orders/:id/transition', () => {
  it('합법 전이 ORDERED → CANCELED', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
      });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(
      agent.post(`/admin/api/orders/${create.body.id}/transition`),
      csrfToken,
    ).send({ to: 'CANCELED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELED');
  });

  it('불법 전이 ORDERED → PAID → 409 ILLEGAL_TRANSITION', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
      });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(
      agent.post(`/admin/api/orders/${create.body.id}/transition`),
      csrfToken,
    ).send({ to: 'PAID' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ILLEGAL_TRANSITION');
  });

  it('존재 X → 404', async () => {
    const app = createApp({ db: freshDb() });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(
      agent.post('/admin/api/orders/9999/transition'),
      csrfToken,
    ).send({ to: 'CANCELED' });
    expect(res.status).toBe(404);
  });
});

describe('GET /admin/api/transfers', () => {
  it('TRANSFER_REPORTED 주문만', async () => {
    const db = freshDb();
    const app = createApp({ db });
    // 주문 2건 — 1건만 TRANSFER_REPORTED
    const o1 = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
      });
    // P0-B (Codex v2): transfer-report에 token 필수.
    await request(app)
      .post(`/api/orders/${o1.body.id}/transfer-report?token=${o1.body.access_token}`)
      .send({ bank: '국민', depositorName: '홍길동', amount: 18000 });
    await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '김철수',
      });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/transfers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('TRANSFER_REPORTED');
    expect(res.body[0].depositor_name).toBe('홍길동');
  });
});

describe('GET /admin/api/settlement', () => {
  it('요약 — 빈 상태', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/settlement');
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(0);
    expect(res.body.in_progress_count).toBe(0);
    expect(res.body.is_closed).toBe(false);
  });
});

describe('POST /admin/api/settlement/close (ADR-012 + G13)', () => {
  it('가드 통과 (in_progress 0) → 마감 + business_state CLOSED', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.post('/admin/api/settlement/close'), csrfToken).send({});
    expect(res.status).toBe(200);
    expect(res.body.is_closed).toBe(true);
    const state = await agent.get('/admin/api/business/state');
    expect(state.body.status).toBe('CLOSED');
  });

  it('가드 실패 (in_progress 주문 있음) → 409', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
      });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.post('/admin/api/settlement/close'), csrfToken).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('IN_PROGRESS_EXISTS');
  });
});

// supertest의 binary 응답 collector — res.body Buffer로 받기
function binaryParser(res, callback) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
}

describe('GET /admin/api/settlement/zip', () => {
  it('ZIP buffer 응답 + Content-Type/Disposition', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent
      .get('/admin/api/settlement/zip')
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/zip/);
    expect(res.headers['content-disposition']).toMatch(/attachment.*settlement.*\.zip/);
    // ZIP magic bytes (PK)
    expect(res.body[0]).toBe(0x50);
    expect(res.body[1]).toBe(0x4b);
  });
});

// ── find_error_v2 — GET /admin/api/history (주문 상태 변경 감사 로그) ──────────
describe('GET /admin/api/history', () => {
  it('★ 인증 없으면 401', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/admin/api/history');
    expect(res.status).toBe(401);
  });

  // find_error_v3 P1-2: ADMIN_LOGIN이 type=all에 포함되므로 본 describe의
  // 기존 주문 이벤트 검증은 type=orders 로 옮겨 분리한다 (의도: 주문 로그 회귀 보호).
  it('빈 결과 — 200 + 빈 배열 (type=orders)', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/history?type=orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('★ 주문 생성 → CREATED 이벤트가 노출 (order_no JOIN, created_at ISO)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/history?type=orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const row = res.body[0];
    expect(row.event_type).toBe('CREATED');
    expect(row.from_status).toBeNull();
    expect(row.to_status).toBe('ORDERED');
    expect(row.action_name).toBe('주문 접수');
    expect(row.actor).toBe('customer');
    expect(typeof row.order_no).toBe('number');
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('★ admin transition → 이벤트 created_at DESC 정렬, actor=admin', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post(`/admin/api/orders/${create.body.id}/transition`), csrfToken)
      .send({ to: 'CANCELED' });
    const res = await agent.get('/admin/api/history?type=orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // 최신(CANCELED) 먼저.
    expect(res.body[0].event_type).toBe('CANCELED');
    expect(res.body[0].actor).toBe('admin');
    expect(res.body[0].from_status).toBe('ORDERED');
    expect(res.body[0].to_status).toBe('CANCELED');
    expect(res.body[0].action_name).toBe('취소');
    expect(res.body[1].event_type).toBe('CREATED');
  });

  it('★ date 쿼리 필터 — 다른 날 이벤트는 제외', async () => {
    const db = freshDb();
    const app = createApp({ db });
    // 기본 operating_date 2026-05-20에 주문.
    await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent } = await loginAgent(app);
    // type=orders 명시: ADMIN_LOGIN(system, operating_date=2026-05-20) 영향 분리.
    const wrongDate = await agent.get('/admin/api/history?type=orders&date=2026-01-01');
    expect(wrongDate.body).toHaveLength(0);
    const rightDate = await agent.get('/admin/api/history?type=orders&date=2026-05-20');
    expect(rightDate.body).toHaveLength(1);
  });
});

// ── find_error_v3 — GET /admin/api/history?type=all|orders|menus|system ──
describe('GET /admin/api/history — find_error_v3 type 필터 + admin_events 통합', () => {
  it('★ type=all (default) — order_events + admin_events 통합, created_at DESC', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent, csrfToken } = await loginAgent(app);
    // 메뉴 변경 → admin_events 행 생성
    await withCsrf(agent.post('/admin/api/menus/2/toggle'), csrfToken).send({ soldOut: true });
    const res = await agent.get('/admin/api/history');
    expect(res.status).toBe(200);
    // 1) 주문 CREATED (order) + 2) 메뉴 SOLDOUT_ON (admin/menu) + 3) ADMIN_LOGIN (admin/system).
    // find_error_v3 P1-2: ADMIN_LOGIN도 operating_date를 채우므로 type=all에 포함됨.
    expect(res.body).toHaveLength(3);
    const sources = res.body.map((r) => r.source).sort();
    expect(sources).toEqual(['admin', 'admin', 'order']);
    const ids = res.body.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => /^[oa]-\d+$/.test(id))).toBe(true);
    const types = res.body.map((r) => r.event_type);
    expect(types).toContain('CREATED');
    expect(types).toContain('SOLDOUT_ON');
    expect(types).toContain('ADMIN_LOGIN');
  });

  it('★ type=orders — order_events만', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/menus/2/toggle'), csrfToken).send({ soldOut: true });
    const res = await agent.get('/admin/api/history?type=orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('order');
    expect(res.body[0].source).toBe('order');
    expect(res.body[0].event_type).toBe('CREATED');
  });

  it('★ type=menus — admin_events category=menu만', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001' });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/menus/3/toggle'), csrfToken).send({ recommended: false });
    const res = await agent.get('/admin/api/history?type=menus');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('menu');
    expect(res.body[0].event_type).toBe('RECOMMEND_OFF');
    expect(res.body[0].target_name).toBe('뿌링클');
  });

  it('★ type=system — admin_events category=system만 (BUSINESS_OPEN 포함)', async () => {
    const db = freshDb();
    const app = createApp({ db: freshDb({ open: false }) });
    const { agent, csrfToken } = await loginAgent(app);
    // 장사 시작 → BUSINESS_OPEN system 이벤트
    await withCsrf(agent.post('/admin/api/business/open'), csrfToken)
      .send({ operating_date: '2026-05-20' });
    const res = await agent.get('/admin/api/history?type=system&date=2026-05-20');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const opens = res.body.filter((r) => r.event_type === 'BUSINESS_OPEN');
    expect(opens).toHaveLength(1);
    expect(opens[0].category).toBe('system');
    expect(opens[0].action_name).toBe('장사 시작');
    expect(opens[0].actor).toBe('admin');
  });

  it('★ created_at은 ISO 8601 UTC Z 형식 (Bug 7 정합)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken).send({ soldOut: true });
    const res = await agent.get('/admin/api/history?type=menus');
    expect(res.body[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  // ── find_error_v3 P2 (Codex 리뷰 2026-05-18) — type allowlist 검증 ──
  it('★ P2: type=invalid 시 400 INVALID_HISTORY_TYPE', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/history?type=garbage');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_HISTORY_TYPE');
  });

  it.each(['all', 'orders', 'menus', 'system'])('★ P2: type=%s 는 200', async (type) => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent } = await loginAgent(app);
    const res = await agent.get(`/admin/api/history?type=${type}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── find_error_v3 — 메뉴 토글 시 admin_events 자동 기록 ──
describe('POST /admin/api/menus/:id/toggle — admin_events 기록', () => {
  it('★ soldOut: true → SOLDOUT_ON 이벤트 1행', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken).send({ soldOut: true });
    const row = db.prepare(
      `SELECT * FROM admin_events WHERE event_type = 'SOLDOUT_ON'`,
    ).get();
    expect(row).toBeDefined();
    expect(row.category).toBe('menu');
    expect(row.action_name).toBe('품절 처리');
    expect(row.actor).toBe('admin');
    expect(row.target_id).toBe(1);
    expect(row.target_name).toBe('후라이드');
    expect(row.before_value).toBe('false');
    expect(row.after_value).toBe('true');
  });

  it('★ soldOut: false → SOLDOUT_OFF 이벤트 (메뉴5는 시드가 sold_out=1)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/menus/5/toggle'), csrfToken).send({ soldOut: false });
    const row = db.prepare(
      `SELECT * FROM admin_events WHERE event_type = 'SOLDOUT_OFF'`,
    ).get();
    expect(row).toBeDefined();
    expect(row.action_name).toBe('판매 재개');
    expect(row.target_name).toBe('뿌링감자튀김');
  });

  it('★ recommended: true → RECOMMEND_ON 이벤트', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/menus/2/toggle'), csrfToken).send({ recommended: true });
    const row = db.prepare(
      `SELECT * FROM admin_events WHERE event_type = 'RECOMMEND_ON'`,
    ).get();
    expect(row).toBeDefined();
    expect(row.action_name).toBe('추천 등록');
    expect(row.before_value).toBe('false');
    expect(row.after_value).toBe('true');
  });

  it('★ base_price 변경 → PRICE_CHANGED 이벤트 + before/after 가격 문자열', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken).send({ base_price: 20000 });
    const row = db.prepare(
      `SELECT * FROM admin_events WHERE event_type = 'PRICE_CHANGED'`,
    ).get();
    expect(row).toBeDefined();
    expect(row.action_name).toBe('가격 변경');
    expect(row.before_value).toBe('18000');
    expect(row.after_value).toBe('20000');
  });

  it('★ before === after → 이벤트 기록 X (멱등)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    // 메뉴1은 시드 sold_out=0. 같은 값으로 토글하면 menu 이벤트 X.
    await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken).send({ soldOut: false });
    const count = db.prepare(
      `SELECT COUNT(*) AS c FROM admin_events WHERE category = 'menu'`,
    ).get().c;
    expect(count).toBe(0);
  });

  it('★ 여러 항목 patch → 변경된 항목마다 별개 row', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    // 메뉴1: soldOut 0→1, recommended 1→0, base_price 18000→17000
    await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken)
      .send({ soldOut: true, recommended: false, base_price: 17000 });
    const rows = db.prepare(
      `SELECT event_type FROM admin_events WHERE category = 'menu' ORDER BY id`,
    ).all();
    const types = rows.map((r) => r.event_type).sort();
    expect(types).toEqual(['PRICE_CHANGED', 'RECOMMEND_OFF', 'SOLDOUT_ON']);
  });

  it('★ 일부만 변경 → 변경된 항목만 row (recommended는 동일하면 row X)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    // 메뉴1: recommended 시드 1, 동일 1로 patch + soldOut 변경
    await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken)
      .send({ soldOut: true, recommended: true });
    const rows = db.prepare(
      `SELECT event_type FROM admin_events WHERE category = 'menu'`,
    ).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('SOLDOUT_ON');
  });

  // ── find_error_v3 P2 (Codex 리뷰 2026-05-18) — 메뉴 변경 + 로그 트랜잭션 원자성 ──
  it('★ P2: 로그 INSERT 실패 시 메뉴 변경도 ROLLBACK (admin_events 테이블 DROP 시뮬레이션)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    // admin_events 테이블을 일부러 DROP → logAdminEvent가 INSERT 실패.
    db.exec('DROP TABLE admin_events');
    // 메뉴1 sold_out=0 → soldOut=true 시도. 트랜잭션 안에서 logMenuPatchEvents가 실패 → ROLLBACK.
    const res = await withCsrf(agent.post('/admin/api/menus/1/toggle'), csrfToken)
      .send({ soldOut: true });
    expect(res.status).toBe(500); // 트랜잭션 실패는 errorHandler가 500.
    // ROLLBACK 검증 — sold_out 여전히 0.
    const menu = db.prepare('SELECT sold_out FROM menus WHERE id = 1').get();
    expect(menu.sold_out).toBe(0);
  });
});

// ── find_error_v3 — POST /admin/api/business/open admin_events 기록 ──
describe('POST /admin/api/business/open — admin_events 기록', () => {
  it('★ CLOSED → OPEN 전환 시 BUSINESS_OPEN system 이벤트 1행', async () => {
    const db = freshDb({ open: false });
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/business/open'), csrfToken)
      .send({ operating_date: '2026-05-20' });
    const row = db.prepare(
      `SELECT * FROM admin_events WHERE event_type = 'BUSINESS_OPEN'`,
    ).get();
    expect(row).toBeDefined();
    expect(row.category).toBe('system');
    expect(row.action_name).toBe('장사 시작');
    expect(row.actor).toBe('admin');
    expect(row.operating_date).toBe('2026-05-20');
  });

  it('★ 멱등 — 이미 OPEN이면 이벤트 추가 X', async () => {
    const db = freshDb({ open: true });
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    await withCsrf(agent.post('/admin/api/business/open'), csrfToken).send({});
    const count = db.prepare(
      `SELECT COUNT(*) AS c FROM admin_events WHERE event_type = 'BUSINESS_OPEN'`,
    ).get().c;
    expect(count).toBe(0);
  });
});

// ── find_error_v3 — POST /admin/login admin_events 기록 ──
describe('POST /admin/login — admin_events 기록', () => {
  it('★ 성공 로그인 시 ADMIN_LOGIN system 이벤트 1행', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app).post('/admin/login').send({ pin: SEED_PIN });
    const row = db.prepare(
      `SELECT * FROM admin_events WHERE event_type = 'ADMIN_LOGIN'`,
    ).get();
    expect(row).toBeDefined();
    expect(row.category).toBe('system');
    expect(row.action_name).toBe('관리자 로그인');
    expect(row.actor).toBe('admin');
  });

  it('★ 실패 로그인은 이벤트 X', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app).post('/admin/login').send({ pin: '000000' });
    const count = db.prepare(
      `SELECT COUNT(*) AS c FROM admin_events WHERE event_type = 'ADMIN_LOGIN'`,
    ).get().c;
    expect(count).toBe(0);
  });

  // ── find_error_v3 P1-2 (Codex 리뷰 2026-05-18) — ADMIN_LOGIN system history 노출 ──
  it('★ P1-2: ADMIN_LOGIN row의 operating_date는 현재 business_state와 일치', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app).post('/admin/login').send({ pin: SEED_PIN });
    const row = db.prepare(
      `SELECT operating_date FROM admin_events WHERE event_type = 'ADMIN_LOGIN'`,
    ).get();
    expect(row.operating_date).toBe('2026-05-20');
  });

  it('★ P1-2: GET /admin/api/history?type=system 에서 ADMIN_LOGIN 조회', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.get('/admin/api/history?type=system&date=2026-05-20'), csrfToken);
    expect(res.status).toBe(200);
    const types = res.body.map((r) => r.event_type);
    expect(types).toContain('ADMIN_LOGIN');
    const loginRow = res.body.find((r) => r.event_type === 'ADMIN_LOGIN');
    expect(loginRow.category).toBe('system');
    expect(loginRow.action_name).toBe('관리자 로그인');
    expect(loginRow.actor).toBe('admin');
  });

  it('★ P1-2: GET /admin/api/history?type=all 에도 ADMIN_LOGIN 포함', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.get('/admin/api/history?type=all&date=2026-05-20'), csrfToken);
    expect(res.status).toBe(200);
    const types = res.body.map((r) => r.event_type);
    expect(types).toContain('ADMIN_LOGIN');
  });

  it('★ P1-2: GET /admin/api/history?type=orders 에는 ADMIN_LOGIN 미노출', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.get('/admin/api/history?type=orders&date=2026-05-20'), csrfToken);
    expect(res.status).toBe(200);
    const types = res.body.map((r) => r.event_type);
    expect(types).not.toContain('ADMIN_LOGIN');
  });

  it('★ P1-2: GET /admin/api/history?type=menus 에도 ADMIN_LOGIN 미노출', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const { agent, csrfToken } = await loginAgent(app);
    const res = await withCsrf(agent.get('/admin/api/history?type=menus&date=2026-05-20'), csrfToken);
    expect(res.status).toBe(200);
    const types = res.body.map((r) => r.event_type);
    expect(types).not.toContain('ADMIN_LOGIN');
  });
});

// ── find_error_v2 — GET /admin/api/coupons/usage (쿠폰 사용 내역) ────────────
describe('GET /admin/api/coupons/usage', () => {
  it('★ 인증 없으면 401', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/admin/api/coupons/usage');
    expect(res.status).toBe(401);
  });

  it('빈 결과 — 200 + 빈 배열', async () => {
    const app = createApp({ db: freshDb() });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/coupons/usage');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('★ 쿠폰 사용 주문 → order_no JOIN + 상수 coupon_name/discount_amount 노출', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
      });
    const { agent } = await loginAgent(app);
    const res = await agent.get('/admin/api/coupons/usage');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const row = res.body[0];
    expect(row.name).toBe('홍길동');
    expect(row.student_id).toBe('202637001');
    expect(row.coupon_name).toBe('컴모융 1,000원 할인');
    expect(row.discount_amount).toBe(1000);
    expect(typeof row.order_no).toBe('number');
    expect(row.used_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('★ date 쿼리 — 다른 날짜 쿠폰은 제외 (orders.operating_date JOIN 필터)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        coupon: { used: true },
      });
    const { agent } = await loginAgent(app);
    const wrongDate = await agent.get('/admin/api/coupons/usage?date=2026-01-01');
    expect(wrongDate.body).toHaveLength(0);
    const rightDate = await agent.get('/admin/api/coupons/usage?date=2026-05-20');
    expect(rightDate.body).toHaveLength(1);
  });
});
