// StickyCartBar — organism (Task 4.2).
//
// 하단 sticky 카트 진입 바. 메뉴 페이지 등 어느 페이지에서든 카트 상태를 즉시 노출.
//
// §3.5 2조 — props drilling X. Zustand 셀렉터로 직접 구독:
//  - totalQty / totalPrice 는 cartSelectors 의 셀렉터 — 값 동일 시 리렌더 X.
//  - 부모(MenuPage)는 데이터를 모르고 콜백(onCheckout)만 전달.
//
// 핵심:
//  - totalQty=0 시 미렌더 (불필요 UI 가림 회피)
//  - z-40 + fixed bottom — 콘텐츠 위에 떠 있음
//  - pb-24 등 페이지 하단 여백은 호출자가 (페이지 클래스로 처리)
//  - 장바구니 버튼 → onCheckout 콜백 (navigate('/cart'))
//
// 관련 결정: §3.5 2조 / AI 슬롭 #26 (formidable 텍스트 형광 X — primary 버튼 배경만 OK)
import { forwardRef } from 'react';
import useCartStore, { cartSelectors } from '../../store/cart.js';
import Button from '../atoms/Button.jsx';
import PriceTag from '../molecules/PriceTag.jsx';

const StickyCartBar = forwardRef(function StickyCartBar(
  { onCheckout, className = '', ...rest },
  ref,
) {
  const totalQty = useCartStore(cartSelectors.totalQty);
  const totalPrice = useCartStore(cartSelectors.totalPrice);

  if (totalQty === 0) return null;

  const cls = [
    'fixed bottom-0 left-0 right-0 z-40',
    'p-md bg-elevated border-t border-divider',
    'flex items-center justify-between gap-md shadow-elevated',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} data-testid="sticky-cart-bar" className={cls} {...rest}>
      <div className="flex items-center gap-sm">
        <span className="font-display font-bold text-base text-ink">
          🛒 {totalQty}개
        </span>
        <PriceTag value={totalPrice} className="text-ink font-semibold" />
      </div>
      <Button
        variant="primary"
        size="md"
        onClick={onCheckout}
        aria-label="장바구니로 이동"
      >
        장바구니
      </Button>
    </div>
  );
});

export default StickyCartBar;
