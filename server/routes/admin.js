// Task 6.7 — 관리자 API 16개 핵심 엔드포인트.
//
// 인증: express-session 쿠키 (sessionMiddleware) + requireAdmin (모든 /admin/api/*).
// 절대 깨지면 안 됨:
//   - ADR-012 정산 마감 가드 (closeSettlement 도메인이 보장)
//   - ADR-025 13 합법 전이만 (transition throw → errorHandler 409)
//   - G13 settlement/close 자동 business_state CLOSED (settlement 도메인 트랜잭션)
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, loginAdmin } from '../middleware/admin-auth.js';
import { requireCsrf, csrfTokenHandler } from '../middleware/csrf.js';
import {
  listMenus,
  toggleMenu,
} from '../repositories/menu-repo.js';
import {
  listOrders,
  getOrder,
  updateOrderStatus,
} from '../repositories/order-repo.js';
import { listOrderEvents } from '../repositories/order-events-repo.js';
import { listCouponUsage } from '../repositories/coupon-repo.js';
import {
  getBusinessState,
  openBusiness,
} from '../domain/business-state.js';
import {
  getSettlementSummary,
  closeSettlement,
} from '../domain/settlement.js';
import { transition } from '../domain/order-state.js';
import { createSettlementZip } from '../jobs/auto-snapshot.js';

const LoginSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN은 6자리 숫자여야 합니다'),
});

const OpenSchema = z.object({
  operating_date: z.string().optional(),
});

const ToggleSchema = z.object({
  soldOut: z.boolean().optional(),
  recommended: z.boolean().optional(),
  base_price: z.number().int().positive().optional(),
});

const TransitionSchema = z.object({
  to: z.string().min(1),
});

const CloseSettlementSchema = z.object({
  operating_date: z.string().optional(),
});

/**
 * 메뉴 직렬화 — basePrice / soldOut / recommended boolean.
 */
function serializeMenu(m) {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    category: m.category,
    basePrice: m.base_price,
    image: m.image,
    soldOut: !!m.sold_out,
    recommended: !!m.recommended,
  };
}

// Bug 7 — SQLite 'YYYY-MM-DD HH:MM:SS' (UTC, marker 없음) → 'YYYY-MM-DDTHH:MM:SSZ' ISO 8601.
// 브라우저(KST)가 marker 없는 문자열을 local time으로 잘못 해석해 540분 오차가 생기는 문제 방어.
// 이미 'T'와 'Z' 또는 오프셋이 포함된 형식은 그대로 유지.
function toIsoUtc(str) {
  if (str == null) return str;
  if (typeof str !== 'string') return str;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) {
    return str.replace(' ', 'T') + 'Z';
  }
  return str;
}

const TS_FIELDS = [
  'created_at',
  'updated_at',
  'transferred_at',
  'paid_at',
  'cooking_at',
  'ready_at',
  'done_at',
];

// Bug 8 — admin 응답 SQLite shape → JSON normalized shape.
// is_external/use_other_name는 SQLite 0|1을 boolean으로, 그 외는 그대로 전달.
// Bug 7 — timestamp 필드는 ISO 8601 Z 형식으로 변환.
// customer 측 serializeOrder와 같은 패턴을 유지해 클라 OrderSchema(zod)가 통과하도록 한다.
function serializeAdminOrder(o) {
  if (!o) return o;
  const out = {
    ...o,
    is_external: !!o.is_external,
    use_other_name: o.use_other_name == null ? null : !!o.use_other_name,
  };
  for (const f of TS_FIELDS) {
    if (out[f] != null) out[f] = toIsoUtc(out[f]);
  }
  return out;
}

/**
 * 관리자 라우터.
 * @param {import('better-sqlite3').Database} db
 */
export function adminRoutes(db) {
  const router = Router();

  // ── POST /admin/login ──
  router.post('/admin/login', (req, res, next) => {
    try {
      const { pin } = LoginSchema.parse(req.body);
      const adminId = loginAdmin(db, pin);
      if (!adminId) {
        return res.status(401).json({ error: 'INVALID_PIN', message: 'PIN이 일치하지 않습니다.' });
      }
      req.session.adminId = adminId;
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // ── POST /admin/logout ──
  router.post('/admin/logout', (req, res) => {
    if (req.session) {
      req.session.destroy(() => res.json({ ok: true }));
    } else {
      res.json({ ok: true });
    }
  });

  // 이하 모두 requireAdmin
  router.use('/admin/api', requireAdmin);
  // P1-6 (Codex 리뷰): mutation 보호. GET/HEAD/OPTIONS는 통과.
  router.use('/admin/api', requireCsrf);

  // ── GET /admin/api/csrf-token (P1-6) ──
  router.get('/admin/api/csrf-token', csrfTokenHandler);

  // ── GET /admin/api/business/state ──
  router.get('/admin/api/business/state', (_req, res) => {
    res.json(getBusinessState(db));
  });

  // ── POST /admin/api/business/open (G13 멱등) ──
  router.post('/admin/api/business/open', (req, res, next) => {
    try {
      const { operating_date } = OpenSchema.parse(req.body ?? {});
      const target = operating_date ?? getBusinessState(db).operating_date;
      const updated = openBusiness(db, { operating_date: target });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ── GET /admin/api/menus ──
  router.get('/admin/api/menus', (_req, res) => {
    res.json(listMenus(db).map(serializeMenu));
  });

  // ── POST /admin/api/menus/:id/toggle ──
  router.post('/admin/api/menus/:id/toggle', (req, res, next) => {
    try {
      const patch = ToggleSchema.parse(req.body ?? {});
      const id = Number(req.params.id);
      // 존재 가드 — toggleMenu는 없으면 undefined 반환
      const updated = toggleMenu(db, id, patch);
      if (!updated) {
        return res.status(404).json({ error: 'MENU_NOT_FOUND', message: '메뉴를 찾을 수 없습니다.' });
      }
      return res.json(serializeMenu(updated));
    } catch (err) {
      return next(err);
    }
  });

  // ── GET /admin/api/orders (status=A,B 다중 필터 지원) ──
  router.get('/admin/api/orders', (req, res) => {
    const operating_date =
      typeof req.query.date === 'string' && req.query.date.length > 0
        ? req.query.date
        : getBusinessState(db).operating_date;
    let status;
    if (typeof req.query.status === 'string' && req.query.status.length > 0) {
      const parts = req.query.status.split(',').filter(Boolean);
      status = parts.length > 1 ? parts : parts[0];
    }
    // Bug 8 — 목록/대시보드도 동일 shape 일관성 보장 (is_external boolean).
    res.json(listOrders(db, { operating_date, status }).map(serializeAdminOrder));
  });

  // ── GET /admin/api/orders/:id ──
  router.get('/admin/api/orders/:id', (req, res) => {
    const order = getOrder(db, Number(req.params.id));
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다.' });
    }
    // Bug 8 — SQLite 0|1을 boolean으로 정규화 (클라 OrderSchema 통과).
    return res.json(serializeAdminOrder(order));
  });

  // ── POST /admin/api/orders/:id/transition (ADR-025) ──
  router.post('/admin/api/orders/:id/transition', (req, res, next) => {
    try {
      const { to } = TransitionSchema.parse(req.body ?? {});
      const order = getOrder(db, Number(req.params.id));
      if (!order) {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다.' });
      }
      // 불법 전이면 StateTransitionError throw → errorHandler 409
      transition(order.status, to);
      // find_error_v2 — admin 전이 이벤트 INSERT (트랜잭션 안).
      const updated = updateOrderStatus(db, order.id, to, {}, { actor: 'admin' });
      // Bug 8 — transition 응답도 동일 shape 유지.
      return res.json(serializeAdminOrder(updated));
    } catch (err) {
      return next(err);
    }
  });

  // ── GET /admin/api/transfers — TRANSFER_REPORTED 만 ──
  router.get('/admin/api/transfers', (req, res) => {
    const operating_date =
      typeof req.query.date === 'string' && req.query.date.length > 0
        ? req.query.date
        : getBusinessState(db).operating_date;
    const orders = listOrders(db, { operating_date, status: 'TRANSFER_REPORTED' });
    res.json(
      orders.map((o) => ({
        id: o.id,
        no: o.no,
        depositor_name: o.depositor_name,
        bank: o.bank,
        custom_bank: o.custom_bank,
        amount: o.amount,
        // Bug 7 — transferred_at은 ISO 8601 Z 형식으로 변환.
        transferred_at: toIsoUtc(o.transferred_at),
        status: o.status,
      })),
    );
  });

  // ── GET /admin/api/settlement (요약) ──
  router.get('/admin/api/settlement', (req, res) => {
    const operating_date =
      typeof req.query.date === 'string' && req.query.date.length > 0
        ? req.query.date
        : getBusinessState(db).operating_date;
    res.json(getSettlementSummary(db, operating_date));
  });

  // ── POST /admin/api/settlement/close (ADR-012 + G13) ──
  router.post('/admin/api/settlement/close', (req, res, next) => {
    try {
      const { operating_date } = CloseSettlementSchema.parse(req.body ?? {});
      const target = operating_date ?? getBusinessState(db).operating_date;
      const summary = closeSettlement(db, target);
      // closeSettlement 내부 — settlements INSERT + business_state CLOSED
      res.json({ ...summary, is_closed: true });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /admin/api/history (find_error_v2 — 주문 상태 변경 감사 로그) ──
  // 응답: 해당 operating_date의 order_events 행 + order_no JOIN. created_at DESC.
  router.get('/admin/api/history', (req, res) => {
    const operating_date =
      typeof req.query.date === 'string' && req.query.date.length > 0
        ? req.query.date
        : getBusinessState(db).operating_date;
    const rows = listOrderEvents(db, { operating_date });
    res.json(
      rows.map((r) => ({
        id: r.id,
        order_id: r.order_id,
        order_no: r.order_no,
        event_type: r.event_type,
        from_status: r.from_status,
        to_status: r.to_status,
        action_name: r.action_name,
        actor: r.actor,
        note: r.note,
        // Bug 7 — created_at은 ISO 8601 Z (브라우저 KST 540분 오차 방어).
        created_at: toIsoUtc(r.created_at),
      })),
    );
  });

  // ── GET /admin/api/coupons/usage (find_error_v2 — 쿠폰 사용 내역) ──
  // 응답: used_coupons JOIN orders (operating_date 필터). coupon_name·discount_amount는
  // ADR-019 상수 ('컴모융 1,000원 할인' / 1000) — DB 스키마 변경 없음.
  router.get('/admin/api/coupons/usage', (req, res) => {
    const operating_date =
      typeof req.query.date === 'string' && req.query.date.length > 0
        ? req.query.date
        : getBusinessState(db).operating_date;
    const rows = listCouponUsage(db, { operating_date });
    res.json(
      rows.map((r) => ({
        id: r.id,
        order_id: r.order_id,
        order_no: r.order_no,
        name: r.name,
        student_id: r.student_id,
        coupon_name: '컴모융 1,000원 할인',
        discount_amount: 1000,
        used_at: toIsoUtc(r.used_at),
      })),
    );
  });

  // ── GET /admin/api/settlement/zip ──
  router.get('/admin/api/settlement/zip', async (_req, res, next) => {
    try {
      const buffer = await createSettlementZip(db);
      const today = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="settlement-${today}.zip"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
