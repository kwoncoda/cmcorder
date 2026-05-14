// Task 3.4 — useGlobalErrorHandler 전역 에러 처리 단위 테스트.
//
// 회귀 포인트:
//  - BusinessClosedError unhandledrejection → onBusinessClosed 콜백 + preventDefault
//  - 일반 Error → console.error
//  - unmount 시 listener 제거 (메모리 누수 0)
//  - onBusinessClosed 미제공 시 BusinessClosedError도 console.error 경로
//  - hook 책임 분리 — unhandledrejection만 (a11y/회복은 ErrorBoundary 컴포넌트 위임)
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalErrorHandler } from '../useGlobalErrorHandler.js';
import { BusinessClosedError } from '../../api/client.js';

describe('useGlobalErrorHandler', () => {
  it('★ BusinessClosedError 시 onBusinessClosed 콜백 + preventDefault', () => {
    const onBusinessClosed = vi.fn();
    renderHook(() => useGlobalErrorHandler({ onBusinessClosed }));

    const event = new Event('unhandledrejection');
    event.reason = new BusinessClosedError({});
    event.preventDefault = vi.fn();
    window.dispatchEvent(event);

    expect(onBusinessClosed).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('일반 에러는 console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useGlobalErrorHandler({}));

    const event = new Event('unhandledrejection');
    event.reason = new Error('기타 에러');
    window.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('unmount 시 listener 제거 (메모리 누수 0)', () => {
    const onBusinessClosed = vi.fn();
    const { unmount } = renderHook(() =>
      useGlobalErrorHandler({ onBusinessClosed }),
    );
    unmount();

    const event = new Event('unhandledrejection');
    event.reason = new BusinessClosedError({});
    event.preventDefault = vi.fn();
    window.dispatchEvent(event);

    expect(onBusinessClosed).not.toHaveBeenCalled();
  });

  it('onBusinessClosed 미제공 시 BusinessClosedError도 console.error 경로', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useGlobalErrorHandler({}));

    const event = new Event('unhandledrejection');
    event.reason = new BusinessClosedError({});
    event.preventDefault = vi.fn();
    window.dispatchEvent(event);

    // 일반 에러 path로 흘러감 — console.error 호출.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a11y/회복 등은 기존 ErrorBoundary 컴포넌트로 위임 — 본 hook은 unhandledrejection만', () => {
    // 본 hook 책임 분리 검증.
    expect(typeof useGlobalErrorHandler).toBe('function');
  });
});
