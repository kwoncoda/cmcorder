// Task 6.8 — error middleware 회귀.
// 도메인 에러 → 적절한 HTTP 상태 + 에러 코드.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../error.js';
import { PricingError } from '../../domain/pricing.js';
import { CouponError } from '../../domain/coupon.js';
import { StateTransitionError } from '../../domain/order-state.js';
import { SettlementError } from '../../domain/settlement.js';

function makeApp(thrower) {
  const app = express();
  app.get('/x', (_req, _res, next) => {
    try {
      thrower();
    } catch (e) {
      next(e);
    }
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('PricingError → 400 PRICING_ERROR', async () => {
    const app = makeApp(() => {
      throw new PricingError('테스트', 'MENU_NOT_FOUND');
    });
    const res = await request(app).get('/x');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PRICING_ERROR');
  });

  it('CouponError → 400 + code 그대로', async () => {
    const app = makeApp(() => {
      throw new CouponError('이미 사용', 'ALREADY_USED');
    });
    const res = await request(app).get('/x');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ALREADY_USED');
  });

  it('StateTransitionError → 409 ILLEGAL_TRANSITION', async () => {
    const app = makeApp(() => {
      throw new StateTransitionError('ORDERED', 'DONE');
    });
    const res = await request(app).get('/x');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ILLEGAL_TRANSITION');
  });

  it('SettlementError → 409 + code', async () => {
    const app = makeApp(() => {
      throw new SettlementError('진행 중', 'IN_PROGRESS_EXISTS');
    });
    const res = await request(app).get('/x');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('IN_PROGRESS_EXISTS');
  });

  it('기타 Error → 500 INTERNAL_ERROR', async () => {
    const app = makeApp(() => {
      throw new Error('unexpected');
    });
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });
});
