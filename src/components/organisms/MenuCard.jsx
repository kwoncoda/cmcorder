// MenuCard — design-bundle screens-customer.jsx:81-114 정합.
//
// 마크업: <article class="menu-card sold-out?">
//   <div class="menu-illust"><img class="menu-img"> <span class="ammo-tag">CODE</span></div>
//   <div class="menu-body"><h3 class="menu-name"> <span class="menu-sub"> <PriceTag class="menu-price"> <button class="pick-btn">
//
// 회귀 보존(테스트 의존):
//   - data-testid="menu-card-{id}" / <h3> 요소 / .menu-card.sold-out + opacity-50 Tailwind 유틸
//   - PriceTag 의 font-mono 클래스 (AI 슬롭 #26 검사)
//   - StampBadge — recommended/sold-out 도장 + 절대 위치
//   - `<button>` 으로 "줍기" / "✓ 인벤토리 N" / "SOLD OUT" 분기, soldOut 시 disabled
//
// 시안 추가 디테일:
//   - useFallback=false 시 design-bundle 자산 path 사용 (/items/{code}.webp)
//   - in-cart 시 pick-btn 에 data-incart 부착 (CSS 가 background: success 로 토글)
import { forwardRef } from 'react';
import StampBadge from '../molecules/StampBadge.jsx';
import PriceTag from '../molecules/PriceTag.jsx';
import MenuFallback from '../molecules/MenuFallback.jsx';
import useCartStore from '../../store/cart.js';

const MenuCard = forwardRef(function MenuCard(
  {
    menu,
    onAdd,
    onDec,
    recommended = false,
    soldOut = false,
    useFallback = true,
    className = '',
    ...rest
  },
  ref,
) {
  // ★ Hook 은 early return *위* 에서 호출 — React Hook 순서 규칙.
  //   menu 가 null 이어도 selector 는 안전하게 0 반환. inCartQty 자체는 early return 후
  //   사용되지 않으므로 비용·결과 영향 없음.
  const menuId = menu?.id;
  // 카트 내 동일 메뉴 수량 — pick-btn 라벨용. shallow 셀렉터.
  const inCartQty = useCartStore(
    (s) => (menuId == null ? 0 : s.items.find((i) => i.menuId === menuId)?.quantity ?? 0),
  );

  if (!menu) return null;

  const isSoldOut = Boolean(soldOut || menu.soldOut);

  const handleAdd = () => {
    if (isSoldOut) return;
    onAdd?.(menu);
  };

  const handleDec = () => {
    if (isSoldOut) return;
    onDec?.(menu);
  };

  // .menu-card 가 토큰 기반 디자인, opacity-50 은 회귀 테스트 호환.
  const cardClass = [
    'menu-card',
    isSoldOut ? 'sold-out opacity-50' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // pick-btn 라벨 분기 — design-bundle screens-customer.jsx:107-109.
  // pick-btn 텍스트 — soldOut 시 한국어 "품절" 사용 (StampBadge "SOLD OUT" 과 중복 회피).
  const pickLabel = isSoldOut
    ? '품절'
    : inCartQty > 0
    ? `✓ 인벤토리 ${inCartQty}`
    : '＋ 줍기';
  const mainAriaLabel = isSoldOut
    ? `${menu.name} 품절`
    : inCartQty > 0
    ? `${menu.name} 한 개 더 줍기`
    : `${menu.name} 줍기`;
  const showDec = inCartQty > 0 && !isSoldOut && typeof onDec === 'function';

  return (
    <article
      ref={ref}
      data-testid={`menu-card-${menu.id}`}
      className={cardClass}
      {...rest}
    >
      <div className="menu-illust">
        {useFallback ? (
          <MenuFallback category={menu.category} name={menu.name} size="lg" />
        ) : (
          <img
            src={menu.image}
            alt={`${menu.name} (${menu.category})`}
            className="menu-img"
            loading="lazy"
            width="180"
            height="135"
          />
        )}
        {menu.code && <span className="ammo-tag" aria-hidden="true">{menu.code}</span>}
        {/* 도장은 시안 절대 위치 — pointer-events-none 으로 버튼 클릭 가로채기 차단 */}
        {!isSoldOut && recommended && (
          <span
            className="stamp-overlay"
            style={{ position: 'absolute', top: 8, left: 8, pointerEvents: 'none' }}
          >
            <StampBadge variant="recommended" />
          </span>
        )}
        {isSoldOut && (
          <span
            className="stamp-soldout-overlay"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              pointerEvents: 'none',
            }}
          >
            <StampBadge variant="sold-out" />
          </span>
        )}
      </div>
      <div className="menu-body">
        <h3 className="menu-name">{menu.name}</h3>
        {menu.sub && <div className="menu-sub">{menu.sub}</div>}
        <PriceTag value={menu.basePrice} className="menu-price" />
        <div className="pick-btn-group">
          <button
            type="button"
            className="pick-btn"
            disabled={isSoldOut}
            data-incart={inCartQty > 0 || undefined}
            onClick={handleAdd}
            aria-label={mainAriaLabel}
          >
            {pickLabel}
          </button>
          {showDec && (
            <button
              type="button"
              className="pick-btn-dec"
              onClick={handleDec}
              aria-label={`${menu.name} 한 개 빼기`}
            >
              <span aria-hidden="true">−</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

export default MenuCard;
