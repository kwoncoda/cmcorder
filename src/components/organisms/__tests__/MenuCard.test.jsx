// Task 2.5 — MenuCard organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.5 / G10·G11·결정 b·결정 f·DESIGN §10.5·AI 슬롭 #26.
//
// 회귀 보호 항목:
//   - 본명 표시 (G10 — 콜라/사이다 등 리스킨 X)
//   - basePrice 천 단위 콤마 (PriceTag)
//   - RECOMMENDED / SOLD OUT 도장 (StampBadge — sold-out 우선)
//   - "줍기" 버튼만 클릭 영역 (결정 f — 카드 article onClick X)
//   - soldOut 시 onAdd 호출 X (버튼 disabled)
//   - 카드 내 형광 옐로 텍스트 금지 (AI 슬롭 #26 — 본명·가격에 text-accent X)
//   - useFallback=true 시 MenuFallback 분류 이모지 렌더 (ADR-006)
//   - useFallback=false 시 <img> 렌더 (자산 수령 후)
//   - menu prop null 시 null 렌더 (방어)
//   - a11y (axe) — 일반 + soldOut
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import MenuCard from '../MenuCard.jsx';

const SAMPLE_MENU = {
  id: 1,
  code: 'BANDAGE',
  name: '후라이드',
  category: 'chicken',
  basePrice: 18000,
};

describe('MenuCard', () => {
  // ── 8 메뉴 본명 렌더 — 4 샘플 (G10 — 리스킨 X) ──
  // 전수 8개는 menus.test.js 가 보호. 본 organism 테스트는 샘플 4개로 props 매핑 확인.
  it.each([
    [{ id: 1, name: '후라이드',   category: 'chicken', basePrice: 18000 }, '후라이드'],
    [{ id: 7, name: '콜라',       category: 'drink',   basePrice: 2000 },  '콜라'],
    [{ id: 4, name: '감자튀김',   category: 'side',    basePrice: 5000 },  '감자튀김'],
    [{ id: 8, name: '사이다',     category: 'drink',   basePrice: 2000 },  '사이다'],
  ])('메뉴 %o 본명 "%s" 렌더 (리스킨 X — G10)', (menu, name) => {
    render(<MenuCard menu={menu} useFallback />);
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });

  it('basePrice 가격 천 단위 콤마 표시', () => {
    render(<MenuCard menu={SAMPLE_MENU} useFallback />);
    expect(screen.getByText(/18,000/)).toBeInTheDocument();
  });

  it('recommended=true 시 RECOMMENDED 도장 표시', () => {
    render(<MenuCard menu={SAMPLE_MENU} recommended useFallback />);
    expect(screen.getByText('RECOMMENDED')).toBeInTheDocument();
  });

  it('soldOut=true 시 SOLD OUT 도장 + 버튼 disabled + opacity 흐림', () => {
    const { container } = render(<MenuCard menu={SAMPLE_MENU} soldOut useFallback />);
    expect(screen.getByText('SOLD OUT')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
    expect(container.firstChild.className).toMatch(/opacity-50/);
  });

  it('recommended + soldOut 동시 시 sold-out 우선 (recommended 도장 X)', () => {
    render(<MenuCard menu={SAMPLE_MENU} recommended soldOut useFallback />);
    expect(screen.getByText('SOLD OUT')).toBeInTheDocument();
    expect(screen.queryByText('RECOMMENDED')).not.toBeInTheDocument();
  });

  it('★ "줍기" 버튼 클릭 시에만 onAdd 호출 (카드 전체 클릭 X) — 결정 f', () => {
    const onAdd = vi.fn();
    render(<MenuCard menu={SAMPLE_MENU} onAdd={onAdd} useFallback />);

    // 1. 카드 article 자체 클릭 — onAdd 호출 X
    const article = screen.getByTestId('menu-card-1');
    fireEvent.click(article);
    expect(onAdd).not.toHaveBeenCalled();

    // 2. 줍기 버튼 클릭 — onAdd 호출
    fireEvent.click(screen.getByRole('button', { name: /줍기/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(SAMPLE_MENU);
  });

  it('★ soldOut 시 줍기 버튼 클릭해도 onAdd 호출 X', () => {
    const onAdd = vi.fn();
    render(<MenuCard menu={SAMPLE_MENU} soldOut onAdd={onAdd} useFallback />);
    fireEvent.click(screen.getByRole('button'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('menu.soldOut=true 시에도 SOLD OUT 도장 (prop 미지정 시 menu 필드 fallback)', () => {
    render(<MenuCard menu={{ ...SAMPLE_MENU, soldOut: true }} useFallback />);
    expect(screen.getByText('SOLD OUT')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('★ 카드 내 형광 옐로 텍스트 금지 (AI 슬롭 #26)', () => {
    // 본명·가격은 text-accent (형광 옐로) 클래스 미사용.
    // 단, 버튼(primary) 은 CTA 라서 형광 옐로 배경 OK — 본 검사는 *텍스트* 클래스만.
    const { container } = render(<MenuCard menu={SAMPLE_MENU} useFallback />);

    const heading = container.querySelector('h3');
    expect(heading).not.toBeNull();
    expect(heading.className).not.toMatch(/\btext-accent\b/);

    // PriceTag wrapper (font-mono 보유) 도 text-accent X.
    const priceTag = container.querySelector('[class*="font-mono"]');
    if (priceTag) {
      expect(priceTag.className).not.toMatch(/\btext-accent\b/);
    }
  });

  it('useFallback=true 시 MenuFallback 분류 이모지 렌더 (ADR-006)', () => {
    render(<MenuCard menu={SAMPLE_MENU} useFallback />);
    // chicken 카테고리 → 🍗
    expect(screen.getByText('🍗')).toBeInTheDocument();
  });

  it('useFallback=false 시 <img> 렌더 (자산 수령 후)', () => {
    const { container } = render(
      <MenuCard menu={{ ...SAMPLE_MENU, image: '/items/bandage.webp' }} useFallback={false} />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/items/bandage.webp');
    expect(img.getAttribute('alt')).toMatch(/후라이드/);
  });

  it('menu prop 이 null 일 때 null 렌더 (방어)', () => {
    const { container } = render(<MenuCard menu={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('forwardRef 로 DOM 참조 전달', () => {
    const ref = createRef();
    render(<MenuCard ref={ref} menu={SAMPLE_MENU} useFallback />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current.tagName).toBe('ARTICLE');
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<MenuCard menu={SAMPLE_MENU} useFallback />);
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });

  it('a11y 위반 없음 — soldOut 상태', async () => {
    const { container } = render(<MenuCard menu={SAMPLE_MENU} soldOut useFallback />);
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
