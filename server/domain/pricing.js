// ============================================================
// Task 6.2 — ADR-020 Pattern B 가격 자체 계산 (★★★)
//
// 책임:
//   - 클라이언트가 보낸 가격·합계·할인을 *전혀 받지 않는다*. 시그니처가 차단.
//   - 서버는 menu_id + quantity만 받아 DB lookup으로 가격을 자체 계산.
//   - 쿠폰 적용 시 1,000원 정액 할인 (ADR-019).
//   - 트랜잭션 시점 DB 가격을 사용 — 메뉴 단가 변경 시 주문 시점 값으로 스냅샷.
//
// 회귀 보호 (server/domain/__tests__/pricing.test.js):
//   1) 정상: menu_id+qty → total 계산
//   2) 클라 total 무시: noise 필드 끼워도 재계산
//   3) 존재 X menu_id 거부
//   4) 쿠폰 1,000원 정액 할인 (subtotal 미만 보장 — 음수 방어)
//
// 절대 깨지면 안 되는 ADR (CLAUDE.md):
//   - ADR-020 4 회귀 케이스
//   - G10 본명 스냅샷 (items_priced에 name·base_price 포함)
// ============================================================

/**
 * PricingError — 가격 계산 실패.
 * @property {string} code — MENU_NOT_FOUND · MENU_SOLD_OUT · PRICING_ERROR
 */
export class PricingError extends Error {
  constructor(message, code = 'PRICING_ERROR') {
    super(message);
    this.name = 'PricingError';
    this.code = code;
  }
}

/**
 * 주문 가격 자체 계산 (ADR-020 ★★★).
 *
 * @param {object} input
 * @param {Array<{menu_id: number, quantity: number}>} input.items
 * @param {object|null} [input.coupon] — { used: true } 시 1,000원 정액 할인 (ADR-019)
 * @param {import('better-sqlite3').Database} db
 * @returns {{ total_price: number, items_priced: Array, discount: number }}
 */
export function calculatePrice({ items, coupon }, db) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PricingError('items가 비어있습니다');
  }

  const itemsPriced = [];
  let subtotal = 0;

  for (const it of items) {
    if (!Number.isInteger(it.menu_id) || it.menu_id <= 0) {
      throw new PricingError(`잘못된 menu_id: ${it.menu_id}`);
    }
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new PricingError(`잘못된 quantity: ${it.quantity}`);
    }

    const menu = db
      .prepare(
        'SELECT id, code, name, category, base_price, sold_out FROM menus WHERE id = ?',
      )
      .get(it.menu_id);
    if (!menu) {
      throw new PricingError(
        `존재하지 않는 menu_id: ${it.menu_id}`,
        'MENU_NOT_FOUND',
      );
    }
    if (menu.sold_out) {
      throw new PricingError(`품절: ${menu.name}`, 'MENU_SOLD_OUT');
    }

    const lineTotal = menu.base_price * it.quantity;
    subtotal += lineTotal;
    itemsPriced.push({
      menu_id: menu.id,
      name: menu.name, // G10 — 주문 시점 본명 스냅샷
      base_price: menu.base_price,
      quantity: it.quantity,
      category: menu.category,
      line_total: lineTotal,
    });
  }

  // 쿠폰 — 1,000원 정액 할인 (ADR-019).
  // Math.min으로 subtotal 초과 방지 (음수 total 회귀).
  const COUPON_DISCOUNT = 1000;
  let discount = 0;
  if (coupon?.used) {
    discount = Math.min(COUPON_DISCOUNT, subtotal);
  }

  return {
    total_price: subtotal - discount,
    items_priced: itemsPriced,
    discount,
  };
}
