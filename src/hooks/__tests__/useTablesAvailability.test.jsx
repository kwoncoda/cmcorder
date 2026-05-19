// Subagent 5 — useTablesAvailability 단위 테스트.
//
// 회귀 포인트:
//  - 마운트 → apiFetch 1회 호출 (TABLES_AVAILABILITY 경로)
//  - 성공 → availability 배열, isReady true
//  - 5xx/네트워크 에러 → availability null, isReady true (graceful fallback)
//  - refresh() 성공 → 배열 반환
//  - refresh() 실패 → null 반환
//  - 폴링 없음 — 2초 경과 후에도 mount 시 1회만 호출
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../api/client.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch } from '../../api/client.js';
import { useTablesAvailability } from '../useTablesAvailability.js';
import { API } from '../../api/routes.js';

const AVAILABILITY = [
  { table_no: 1, status: 'available' },
  { table_no: 2, status: 'occupied' },
  { table_no: 3, status: 'available' },
  { table_no: 4, status: 'dining' },
  { table_no: 5, status: 'locked' },
  { table_no: 6, status: 'available' },
  { table_no: 7, status: 'available' },
  { table_no: 8, status: 'available' },
  { table_no: 9, status: 'available' },
  { table_no: 10, status: 'available' },
  { table_no: 11, status: 'available' },
  { table_no: 12, status: 'available' },
  { table_no: 13, status: 'available' },
  { table_no: 14, status: 'available' },
  { table_no: 15, status: 'available' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useTablesAvailability', () => {
  it('마운트 시 apiFetch 1회 호출 (TABLES_AVAILABILITY 경로)', async () => {
    apiFetch.mockResolvedValueOnce(AVAILABILITY);
    const { result } = renderHook(() => useTablesAvailability());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][0]).toBe(API.TABLES_AVAILABILITY);
  });

  it('성공 시 availability 배열 + isReady true', async () => {
    apiFetch.mockResolvedValueOnce(AVAILABILITY);
    const { result } = renderHook(() => useTablesAvailability());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.availability).toHaveLength(15);
    expect(result.current.availability[0]).toEqual({ table_no: 1, status: 'available' });
  });

  it('5xx/네트워크 에러 → availability null, isReady true (graceful fallback)', async () => {
    apiFetch.mockRejectedValueOnce(new Error('네트워크 오류'));
    const { result } = renderHook(() => useTablesAvailability());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.availability).toBeNull();
  });

  it('폴링 없음 — 2초 후에도 mount 시 apiFetch 1회만 호출', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    apiFetch.mockResolvedValue(AVAILABILITY);
    const { result } = renderHook(() => useTablesAvailability());
    // flush async microtasks so the mount fetch completes
    await act(async () => {
      await Promise.resolve();
    });
    // advance 2 seconds — no polling should fire
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    // 1 call = mount fetch only
    expect(apiFetch).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('refresh() 성공 → 배열 반환', async () => {
    apiFetch.mockResolvedValue(AVAILABILITY);
    const { result } = renderHook(() => useTablesAvailability());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    apiFetch.mockClear();
    apiFetch.mockResolvedValueOnce(AVAILABILITY);
    let refreshResult;
    await act(async () => {
      refreshResult = await result.current.refresh();
    });
    expect(refreshResult).toHaveLength(15);
  });

  it('refresh() 실패 → null 반환', async () => {
    apiFetch.mockResolvedValueOnce(AVAILABILITY);
    const { result } = renderHook(() => useTablesAvailability());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    apiFetch.mockRejectedValueOnce(new Error('서버 오류'));
    let refreshResult;
    await act(async () => {
      refreshResult = await result.current.refresh();
    });
    expect(refreshResult).toBeNull();
  });
});
