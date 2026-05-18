// MenuList — design-bundle .menu-grid 2-col grid 정합.
// MenuCard 의 단순 컬렉션 렌더. menu.image 있으면 useFallback=false 로 실 webp 사용.
import { forwardRef } from 'react';
import MenuCard from './MenuCard.jsx';

const MenuList = forwardRef(function MenuList(
  { menus = [], onAdd, onDec, className = '', ...rest },
  ref,
) {
  return (
    <ul
      ref={ref}
      data-testid="menu-list"
      className={`menu-grid ${className}`.trim()}
      style={{ listStyle: 'none', margin: 0 }}
      {...rest}
    >
      {menus.map((m) => (
        <li key={m.id}>
          <MenuCard
            menu={m}
            useFallback={!m.image}
            onAdd={onAdd}
            onDec={onDec}
            soldOut={m.soldOut}
            recommended={m.recommended}
          />
        </li>
      ))}
    </ul>
  );
});

export default MenuList;
