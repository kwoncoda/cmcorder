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

  it('200 — 메뉴 10개 반환 (menu_update — 신규 2종 포함)', async () => {
    const res = await request(app).get('/api/menus');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
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
        student_id: '202637001',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.no).toBe(1);
    expect(res.body.total_price).toBe(16000); // 8000 × 2
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
        student_id: '202637001',
        total_price: 999, // 무시되어야
        items_priced: [{ menu_id: 1, base_price: 1, quantity: 1 }], // 무시
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.total_price).toBe(8000);
  });

  it('외부인 + 토큰 생성 (P0-4: external_token 응답 미노출, access_token만 노출)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.is_external).toBe(true);
    // P0-4: external_token은 응답에서 노출 X. POST 응답에만 access_token 포함.
    expect(res.body.external_token).toBeUndefined();
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.access_token.length).toBeGreaterThan(10);
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
        student_id: '202637001',
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PRICING_ERROR');
  });

  it('★ Bug 7 회귀 — 주문 응답 timestamps는 ISO 8601 UTC (T...Z) 형식', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });
    expect(res.status).toBe(200);
    // SQLite datetime('now')는 'YYYY-MM-DD HH:MM:SS' (UTC, marker 없음) 출력.
    // serializeOrder가 ISO 8601 Z 형식으로 변환해야 브라우저(KST)가 540분 오차 없이 해석.
    expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe('사용자 API — POST /api/orders + 쿠폰', () => {
  it('쿠폰 사용 학생 — 1,000원 정액 할인 + used_coupons 등록 (ADR-019)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }], // 8000
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    // 8000 - 1000 = 7000 (정액 ADR-019)
    expect(res.body.total_price).toBe(7000);

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
        delivery_type: 'takeout',
      });
    const dup = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(dup.status).toBe(400);
    expect(dup.body.error).toBe('ALREADY_USED');
  });

  // ── find_error_v3 (2026-05-18) — 쿠폰 중복 기준 student_id 단일화 ─────
  it('★ find_error_v3 — 같은 학번 다른 이름으로 쿠폰 재사용 시도 → 400 ALREADY_USED', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const first = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(first.status).toBe(200);

    // 같은 학번에 이름만 다른 두 번째 쿠폰 주문 → 거부.
    const dup = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '김철수',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(dup.status).toBe(400);
    expect(dup.body.error).toBe('ALREADY_USED');
    expect(dup.body.message).toBe('이미 쿠폰을 사용한 학번이에요.');
  });

  it('★ find_error_v3 — 쿠폰 사용한 학번도 쿠폰 없는 일반 주문은 성공', async () => {
    const db = freshDb();
    const app = createApp({ db });
    // 1. 쿠폰 사용 주문 (학번 A, 이름 X)
    const couponOrder = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(couponOrder.status).toBe(200);
    expect(couponOrder.body.total_price).toBe(7000); // 1,000원 할인

    // 2. 같은 학번 + 다른 이름 + coupon 없음 → 정상 (할인 X)
    const plain = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '김철수',
        student_id: '202637001',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(plain.status).toBe(200);
    expect(plain.body.total_price).toBe(8000); // 할인 없음

    // 3. 같은 학번 + 동일 이름 + coupon.used=false → 정상
    const plainSameName = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        coupon: { used: false },
        delivery_type: 'takeout',
      });
    expect(plainSameName.status).toBe(200);
    expect(plainSameName.body.total_price).toBe(8000);
  });

  it('★ find_error_v3 — 같은 학번 다른 이름 쿠폰 시도 실패 후 DB는 첫 쿠폰만 보존', async () => {
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
        delivery_type: 'takeout',
      });
    const dup = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '김철수',
        student_id: '202637001',
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(dup.status).toBe(400);

    // used_coupons는 첫 주문(홍길동) 1행만 유지.
    const rows = db
      .prepare('SELECT student_id, name FROM used_coupons WHERE student_id = ?')
      .all('202637001');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('홍길동');
  });

  // ── P0-3 (Codex 리뷰) 쿠폰 할인 위변조 방어 ───────────────────
  // pricing.js는 coupon.used만 보고 1,000원 할인. 이후 consumeCoupon은 student_id가
  // 있을 때만 실행하므로, 외부인이거나 학번 없이 coupon: { used: true } 보내면
  // 할인만 받고 used_coupons 기록은 안 남는다. 서버가 거부해야.
  it('P0-3 — 외부인이 coupon.used=true 보내면 400 COUPON_REQUIRES_STUDENT', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COUPON_REQUIRES_STUDENT');
    // DB에 어떤 주문도 생성되지 X (트랜잭션 보호)
    const orderCount = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    expect(orderCount).toBe(0);
  });

  it('P0-3 — 외부인 + coupon.used=true 보내면 400 COUPON_REQUIRES_STUDENT', async () => {
    // P2-2 (find_error_v2) 이후: is_external=false + student_id 누락은 Zod가 먼저 거부.
    // 따라서 P0-3 게이트는 is_external=true + 쿠폰 사용 시도 벡터로 검증한다.
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        student_id: null,
        is_external: true,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COUPON_REQUIRES_STUDENT');
  });

  it('P0-3 — 잘못된 학번 형식(5자리) → 400 VALIDATION_ERROR (find_error_v2: 9자리 게이트가 먼저)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '12345', // 9자리 미만
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('P0-3 — 학과 코드 37이 아닌 학번 + coupon.used=true → 400 INVALID_FORMAT', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202612001', // 학과 코드 12 (다른 학과)
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_FORMAT');
  });

  it('P0-3 — 쿠폰 미사용(coupon.used=false) + 외부인 → 정상 주문 (할인 없음)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        coupon: { used: false },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.total_price).toBe(8000); // 할인 X
  });

  // ── find_error_v2 — 주문 자격(9자리) / 쿠폰 자격(37) 분리 ───────────────
  it('★ find_error_v2 — 9자리 비-37 학번 + 쿠폰 미사용 → 200 (주문 가능)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202111123',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.total_price).toBe(8000);
  });

  it('★ find_error_v2 — 9자리 비-37 학번 + coupon.used=true → 400 INVALID_FORMAT (쿠폰만 거부)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202111123',
        is_external: false,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_FORMAT');
    const orderCount = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    expect(orderCount).toBe(0);
  });

  it('★ find_error_v2 — 8자리 학번 + is_external=false → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '20211112',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('★ find_error_v2 — 영문 포함 학번 + is_external=false → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '20211a123',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('★ find_error_v2 — is_external=true + student_id=null → 200 (외부인 흐름 보존)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        student_id: null,
        is_external: true,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.is_external).toBe(true);
  });

  // P2-2 (Codex 리뷰) — 학생 주문 student_id 필수 정책 보강.
  it('★ P2-2 — is_external=false + student_id 누락 → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('학번은 숫자 9자리로 입력해주세요.');
  });

  it('★ P2-2 — is_external=false + student_id="" → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('학번은 숫자 9자리로 입력해주세요.');
  });

  it('★ P2-2 — is_external=false + student_id=null → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: null,
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('학번은 숫자 9자리로 입력해주세요.');
  });

  it('★ P2-2 — is_external=false + 9자리 학번 → 200 (정상 주문 회귀)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202111123',
        is_external: false,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.is_external).toBe(false);
  });
});

// ── minimap_design — POST /api/orders table_no 범위 (1~15) ─────────────
describe('사용자 API — POST /api/orders table_no 1~15 범위 검증', () => {
  const orderBase = (table_no) => ({
    items: [{ menu_id: 1, quantity: 1 }],
    name: '홍길동',
    student_id: '202637001',
    is_external: false,
    delivery_type: 'dineIn',
    table_no,
  });

  it('★ table_no=1 → 200 (경계 하한 정상)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase(1));
    expect(res.status).toBe(200);
    expect(res.body.table_no).toBe(1);
  });

  it('★ table_no=15 → 200 (경계 상한 정상)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase(15));
    expect(res.status).toBe(200);
    expect(res.body.table_no).toBe(15);
  });

  it('★ table_no=8 → 200 (중간값 정상)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase(8));
    expect(res.status).toBe(200);
  });

  it('★ table_no=0 → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase(0));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe(
      '테이블 번호는 1번부터 15번까지만 선택할 수 있어요.',
    );
  });

  it('★ table_no=16 → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase(16));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe(
      '테이블 번호는 1번부터 15번까지만 선택할 수 있어요.',
    );
  });

  it('★ table_no=999 → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase(999));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('★ table_no=-1 → 400 VALIDATION_ERROR (음수 거부)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase(-1));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('★ table_no="abc" → 400 VALIDATION_ERROR (문자 거부)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).post('/api/orders').send(orderBase('abc'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('★ table_no=null → 200 (포장 케이스 회귀 — 호환 유지)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        delivery_type: 'takeout',
        table_no: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.table_no).toBeNull();
  });

  it('★ table_no 미지정 → 200 (optional 회귀 — 호환 유지)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(200);
    expect(res.body.table_no).toBeNull();
  });

  // ── table_lock 라운드 P2-1 (Codex 리뷰 2026-05-19) ────────────────
  // delivery_type='dineIn' 명시 + table_no 누락 → 400 거부.
  // API 직접 호출 보호선 (프론트 CheckoutPage는 항상 table_no 같이 보냄).
  it('★ P2-1 — delivery_type=dineIn + table_no 미지정 → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        delivery_type: 'dineIn',
        // table_no 누락
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('매장 식사 주문은 테이블 번호를 선택해주세요.');
  });

  it('★ P2-1 — delivery_type=dineIn + table_no=null → 400 VALIDATION_ERROR', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        delivery_type: 'dineIn',
        table_no: null,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('★ P2-1 — delivery_type=takeout + table_no=null → 200 (포장 회귀)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        delivery_type: 'takeout',
        table_no: null,
      });
    expect(res.status).toBe(200);
  });

  it('★ P2-1 — delivery_type=dineIn + table_no=1 → 200 (정상 회귀)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        delivery_type: 'dineIn',
        table_no: 1,
      });
    expect(res.status).toBe(200);
    expect(res.body.table_no).toBe(1);
  });

  // ── P2-#3 (Codex 재리뷰 2026-05-19) — dining_at/settled_at ISO 직렬화 ────
  it('★ P2-#3 — serializeOrder 응답에 dining_at, settled_at 포함 (초기 null)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        is_external: false,
        delivery_type: 'dineIn',
        table_no: 2,
      });
    expect(res.status).toBe(200);
    // 응답에 두 키가 존재하고 (null) 다른 타임스탬프 필드와 같은 형식.
    expect(res.body).toHaveProperty('dining_at');
    expect(res.body).toHaveProperty('settled_at');
    expect(res.body.dining_at).toBeNull();
    expect(res.body.settled_at).toBeNull();
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

  it('CLOSED 상태에서 GET /api/menus → 302 /closed (충돌-3 정합, API_DRAFT §1.12)', async () => {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    const app = createApp({ db });
    const res = await request(app).get('/api/menus');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/closed');
  });

  it('CLOSED 상태에서도 GET /api/business-state는 통과 (SPA가 영업 상태 알아야 함)', async () => {
    const db = new Database(':memory:');
    bootstrapDatabase(db);
    const app = createApp({ db });
    const res = await request(app).get('/api/business-state');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLOSED');
  });
});

describe('사용자 API — GET /api/orders/:id', () => {
  it('생성 후 access_token 으로 조회', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        delivery_type: 'takeout',
      });
    expect(create.status).toBe(200);
    // P0-4: POST 응답에 access_token 포함
    expect(typeof create.body.access_token).toBe('string');
    expect(create.body.access_token.length).toBeGreaterThan(10);

    const get = await request(app)
      .get(`/api/orders/${create.body.id}?token=${create.body.access_token}`);
    expect(get.status).toBe(200);
    expect(get.body.id).toBe(create.body.id);
    expect(get.body.no).toBe(create.body.no);
    // P0-4: GET 응답에서 access_token, external_token 미노출
    expect(get.body.access_token).toBeUndefined();
    expect(get.body.external_token).toBeUndefined();
  });

  it('P0-4 — token 없이 조회 → 401 UNAUTHORIZED', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
      });
    const get = await request(app).get(`/api/orders/${create.body.id}`);
    expect(get.status).toBe(401);
    expect(get.body.error).toBe('UNAUTHORIZED');
  });

  it('P0-4 — 잘못된 token → 403 FORBIDDEN', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        delivery_type: 'takeout',
      });
    const get = await request(app)
      .get(`/api/orders/${create.body.id}?token=wrong-token-value`);
    expect(get.status).toBe(403);
    expect(get.body.error).toBe('FORBIDDEN');
  });

  it('P0-4 — 외부인 주문도 access_token 발급되고 동일 인증', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        delivery_type: 'takeout',
      });
    expect(create.status).toBe(200);
    expect(typeof create.body.access_token).toBe('string');

    const get = await request(app)
      .get(`/api/orders/${create.body.id}?token=${create.body.access_token}`);
    expect(get.status).toBe(200);
    expect(get.body.external_token).toBeUndefined();
    expect(get.body.access_token).toBeUndefined();
  });

  it('P0-4 — 타인 주문 ID + 본인 token → 403 FORBIDDEN (ID 추측 차단)', async () => {
    const app = createApp({ db: freshDb() });
    const a = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: 'A', student_id: '202637001', delivery_type: 'takeout' });
    const b = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: 'B', student_id: '202637002', delivery_type: 'takeout' });
    expect(a.body.id).not.toBe(b.body.id);

    // A 의 token으로 B 의 주문 조회 시도
    const cross = await request(app)
      .get(`/api/orders/${b.body.id}?token=${a.body.access_token}`);
    expect(cross.status).toBe(403);
  });

  it('존재 X → 404 ORDER_NOT_FOUND', async () => {
    const app = createApp({ db: freshDb() });
    // P0-4: 토큰 없으면 401 우선. 토큰 있고 주문이 없으면 404.
    const res = await request(app).get('/api/orders/9999?token=anything');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');
  });
});

describe('사용자 API — POST /api/orders/:id/transfer-report', () => {
  it('이체 신고 (token 포함) → status TRANSFER_REPORTED', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        delivery_type: 'takeout',
      });

    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({
        bank: '국민',
        depositorName: '김철수',
        amount: 8000,
      });
    expect(report.status).toBe(200);
    expect(report.body.status).toBe('TRANSFER_REPORTED');
    expect(report.body.depositor_name).toBe('김철수');
  });

  it('이체 신고 필드 누락 → 400 (token 있어도 검증 후)', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '홍길동',
        student_id: '202637001',
        delivery_type: 'takeout',
      });

    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '국민' }); // amount, depositorName 누락
    expect(report.status).toBe(400);
  });

  // ── P0-B (Codex v2) transfer-report 인증 ──────────────────────
  it('P0-B — token 없이 POST → 401 UNAUTHORIZED', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });

    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report`)
      .send({ bank: '국민', depositorName: '김철수', amount: 8000 });
    expect(report.status).toBe(401);
    expect(report.body.error).toBe('UNAUTHORIZED');
  });

  it('P0-B — 잘못된 token → 403 FORBIDDEN', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });

    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=wrong-token`)
      .send({ bank: '국민', depositorName: '김철수', amount: 8000 });
    expect(report.status).toBe(403);
    expect(report.body.error).toBe('FORBIDDEN');
  });

  it('P0-B — 타인 주문 ID + 본인 token → 403 (ID 추측 차단)', async () => {
    const app = createApp({ db: freshDb() });
    const a = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: 'A', student_id: '202637001', delivery_type: 'takeout' });
    const b = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: 'B', student_id: '202637002', delivery_type: 'takeout' });

    // A의 token으로 B 주문에 transfer-report 시도 → 403, B 주문 상태 변경 X
    const cross = await request(app)
      .post(`/api/orders/${b.body.id}/transfer-report?token=${a.body.access_token}`)
      .send({ bank: '국민', depositorName: 'A가 B 주문에 이체 보고 시도', amount: 8000 });
    expect(cross.status).toBe(403);

    // B 주문은 여전히 ORDERED (상태 변경 X)
    const bGet = await request(app).get(`/api/orders/${b.body.id}?token=${b.body.access_token}`);
    expect(bGet.body.status).toBe('ORDERED');
    expect(bGet.body.depositor_name).toBeFalsy();
  });

  it('P0-B — 존재하지 않는 주문 ID + 임의 token → 404 (token 검증 후)', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app)
      .post('/api/orders/9999/transfer-report?token=anything')
      .send({ bank: '날부', depositorName: 'X', amount: 1000 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');
  });

  // ── P1-1 (Codex 리뷰) 상태 가드 — ORDERED만 허용 ─────────────────
  // transfer-report API는 LEGAL_TRANSITIONS를 우회해 status를 강제 변경했었다.
  // 회귀: ORDERED 외 모든 상태에서 409 ILLEGAL_TRANSITION 거부.
  it('★ P1-1 — ORDERED 주문은 transfer-report 성공 (회귀)', async () => {
    const app = createApp({ db: freshDb() });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });
    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '국민', depositorName: '홍길동', amount: 8000 });
    expect(report.status).toBe(200);
    expect(report.body.status).toBe('TRANSFER_REPORTED');
  });

  // ── find_error_v2 — TRANSFER_REPORTED 중복 제출은 친절한 409로 응답 ─────
  // 회귀 동기: 사용자가 이체 신고 후 뒤로가기 → 재제출 시 raw "불법 상태 전이"
  // 문구가 UI에 노출되던 사고. 라우트가 도메인 에러 메시지를 가공해 친절한 안내로 변환.
  it('★ find_error_v2 — TRANSFER_REPORTED 중복 제출 → 409 TRANSFER_ALREADY_REPORTED', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });

    // 첫 신고 — 정상 200
    const first = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '국민', depositorName: '홍길동', amount: 8000 });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('TRANSFER_REPORTED');

    // 두번째 신고 (중복) — 친절한 안내. 내부 문구 "불법 상태 전이" 노출 X.
    const dup = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '신한', depositorName: '다른이름', amount: 7000 });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('TRANSFER_ALREADY_REPORTED');
    expect(dup.body.message).toBeDefined();
    expect(dup.body.message).not.toContain('불법 상태 전이');
  });

  // 회귀: 중복 제출은 DB의 transferred_at·입금 정보를 덮어쓰지 않아야 한다 (스냅샷 비교).
  it('★ find_error_v2 — TRANSFER_REPORTED 중복 제출은 DB 행을 변경하지 않는다', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });

    await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '국민', depositorName: '홍길동', amount: 8000 });

    const before = db
      .prepare('SELECT status, depositor_name, bank, amount, transferred_at FROM orders WHERE id = ?')
      .get(create.body.id);

    const dup = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '신한', depositorName: '덮어쓰기시도', amount: 99999 });
    expect(dup.status).toBe(409);

    const after = db
      .prepare('SELECT status, depositor_name, bank, amount, transferred_at FROM orders WHERE id = ?')
      .get(create.body.id);
    expect(after).toEqual(before);
  });

  // 그 외 불법 상태(PAID/COOKING/READY/DONE/CANCELED/HOLD)는 친절한 TRANSFER_NOT_ALLOWED로.
  it.each([
    ['PAID'],
    ['COOKING'],
    ['READY'],
    ['DONE'],
    ['CANCELED'],
    ['HOLD'],
  ])('★ find_error_v2 — %s 상태 주문 transfer-report → 409 TRANSFER_NOT_ALLOWED (내부 문구 미노출)', async (state) => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });
    // 테스트 fixture — DB SQL로 상태 강제 (도메인 검증 우회는 의도된 setup).
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(state, create.body.id);

    const report = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '국민', depositorName: '홍길동', amount: 8000 });
    expect(report.status).toBe(409);
    expect(report.body.error).toBe('TRANSFER_NOT_ALLOWED');
    expect(report.body.message).toBeDefined();
    expect(report.body.message).not.toContain('불법 상태 전이');

    // 상태가 임의로 변하지 않았는지 회귀.
    const dbRow = db.prepare('SELECT status FROM orders WHERE id = ?').get(create.body.id);
    expect(dbRow.status).toBe(state);
  });
});

// ── find_error_v2 — order_events 자동 로깅 (CREATED + TRANSFER_REPORTED) ─────
describe('order_events 자동 로깅 — POST /api/orders', () => {
  it('★ 주문 성공 시 CREATED 이벤트 INSERT (actor=customer)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });
    expect(res.status).toBe(200);
    const events = db
      .prepare('SELECT * FROM order_events WHERE order_id = ?')
      .all(res.body.id);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('CREATED');
    expect(events[0].from_status).toBeNull();
    expect(events[0].to_status).toBe('ORDERED');
    expect(events[0].actor).toBe('customer');
    expect(events[0].action_name).toBe('주문 접수');
  });

  it('★ 주문 실패(쿠폰 위변조) → 이벤트 INSERT X (트랜잭션 ROLLBACK 보호)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ menu_id: 1, quantity: 1 }],
        name: '외부 손님',
        is_external: true,
        coupon: { used: true },
        delivery_type: 'takeout',
      });
    expect(res.status).toBe(400);
    const count = db.prepare('SELECT COUNT(*) AS c FROM order_events').get().c;
    expect(count).toBe(0);
  });
});

describe('order_events 자동 로깅 — POST /api/orders/:id/transfer-report', () => {
  it('★ 정상 이체 신고 시 TRANSFER_REPORTED 이벤트 INSERT (actor=customer, from=ORDERED)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });
    await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '국민', depositorName: '홍길동', amount: 8000 });
    const events = db
      .prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id')
      .all(create.body.id);
    // CREATED + TRANSFER_REPORTED — 2 행.
    expect(events).toHaveLength(2);
    const tr = events.find((e) => e.event_type === 'TRANSFER_REPORTED');
    expect(tr).toBeDefined();
    expect(tr.from_status).toBe('ORDERED');
    expect(tr.to_status).toBe('TRANSFER_REPORTED');
    expect(tr.actor).toBe('customer');
    expect(tr.action_name).toBe('이체 완료 요청');
  });

  it('★ TRANSFER_REPORTED 중복 제출 → 이벤트는 1행 유지 (회귀)', async () => {
    const db = freshDb();
    const app = createApp({ db });
    const create = await request(app)
      .post('/api/orders')
      .send({ items: [{ menu_id: 1, quantity: 1 }], name: '홍길동', student_id: '202637001', delivery_type: 'takeout' });
    await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '국민', depositorName: '홍길동', amount: 8000 });
    // 두번째(중복) — 409로 단락되어 이벤트 INSERT 안 됨.
    const dup = await request(app)
      .post(`/api/orders/${create.body.id}/transfer-report?token=${create.body.access_token}`)
      .send({ bank: '신한', depositorName: '다른이름', amount: 7000 });
    expect(dup.status).toBe(409);
    const trCount = db
      .prepare("SELECT COUNT(*) AS c FROM order_events WHERE order_id = ? AND event_type = 'TRANSFER_REPORTED'")
      .get(create.body.id).c;
    expect(trCount).toBe(1);
  });
});

// ── table_lock 브랜치 Subagent 1 — POST /api/orders availability 가드 ──────
describe('사용자 API — POST /api/orders 테이블 availability 가드', () => {
  function insertPaidOrder(db, table_no) {
    db.prepare(
      `INSERT INTO orders (no, operating_date, status, name, student_id, delivery_type, table_no, total_price)
       VALUES (1, '2026-05-20', 'PAID', '먼저온손님', '202637001', 'dineIn', ?, 8000)`,
    ).run(table_no);
  }

  const orderFor = (table_no) => ({
    items: [{ menu_id: 1, quantity: 1 }],
    name: '나중손님',
    student_id: '202637002',
    is_external: false,
    delivery_type: 'dineIn',
    table_no,
  });

  it('5번 PAID 점유 상태 → POST {table_no:5} → 409 TABLE_NOT_AVAILABLE', async () => {
    const db = freshDb();
    insertPaidOrder(db, 5);
    const app = createApp({ db });
    const res = await request(app).post('/api/orders').send(orderFor(5));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('TABLE_NOT_AVAILABLE');
    expect(res.body.message).toBe(
      '현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요.',
    );
  });

  it('5번 잠금 상태 → POST {table_no:5} → 409 TABLE_NOT_AVAILABLE (동일 메시지)', async () => {
    const db = freshDb();
    // table_locks에 직접 잠금 삽입
    db.prepare(
      `INSERT INTO table_locks (table_no, locked, locked_at) VALUES (5, 1, datetime('now'))`,
    ).run();
    const app = createApp({ db });
    const res = await request(app).post('/api/orders').send(orderFor(5));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('TABLE_NOT_AVAILABLE');
    expect(res.body.message).toBe(
      '현재 선택하신 테이블은 이용 중이거나 준비 중입니다. 번거로우시겠지만 다른 테이블로 이동해 주세요.',
    );
  });

  it('5번 SETTLED 주문 후 → POST {table_no:5} → 200 (재선택 가능)', async () => {
    const db = freshDb();
    // SETTLED 주문 삽입
    db.prepare(
      `INSERT INTO orders (no, operating_date, status, name, student_id, delivery_type, table_no, total_price)
       VALUES (1, '2026-05-20', 'SETTLED', '먼저온손님', '202637001', 'dineIn', 5, 8000)`,
    ).run();
    const app = createApp({ db });
    const res = await request(app).post('/api/orders').send(orderFor(5));
    expect(res.status).toBe(200);
  });

  it('포장 주문 (delivery_type=takeout, table_no=null) → 점유 검증 우회 → 200', async () => {
    const db = freshDb();
    insertPaidOrder(db, 5); // 5번 점유 중이지만 포장은 무관
    const app = createApp({ db });
    const res = await request(app).post('/api/orders').send({
      items: [{ menu_id: 1, quantity: 1 }],
      name: '포장손님',
      is_external: true,
      delivery_type: 'takeout',
      table_no: null,
    });
    expect(res.status).toBe(200);
  });
});

// ── table_lock 브랜치 Subagent 1 — GET /api/tables/availability ─────────
describe('사용자 API — GET /api/tables/availability', () => {
  it('200 응답 + 길이 15', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/api/tables/availability');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(15);
  });

  it('각 row는 {table_no, status} 만 포함 — order_no/dining_at/locked_at 없음', async () => {
    const app = createApp({ db: freshDb() });
    const res = await request(app).get('/api/tables/availability');
    expect(res.status).toBe(200);
    res.body.forEach((row) => {
      expect(row).toHaveProperty('table_no');
      expect(row).toHaveProperty('status');
      expect(row).not.toHaveProperty('order_no');
      expect(row).not.toHaveProperty('dining_at');
      expect(row).not.toHaveProperty('locked_at');
    });
    expect(res.body[0].table_no).toBe(1);
    expect(res.body[0].status).toBe('available');
  });

  it('5번 PAID 후 응답: 5번 occupied, order_no 없음', async () => {
    const db = freshDb();
    db.prepare(
      `INSERT INTO orders (no, operating_date, status, name, student_id, delivery_type, table_no, total_price)
       VALUES (1, '2026-05-20', 'PAID', '손님', '202637001', 'dineIn', 5, 8000)`,
    ).run();
    const app = createApp({ db });
    const res = await request(app).get('/api/tables/availability');
    expect(res.status).toBe(200);
    const row5 = res.body.find((r) => r.table_no === 5);
    expect(row5.status).toBe('occupied');
    expect(row5.order_no).toBeUndefined();
  });
});
