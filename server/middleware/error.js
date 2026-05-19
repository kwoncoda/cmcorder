// Task 6.8 — 전역 에러 핸들러.
//
// 도메인 에러를 HTTP 상태로 매핑:
//   - PricingError       → 400 PRICING_ERROR (또는 code 그대로)
//   - CouponError        → 400 (code: INVALID_FORMAT · ALREADY_USED · ...)
//   - StateTransitionError → 409 ILLEGAL_TRANSITION
//   - SettlementError    → 409 (code: IN_PROGRESS_EXISTS · ALREADY_CLOSED)
//   - zod ZodError       → 400 VALIDATION_ERROR
//   - 기타               → 500 INTERNAL_ERROR
import { logger } from '../lib/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  logger.error({ err, path: req.path }, '[error]');

  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: err.issues?.[0]?.message ?? '입력값이 올바르지 않습니다.',
      issues: err.issues,
    });
  }
  if (err?.name === 'PricingError') {
    return res.status(400).json({
      error: 'PRICING_ERROR',
      code: err.code,
      message: err.message,
    });
  }
  if (err?.name === 'CouponError') {
    return res.status(400).json({
      error: err.code ?? 'COUPON_ERROR',
      message: err.message,
    });
  }
  if (err?.name === 'StateTransitionError') {
    return res.status(409).json({
      error: 'ILLEGAL_TRANSITION',
      message: err.message,
    });
  }
  if (err?.name === 'SettlementError') {
    return res.status(409).json({
      error: err.code ?? 'SETTLEMENT_ERROR',
      message: err.message,
    });
  }
  if (err?.name === 'TableNotAvailableError') {
    const status = err.reason === 'out_of_range' ? 400 : 409;
    return res.status(status).json({
      error: 'TABLE_NOT_AVAILABLE',
      message: err.message,
    });
  }
  return res.status(500).json({ error: 'INTERNAL_ERROR' });
}
