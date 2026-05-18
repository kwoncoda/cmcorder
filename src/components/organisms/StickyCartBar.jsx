// StickyCartBar — design-bundle .sticky-bar 정합.
//
// design-bundle 카피(screens-customer.jsx:125-127):
//   "🎒 인벤토리 N개 · {금액}원 보기 →"
//
// 테스트 호환: data-testid="sticky-cart-bar" + totalQty=0 시 미렌더.
import { forwardRef } from 'react';
import useCartStore, { cartSelectors } from '../../store/cart.js';

const formatter = new Intl.NumberFormat('ko-KR');

const StickyCartBar = forwardRef(function StickyCartBar(
  { onCheckout, className = '', ...rest },
  ref,
) {
  const totalQty = useCartStore(cartSelectors.totalQty);
  const totalPrice = useCartStore(cartSelectors.totalPrice);

  if (totalQty === 0) return null;

  return (
    <div
      ref={ref}
      data-testid="sticky-cart-bar"
      className={`sticky-bar ${className}`.trim()}
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40 }}
      {...rest}
    >
      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        onClick={onCheckout}
        aria-label="장바구니로 이동"
      >
        <img
          src="/pubg-inventory.webp"
          alt=""
          width="22"
          height="22"
          style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}
        />
        인벤토리 {totalQty}개 · {formatter.format(totalPrice)}원 보기 →
      </button>
    </div>
  );
});

export default StickyCartBar;
