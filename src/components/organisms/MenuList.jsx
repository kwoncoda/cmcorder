// MenuList — organism (Task 4.2).
//
// 메뉴 카드 그리드. MenuCard 의 단순 컬렉션 렌더만 담당 — 데이터 fetch X.
//
// 핵심:
//  - grid-cols-2 — 모바일 기본 2열 (메뉴 8개라 4행).
//  - soldOut / recommended 도 그대로 MenuCard 에 전달 — 위임.
//  - 빈 배열은 호출자가 EmptyState 로 처리 (본 컴포넌트는 빈 ul 만).
import { forwardRef } from 'react';
import MenuCard from './MenuCard.jsx';

const MenuList = forwardRef(function MenuList(
  { menus = [], onAdd, className = '', ...rest },
  ref,
) {
  return (
    <ul
      ref={ref}
      data-testid="menu-list"
      className={`grid grid-cols-2 gap-md ${className}`.trim()}
      {...rest}
    >
      {menus.map((m) => (
        <li key={m.id}>
          <MenuCard
            menu={m}
            useFallback
            onAdd={onAdd}
            soldOut={m.soldOut}
            recommended={m.recommended}
          />
        </li>
      ))}
    </ul>
  );
});

export default MenuList;
