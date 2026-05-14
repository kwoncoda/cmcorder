// Task 3.2 — useApi hook 단위 테스트.
//
// 회귀 포인트:
//  - 성공 시 data 반환 (isLoading false, error null)
//  - 실패 시 error 반환
//  - 423 BusinessClosedError → onBusinessClosed 콜백 발화 (G13 단일 reactive 진입점)
//  - unmount 시 AbortController.abort — fetcher signal 전달 + abort 검증
//  - deps 변경 시 이전 요청 abort + 새 요청 fire (StrictMode 2회 mount 시뮬)
//  - refetch 시 새 fetch
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '../useApi.js';
import { BusinessClosedError } from '../../api/client.js';

beforeEach(() => {
  vi.useRealTimers();
});

describe('useApi', () => {
  it('성공 시 data 반환 + isLoading false + error null', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() => useApi(fetcher, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBeNull();
  });

  it('실패 시 error 반환 + data null', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('서버 에러');
    });
    const { result } = renderHook(() => useApi(fetcher, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error.message).toBe('서버 에러');
    expect(result.current.data).toBeNull();
  });

  it('★ 423 BusinessClosedError 시 onBusinessClosed 콜백 호출 (G13)', async () => {
    const onBusinessClosed = vi.fn();
    const fetcher = vi.fn(async () => {
      throw new BusinessClosedError({});
    });
    renderHook(() => useApi(fetcher, [], { onBusinessClosed }));
    await waitFor(() => expect(onBusinessClosed).toHaveBeenCalled());
  });

  it('★ unmount 시 AbortController abort — fetcher signal 수신 + abort 발화', async () => {
    let receivedSignal;
    const fetcher = vi.fn(async ({ signal }) => {
      receivedSignal = signal;
      return new Promise(() => {}); // never resolve
    });
    const { unmount } = renderHook(() => useApi(fetcher, []));
    await waitFor(() => expect(receivedSignal).toBeDefined());
    expect(receivedSignal.aborted).toBe(false);
    unmount();
    expect(receivedSignal.aborted).toBe(true);
  });

  it('★ deps 변경 시 이전 fetch abort + 새 fetch (StrictMode 2회 mount 시뮬)', async () => {
    // 시뮬: deps 변경 = 새 effect → 기존 effect cleanup → controller.abort
    let callCount = 0;
    let abortedCount = 0;
    const fetcher = vi.fn(async ({ signal }) => {
      callCount++;
      const myCall = callCount;
      signal.addEventListener('abort', () => {
        abortedCount++;
      });
      // 첫 호출은 영원히 pending — abort 검증용.
      if (myCall === 1) return new Promise(() => {});
      return { ok: true };
    });
    const { rerender, result } = renderHook(
      ({ deps }) => useApi(fetcher, deps),
      { initialProps: { deps: [0] } },
    );
    // 다른 deps로 rerender → 이전 effect cleanup → abort + 새 fetch fire.
    rerender({ deps: [1] });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    // 첫 fetch가 abort 되었는지.
    expect(abortedCount).toBeGreaterThanOrEqual(1);
  });

  it('refetch 호출 시 새 fetch', async () => {
    let counter = 0;
    const fetcher = vi.fn(async () => ({ value: ++counter }));
    const { result } = renderHook(() => useApi(fetcher, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data.value).toBe(1);
    act(() => result.current.refetch());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.data.value).toBe(2));
  });
});
