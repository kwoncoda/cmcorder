// MenuSalesBar — molecule (adjustment 라운드 Subagent 4).
//
// 메뉴별 판매 1행 — 이름 / 진행 바 / "N건 · X원" 메타.
// design-bundle .bar-row 패턴 (screens-admin.jsx:731-741 / app.css:1761-1789).
//
// 회귀:
//  - 한글 화폐 포맷: `value.toLocaleString('ko-KR')` + "원" suffix.
//  - bar width: `revenue / maxRevenue * 100`. maxRevenue ≤ 0 → 0%.
//  - data-testid=`menu-sales-bar-{menu_id}` (메뉴별 ID 식별).
//  - data-bar-fill 자식에 inline style width 적용 (테스트 식별 + 동적 폭).
import { forwardRef } from 'react';

function computeWidthPct(revenue, maxRevenue) {
  if (!maxRevenue || maxRevenue <= 0) return 0;
  const pct = (revenue / maxRevenue) * 100;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

function formatKrw(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

const MenuSalesBar = forwardRef(function MenuSalesBar(
  { menu_id, name, quantity = 0, revenue = 0, maxRevenue = 0, className = '', ...rest },
  ref,
) {
  const widthPct = computeWidthPct(revenue, maxRevenue);
  // design-bundle .bar-row → Tailwind utility:
  //   grid grid-cols-[120px_1fr_140px] md:grid-cols-[180px_1fr_160px]
  //   gap-sm items-center.
  const rowCls = [
    'bar-row',
    'grid grid-cols-[120px_1fr_140px] md:grid-cols-[180px_1fr_160px] gap-sm items-center',
    'py-1',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      data-testid={`menu-sales-bar-${menu_id}`}
      className={rowCls}
      {...rest}
    >
      <span className="bar-name text-sm font-semibold truncate">{name}</span>
      <div className="bar-track h-2 bg-bg rounded-full overflow-hidden">
        <div
          className="bar-fill h-full bg-accent transition-all"
          data-bar-fill
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="bar-meta text-xs text-muted font-mono tabular-nums text-right">
        {quantity}건 · {formatKrw(revenue)}
      </span>
    </div>
  );
});

export default MenuSalesBar;
