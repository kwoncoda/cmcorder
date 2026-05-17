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
import { transition } from '../domain/order-state.js';

// find_error_v2 — 주문 자격은 9자리 숫자 (학과 무관), 쿠폰 자격은 도메인(coupon.js)에서 37 검증.
const ORDER_STUDENT_ID_PATTERN = /^\d{9}$/;
const CreateOrderSchema = z
  .object({
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
  })
  .superRefine((val, ctx) => {
    // 학생 주문(non-external)은 student_id 9자리 숫자 필수.
    // P2-2 (Codex 리뷰): 외부인이 아니면 누락·빈 문자열·형식 오류 모두 거부 — API 직접 호출 보호.
    if (!val.is_external) {
      const sid = val.student_id;
      if (sid == null || sid === '' || !ORDER_STUDENT_ID_PATTERN.test(sid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['student_id'],
          message: '학번은 숫자 9자리로 입력해주세요.',
        });
      }
    }
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
        // P0-4 (Codex 리뷰): 모든 주문에 access_token 발급.
        // 외부인은 external_token = access_token (동일 값) — QR 공유 호환.
        const accessToken = crypto.randomUUID();
        const externalToken = input.is_external ? accessToken : null;
        const order = createOrder(
          db,
          {
            items_priced: priced.items_priced,
            total_price: priced.total_price,
            name: input.name,
            student_id: input.student_id ?? null,
            is_external: input.is_external ?? false,
            external_token: externalToken,
            access_token: accessToken,
            delivery_type: input.delivery_type ?? 'dineIn',
            table_no: input.table_no ?? null,
            operating_date,
          },
          // find_error_v2 — 같은 트랜잭션 안에서 CREATED 이벤트 INSERT.
          { actor: 'customer' },
        );
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

      // POST 응답은 access_token 포함 (최초 1회만 클라가 받음).
      res.json({ ...serializeOrder(result), access_token: result.access_token });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/orders/:id (P0-4 인증) ──
  // 요구: ?token=<access_token> 일치 시에만 본인 주문 조회 허용.
  // - token 없음 → 401 UNAUTHORIZED
  // - 주문 X → 404 (token 자체는 형식 검증만, 존재하지 않는 ID 누설 방지를 위해
  //              token 검증과 ID 검증 순서: 401 → 404 → 403)
  // - token 불일치 → 403 FORBIDDEN
  router.get('/api/orders/:id', (req, res) => {
    const rawToken = req.query.token;
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: '토큰이 필요합니다.' });
    }
    const order = getOrder(db, Number(req.params.id));
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }
    // 우선순위: access_token (모든 주문) → external_token (마이그레이션 전 외부인 호환)
    const expected = order.access_token ?? order.external_token;
    if (!expected || rawToken !== expected) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '주문 접근 권한이 없습니다.' });
    }
    return res.json(serializeOrder(order));
  });

  // ── POST /api/orders/:id/transfer-report (P0-B Codex v2 인증 추가) ──
  // 검증 순서: token 형식(401) → 주문 존재(404) → token 일치(403) → 입력 검증(400) → 상태 가드(409)
  // 이전: 무인증으로 ID 추측만으로 타인 주문 입금정보 덮어쓰기 + TRANSFER_REPORTED 강제 전이 가능.
  router.post('/api/orders/:id/transfer-report', (req, res, next) => {
    try {
      const rawToken = req.query.token;
      if (typeof rawToken !== 'string' || rawToken.length === 0) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: '토큰이 필요합니다.' });
      }
      const existing = getOrder(db, Number(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      }
      const expected = existing.access_token ?? existing.external_token;
      if (!expected || rawToken !== expected) {
        return res.status(403).json({ error: 'FORBIDDEN', message: '주문 접근 권한이 없습니다.' });
      }
      // find_error_v2 — TRANSFER_REPORTED 중복 제출은 친절한 안내로 응답하고 DB는 변경하지 않는다.
      // (입력 검증 *전*에 단락 — 사용자가 뒤로가기 후 빈 폼 재전송해도 raw 에러 노출 X)
      if (existing.status === 'TRANSFER_REPORTED') {
        return res.status(409).json({
          error: 'TRANSFER_ALREADY_REPORTED',
          message: '이미 이체 완료 요청이 접수됐어요. 본부 확인을 기다려주세요.',
        });
      }
      const input = TransferReportSchema.parse(req.body);
      // P1-1 (Codex 리뷰) — 상태 가드.
      // LEGAL_TRANSITIONS상 ORDERED → TRANSFER_REPORTED만 합법.
      // find_error_v2 — 다른 불법 상태(PAID/COOKING/READY/DONE/CANCELED/HOLD)는
      // 내부 문구 "불법 상태 전이" 노출 없이 친절한 메시지로 변환. 도메인 에러는
      // 라우트가 흡수 — admin 라우트는 여전히 기존 errorHandler 매핑을 사용한다.
      try {
        transition(existing.status, 'TRANSFER_REPORTED');
      } catch (err) {
        if (err.name === 'StateTransitionError') {
          return res.status(409).json({
            error: 'TRANSFER_NOT_ALLOWED',
            message: '지금은 이체 완료 요청을 보낼 수 없는 상태예요.',
          });
        }
        throw err;
      }
      const order = updateTransferInfo(
        db,
        Number(req.params.id),
        {
          depositor_name: input.depositorName,
          bank: input.bank,
          custom_bank: input.customBank,
          use_other_name: input.useOtherName,
          other_name: input.otherName,
          amount: input.amount,
        },
        // find_error_v2 — TRANSFER_REPORTED 이벤트 INSERT (트랜잭션 안).
        { actor: 'customer' },
      );
      return res.json(serializeOrder(order));
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

// Bug 7 — SQLite 'YYYY-MM-DD HH:MM:SS' (UTC, marker 없음) → 'YYYY-MM-DDTHH:MM:SSZ' ISO 8601.
// 브라우저(KST)가 marker 없는 문자열을 local time으로 잘못 해석해 540분 오차가 생기는 문제 방어.
function toIsoUtc(str) {
  if (str == null) return str;
  if (typeof str !== 'string') return str;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) {
    return str.replace(' ', 'T') + 'Z';
  }
  return str;
}

// P0-4: GET 응답에서 access_token, external_token은 노출하지 않는다.
// 토큰은 POST /api/orders 응답에서만 최초 1회 전달 (클라가 sessionStorage에 보관).
// Bug 7: timestamp는 ISO 8601 Z 형식으로 변환하여 브라우저 timezone 오차 방지.
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
    delivery_type: o.delivery_type,
    table_no: o.table_no,
    depositor_name: o.depositor_name,
    bank: o.bank,
    amount: o.amount,
    created_at: toIsoUtc(o.created_at),
    transferred_at: toIsoUtc(o.transferred_at),
    paid_at: toIsoUtc(o.paid_at),
    cooking_at: toIsoUtc(o.cooking_at),
    ready_at: toIsoUtc(o.ready_at),
    done_at: toIsoUtc(o.done_at),
  };
}
