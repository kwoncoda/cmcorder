// CategoryTabs — organism (Task 4.2).
//
// 메뉴 분류 탭 (전체 / 치킨 / 사이드 / 음료).
//
// 핵심:
//  - role="tablist" + button[role="tab"] + aria-selected — WAI-ARIA tab pattern (단순 형)
//  - 활성 탭: bg-accent (형광 옐로 배경) + text-card-ink — *배경*만 형광, 텍스트는 #1B1F23 (AI 슬롭 #26 회피)
//  - 비활성 탭: bg-elevated + text-ink — 톤 다운
//  - min-h-[44px] — 모바일 hitbox (Button atom 과 동일)
//  - overflow-x-auto — 탭 수 늘어도 가로 스크롤 가능 (현재는 4개라 X)
//
// 관련 결정: AI 슬롭 #26 (텍스트 형광 X — 배경만 OK)
import { forwardRef } from 'react';

const CategoryTabs = forwardRef(function CategoryTabs(
  { categories = [], value, onChange, className = '', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="메뉴 분류"
      data-testid="category-tabs"
      className={`flex gap-xs overflow-x-auto ${className}`.trim()}
      {...rest}
    >
      {categories.map((c) => {
        const active = c.value === value;
        const cls = [
          'min-h-[44px] px-md rounded-md',
          'font-display font-semibold text-sm whitespace-nowrap',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
          active
            ? 'bg-accent text-card-ink'
            : 'bg-elevated text-ink hover:bg-divider',
        ].join(' ');
        return (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(c.value)}
            className={cls}
            data-testid={`category-tab-${c.value}`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
});

export default CategoryTabs;
