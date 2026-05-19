// Task 6.4 — 주문 상태 머신 (ADR-025).
// 15 합법 전이 + 9 불법 거부.
// table_lock: READY → DINING → SETTLED 새 흐름 추가. READY → DONE 폐지.
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
