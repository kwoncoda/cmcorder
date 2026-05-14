// Task 6.2 — ADR-020 ★★★ Pattern B 가격 자체 계산 회귀 보호.
//
// 4 회귀 케이스 (절대 깨지면 안 됨 — CLAUDE.md):
//   1) 정상 — menu_id + qty만으로 total 계산
//   2) 클라가 다른 total 보내도 무시 (재계산)
//   3) 존재하지 않는 menu_id 거부
//   4) 쿠폰 적용 시 할인
//
// :memory: SQLite + bootstrapDatabase로 격리 — 디스크 부수효과 없음.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { calculatePrice, PricingError } from '../pricing.js';

let db;

beforeEach(() => {
  db = new Database(':memory:');
  bootstrapDatabase(db);
});

describe('pricing — ADR-020 ★★★ 4 회귀', () => {
  it('★★★ 회귀 1: 정상 — menu_id + qty만으로 total 계산', () => {
    // 후라이드(id=1) base_price=18000 × 2 = 36000
    const r = calculatePrice({ items: [{ menu_id: 1, quantity: 2 }] }, db);
    expect(r.total_price).toBe(36000);
  });

  it('★★★ 회귀 2: 클라가 다른 total 보내도 무시 (시그니처 차단 + 재계산)', () => {
    // calculatePrice는 items + coupon만 받음 → 다른 total을 보낼 채널 자체 없음
    // 입력에 noise 필드를 끼워도 무시됨을 확인.
    const r = calculatePrice(
      { items: [{ menu_id: 1, quantity: 1 }], total: 99999, total_price: 99999 },
      db,
    );
    expect(r.total_price).toBe(18000); // 클라 total/total_price 무시 — 서버 재계산
  });

  it('★★★ 회귀 3: 존재하지 않는 menu_id 거부', () => {
    expect(() => calculatePrice({ items: [{ menu_id: 999, quantity: 1 }] }, db)).toThrow(
      PricingError,
    );
  });

  it('★★★ 회귀 4: 쿠폰 적용 시 1,000원 정액 할인 (ADR-019)', () => {
    const r = calculatePrice(
      { items: [{ menu_id: 1, quantity: 1 }], coupon: { used: true } },
      db,
    );
    // 18000 − 1000 = 17000 (정액)
    expect(r.total_price).toBe(17000);
    expect(r.discount).toBe(1000);
  });

  it('★ 쿠폰 정액 할인 — subtotal이 1000 미만이어도 음수 방어', () => {
    // 가장 싼 메뉴(콜라 2000원)도 1000원 할인 적용 가능 — 음수 X 회귀
    const r = calculatePrice(
      { items: [{ menu_id: 7, quantity: 1 }], coupon: { used: true } },
      db,
    );
    expect(r.total_price).toBe(1000); // 2000 - 1000
    expect(r.discount).toBe(1000);
  });
});

describe('pricing — 추가 케이스', () => {
  it('여러 메뉴 합산', () => {
    const r = calculatePrice(
      { items: [{ menu_id: 1, quantity: 1 }, { menu_id: 7, quantity: 3 }] },
      db,
    );
    // 후라이드 18000 + 콜라 2000 * 3 = 24000
    expect(r.total_price).toBe(24000);
  });

  it('quantity 0 거부', () => {
    expect(() =>
      calculatePrice({ items: [{ menu_id: 1, quantity: 0 }] }, db),
    ).toThrow(PricingError);
  });

  it('quantity 음수 거부', () => {
    expect(() =>
      calculatePrice({ items: [{ menu_id: 1, quantity: -1 }] }, db),
    ).toThrow(PricingError);
  });

  it('빈 items 거부', () => {
    expect(() => calculatePrice({ items: [] }, db)).toThrow(PricingError);
  });

  it('items_priced 스냅샷 — name + base_price 포함 (G10)', () => {
    const r = calculatePrice({ items: [{ menu_id: 1, quantity: 1 }] }, db);
    expect(r.items_priced).toHaveLength(1);
    expect(r.items_priced[0].name).toBe('후라이드');
    expect(r.items_priced[0].base_price).toBe(18000);
    expect(r.items_priced[0].quantity).toBe(1);
    expect(r.items_priced[0].menu_id).toBe(1);
    expect(r.items_priced[0].line_total).toBe(18000);
  });

  it('품절 메뉴 거부', () => {
    db.prepare('UPDATE menus SET sold_out = 1 WHERE id = 1').run();
    expect(() =>
      calculatePrice({ items: [{ menu_id: 1, quantity: 1 }] }, db),
    ).toThrow(PricingError);
  });

  it('쿠폰 미사용 — 할인 0', () => {
    const r = calculatePrice({ items: [{ menu_id: 1, quantity: 1 }] }, db);
    expect(r.discount).toBe(0);
    expect(r.total_price).toBe(18000);
  });

  it('menu_id 정수 아님 거부', () => {
    expect(() =>
      calculatePrice({ items: [{ menu_id: 'abc', quantity: 1 }] }, db),
    ).toThrow(PricingError);
  });

  it('PricingError code — MENU_NOT_FOUND', () => {
    try {
      calculatePrice({ items: [{ menu_id: 9999, quantity: 1 }] }, db);
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(PricingError);
      expect(err.code).toBe('MENU_NOT_FOUND');
    }
  });
});
