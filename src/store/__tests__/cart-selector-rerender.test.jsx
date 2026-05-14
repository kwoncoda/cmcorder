// Task 3.1 — 셀렉터 회귀 (§3.5 2조).
// 핵심 검증: 카트 totalQty만 구독한 컴포넌트는, items 배열의
// reference만 바뀌어도 totalQty 값이 동일하면 *리렌더되지 않아야*.
// 안티패턴(전체 객체 구독)은 동일 시나리오에서 *리렌더*된다는 비교 케이스도 포함.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import useCartStore, { cartSelectors } from '../cart.js';

beforeEach(() => {
  useCartStore.setState({ items: [] });
});

describe('CartStore 셀렉터 회귀 (§3.5 2조)', () => {
  it('totalQty만 구독한 컴포넌트 — items reference만 바뀌고 totalQty 동일하면 리렌더 X', () => {
    const renderSpy = vi.fn();

    function TotalQtyDisplay() {
      const totalQty = useCartStore(cartSelectors.totalQty);
      renderSpy();
      return <div data-testid="qty">{totalQty}</div>;
    }

    render(<TotalQtyDisplay />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // 카트에 새 항목 추가 → totalQty 0 → 1 변동 → 리렌더 1회
    act(() => useCartStore.getState().addItem({ id: 1, name: 'A', basePrice: 1000 }));
    expect(renderSpy).toHaveBeenCalledTimes(2);

    // items 배열의 *각 항목 객체 reference만* 새로 만들어도
    // totalQty 합은 동일 → 셀렉터 결과 ===로 비교되어 리렌더 X
    act(() => useCartStore.setState((state) => ({
      items: state.items.map((i) => ({ ...i })),
    })));
    expect(renderSpy).toHaveBeenCalledTimes(2); // 추가 호출 없음 — 셀렉터가 차단
  });

  it('안티패턴 — 전체 객체 구독 시 동일 시나리오에서 리렌더 발생 (대조군)', () => {
    // 비셀렉터 (전체 state 구독) 패턴은 모든 state 변경에 리렌더된다는 사실을 입증.
    // 이로써 §3.5 2조 셀렉터 강제의 가치를 회귀로 보장.
    const renderSpy = vi.fn();

    function FullSubscribe() {
      const state = useCartStore();
      renderSpy();
      return <div>{state.items.length}</div>;
    }

    render(<FullSubscribe />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => useCartStore.setState((state) => ({
      items: state.items.map((i) => ({ ...i })),
    })));
    // 전체 구독 → state reference 바뀜 → 리렌더 발생
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });
});
