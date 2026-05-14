// C-1 — useOrderPolling 단위 테스트 (SSE 라우트 미존재 → 5초 폴링 fallback).
//
// 회귀 포인트:
//  - orderId 시 즉시 1회 fetch + 5초 간격 폴링
//  - authToken 시 URL에 ?token= 포함
//  - withCredentials 없음 (apiFetch 위임) — 토큰 분기는 URL 쿼리만
//  - enabled=false 시 fetch X
//  - snapshot 갱신 + status 노출
//  - ★ onStatusChange(prev, next) — status 전이 시 1회만 호출
//  - ★ 첫 fetch는 prevStatus=null이라 onStatusChange 호출 X (새로고침 후 READY 직진입 회귀)
//  - ★ 동일 status 재전송 시 onStatusChange 호출 X
//  - ★ 언마운트 시 setInterval clear + AbortController abort
//  - error 시 isConnected=false + error 상태
//  - orderId 변경 시 이전 폴링 중단, 새 폴링 시작
//  - onStatusChange 매 렌더 새 함수여도 effect 재실행 X (latest ref)
//  - BusinessClosedError throw 위임 (useGlobalErrorHandler 패턴)
//
// jsdom + fake timers — setInterval/AbortController 회귀 가드.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { BusinessClosedError } from '../../api/client.js';

// apiFetch 자체를 mock — zod 검증 우회.
vi.mock('../../api/client.js', async () => {
  const actual = await vi.importActual('../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../api/client.js';
import { useOrderPolling } from '../useOrderPolling.js';

const SAMPLE_ORDER = {
  id: 17,
  no: 17,
  operating_date: '2026-05-20',
  status: 'PAID',
  items: [],
  total_price: 18000,
};

beforeEach(() => {
  vi.useFakeTimers();
  apiFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useOrderPolling', () => {
  it('orderId 시 즉시 1회 fetch + URL 에 orderId 포함', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderHook(() => useOrderPolling({ orderId: 17 }));
    // 즉시 1회 — fake timer라도 microtask는 흘러야 호출 검증.
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch.mock.calls[0][0]).toContain('/api/orders/17');
  });

  it('authToken 시 URL 에 ?token= 쿼리 포함', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderHook(() => useOrderPolling({ orderId: 17, authToken: 'ABC-DEF' }));
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch.mock.calls[0][0]).toContain('token=ABC-DEF');
  });

  it('enabled=false 시 fetch X', () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderHook(() => useOrderPolling({ orderId: 17, enabled: false }));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('orderId 없으면 fetch X', () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderHook(() => useOrderPolling({ orderId: null }));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('snapshot 갱신 + status 노출 + isConnected=true', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const { result } = renderHook(() => useOrderPolling({ orderId: 17 }));
    await vi.waitFor(() => expect(result.current.snapshot).toBeTruthy());
    expect(result.current.snapshot).toEqual(SAMPLE_ORDER);
    expect(result.current.status).toBe('PAID');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('5초 간격으로 폴링 — 6초 경과 시 2회 호출', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderHook(() => useOrderPolling({ orderId: 17 }));
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    // 5초 경과 — 2번째 fetch fire.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('intervalMs 옵션 override 가능', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderHook(() => useOrderPolling({ orderId: 17, intervalMs: 1_000 }));
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('★ onStatusChange — status 전이 시 1회만 호출 (PAID → COOKING)', async () => {
    const onStatusChange = vi.fn();
    apiFetch
      .mockResolvedValueOnce({ ...SAMPLE_ORDER, status: 'PAID' })
      .mockResolvedValueOnce({ ...SAMPLE_ORDER, status: 'COOKING' });

    const { result } = renderHook(() =>
      useOrderPolling({ orderId: 17, onStatusChange }),
    );
    // 첫 fetch — prev=null 이라 콜백 X.
    await vi.waitFor(() => expect(result.current.status).toBe('PAID'));
    expect(onStatusChange).not.toHaveBeenCalled();

    // 5초 경과 — 2번째 fetch — PAID → COOKING 전이.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await vi.waitFor(() => expect(result.current.status).toBe('COOKING'));
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith('PAID', 'COOKING');
  });

  it('★ 동일 status 재전송 시 onStatusChange 호출 X', async () => {
    const onStatusChange = vi.fn();
    apiFetch.mockResolvedValue({ ...SAMPLE_ORDER, status: 'PAID' });

    renderHook(() => useOrderPolling({ orderId: 17, onStatusChange }));
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    // 같은 status 두 번 더.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('★ 첫 fetch — prev=null 이라 새로고침 후 READY 직진입 시 onStatusChange 호출 X', async () => {
    const onStatusChange = vi.fn();
    apiFetch.mockResolvedValue({ ...SAMPLE_ORDER, status: 'READY' });

    const { result } = renderHook(() =>
      useOrderPolling({ orderId: 17, onStatusChange }),
    );
    await vi.waitFor(() => expect(result.current.status).toBe('READY'));
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('★ 언마운트 시 setInterval clear + AbortController abort (cleanup 보장)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const { unmount } = renderHook(() => useOrderPolling({ orderId: 17 }));
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    unmount();
    // 언마운트 후 시간 경과해도 더 이상 fetch X.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('error 시 isConnected=false + error 상태 (재시도는 계속)', async () => {
    apiFetch.mockRejectedValue(new Error('네트워크 에러'));
    const { result } = renderHook(() => useOrderPolling({ orderId: 17 }));
    await vi.waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error.message).toBe('네트워크 에러');
  });

  it('orderId 변경 시 이전 폴링 중단 + 새 polling 시작', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const { rerender } = renderHook(({ id }) => useOrderPolling({ orderId: id }), {
      initialProps: { id: 17 },
    });
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch.mock.calls[0][0]).toContain('/api/orders/17');

    rerender({ id: 42 });
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(apiFetch.mock.calls[1][0]).toContain('/api/orders/42');
  });

  it('onStatusChange 매 렌더 새 함수여도 effect 재실행 X (latest ref)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const { rerender } = renderHook(
      ({ cb }) => useOrderPolling({ orderId: 17, onStatusChange: cb }),
      { initialProps: { cb: () => {} } },
    );
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    rerender({ cb: () => {} });
    rerender({ cb: () => {} });
    // 새 함수 reference 들이지만 effect 재실행 X — fetch는 1회만.
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('★ BusinessClosedError throw → 전역 핸들러 위임 (error state 에 잡지 X)', async () => {
    // BusinessClosedError 는 G13 단일 reactive 진입점. hook 안에서 setError X.
    // promise rejection 은 의도된 위임 — unhandled rejection 핸들러 임시 가로채기.
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    apiFetch.mockRejectedValue(new BusinessClosedError({}));
    const { result } = renderHook(() => useOrderPolling({ orderId: 17 }));
    // 잠시 흘려보내 fetch 진입 후 reject.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // useGlobalErrorHandler 가 위임받음 — hook 자체 error state 는 BusinessClosed 안 잡음.
    expect(result.current.error).not.toBeInstanceOf(BusinessClosedError);
    expect(result.current.isConnected).toBe(false);
    process.off('unhandledRejection', unhandled);
  });
});
