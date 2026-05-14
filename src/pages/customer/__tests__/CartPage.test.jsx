// Task 4.3 — CartPage 통합 테스트.
//
// 회귀 보호:
//  - 3분기: items 0건 = EmptyState / 1건 이상 = list + sticky CTA
//  - 헤더 "인벤토리 (N개)" — G11
//  - Zustand 셀렉터(totalPrice/totalQty) 즉시 반영
//  - + 클릭 시 cart store 갱신 + 합계 변동
//  - 수량 1에서 − 클릭 시 자동 제거 (CartItem의 onRemove 분기)
//  - 주문 정보 입력 클릭 시 /checkout navigate
//  - Empty 시 "메뉴 보러 가기" 클릭 시 /menu navigate
//  - Empty 시 sticky CTA 미렌더
//  - 페이지 ≤120줄 — §3.5 1조
//  - a11y (axe)
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';
import CartPage from '../CartPage.jsx';
import useCartStore from '../../../store/cart.js';

// CartPage 단독 + 라우팅 검증을 위한 다중 라우트 헬퍼.
function renderPage(initialPath = '/cart') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/cart" element={<CartPage />} />
        <Route path="/menu" element={<div data-testid="menu-page-stub">메뉴</div>} />
        <Route
          path="/checkout"
          element={<div data-testid="checkout-page-stub">체크아웃</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const ITEM_A = { menuId: 1, name: '후라이드', basePrice: 18000, quantity: 2, category: 'chicken' };
const ITEM_B = { menuId: 2, name: '감자튀김', basePrice: 4000, quantity: 1, category: 'side' };

beforeEach(() => {
  useCartStore.setState({ items: [] });
});

describe('CartPage', () => {
  it('★ Empty 분기 — items 0 시 EmptyState + "메뉴 보러 가기" 버튼', () => {
    renderPage();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/인벤토리가 비어/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메뉴 보러 가기' })).toBeInTheDocument();
  });

  it('items 표시 + 인벤토리 (N개) 라벨 — 수량 합산', () => {
    useCartStore.setState({ items: [ITEM_A, ITEM_B] });
    renderPage();
    // 2 + 1 = 3개
    expect(screen.getByText(/인벤토리 \(3개\)/)).toBeInTheDocument();
  });

  it('합계 즉시 반영 — Zustand 셀렉터(totalPrice)', () => {
    // 1,000 × 3 = 3,000
    useCartStore.setState({
      items: [{ menuId: 1, name: 'A', basePrice: 1000, quantity: 3, category: 'chicken' }],
    });
    renderPage();
    // sticky CTA 합계 표시 — CartItem 의 "소계" 와 별개로 sticky 영역만 검증.
    const sticky = screen.getByTestId('cart-sticky-cta');
    expect(sticky).toHaveTextContent('3,000');
  });

  it('★ 수량 + 버튼 클릭 시 store 갱신 + 합계 변동', () => {
    useCartStore.setState({
      items: [{ menuId: 1, name: 'A', basePrice: 1000, quantity: 1, category: 'chicken' }],
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /수량 증가/ }));
    expect(useCartStore.getState().items[0].quantity).toBe(2);
    // 1,000 × 2 = 2,000 (sticky CTA 영역만 검증 — CartItem 소계와 중복 회피)
    const sticky = screen.getByTestId('cart-sticky-cta');
    expect(sticky).toHaveTextContent('2,000');
  });

  it('★ 수량 1에서 − 시 자동 제거 (CartItem onRemove 분기)', () => {
    useCartStore.setState({
      items: [{ menuId: 1, name: 'A', basePrice: 1000, quantity: 1, category: 'chicken' }],
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /수량 감소/ }));
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('수량 2에서 − 시 quantity 1로 감소 (제거 X)', () => {
    useCartStore.setState({
      items: [{ menuId: 1, name: 'A', basePrice: 1000, quantity: 2, category: 'chicken' }],
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /수량 감소/ }));
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it('★ 주문 정보 입력 버튼 클릭 시 /checkout 으로 navigate', () => {
    useCartStore.setState({ items: [ITEM_A] });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '주문 정보 입력' }));
    expect(screen.getByTestId('checkout-page-stub')).toBeInTheDocument();
  });

  it('★ 메뉴 보러 가기 클릭 시 /menu 로 navigate', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '메뉴 보러 가기' }));
    expect(screen.getByTestId('menu-page-stub')).toBeInTheDocument();
  });

  it('★ Empty 시 sticky CTA 미렌더', () => {
    renderPage();
    expect(screen.queryByTestId('cart-sticky-cta')).not.toBeInTheDocument();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/CartPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });

  it('a11y 위반 없음 (items 있을 때)', async () => {
    useCartStore.setState({ items: [ITEM_A] });
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
