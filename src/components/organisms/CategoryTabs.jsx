// CategoryTabs — design-bundle .cat-tabs (가로 스크롤 chip) 정합.
//
// 마크업: <nav class="cat-tabs" role="tablist">
//   <button class="cat-tab active?" role="tab" aria-selected> {label} </button>
//
// 테스트 호환: data-testid="category-tab-{value}" 보존.
import { forwardRef } from 'react';

const CategoryTabs = forwardRef(function CategoryTabs(
  { categories = [], value, onChange, className = '', ...rest },
  ref,
) {
  return (
    <nav
      ref={ref}
      role="tablist"
      aria-label="메뉴 분류"
      data-testid="category-tabs"
      className={`cat-tabs ${className}`.trim()}
      {...rest}
    >
      {categories.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(c.value)}
            className={`cat-tab ${active ? 'active' : ''}`.trim()}
            data-testid={`category-tab-${c.value}`}
          >
            {c.label}
          </button>
        );
      })}
    </nav>
  );
});

export default CategoryTabs;
