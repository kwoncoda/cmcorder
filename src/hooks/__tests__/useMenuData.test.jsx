// Task 4.2 — useMenuData hook 단위 테스트.
//
// 회귀 포인트:
//  - GET /api/menus 호출 → data 반환
//  - popular 파생: recommended=true 우선, 없으면 첫 3개 fallback (결정 E)
//  - 로딩 / 에러 / 빈 분기 — 호출자에 isLoading·error 노출
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// apiFetch mock — useApi 가 호출하는 fetcher 인자에 그대로 전달.
vi.mock('../../api/client.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});
import { apiFetch } from '../../api/client.js';
import { useMenuData } from '../useMenuData.js';

const FULL_MENUS = [
  { id: 1, code: 'BANDAGE',    name: '후라이드',     category: 'chicken', basePrice: 18000, recommended: true,  soldOut: false },
  { id: 2, code: 'FIRST_AID',  name: '양념',         category: 'chicken', basePrice: 19000, recommended: false, soldOut: false },
  { id: 3, code: 'MED_KIT',    name: '뿌링클',       category: 'chicken', basePrice: 21000, recommended: true,  soldOut: false },
  { id: 4, code: 'SYRINGE',    name: '감자튀김',     category: 'side',    basePrice: 5000,  recommended: false, soldOut: false },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMenuData', () => {
  it('성공 시 menus 배열 반환', async () => {
    apiFetch.mockResolvedValueOnce(FULL_MENUS);
    const { result } = renderHook(() => useMenuData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.menus).toHaveLength(4);
    expect(result.current.error).toBeNull();
  });

  it('★ popular — recommended=true 메뉴 우선 (결정 E)', async () => {
    apiFetch.mockResolvedValueOnce(FULL_MENUS);
    const { result } = renderHook(() => useMenuData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // recommended=true 인 후라이드(id:1)와 뿌링클(id:3) 둘 — 첫 3개로 잘림 X
    expect(result.current.popular.map((m) => m.id)).toEqual([1, 3]);
  });

  it('★ popular — recommended 없을 시 첫 3개 fallback', async () => {
    const noRecommended = FULL_MENUS.map((m) => ({ ...m, recommended: false }));
    apiFetch.mockResolvedValueOnce(noRecommended);
    const { result } = renderHook(() => useMenuData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.popular).toHaveLength(3);
    expect(result.current.popular.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('★ 에러 시 menus 빈 배열 + error 노출', async () => {
    apiFetch.mockRejectedValueOnce(new Error('네트워크 오류'));
    const { result } = renderHook(() => useMenuData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.menus).toEqual([]);
    expect(result.current.popular).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });
});
