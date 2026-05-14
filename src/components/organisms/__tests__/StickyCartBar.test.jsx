// Task 4.2 — StickyCartBar organism 단위 테스트.
//
// 회귀 포인트:
//  - totalQty=0 시 미렌더 (불필요 UI 가림 방지)
//  - 카트 항목 있을 시 totalQty + totalPrice 표시
//  - props drilling X — Zustand 셀렉터 직접 구독 (§3.5 2조)
//  - 장바구니 버튼 클릭 시 onCheckout 콜백 호출
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StickyCartBar from '../StickyCartBar.jsx';
import useCartStore from '../../../store/cart.js';

beforeEach(() => {
  useCartStore.setState({ items: [] });
});

describe('StickyCartBar', () => {
  it('★ totalQty=0 시 미렌더', () => {
    render(<StickyCartBar onCheckout={() => {}} />);
    expect(screen.queryByTestId('sticky-cart-bar')).not.toBeInTheDocument();
  });

  it('★ 카트 항목 있을 시 totalQty + totalPrice 표시', () => {
    useCartStore.setState({
      items: [{ menuId: 1, name: '후라이드', basePrice: 1000, quantity: 3 }],
    });
    render(<StickyCartBar onCheckout={() => {}} />);
    expect(screen.getByTestId('sticky-cart-bar')).toBeInTheDocument();
    expect(screen.getByText(/3개/)).toBeInTheDocument();
    expect(screen.getByText(/3,000/)).toBeInTheDocument();
  });

  it('장바구니 버튼 클릭 시 onCheckout 호출', () => {
    useCartStore.setState({
      items: [{ menuId: 1, name: 'X', basePrice: 1000, quantity: 1 }],
    });
    const onCheckout = vi.fn();
    render(<StickyCartBar onCheckout={onCheckout} />);
    fireEvent.click(screen.getByRole('button', { name: /장바구니로 이동/ }));
    expect(onCheckout).toHaveBeenCalled();
  });
});
