// Task 6.4 — 이체 매칭 (4요소: 이름·은행·금액·시각 ±5분).
import { describe, it, expect } from 'vitest';
import { matchTransfer } from '../transfer-matching.js';

const baseTime = '2026-05-20T17:00:00.000Z';

const baseCandidate = {
  id: 1,
  depositor_name: '홍길동',
  bank: '신한',
  custom_bank: null,
  use_other_name: 0,
  other_name: null,
  amount: 18000,
  transferred_at: baseTime,
};

describe('transfer-matching — 4요소', () => {
  it('★ 4요소 모두 일치 — 매칭', () => {
    const r = matchTransfer(
      {
        depositorName: '홍길동',
        bank: '신한',
        amount: 18000,
        transferredAt: baseTime,
      },
      [baseCandidate],
    );
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(1);
  });

  it('★ 이름 불일치 — 미매칭', () => {
    const r = matchTransfer(
      {
        depositorName: '김철수',
        bank: '신한',
        amount: 18000,
        transferredAt: baseTime,
      },
      [baseCandidate],
    );
    expect(r).toHaveLength(0);
  });

  it('★ 은행 불일치 — 미매칭', () => {
    const r = matchTransfer(
      {
        depositorName: '홍길동',
        bank: 'KB',
        amount: 18000,
        transferredAt: baseTime,
      },
      [baseCandidate],
    );
    expect(r).toHaveLength(0);
  });

  it('★ 금액 불일치 — 미매칭', () => {
    const r = matchTransfer(
      {
        depositorName: '홍길동',
        bank: '신한',
        amount: 17000,
        transferredAt: baseTime,
      },
      [baseCandidate],
    );
    expect(r).toHaveLength(0);
  });

  it('★ 시각 ±5분 내 매칭', () => {
    const r = matchTransfer(
      {
        depositorName: '홍길동',
        bank: '신한',
        amount: 18000,
        transferredAt: '2026-05-20T17:04:00.000Z', // 4분 차이
      },
      [baseCandidate],
    );
    expect(r).toHaveLength(1);
  });

  it('★ 시각 5분 초과 — 미매칭', () => {
    const r = matchTransfer(
      {
        depositorName: '홍길동',
        bank: '신한',
        amount: 18000,
        transferredAt: '2026-05-20T17:06:00.000Z', // 6분 차이
      },
      [baseCandidate],
    );
    expect(r).toHaveLength(0);
  });

  it('★ use_other_name=1일 때 other_name으로 매칭', () => {
    const candidate = {
      ...baseCandidate,
      depositor_name: '본명',
      use_other_name: 1,
      other_name: '입금자',
    };
    const r = matchTransfer(
      {
        depositorName: '입금자',
        bank: '신한',
        amount: 18000,
        transferredAt: baseTime,
      },
      [candidate],
    );
    expect(r).toHaveLength(1);
  });

  it('★ custom_bank로 매칭 (기타 은행)', () => {
    const candidate = {
      ...baseCandidate,
      bank: null,
      custom_bank: '카카오뱅크',
    };
    const r = matchTransfer(
      {
        depositorName: '홍길동',
        bank: '카카오뱅크',
        amount: 18000,
        transferredAt: baseTime,
      },
      [candidate],
    );
    expect(r).toHaveLength(1);
  });
});
