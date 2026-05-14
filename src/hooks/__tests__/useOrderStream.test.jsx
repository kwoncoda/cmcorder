// Task 3.3 — useOrderStream SSE hook 단위 테스트.
//
// 회귀 포인트:
//  - orderId 있을 때만 EventSource 생성 (없으면 X)
//  - URL: `/api/orders/:id/stream` + (authToken 있으면 ?token=)
//  - withCredentials: 토큰 없으면 true (세션 쿠키), 있으면 false
//  - 'message' / 'status' / 'business-closed' 이벤트 수신 + snapshot 갱신
//  - ★ onStatusChange(prev, next) — status 전이 시 1회 호출, 첫 snapshot은 prev null이라 호출 X
//  - ★ 동일 status 재전송 시 호출 X
//  - ★ 언마운트 시 EventSource close (메모리 누수 0)
//  - ★ StrictMode mount-unmount-mount 시 최종 활성 EventSource 1개
//  - orderId 변경 시 이전 close + 새 EventSource
//  - error 시 isConnected=false (브라우저 기본 재연결에 위임)
//  - onStatusChange 매 렌더 새 함수여도 effect 재실행 X (latest ref 패턴)
//
// jsdom은 EventSource 미구현 — global polyfill mock 주입.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrderStream } from '../useOrderStream.js';

// ── EventSource mock ───────────────────────────────────────────
// 실제 EventSource API와 동일한 표면: onopen·onmessage·onerror·addEventListener·close.
// 비동기 open 발화 — 실제 네트워크와 유사하게 setTimeout 0.
class MockEventSource {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = {};
    this.readyState = 0;
    this.closed = false;
    MockEventSource.instances.push(this);
    setTimeout(() => {
      if (this.closed) return;
      this.readyState = 1;
      this.onopen?.({});
    }, 0);
  }
  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
  removeEventListener() {}
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  // 테스트 helper — 특정 이벤트 dispatch.
  emit(type, data) {
    const ev = { data: typeof data === 'string' ? data : JSON.stringify(data) };
    if (type === 'message') {
      this.onmessage?.(ev);
    } else if (this.listeners[type]) {
      this.listeners[type](ev);
    }
  }
  emitError() {
    this.onerror?.(new Event('error'));
  }
  static instances = [];
  static reset() {
    MockEventSource.instances = [];
  }
}

beforeEach(() => {
  global.EventSource = MockEventSource;
  MockEventSource.reset();
});

afterEach(() => {
  MockEventSource.reset();
});

describe('useOrderStream', () => {
  it('orderId 시 EventSource 생성 + URL에 orderId 포함', async () => {
    renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0].url).toContain('/api/orders/17/stream');
  });

  it('authToken 시 URL에 token 쿼리', async () => {
    renderHook(() => useOrderStream({ orderId: 17, authToken: 'ABC' }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0].url).toContain('token=ABC');
  });

  it('enabled=false 시 연결 안 함', () => {
    renderHook(() => useOrderStream({ orderId: 17, enabled: false }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('message 이벤트 시 snapshot 갱신', async () => {
    const { result } = renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    act(() => MockEventSource.instances[0].emit('message', { status: 'PAID', no: 17 }));
    await waitFor(() => expect(result.current.status).toBe('PAID'));
  });

  it('status 이벤트 시 snapshot 부분 갱신', async () => {
    const { result } = renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    act(() => MockEventSource.instances[0].emit('message', { status: 'PAID', no: 17 }));
    act(() => MockEventSource.instances[0].emit('status', { status: 'COOKING' }));
    await waitFor(() => expect(result.current.status).toBe('COOKING'));
  });

  it('★ onStatusChange(prev, next) — status 전이 시 1회만 호출', async () => {
    const onStatusChange = vi.fn();
    const { result } = renderHook(() =>
      useOrderStream({ orderId: 17, onStatusChange }),
    );
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    // 첫 snapshot — prevStatus null → 콜백 X.
    act(() => MockEventSource.instances[0].emit('message', { status: 'PAID' }));
    await waitFor(() => expect(result.current.status).toBe('PAID'));
    expect(onStatusChange).not.toHaveBeenCalled();
    // 전이 PAID → COOKING — 1회 호출.
    act(() => MockEventSource.instances[0].emit('status', { status: 'COOKING' }));
    await waitFor(() => expect(result.current.status).toBe('COOKING'));
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith('PAID', 'COOKING');
  });

  it('★ 동일 status 재전송 시 onStatusChange 호출 X', async () => {
    const onStatusChange = vi.fn();
    renderHook(() => useOrderStream({ orderId: 17, onStatusChange }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    act(() => MockEventSource.instances[0].emit('message', { status: 'PAID' }));
    act(() => MockEventSource.instances[0].emit('message', { status: 'PAID' }));
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('★ 언마운트 시 EventSource close (메모리 누수 0)', async () => {
    const { unmount } = renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });

  it('★ StrictMode mount-unmount-mount → 최종 활성 EventSource 1개', async () => {
    // StrictMode 시뮬레이션: 직접 mount-unmount-mount.
    const { unmount } = renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    unmount();
    const { unmount: unmount2 } = renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    // 활성 EventSource는 마지막 인스턴스 1개.
    const active = MockEventSource.instances.filter((es) => !es.closed);
    expect(active).toHaveLength(1);
    unmount2();
  });

  it('business-closed 이벤트 → snapshot.business_closed=true', async () => {
    const { result } = renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    act(() => MockEventSource.instances[0].emit('business-closed', '{}'));
    await waitFor(() =>
      expect(result.current.snapshot?.business_closed).toBe(true),
    );
  });

  it('error 시 isConnected=false', async () => {
    const { result } = renderHook(() => useOrderStream({ orderId: 17 }));
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    act(() => MockEventSource.instances[0].emitError());
    expect(result.current.isConnected).toBe(false);
  });

  it('orderId 없으면 연결 X', () => {
    renderHook(() => useOrderStream({ orderId: null }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('orderId 변경 시 이전 close + 새 EventSource', async () => {
    const { rerender } = renderHook(({ id }) => useOrderStream({ orderId: id }), {
      initialProps: { id: 17 },
    });
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const first = MockEventSource.instances[0];
    rerender({ id: 18 });
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    expect(first.closed).toBe(true);
  });

  it('onStatusChange 매 렌더 새 함수여도 effect 재실행 X (latest ref)', async () => {
    const { rerender } = renderHook(
      ({ cb }) => useOrderStream({ orderId: 17, onStatusChange: cb }),
      { initialProps: { cb: () => {} } },
    );
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    rerender({ cb: () => {} }); // 새 함수
    rerender({ cb: () => {} });
    // EventSource 추가 생성 X (orderId 동일).
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
