// SettlementMenuSalesCard — organism (adjustment 라운드 Subagent 4).
//
// 메뉴별 판매 wide 카드 — design-bundle .settle-card.wide (screens-admin.jsx:724-742).
//
// 책임:
//   - 메뉴 8행 bar chart (server 가 ORDER BY m.id ASC 보장).
//   - 0건 메뉴도 표시 (LEFT JOIN 회귀 보호).
//   - max revenue 기준 정규화 폭 — MenuSalesBar 에 위임.
//
// 회귀:
//   - data-testid="settlement-menu-sales-card".
//   - 8행 + ID 순 + 0건 메뉴 row 유지.
import { forwardRef, useMemo } from 'react';
import MenuSalesBar from '../../molecules/MenuSalesBar.jsx';

const SettlementMenuSalesCard = forwardRef(function SettlementMenuSalesCard(
  { menuSales = [] },
  ref,
) {
  const list = Array.isArray(menuSales) ? menuSales : [];
  const maxRevenue = useMemo(() => {
    let m = 0;
    for (const row of list) {
      const r = Number(row?.revenue || 0);
      if (r > m) m = r;
    }
    return m;
  }, [list]);

  return (
    <section
      ref={ref}
      data-testid="settlement-menu-sales-card"
      className="settle-card md:col-span-2 bg-elevated rounded-md p-md flex flex-col gap-sm"
      aria-label="메뉴별 판매"
    >
      <div className="text-xs text-accent font-semibold uppercase tracking-wide">메뉴별 판매</div>
      {list.length === 0 ? (
        <p className="text-sm text-muted">집계 데이터가 없어요.</p>
      ) : (
        <div className="flex flex-col gap-xs">
          {list.map((row) => (
            <MenuSalesBar
              key={row.menu_id}
              menu_id={row.menu_id}
              name={row.name}
              quantity={row.quantity}
              revenue={row.revenue}
              maxRevenue={maxRevenue}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export default SettlementMenuSalesCard;
