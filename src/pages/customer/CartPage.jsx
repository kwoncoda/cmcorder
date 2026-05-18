// C-2 카트(인벤토리) — design-bundle screens-customer.jsx ScreenCart 정합.
//
// 마크업: <back-bar> + <cart-list> + <receipt> + sticky CTA.
// 테스트 호환: "인벤토리 (N개)" 텍스트, cart-sticky-cta testid, "주문 정보 입력" 버튼.
import { useNavigate } from 'react-router-dom';
import useCartStore, { cartSelectors } from '../../store/cart.js';
import CartItem from '../../components/organisms/CartItem.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';

const formatter = new Intl.NumberFormat('ko-KR');

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const totalQty = useCartStore(cartSelectors.totalQty);
  const totalPrice = useCartStore(cartSelectors.totalPrice);
  const changeQty = useCartStore((s) => s.changeQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const navigate = useNavigate();

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
    <section data-testid="cart-page">
      <div className="back-bar">
        <button type="button" onClick={() => navigate('/menu')} aria-label="뒤로">
          ←
        </button>
        <h1>
          <img
            src="/pubg-inventory.webp"
            alt=""
            width="24"
            height="24"
            style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}
          />
          인벤토리 ({totalQty}개)
        </h1>
        <span className="meta">{items.length} ITEMS</span>
      </div>

      <h2 className="sr-only" style={{ position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>인벤토리 항목</h2>
      <ul className="cart-list" style={{ listStyle: 'none', margin: 0 }}>
        {items.map((item) => (
          <li key={item.menuId}>
            <CartItem
              menu={{
                id: item.menuId,
                code: item.code,
                name: item.name,
                category: item.category,
                basePrice: item.basePrice,
                image: item.image,
                sub: item.sub,
              }}
              quantity={item.quantity}
              onChangeQty={(id, qty) => changeQty(id, qty)}
              onRemove={(id) => removeItem(id)}
              useFallback={!item.image}
            />
          </li>
        ))}
      </ul>

      <div className="receipt">
        <div className="line">
          <span className="label">소계</span>
          <span className="price">{formatter.format(totalPrice)}원</span>
        </div>
        <div className="line">
          <span className="label">쿠폰 할인 (다음 단계에서 적용)</span>
          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>—</span>
        </div>
        <div className="line total">
          <span className="label">합계</span>
          <span className="price price-lg" style={{ color: 'var(--color-accent)' }}>
            {formatter.format(totalPrice)}원
          </span>
        </div>
      </div>

      <div style={{ height: 96 }} />
      <div
        data-testid="cart-sticky-cta"
        className="sticky-bar"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40 }}
      >
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => navigate('/checkout')}
          aria-label="주문 정보 입력"
        >
          주문 정보 입력 · {formatter.format(totalPrice)}원
        </button>
      </div>
    </section>
  );
}
