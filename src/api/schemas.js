// API 응답 zod 스키마 — Task 3.2.
//
// 런타임 타입 안전. apiFetch({ schema }) 옵션으로 주입하면
// 서버 응답을 검증 후 통과 (실패 시 ValidationError throw).
//
// 출처: docs/API_DRAFT.md (모든 응답 본문) + docs/DB_DRAFT.md (필드 명세).
import { z } from 'zod';

// ── 메뉴 ────────────────────────────────────────────────────
export const MenuSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  name: z.string().min(1),
  category: z.enum(['chicken', 'side', 'drink']),
  basePrice: z.number().int().positive(),
  image: z.string().optional(),
  soldOut: z.boolean().optional(),
  recommended: z.boolean().optional(),
});

export const MenuListSchema = z.array(MenuSchema);

// ── 주문 상태 (8개 — USER_FLOW §7.4) ──────────────────────────
export const OrderStatusSchema = z.enum([
  'ORDERED',
  'TRANSFER_REPORTED',
  'PAID',
  'COOKING',
  'READY',
  'DONE',
  'HOLD',
  'CANCELED',
]);

// ── 주문 ────────────────────────────────────────────────────
// API_DRAFT §1.6/§1.7/§1.10 응답 본문 기반. nullable 시각 필드는 옵션 처리.
export const OrderSchema = z.object({
  id: z.number().int().positive(),
  no: z.number().int().positive(),
  operating_date: z.string(),
  status: OrderStatusSchema,
  items: z.array(
    z.object({
      menu_id: z.number().int().positive(),
      name: z.string(),
      base_price: z.number().int(),
      quantity: z.number().int().positive(),
    }),
  ),
  total_price: z.number().int(),
  created_at: z.string().optional(),
  transferred_at: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  cooking_at: z.string().nullable().optional(),
  ready_at: z.string().nullable().optional(),
  done_at: z.string().nullable().optional(),
  depositor_name: z.string().nullable().optional(),
  is_external: z.boolean().optional(),
  table_no: z.number().int().nullable().optional(),
  external_token: z.string().nullable().optional(),
});

// ── 영업 상태 (G13) ─────────────────────────────────────────
export const BusinessStateSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED']),
  operating_date: z.string(),
  changed_at: z.string().optional(),
});

// ── 에러 응답 ────────────────────────────────────────────────
// 백엔드는 { ok: false, error: { code, message, field } } 또는
// 단순 { error: 'CODE' } 두 가지 형태 모두 허용 (방어).
export const ApiErrorSchema = z.union([
  z.object({
    ok: z.literal(false).optional(),
    error: z.object({
      code: z.string(),
      message: z.string().optional(),
      field: z.string().nullable().optional(),
    }),
  }),
  z.object({
    error: z.string(),
    message: z.string().optional(),
    details: z.unknown().optional(),
  }),
]);
