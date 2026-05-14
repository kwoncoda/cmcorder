// Task 6.6 — 사용자 API 라우트.
//
// ADR-020 Pattern B (★★★): 클라가 보낸 가격/합계/할인은 무시.
// 서버는 menu_id+qty만 받아 calculatePrice로 자체 계산.
//
// 12 엔드포인트 중 본 task에서 다루는 핵심 6개:
//   GET  /api/menus
//   GET  /api/popular
//   GET  /api/business-state
//   POST /api/orders
//   GET  /api/orders/:id
//   POST /api/orders/:id/transfer-report
//
// 나머지(SSE · 외부인 토큰 조회 등)는 Task 6.6 후속 단계.
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { listMenus } from '../repositories/menu-repo.js';
import {
  createOrder,
  getOrder,
  updateTransferInfo,
} from '../repositories/order-repo.js';
import { calculatePrice } from '../domain/pricing.js';
import { consumeCoupon, CouponError } from '../domain/coupon.js';
import { getPopularMenus } from '../domain/popularity.js';
import { getBusinessState } from '../domain/business-state.js';

const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menu_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'items가 비어있습니다'),
  student_id: z.string().nullable().optional(),
  name: z.string().min(1, '이름이 필요합니다'),
  is_external: z.boolean().optional(),
  delivery_type: z.enum(['dineIn', 'takeout']).optional(),
  table_no: z.number().int().nullable().optional(),
  coupon: z.object({ used: z.boolean() }).nullable().optional(),
});

const TransferReportSchema = z.object({
  bank: z.string().min(1),
  customBank: z.string().optional(),
  depositorName: z.string().min(1),
  useOtherName: z.boolean().optional(),
  otherName: z.string().optional(),
  amount: z.number().int().positive(),
});

/**
 * 사용자 API 라우터.
 * @param {import('better-sqlite3').Database} db
 */
export function customerRoutes(db) {
  const router = Router();

  // ── GET /api/menus ──
  router.get('/api/menus', (_req, res) => {
    const menus = listMenus(db);
    res.json(
      menus.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        basePrice: m.base_price,
        image: m.image,
        soldOut: !!m.sold_out,
        recommended: !!m.recommended,
      })),
    );
  });

  // ── GET /api/popular ──
  router.get('/api/popular', (_req, res) => {
    const popular = getPopularMenus(db, 3);
    res.json(
      popular.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        basePrice: m.base_price,
        image: m.image,
      })),
    );
  });

  // ── GET /api/business-state ──
  router.get('/api/business-state', (_req, res) => {
    res.json(getBusinessState(db));
  });

  // ── POST /api/orders (ADR-020 Pattern B + P0-3 쿠폰 위변조 방어) ──
  router.post('/api/orders', (req, res, next) => {
    try {
      const input = CreateOrderSchema.parse(req.body);
      const operating_date = getBusinessState(db).operating_date;

      // P0-3 (Codex 리뷰) — 쿠폰 위변조 방어.
      // pricing.js는 coupon.used만 보고 1,000원 할인하므로, 학번/외부인 검증을
      // *가격 계산 이전*에 강제해야 한다. 거부 시 트랜잭션 시작 전이라 DB 무변경.
      if (input.coupon?.used) {
        if (input.is_external || !input.student_id) {
          throw new CouponError(
            '쿠폰은 학번이 있는 학생만 사용할 수 있습니다',
            'COUPON_REQUIRES_STUDENT',
          );
        }
      }

      // 서버 자체 계산 — 클라가 보낸 total/items_priced는 무시
      const priced = calculatePrice(
        { items: input.items, coupon: input.coupon },
        db,
      );

      const result = db.transaction(() => {
        const externalToken = input.is_external ? crypto.randomUUID() : null;
        const order = createOrder(db, {
          items_priced: priced.items_priced,
          total_price: priced.total_price,
          name: input.name,
          student_id: input.student_id ?? null,
          is_external: input.is_external ?? false,
          external_token: externalToken,
          delivery_type: input.delivery_type ?? 'dineIn',
          table_no: input.table_no ?? null,
          operating_date,
        });
        // 쿠폰 소비 — 위 P0-3 가드로 student_id·!is_external가 보장됨.
        // validateCoupon 실패(형식·중복) 시 트랜잭션 ROLLBACK으로 주문도 취소.
        if (input.coupon?.used) {
          consumeCoupon(
            {
              studentId: input.student_id,
              name: input.name,
              orderId: order.id,
            },
            db,
          );
        }
        return order;
      })();

      res.json(serializeOrder(result));
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/orders/:id ──
  router.get('/api/orders/:id', (req, res) => {
    const order = getOrder(db, Number(req.params.id));
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }
    return res.json(serializeOrder(order));
  });

  // ── POST /api/orders/:id/transfer-report ──
  router.post('/api/orders/:id/transfer-report', (req, res, next) => {
    try {
      const input = TransferReportSchema.parse(req.body);
      const order = updateTransferInfo(db, Number(req.params.id), {
        depositor_name: input.depositorName,
        bank: input.bank,
        custom_bank: input.customBank,
        use_other_name: input.useOtherName,
        other_name: input.otherName,
        amount: input.amount,
      });
      res.json(serializeOrder(order));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function serializeOrder(o) {
  return {
    id: o.id,
    no: o.no,
    operating_date: o.operating_date,
    status: o.status,
    name: o.name,
    items: o.items,
    total_price: o.total_price,
    is_external: !!o.is_external,
    external_token: o.external_token,
    delivery_type: o.delivery_type,
    table_no: o.table_no,
    depositor_name: o.depositor_name,
    bank: o.bank,
    amount: o.amount,
    created_at: o.created_at,
    transferred_at: o.transferred_at,
    paid_at: o.paid_at,
    cooking_at: o.cooking_at,
    ready_at: o.ready_at,
    done_at: o.done_at,
  };
}
