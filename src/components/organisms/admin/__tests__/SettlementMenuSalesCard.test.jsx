// adjustment 라운드 Subagent 4 — SettlementMenuSalesCard 단위 테스트.
//
// 메뉴별 판매 wide 카드 — 메뉴 8행 (ID 순), 0건 메뉴 포함, bar chart.
//
// 회규 보호:
//  - 8행 렌더 (`getAllByTestId(/menu-sales-bar-/)` length === 8).
//  - 메뉴 ID 순 — 첫 row "후라이드", 마지막 row "사이다".
//  - 0건 메뉴 row 포함 (예: menu_id=5 quantity=0 + "0건" 텍스트).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettlementMenuSalesCard from '../SettlementMenuSalesCard.jsx';

const MENU_SALES_8 = [
  { menu_id: 1, code: 'BANDAGE',    name: '후라이드',     category: 'chicken', base_price: 18000, quantity: 42, revenue: 756000 },
  { menu_id: 2, code: 'FIRST_AID',  name: '양념',         category: 'chicken', base_price: 19000, quantity: 38, revenue: 722000 },
  { menu_id: 3, code: 'MED_KIT',    name: '뿌링클',       category: 'chicken', base_price: 21000, quantity: 51, revenue: 1071000 },
  { menu_id: 4, code: 'SYRINGE',    name: '감자튀김',     category: 'side',    base_price:  5000, quantity: 28, revenue:  140000 },
  { menu_id: 5, code: 'DEFIB',      name: '뿌링감자튀김', category: 'side',    base_price:  7000, quantity:  0, revenue:       0 },
  { menu_id: 6, code: 'ADRENALINE', name: '칠리스',       category: 'side',    base_price:  6000, quantity: 14, revenue:   84000 },
  { menu_id: 7, code: 'PAINKILLER', name: '콜라',         category: 'drink',   base_price:  2000, quantity: 33, revenue:   66000 },
  { menu_id: 8, code: 'ENERGY',     name: '사이다',       category: 'drink',   base_price:  2000, quantity: 28, revenue:   56000 },
];

describe('SettlementMenuSalesCard', () => {
  it('★ 8행 렌더 (menu-sales-bar-* 8개)', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_8} />);
    const bars = screen.getAllByTestId(/^menu-sales-bar-/);
    expect(bars).toHaveLength(8);
  });

  it('★ 메뉴 ID 순 — 첫 row 후라이드 / 마지막 row 사이다', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_8} />);
    const bars = screen.getAllByTestId(/^menu-sales-bar-/);
    expect(bars[0]).toHaveTextContent('후라이드');
    expect(bars[bars.length - 1]).toHaveTextContent('사이다');
  });

  it('★ 0건 메뉴 row 포함 (menu_id=5 + "0건" 텍스트)', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_8} />);
    const zero = screen.getByTestId('menu-sales-bar-5');
    expect(zero).toHaveTextContent('뿌링감자튀김');
    expect(zero).toHaveTextContent('0건');
    expect(zero).toHaveTextContent('0원');
  });

  it('카드 컨테이너 testid 노출', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_8} />);
    expect(screen.getByTestId('settlement-menu-sales-card')).toBeInTheDocument();
  });

  it('빈 배열일 때 안전하게 빈 카드 렌더 (8행 미만이어도 폭주 X)', () => {
    render(<SettlementMenuSalesCard menuSales={[]} />);
    expect(screen.getByTestId('settlement-menu-sales-card')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^menu-sales-bar-/)).toHaveLength(0);
  });
});
