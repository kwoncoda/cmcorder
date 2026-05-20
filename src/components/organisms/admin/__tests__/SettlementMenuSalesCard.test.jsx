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

// menu_update 라운드 (2026-05-20): 메뉴 8행 → 10행 픽스처 + 가격 갱신.
const MENU_SALES_10 = [
  { menu_id:  1, code: 'BANDAGE',    name: '후라이드',     category: 'chicken', base_price:  8000, quantity: 42, revenue: 336000 },
  { menu_id:  2, code: 'FIRST_AID',  name: '양념',         category: 'chicken', base_price:  9000, quantity: 38, revenue: 342000 },
  { menu_id:  3, code: 'MED_KIT',    name: '뿌링클',       category: 'chicken', base_price: 11000, quantity: 51, revenue: 561000 },
  { menu_id:  4, code: 'SYRINGE',    name: '감자튀김',     category: 'side',    base_price:  4000, quantity: 28, revenue: 112000 },
  { menu_id:  5, code: 'DEFIB',      name: '뿌링감자튀김', category: 'side',    base_price:  5000, quantity:  0, revenue:      0 },
  { menu_id:  6, code: 'ADRENALINE', name: '칠리스',       category: 'side',    base_price:  4500, quantity: 14, revenue:  63000 },
  { menu_id:  7, code: 'PAINKILLER', name: '콜라',         category: 'drink',   base_price:  2000, quantity: 33, revenue:  66000 },
  { menu_id:  8, code: 'ENERGY',     name: '사이다',       category: 'drink',   base_price:  2000, quantity: 28, revenue:  56000 },
  { menu_id:  9, code: 'bluezone',   name: '생수',         category: 'side',    base_price:  1000, quantity:  5, revenue:   5000 },
  { menu_id: 10, code: 'fuel',       name: '양념 소스',    category: 'side',    base_price:   500, quantity: 12, revenue:   6000 },
];

describe('SettlementMenuSalesCard', () => {
  it('★ 10행 렌더 (menu-sales-bar-* 10개 — menu_update 라운드)', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_10} />);
    const bars = screen.getAllByTestId(/^menu-sales-bar-/);
    expect(bars).toHaveLength(10);
  });

  it('★ 메뉴 ID 순 — 첫 row 후라이드 / 마지막 row 양념 소스 (menu_update)', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_10} />);
    const bars = screen.getAllByTestId(/^menu-sales-bar-/);
    expect(bars[0]).toHaveTextContent('후라이드');
    expect(bars[bars.length - 1]).toHaveTextContent('양념 소스');
  });

  it('★ 0건 메뉴 row 포함 (menu_id=5 + "0건" 텍스트)', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_10} />);
    const zero = screen.getByTestId('menu-sales-bar-5');
    expect(zero).toHaveTextContent('뿌링감자튀김');
    expect(zero).toHaveTextContent('0건');
    expect(zero).toHaveTextContent('0원');
  });

  it('★ menu_update — 신규 메뉴 row(생수/양념 소스) 노출', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_10} />);
    const bluezone = screen.getByTestId('menu-sales-bar-9');
    expect(bluezone).toHaveTextContent('생수');
    const fuel = screen.getByTestId('menu-sales-bar-10');
    expect(fuel).toHaveTextContent('양념 소스');
  });

  it('카드 컨테이너 testid 노출', () => {
    render(<SettlementMenuSalesCard menuSales={MENU_SALES_10} />);
    expect(screen.getByTestId('settlement-menu-sales-card')).toBeInTheDocument();
  });

  it('빈 배열일 때 안전하게 빈 카드 렌더 (10행 미만이어도 폭주 X)', () => {
    render(<SettlementMenuSalesCard menuSales={[]} />);
    expect(screen.getByTestId('settlement-menu-sales-card')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^menu-sales-bar-/)).toHaveLength(0);
  });
});
