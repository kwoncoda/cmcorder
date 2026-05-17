// Task 3.1 — businessState store 단위 테스트 (5+ 케이스).
// 회귀 포인트:
//  - setStatus / syncFromServer 전이
//  - shouldBeOpen 셀렉터 — 운영 일자/시간 기반 boolean 계산
//    · 일자 다르면 false · 시작 전 false · 종료 후 false · 정상 영업 중 true
import { describe, it, expect, beforeEach, vi } from 'vitest';
import useBusinessStateStore, { businessStateSelectors } from '../businessState.js';

beforeEach(() => {
  useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
});

describe('BusinessStateStore', () => {
  it('setStatus — OPEN 전이', () => {
    useBusinessStateStore.getState().setStatus('OPEN');
    expect(useBusinessStateStore.getState().status).toBe('OPEN');
  });

  it('syncFromServer — 상태 + 일자 통합', () => {
    useBusinessStateStore.getState().syncFromServer({
      status: 'OPEN',
      operating_date: '2026-05-21',
    });
    expect(useBusinessStateStore.getState().status).toBe('OPEN');
    expect(useBusinessStateStore.getState().operating_date).toBe('2026-05-21');
  });

  it('shouldBeOpen — 운영 일자와 오늘 다르면 false', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T17:00:00'));
    useBusinessStateStore.setState({ operating_date: '2026-05-20' });
    expect(businessStateSelectors.shouldBeOpen(useBusinessStateStore.getState())).toBe(false);
    vi.useRealTimers();
  });

  it('shouldBeOpen — 운영 시간 내 true (5/20 17:00)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T17:00:00'));
    useBusinessStateStore.setState({ operating_date: '2026-05-20' });
    expect(businessStateSelectors.shouldBeOpen(useBusinessStateStore.getState())).toBe(true);
    vi.useRealTimers();
  });

  // Bug 12 — 5/20 오픈을 16:30 → 15:00으로 앞당김. 시작 전 검증 시점도 14:59로 조정.
  it('shouldBeOpen — 시작 전 false (5/20 14:59)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T14:59:00'));
    useBusinessStateStore.setState({ operating_date: '2026-05-20' });
    expect(businessStateSelectors.shouldBeOpen(useBusinessStateStore.getState())).toBe(false);
    vi.useRealTimers();
  });

  it('shouldBeOpen — 종료 후 false (5/20 22:00)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T22:00:00'));
    useBusinessStateStore.setState({ operating_date: '2026-05-20' });
    expect(businessStateSelectors.shouldBeOpen(useBusinessStateStore.getState())).toBe(false);
    vi.useRealTimers();
  });
});
