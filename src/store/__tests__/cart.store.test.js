// Task 3.1 — cart store 단위 테스트 (8+ 케이스).
// 회귀 포인트:
//  - addItem 중복 menuId 시 quantity 병합
//  - removeItem · changeQty(0이하 자동 제거) · clear
//  - cartSelectors.totalQty / totalPrice (외부 export 함수)
//  - menu=null 방어 — 추가 무시
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCartStore, { cartSelectors } from '../cart.js';

const sampleMenu = { id: 1, name: '후라이드', basePrice: 18000, category: 'chicken' };

beforeEach(() => {
  // store 초기화 — 각 케이스 격리
  useCartStore.setState({ items: [] });
});

describe('CartStore', () => {
  it('addItem — 새 항목 추가', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => result.current.addItem(sampleMenu));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].menuId).toBe(1);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.items[0].basePrice).toBe(18000);
  });

  it('addItem — 동일 menu 중복 시 quantity 병합 (회귀)', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => result.current.addItem(sampleMenu));
    act(() => result.current.addItem(sampleMenu, 2));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
  });

  it('removeItem — menuId로 제거', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => result.current.addItem(sampleMenu));
    act(() => result.current.removeItem(1));
    expect(result.current.items).toHaveLength(0);
  });

  it('changeQty — 양수면 갱신, 0 이하면 자동 제거', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => result.current.addItem(sampleMenu));
    act(() => result.current.changeQty(1, 5));
    expect(result.current.items[0].quantity).toBe(5);
    act(() => result.current.changeQty(1, 0));
    expect(result.current.items).toHaveLength(0);
  });

  it('clear — 모든 항목 제거', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => result.current.addItem(sampleMenu));
    act(() => result.current.addItem({ id: 2, name: '양념', basePrice: 19000 }));
    act(() => result.current.clear());
    expect(result.current.items).toHaveLength(0);
  });

  it('cartSelectors.totalQty — 합산', () => {
    useCartStore.setState({
      items: [
        { menuId: 1, name: 'A', basePrice: 1000, quantity: 2 },
        { menuId: 2, name: 'B', basePrice: 2000, quantity: 3 },
      ],
    });
    expect(cartSelectors.totalQty(useCartStore.getState())).toBe(5);
  });

  it('cartSelectors.totalPrice — 합산', () => {
    useCartStore.setState({
      items: [
        { menuId: 1, name: 'A', basePrice: 1000, quantity: 2 },
        { menuId: 2, name: 'B', basePrice: 2000, quantity: 3 },
      ],
    });
    expect(cartSelectors.totalPrice(useCartStore.getState())).toBe(8000);
  });

  it('빈 카트 — totalQty / totalPrice 0', () => {
    expect(cartSelectors.totalQty(useCartStore.getState())).toBe(0);
    expect(cartSelectors.totalPrice(useCartStore.getState())).toBe(0);
  });

  it('menu=null 또는 id 없음 — 추가 무시 (방어)', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => result.current.addItem(null));
    act(() => result.current.addItem({}));
    act(() => result.current.addItem(undefined));
    expect(result.current.items).toHaveLength(0);
  });
});
