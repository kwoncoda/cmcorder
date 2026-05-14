// Task 2.6 — CartItem organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.6 / G11 인벤토리 라벨 / UX §5.1.
//
// 회귀 보호 항목:
//   - 본명 + 단가 + 소계 렌더 (단가 × 수량 = 소계)
//   - 천 단위 콤마 (PriceTag 통합)
//   - +/- 버튼이 onChangeQty(menuId, newQty) 호출
//   - ★ 수량 1에서 − 클릭 시 onRemove 호출 (onChangeQty X) — 자동 제거 분기
//   - aria-live="polite" 수량 안내 (수량 변경 시 스크린리더 통보)
//   - menu=null 시 null 렌더 (방어)
//   - useFallback=true 시 MenuFallback 이모지 / false 시 <img>
//   - forwardRef 로 DOM 참조 전달
//   - 카드 내 형광 옐로 텍스트 금지 (AI 슬롭 #26 — MenuCard와 동일 톤)
//   - a11y (axe)
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import CartItem from '../CartItem.jsx';

const SAMPLE = {
  id: 1,
  name: '후라이드',
  category: 'chicken',
  basePrice: 18000,
};

describe('CartItem', () => {
  it('본명·단가·소계 렌더 (단가 × 수량)', () => {
    render(<CartItem menu={SAMPLE} quantity={2} useFallback />);
    expect(screen.getByRole('heading', { name: '후라이드' })).toBeInTheDocument();
    // 단가 18,000
    expect(screen.getByText(/18,000/)).toBeInTheDocument();
    // 소계 18,000 × 2 = 36,000
    expect(screen.getByText(/36,000/)).toBeInTheDocument();
  });

  it('+ 클릭 시 onChangeQty(menuId, quantity + 1) 호출', () => {
    const onChangeQty = vi.fn();
    render(
      <CartItem menu={SAMPLE} quantity={2} onChangeQty={onChangeQty} useFallback />,
    );
    fireEvent.click(screen.getByRole('button', { name: /수량 증가/ }));
    expect(onChangeQty).toHaveBeenCalledTimes(1);
    expect(onChangeQty).toHaveBeenCalledWith(1, 3);
  });

  it('− 클릭 시 onChangeQty(menuId, quantity - 1) 호출 (수량 > 1)', () => {
    const onChangeQty = vi.fn();
    render(
      <CartItem menu={SAMPLE} quantity={2} onChangeQty={onChangeQty} useFallback />,
    );
    fireEvent.click(screen.getByRole('button', { name: /수량 감소/ }));
    expect(onChangeQty).toHaveBeenCalledTimes(1);
    expect(onChangeQty).toHaveBeenCalledWith(1, 1);
  });

  it('★ 수량 1에서 − 클릭 시 onRemove 호출 (onChangeQty X)', () => {
    const onChangeQty = vi.fn();
    const onRemove = vi.fn();
    render(
      <CartItem
        menu={SAMPLE}
        quantity={1}
        onChangeQty={onChangeQty}
        onRemove={onRemove}
        useFallback
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /수량 감소/ }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(1);
    expect(onChangeQty).not.toHaveBeenCalled();
  });

  it('수량 aria-live polite 로 스크린리더 안내', () => {
    render(<CartItem menu={SAMPLE} quantity={3} useFallback />);
    const live = screen.getByLabelText(/현재 수량 3개/);
    expect(live).toBeInTheDocument();
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  it('menu=null 시 null 렌더 (방어)', () => {
    const { container } = render(<CartItem menu={null} quantity={1} />);
    expect(container.firstChild).toBeNull();
  });

  it('useFallback=true 시 MenuFallback 분류 이모지 렌더 (chicken → 🍗)', () => {
    render(<CartItem menu={SAMPLE} quantity={1} useFallback />);
    expect(screen.getByText('🍗')).toBeInTheDocument();
  });

  it('useFallback=false 시 <img> 렌더 (자산 수령 후)', () => {
    const { container } = render(
      <CartItem
        menu={{ ...SAMPLE, image: '/items/bandage.webp' }}
        quantity={1}
        useFallback={false}
      />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/items/bandage.webp');
  });

  it('★ 카드 내 형광 옐로 텍스트 금지 (AI 슬롭 #26)', () => {
    // 본명 h3·소계 wrapper 가 text-accent 클래스 미사용.
    const { container } = render(
      <CartItem menu={SAMPLE} quantity={2} useFallback />,
    );
    const heading = container.querySelector('h3');
    expect(heading).not.toBeNull();
    expect(heading.className).not.toMatch(/\btext-accent\b/);
  });

  it('forwardRef 로 DOM 참조 전달', () => {
    const ref = createRef();
    render(<CartItem ref={ref} menu={SAMPLE} quantity={1} useFallback />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current.tagName).toBe('ARTICLE');
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <CartItem menu={SAMPLE} quantity={2} useFallback />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
