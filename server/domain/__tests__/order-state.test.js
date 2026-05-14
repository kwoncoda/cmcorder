// Task 6.4 — 주문 상태 머신 (ADR-025).
// 13 합법 전이 + 5 불법 거부.
import { describe, it, expect } from 'vitest';
import {
  LEGAL_TRANSITIONS,
  canTransition,
  transition,
  StateTransitionError,
} from '../order-state.js';

describe('order-state — 13 합법 전이', () => {
  it.each([
    ['ORDERED', 'TRANSFER_REPORTED'],
    ['ORDERED', 'CANCELED'],
    ['TRANSFER_REPORTED', 'PAID'],
    ['TRANSFER_REPORTED', 'HOLD'],
    ['TRANSFER_REPORTED', 'CANCELED'],
    ['PAID', 'COOKING'],
    ['PAID', 'CANCELED'],
    ['COOKING', 'READY'],
    ['COOKING', 'CANCELED'],
    ['READY', 'DONE'],
    ['READY', 'CANCELED'],
    ['HOLD', 'PAID'],
    ['HOLD', 'CANCELED'],
  ])('★ 합법: %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => transition(from, to)).not.toThrow();
  });

  it('★ 총 13개 합법 전이만 존재 (회귀 보호)', () => {
    const count = Object.values(LEGAL_TRANSITIONS).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    expect(count).toBe(13);
  });
});

describe('order-state — 5 불법 거부', () => {
  it.each([
    ['ORDERED', 'PAID', '이체 미신고 건너뜀'],
    ['PAID', 'READY', '조리 단계 건너뜀'],
    ['DONE', 'COOKING', '완료 후 되돌림'],
    ['CANCELED', 'ORDERED', '취소 후 부활 X'],
    ['TRANSFER_REPORTED', 'DONE', '큰 점프'],
  ])('★ 불법: %s → %s (%s)', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => transition(from, to)).toThrow(StateTransitionError);
  });

  it('★ StateTransitionError 메타데이터 (from·to·code)', () => {
    try {
      transition('ORDERED', 'PAID');
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(StateTransitionError);
      expect(err.code).toBe('ILLEGAL_TRANSITION');
      expect(err.from).toBe('ORDERED');
      expect(err.to).toBe('PAID');
    }
  });

  it('★ 알 수 없는 상태에서 시작 — false', () => {
    expect(canTransition('UNKNOWN', 'ORDERED')).toBe(false);
  });
});
