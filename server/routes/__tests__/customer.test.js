// Task 6.6 — 사용자 API 통합 회귀 (supertest).
// 12 엔드포인트 중 본 task에서 다루는 핵심:
//   GET /api/menus · GET /api/popular · GET /api/business-state
//   POST /api/orders · GET /api/orders/:id · POST /api/orders/:id/transfer-report
//
// 절대 깨지면 안 되는 ADR:
//   - ADR-020 Pattern B: 클라가 total 무엇을 보내도 서버가 menu_id+qty로 재계산
//   - ADR-019: 학번 + 이름 + UNIQUE → 쿠폰 race 차단
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { createApp } from '../../app.js';
import { openBusinessDay } from '../../repositories/business-state-repo.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  openBusinessDay(db, { operating_date: '2026-05-20' });
  return db;
}

describe('사용자 API — GET /api/menus', () => {
  let app;
  beforeEach(() => {
    app = createApp({ db: freshDb() });
  });

  it('200 — 메뉴 8개 반환', async () => {
    const res = await request(app).get('/api/menus');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('basePrice');
    expect(typeof res.body[0].soldOut).toBe('boolean');
  });
});

describe('사용자 API — GET /api/popular', () => {
  it('인기 메뉴 N개 반환 (기본 3)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/api/popular');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.length).toBeLessThanOrEqual(3);
  });
});

describe('사용자 API — GET /api/business-state', () => {
  it('영업 상태 반환', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/api/business-state');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.operating_date).toBe('2026-05-20');
  });
});

describe('사용자 API — POST /api/orders (정상)', () => {
  it('정상 주문 생성 → 200 + 본명 스냅샷', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 2 }],
        name: '홍길동',
        student_id: null,
        is_external: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.no).toBe(1);
    expect(res.body.total_price).toBe(36000); // 18000 × 2
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('후라이드');
    expect(res.body.status).toBe('ORDERED');
  });

  it('★ ADR-020 — 클라가 total 999 보내도 서버 재계산', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        total_price: 999, // 무시되어야
        items_priced: [{ menu_id: 1, base_price: 1, quantity: 1 }], // 무시
      });
    expect(res.status).toBe(200);
    expect(res.body.total_price).toBe(18000);
  });

  it('외부인 + 토큰 생성', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.is_external).toBe(true);
    expect(res.body.external_token).toBeTruthy();
  });

  it('items 비어있으면 400', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [], name: '홍길동' });
    expect(res.status).toBe(400);
  });

  it('존재하지 않는 menu_id → 400 PRICING_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 9999, quantity: 1 }],
        name: '홍길동',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PRICING_ERROR');
  });
});

describe('사용자 API — POST /api/orders + 쿠폰', () => {
  it('쿠폰 사용 학생 — 1,000원 정액 할인 + used_coupons 등록 (ADR-019)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }], // 18000
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
      });
    expect(res.status).toBe(200);
    // 18000 - 1000 = 17000 (정액 ADR-019)
    expect(res.body.total_price).toBe(17000);

    // used_coupons 확인
    const used = db
      .prepare('SELECT * FROM used_coupons WHERE student_id = ?')
      .get('202637001');
    expect(used).toBeDefined();
    expect(used.name).toBe('홍길동');
  });

  it('쿠폰 중복 사용 → 400 ALREADY_USED', async () => {
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
    const dup = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
      });
    expect(dup.status).toBe(400);
    expect(dup.body.error).toBe('ALREADY_USED');
  });
});

describe('사용자 API — 영업 외 가드', () => {
  it('CLOSED 상태에서 POST /api/orders → 423', async () => {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    // 영업 시작 안 함 → CLOSED
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
      });
    expect(res.status).toBe(423);
    expect(res.body.error).toBe('BUSINESS_CLOSED');
  });

  it('CLOSED 상태에서도 GET /api/menus 통과', async () => {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    const app = createApp({ db });
    const res = await request(app).get('/api/menus');
    expect(res.status).toBe(200);
  });
});

describe('사용자 API — GET /api/orders/:id', () => {
  it('생성 후 조회', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
      });
    expect(create.status).toBe(200);

    const get = await request(app).get(`/api/orders/${create.body.id}`);
    expect(get.status).toBe(200);
    expect(get.body.id).toBe(create.body.id);
    expect(get.body.no).toBe(create.body.no);
  });

  it('존재 X → 404 ORDER_NOT_FOUND', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/api/orders/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');
  });
});

describe('사용자 API — POST /api/orders/:id/transfer-report', () => {
  it('이체 신고 → status TRANSFER_REPORTED', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
      });

    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report`)
      .send({
        bank: '국민',
        depositorName: '김철수',
        amount: 18000,
      });
    expect(report.status).toBe(200);
    expect(report.body.status).toBe('TRANSFER_REPORTED');
    expect(report.body.depositor_name).toBe('김철수');
  });

  it('이체 신고 필드 누락 → 400', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
      });

    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report`)
      .send({ bank: '국민' }); // amount, depositorName 누락
    expect(report.status).toBe(400);
  });
});
