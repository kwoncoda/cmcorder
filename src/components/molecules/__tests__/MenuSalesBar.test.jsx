// adjustment 라운드 Subagent 4 — MenuSalesBar 단위 테스트.
//
// 단일 메뉴 1행 bar — 이름 / 진행 바 / "N건 · X원" 메타.
// design-bundle .bar-row 패턴 (`docs/design-bundle/screens-admin.jsx:731-741`).
//
// 회귀 보호:
//  - 한글 화폐 포맷 `toLocaleString('ko-KR')` ("1,000원" / "0원" 형태).
//  - bar width = `revenue / maxRevenue * 100`.
//  - maxRevenue=0 (또는 누락) 시 bar width 0% — 0건 메뉴 대비.
//  - data-testid=`menu-sales-bar-{menu_id}`.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuSalesBar from '../MenuSalesBar.jsx';

describe('MenuSalesBar', () => {
  it('★ 한글 화폐 포맷 "1,000원" 노출', () => {
    render(
      <MenuSalesBar
        menu_id={7}
        name="콜라"
        quantity={5}
        revenue={1000}
        maxRevenue={1000}
      />,
    );
    const row = screen.getByTestId('menu-sales-bar-7');
    expect(row).toHaveTextContent('콜라');
    expect(row).toHaveTextContent('5건');
    expect(row).toHaveTextContent('1,000원');
  });

  it('★ maxRevenue=0 시 bar width 0% (0건 메뉴 대비)', () => {
    const { container } = render(
      <MenuSalesBar
        menu_id={5}
        name="뿌링감자튀김"
        quantity={0}
        revenue={0}
        maxRevenue={0}
      />,
    );
    const fill = container.querySelector('[data-testid="menu-sales-bar-5"] .bar-fill, [data-testid="menu-sales-bar-5"] [data-bar-fill]');
    expect(fill).not.toBeNull();
    // width: '0%' (style inline 또는 0% 문자열)
    const styleAttr = fill.getAttribute('style') ?? '';
    expect(styleAttr).toMatch(/width:\s*0%/);
  });

  it('revenue/maxRevenue 비율로 width 계산 (50%)', () => {
    const { container } = render(
      <MenuSalesBar
        menu_id={1}
        name="후라이드"
        quantity={1}
        revenue={500}
        maxRevenue={1000}
      />,
    );
    const fill = container.querySelector('[data-testid="menu-sales-bar-1"] [data-bar-fill]');
    expect(fill).not.toBeNull();
    expect(fill.getAttribute('style') ?? '').toMatch(/width:\s*50%/);
  });

  it('0건 메뉴 → "0건 · 0원"', () => {
    render(
      <MenuSalesBar
        menu_id={5}
        name="뿌링감자튀김"
        quantity={0}
        revenue={0}
        maxRevenue={1000}
      />,
    );
    const row = screen.getByTestId('menu-sales-bar-5');
    expect(row).toHaveTextContent('0건');
    expect(row).toHaveTextContent('0원');
  });
});
