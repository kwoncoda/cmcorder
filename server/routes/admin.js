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
  getMenu,
  toggleMenu,
} from '../repositories/menu-repo.js';
import {
  listOrders,
  getOrder,
  updateOrderStatus,
} from '../repositories/order-repo.js';
import { listOrderEvents } from '../repositories/order-events-repo.js';
import { logAdminEvent, listAdminEvents } from '../repositories/admin-events-repo.js';
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

// find_error_v3 — 메뉴 patch 변경 항목별 admin_events row 생성.
// before/after가 같으면 row X. soldOut/recommended/base_price 각각 별개 row.
function logMenuPatchEvents(db, before, after, patch, operating_date) {
  if (patch.soldOut !== undefined) {
    const beforeBool = !!before.sold_out;
    const afterBool = !!after.sold_out;
    if (beforeBool !== afterBool) {
      logAdminEvent(db, {
        category: 'menu',
        event_type: afterBool ? 'SOLDOUT_ON' : 'SOLDOUT_OFF',
        action_name: afterBool ? '품절 처리' : '판매 재개',
        actor: 'admin',
        operating_date,
        target_id: after.id,
        target_name: after.name,
        before_value: String(beforeBool),
        after_value: String(afterBool),
      });
    }
  }
  if (patch.recommended !== undefined) {
    const beforeBool = !!before.recommended;
    const afterBool = !!after.recommended;
    if (beforeBool !== afterBool) {
      logAdminEvent(db, {
        category: 'menu',
        event_type: afterBool ? 'RECOMMEND_ON' : 'RECOMMEND_OFF',
        action_name: afterBool ? '추천 등록' : '추천 해제',
        actor: 'admin',
        operating_date,
        target_id: after.id,
        target_name: after.name,
        before_value: String(beforeBool),
        after_value: String(afterBool),
      });
    }
  }
  if (patch.base_price !== undefined) {
    if (before.base_price !== after.base_price) {
      logAdminEvent(db, {
        category: 'menu',
        event_type: 'PRICE_CHANGED',
        action_name: '가격 변경',
        actor: 'admin',
        operating_date,
        target_id: after.id,
        target_name: after.name,
        before_value: String(before.base_price),
        after_value: String(after.base_price),
      });
    }
  }
}

// find_error_v3 P2 (Codex 리뷰 2026-05-18) — history type allowlist.
const HISTORY_TYPE_ALLOWLIST = new Set(['all', 'orders', 'menus', 'system']);

// find_error_v3 — 주문 상태 → 한국어 액션 라벨 (order-repo와 정합).
const ORDER_ACTION_LABEL = {
  CREATED: '주문 접수',
  TRANSFER_REPORTED: '이체 완료 요청',
  PAID: '이체 확인',
  COOKING: '조리 시작',
  READY: '조리 완료',
  DONE: '전달 완료',
  HOLD: '보류',
  CANCELED: '취소',
};

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
      // find_error_v3 P1-2 (Codex 리뷰 2026-05-18) — 성공 로그인은 system 이벤트 1행.
      // operating_date를 현재 business_state.operating_date로 채워서 history?type=system
      // 일자 필터에 노출되게 한다. (이전: NULL이라 listAdminEvents의 operating_date=? 조건에서
      // 자동 제외되어 시스템 내역 탭에서 보이지 않던 P1 버그를 해소.)
      logAdminEvent(db, {
        category: 'system',
        event_type: 'ADMIN_LOGIN',
        action_name: '관리자 로그인',
        actor: 'admin',
        operating_date: getBusinessState(db).operating_date,
      });
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
      // find_error_v3 — 멱등 동작이라 실제 전환 여부를 판별: CLOSED → OPEN인 경우만 이벤트 기록.
      const before = getBusinessState(db);
      const updated = openBusiness(db, { operating_date: target });
      if (before.status !== 'OPEN' && updated.status === 'OPEN') {
        logAdminEvent(db, {
          category: 'system',
          event_type: 'BUSINESS_OPEN',
          action_name: '장사 시작',
          actor: 'admin',
          operating_date: updated.operating_date,
        });
      }
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
  // find_error_v3 P2 (Codex 리뷰 2026-05-18): 메뉴 변경 + 이벤트 INSERT를 단일 트랜잭션으로
  // 묶어 로그 실패 시 메뉴 변경도 ROLLBACK. 이전: toggleMenu 성공 후 logMenuPatchEvents가
  // 실패하면 메뉴 변경은 반영됐는데 응답은 500인 불일치 가능.
  router.post('/admin/api/menus/:id/toggle', (req, res, next) => {
    try {
      const patch = ToggleSchema.parse(req.body ?? {});
      const id = Number(req.params.id);
      const before = getMenu(db, id);
      if (!before) {
        return res.status(404).json({ error: 'MENU_NOT_FOUND', message: '메뉴를 찾을 수 없습니다.' });
      }
      const operating_date = getBusinessState(db).operating_date;
      const updated = db.transaction(() => {
        const next = toggleMenu(db, id, patch);
        if (!next) return null;
        logMenuPatchEvents(db, before, next, patch, operating_date);
        return next;
      })();
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

  // ── GET /admin/api/history (find_error_v2 + find_error_v3 — 통합 감사 로그) ──
  // type=all (default) → order_events + admin_events 합쳐 created_at DESC
  // type=orders → order_events만
  // type=menus  → admin_events category=menu만
  // type=system → admin_events category=system만
  // 응답 row 통일 스키마: { id, source, category, event_type, action_name, actor,
  //   order_id, order_no, from_status, to_status,
  //   target_id, target_name, before_value, after_value, note, created_at }
  // id는 source-prefix 문자열(`o-<id>`, `a-<id>`)로 통합 unique.
  // find_error_v3 P2 (Codex 리뷰 2026-05-18): type allowlist 검증. 잘못된 값은 400.
  router.get('/admin/api/history', (req, res) => {
    const operating_date =
      typeof req.query.date === 'string' && req.query.date.length > 0
        ? req.query.date
        : getBusinessState(db).operating_date;
    const rawType =
      typeof req.query.type === 'string' && req.query.type.length > 0
        ? req.query.type
        : 'all';
    if (!HISTORY_TYPE_ALLOWLIST.has(rawType)) {
      return res.status(400).json({
        error: 'INVALID_HISTORY_TYPE',
        message: 'history type은 all/orders/menus/system 중 하나여야 합니다.',
      });
    }
    const type = rawType;

    const orderRows =
      type === 'all' || type === 'orders'
        ? listOrderEvents(db, { operating_date }).map((r) => ({
            id: `o-${r.id}`,
            source: 'order',
            category: 'order',
            event_type: r.event_type,
            action_name: r.action_name ?? ORDER_ACTION_LABEL[r.event_type] ?? r.event_type,
            actor: r.actor,
            order_id: r.order_id,
            order_no: r.order_no,
            from_status: r.from_status,
            to_status: r.to_status,
            target_id: null,
            target_name: null,
            before_value: null,
            after_value: null,
            note: r.note,
            created_at: toIsoUtc(r.created_at),
          }))
        : [];

    let adminCategory;
    if (type === 'menus') adminCategory = 'menu';
    else if (type === 'system') adminCategory = 'system';

    const includeAdmin = type === 'all' || type === 'menus' || type === 'system';
    const adminRows = includeAdmin
      ? listAdminEvents(db, { operating_date, category: adminCategory }).map((r) => ({
          id: `a-${r.id}`,
          source: 'admin',
          category: r.category,
          event_type: r.event_type,
          action_name: r.action_name,
          actor: r.actor,
          order_id: null,
          order_no: null,
          from_status: null,
          to_status: null,
          target_id: r.target_id,
          target_name: r.target_name,
          before_value: r.before_value,
          after_value: r.after_value,
          note: r.note,
          created_at: toIsoUtc(r.created_at),
        }))
      : [];

    // 통합 정렬 — created_at DESC. 동일 시각은 source 안의 자체 정렬 유지.
    const merged = [...orderRows, ...adminRows].sort((a, b) => {
      if (a.created_at === b.created_at) return 0;
      return a.created_at < b.created_at ? 1 : -1;
    });
    res.json(merged);
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
