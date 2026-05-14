// Task 4.2 — MenuList organism 단위 테스트.
//
// 회귀 포인트:
//  - 메뉴 배열 → MenuCard 그리드 렌더
//  - soldOut 메뉴는 "줍기" 대신 "품절" 버튼 (MenuCard 위임 확인)
//  - 빈 배열 시 빈 ul 만 렌더 (EmptyState 는 호출자가 분기)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuList from '../MenuList.jsx';

const MENUS = [
  { id: 1, code: 'BANDAGE', name: '후라이드',   category: 'chicken', basePrice: 18000 },
  { id: 5, code: 'DEFIB',   name: '뿌링감자',   category: 'side',    basePrice: 7000, soldOut: true },
];

describe('MenuList', () => {
  it('★ 메뉴 → MenuCard 렌더', () => {
    render(<MenuList menus={MENUS} />);
    // MenuFallback 도 name 을 노출하므로 heading 으로 식별.
    expect(screen.getByRole('heading', { name: '후라이드' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '뿌링감자' })).toBeInTheDocument();
  });

  it('★ soldOut 메뉴는 "품절" 버튼 (MenuCard 위임 확인)', () => {
    render(<MenuList menus={MENUS} />);
    // 뿌링감자는 soldOut → 품절 라벨
    const soldOutBtn = screen.getByRole('button', { name: /뿌링감자 품절/ });
    expect(soldOutBtn).toBeDisabled();
  });

  it('빈 배열 시 빈 list 만 렌더', () => {
    render(<MenuList menus={[]} />);
    const list = screen.getByTestId('menu-list');
    expect(list).toBeInTheDocument();
    expect(list.children).toHaveLength(0);
  });
});
