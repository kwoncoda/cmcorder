// C-2 카트(인벤토리) 페이지 — Task 4.3.
//
// 사용자 줍기 결과 확인 + 수량 조정 + 주문 정보 입력으로 이동.
//
// 설계 (§3.5 1조 — 페이지 ≤120줄):
//  - Zustand 셀렉터 직접 구독 (§3.5 2조) — totalQty / totalPrice 셀렉터 함수만 받음
//  - 3분기 처리: items 0건 = EmptyState, 1건 이상 = list + sticky CTA
//  - 수량 1에서 − → CartItem 의 onRemove 자동 호출 (Task 2.6 분기)
//  - sticky CTA 는 items 있을 때만 렌더 (Empty 분기에서는 EmptyState 의 인라인 CTA)
//
// 관련 결정: G11 (인벤토리 라벨) · UX §6.1 (Empty 마스코트) · §3.5 1·2조
import { useNavigate } from 'react-router-dom';
import useCartStore, { cartSelectors } from '../../store/cart.js';
import CartItem from '../../components/organisms/CartItem.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';
import Button from '../../components/atoms/Button.jsx';
import PriceTag from '../../components/molecules/PriceTag.jsx';

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const totalQty = useCartStore(cartSelectors.totalQty);
  const totalPrice = useCartStore(cartSelectors.totalPrice);
  const changeQty = useCartStore((s) => s.changeQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const navigate = useNavigate();

  // Empty 분기 — UX §6.1 마스코트 + 인라인 CTA (토스트 X — UX-1).
  if (items.length === 0) {
    return (
      <section data-testid="cart-page" className="flex flex-col flex-1">
        <EmptyState
          variant="page"
          title="인벤토리가 비어 있어요"
          description="메뉴 화면에서 줍기 버튼을 눌러 인벤토리를 채워주세요."
          mascot="default"
          actionLabel="메뉴 보러 가기"
          onAction={() => navigate('/menu')}
        />
      </section>
    );
  }

  return (
    <section data-testid="cart-page" className="flex flex-col gap-md p-md pb-24">
      <header className="flex items-center justify-between">
        {/* CustomerLayout 의 site 헤더(🍗 치킨이닭)가 h1 역할 — 페이지는 h2 로 격하.
            list 의 CartItem h3 와 heading-order 일관성. */}
        <h2 className="font-display font-black text-2xl text-ink">
          🎒 인벤토리 ({totalQty}개)
        </h2>
      </header>

      <ul className="flex flex-col gap-sm list-none p-0">
        {items.map((item) => (
          <li key={item.menuId}>
            <CartItem
              menu={{
                id: item.menuId,
                name: item.name,
                category: item.category,
                basePrice: item.basePrice,
              }}
              quantity={item.quantity}
              onChangeQty={(id, qty) => changeQty(id, qty)}
              onRemove={(id) => removeItem(id)}
              useFallback
            />
          </li>
        ))}
      </ul>

      <div
        data-testid="cart-sticky-cta"
        className="fixed bottom-0 left-0 right-0 z-40 p-md bg-elevated border-t border-divider flex items-center justify-between gap-md shadow-elevated"
      >
        <div className="flex flex-col">
          <span className="text-xs text-muted">합계</span>
          <PriceTag value={totalPrice} size="lg" className="text-ink font-semibold" />
        </div>
        <Button variant="primary" size="lg" onClick={() => navigate('/checkout')}>
          주문 정보 입력
        </Button>
      </div>
    </section>
  );
}
