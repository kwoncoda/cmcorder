// CartItem — design-bundle .cart-line (grid 56px 1fr auto) 정합.
//
// 마크업: <article class="cart-line" data-testid="cart-item-{id}">
//   <div class="thumb"><img|fallback></div>
//   <div>{name h3 + name-sub + qty(− N +)}</div>
//   <div>{remove × + price}</div>
//
// 회귀 보존: <article> 태그, <h3>, aria-label="X 수량 증가/감소", testid, ref.
// onRemove 분기: quantity 1 에서 − 클릭 시 호출.
// AI 슬롭 #26: h3·소계 텍스트에 text-accent 클래스 X.
import { forwardRef } from 'react';
import PriceTag from '../molecules/PriceTag.jsx';
import MenuFallback from '../molecules/MenuFallback.jsx';

const formatter = new Intl.NumberFormat('ko-KR');

const CartItem = forwardRef(function CartItem(
  {
    menu,
    quantity = 1,
    onChangeQty,
    onRemove,
    useFallback = true,
    className = '',
    ...rest
  },
  ref,
) {
  if (!menu) return null;
  const subtotal = (menu.basePrice ?? 0) * quantity;

  const handleDec = () => {
    const next = quantity - 1;
    if (next <= 0) onRemove?.(menu.id);
    else onChangeQty?.(menu.id, next);
  };
  const handleInc = () => onChangeQty?.(menu.id, quantity + 1);

  return (
    <article
      ref={ref}
      data-testid={`cart-item-${menu.id}`}
      className={`cart-line ${className}`.trim()}
      aria-label={`인벤토리 항목 — ${menu.name}`}
      {...rest}
    >
      <div className="thumb" aria-hidden="true">
        {useFallback ? (
          <MenuFallback category={menu.category} name={menu.name} size="md" />
        ) : (
          <img src={menu.image} alt={menu.name} width="49" height="49" loading="lazy" />
        )}
      </div>
      <div>
        <h3 className="name">{menu.name}</h3>
        <div className="name-sub">
          {menu.code ?? menu.category}
          {menu.sub ? ` · ${menu.sub}` : ''}
          {` · ${formatter.format(menu.basePrice ?? 0)}원`}
        </div>
        <div className="qty">
          <button
            type="button"
            onClick={handleDec}
            aria-label={`${menu.name} 수량 감소`}
          >
            −
          </button>
          <span
            aria-live="polite"
            aria-label={`${menu.name} 현재 수량 ${quantity}개`}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={handleInc}
            aria-label={`${menu.name} 수량 증가`}
          >
            ＋
          </button>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <button
          type="button"
          className="remove"
          onClick={() => onRemove?.(menu.id)}
          aria-label={`${menu.name} 삭제`}
        >
          ×
        </button>
        <PriceTag value={subtotal} className="price" />
      </div>
    </article>
  );
});

export default CartItem;
