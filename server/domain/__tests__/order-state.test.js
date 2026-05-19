// Task 6.4 — 주문 상태 머신 (ADR-025).
// 15 합법 전이 + 9 불법 거부.
// table_lock: READY → DINING → SETTLED 새 흐름 추가. READY → DONE 폐지.
// design_fix_v4 (2026-05-19): takeout 주문은 READY → SETTLED 직접 (DINING 건너뜀).
import { describe, it, expect } from 'vitest';
import {
  LEGAL_TRANSITIONS,
  canTransition,
  transition,
  StateTransitionError,
} from '../order-state.js';

describe('order-state — 15 합법 전이', () => {
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
    ['READY', 'DINING'],       // ← 변경: DONE 대신 DINING
    ['READY', 'CANCELED'],
    ['DINING', 'SETTLED'],     // ← 신규
    ['DINING', 'CANCELED'],    // ← 신규
    ['HOLD', 'PAID'],
    ['HOLD', 'CANCELED'],
  ])('★ 합법: %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => transition(from, to)).not.toThrow();
  });

  it('★ 총 15개 합법 전이만 존재 (회귀 보호)', () => {
    const count = Object.values(LEGAL_TRANSITIONS).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    expect(count).toBe(15);
  });
});

describe('order-state — 9 불법 거부', () => {
  it.each([
    ['ORDERED', 'PAID', '이체 미신고 건너뜀'],
    ['PAID', 'READY', '조리 단계 건너뜀'],
    ['DONE', 'COOKING', 'DONE dead status — 전이 시작 불가'],
    ['CANCELED', 'ORDERED', '취소 후 부활 X'],
    ['TRANSFER_REPORTED', 'DONE', 'DONE dead status — 진입 불가'],
    ['READY', 'DONE', 'READY→DONE 직접 전이 폐지 (dead status)'],
    ['READY', 'SETTLED', 'DINING 우회 차단'],
    ['DINING', 'DONE', 'DONE dead status — DINING 에서 진입 불가'],
    ['DINING', 'READY', '역방향 전이 불가'],
  ])('★ 불법: %s → %s (%s)', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => transition(from, to)).toThrow(StateTransitionError);
  });

  it('★ SETTLED 터미널 — 어떤 상태로도 전이 불가', () => {
    expect(canTransition('SETTLED', 'CANCELED')).toBe(false);
    expect(canTransition('SETTLED', 'ORDERED')).toBe(false);
    expect(() => transition('SETTLED', 'CANCELED')).toThrow(StateTransitionError);
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

  it('DONE은 어떤 합법 전이의 우변에도 등장하지 않는다 (dead status 회귀)', () => {
    const allTargets = Object.values(LEGAL_TRANSITIONS).flat();
    expect(allTargets).not.toContain('DONE');
  });
});

// ── design_fix_v4 — takeout 주문 READY → SETTLED 직접 전이 ─────────────────
// 매장 식사(dineIn)는 READY → DINING → SETTLED 유지. 포장(takeout)은 DINING을
// 건너뛴다. opts.deliveryType 인자를 통해 호출부가 분기를 전달.
// LEGAL_TRANSITIONS 객체 자체는 변경하지 않는다 (DONE 메타 회귀 보호).
describe('order-state — design_fix_v4 takeout 분기', () => {
  it('★ takeout READY → SETTLED 합법 (DINING 건너뜀)', () => {
    expect(canTransition('READY', 'SETTLED', { deliveryType: 'takeout' })).toBe(true);
    expect(() =>
      transition('READY', 'SETTLED', { deliveryType: 'takeout' }),
    ).not.toThrow();
  });

  it('★ dineIn READY → SETTLED 불법 (DINING 우회 차단 회귀)', () => {
    expect(canTransition('READY', 'SETTLED', { deliveryType: 'dineIn' })).toBe(false);
    expect(() =>
      transition('READY', 'SETTLED', { deliveryType: 'dineIn' }),
    ).toThrow(StateTransitionError);
  });

  it('★ opts 없이 READY → SETTLED 불법 (dineIn 기본 흐름, backwards-compat)', () => {
    expect(canTransition('READY', 'SETTLED')).toBe(false);
    expect(() => transition('READY', 'SETTLED')).toThrow(StateTransitionError);
  });

  it('★ takeout READY → DINING 불법 (포장은 테이블 점유 의미 없음, 방어선)', () => {
    expect(canTransition('READY', 'DINING', { deliveryType: 'takeout' })).toBe(false);
    expect(() =>
      transition('READY', 'DINING', { deliveryType: 'takeout' }),
    ).toThrow(StateTransitionError);
  });

  it('★ dineIn READY → DINING 합법 (회귀)', () => {
    expect(canTransition('READY', 'DINING', { deliveryType: 'dineIn' })).toBe(true);
    expect(() =>
      transition('READY', 'DINING', { deliveryType: 'dineIn' }),
    ).not.toThrow();
  });

  it('★ opts 없이 READY → DINING 합법 (기본 dineIn 흐름, backwards-compat)', () => {
    expect(canTransition('READY', 'DINING')).toBe(true);
    expect(() => transition('READY', 'DINING')).not.toThrow();
  });

  it('★ takeout 분기는 READY 외 상태에서는 LEGAL_TRANSITIONS 표를 따른다', () => {
    // 즉, takeout 옵션이 PAID→COOKING 같은 일반 전이를 막거나 추가하지 않는다.
    expect(canTransition('PAID', 'COOKING', { deliveryType: 'takeout' })).toBe(true);
    expect(canTransition('COOKING', 'READY', { deliveryType: 'takeout' })).toBe(true);
    // 불법은 여전히 불법.
    expect(canTransition('ORDERED', 'PAID', { deliveryType: 'takeout' })).toBe(false);
  });

  it('★ transition takeout READY → SETTLED StateTransitionError 안 던짐', () => {
    expect(() =>
      transition('READY', 'SETTLED', { deliveryType: 'takeout' }),
    ).not.toThrow();
  });

  it('★ transition takeout READY → DINING StateTransitionError 메타 (from/to/code)', () => {
    try {
      transition('READY', 'DINING', { deliveryType: 'takeout' });
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(StateTransitionError);
      expect(err.code).toBe('ILLEGAL_TRANSITION');
      expect(err.from).toBe('READY');
      expect(err.to).toBe('DINING');
    }
  });
});
