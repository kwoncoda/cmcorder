// CartItem — organism (IMPLEMENTATION_PLAN §2.6 / G11 인벤토리 라벨).
// 장바구니("인벤토리") 한 줄 — [이미지/이모지] [본명·단가·소계] [- 수량 +].
//
// 핵심 결정:
// - **수량 1에서 − 클릭 시 onRemove 호출** (onChangeQty 가 0 newQty 로 호출되지 *않음*).
//   부모는 항상 양수 quantity 만 다루도록 보장 → 데이터 모델 단순화.
// - **aria-live="polite"**: +/- 클릭으로 수량 변경 시 스크린리더가 자동 통보.
//   assertive 가 아닌 polite — 사용자 입력 직접 결과라서 강제 끼어들기 X.
// - **G11 인벤토리** : 장바구니 → 인벤토리 메타포. aria-label="인벤토리 항목 — {name}".
// - **AI 슬롭 #26**: 본명·소계 텍스트에 `text-accent` (형광 옐로) X.
//   카드 톤은 `bg-card-bg text-card-ink` (MenuCard 와 동일 흙색 톤).
// - **ADR-006**: useFallback 분기 (자산 미수령 시 분류 이모지).
//
// props:
// - menu: { id, name, category, basePrice, image? } — 필수 (MenuCard 와 동일 스키마)
// - quantity: number ≥ 1 — 필수 (0 도달 시 부모가 remove)
// - onChangeQty?(menuId, newQty): +/- 클릭 시 호출 (newQty ≥ 1 만 통보)
// - onRemove?(menuId): 수량 1에서 − 클릭 시 자동 호출
// - useFallback?: true (기본) → MenuFallback 이모지 / false → <img>
import { forwardRef } from 'react';
import Button from '../atoms/Button.jsx';
import PriceTag from '../molecules/PriceTag.jsx';
import MenuFallback from '../molecules/MenuFallback.jsx';

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
  // 방어: menu 없으면 아무것도 렌더 X (MenuCard 와 동일 패턴).
  if (!menu) return null;

  const subtotal = (menu.basePrice ?? 0) * quantity;

  // − 핸들러: 수량 1에서는 onRemove, 그 외에는 onChangeQty(quantity - 1).
  const handleDec = () => {
    const next = quantity - 1;
    if (next <= 0) {
      onRemove?.(menu.id);
    } else {
      onChangeQty?.(menu.id, next);
    }
  };

  // + 핸들러: onChangeQty(quantity + 1). 상한 검증은 부모 책임 (재고 정책 X — Task 2.6 범위 밖).
  const handleInc = () => {
    onChangeQty?.(menu.id, quantity + 1);
  };

  const cls = [
    'flex items-center gap-md',
    'bg-card-bg text-card-ink',
    'rounded-md p-md',
    'shadow-card',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      ref={ref}
      data-testid={`cart-item-${menu.id}`}
      className={cls}
      aria-label={`인벤토리 항목 — ${menu.name}`}
      {...rest}
    >
      {/* 일러스트 영역 — 가로 정사각 (64px). useFallback 분기. */}
      <div className="w-16 h-16 shrink-0 flex items-center justify-center">
        {useFallback ? (
          <MenuFallback category={menu.category} name={menu.name} size="md" />
        ) : (
          <img
            src={menu.image}
            alt={`${menu.name} (${menu.category})`}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* 본명 + 단가 + 소계 */}
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold text-base text-card-ink truncate">
          {menu.name}
        </h3>
        <div className="text-xs text-card-muted">
          단가{' '}
          <PriceTag value={menu.basePrice} size="sm" className="text-card-muted" />
        </div>
        <div className="text-sm text-card-ink mt-2xs">
          소계{' '}
          <PriceTag
            value={subtotal}
            size="md"
            className="text-card-ink font-semibold"
          />
        </div>
      </div>

      {/* 수량 컨트롤 — [- 수량 +] */}
      <div className="flex items-center gap-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDec}
          aria-label={`${menu.name} 수량 감소`}
        >
          −
        </Button>
        {/* 수량 표시 — aria-live polite 로 스크린리더 안내. tabular-nums 로 폭 균일. */}
        <span
          className="font-mono tabular-nums text-card-ink font-semibold text-lg min-w-[24px] text-center"
          aria-live="polite"
          aria-label={`${menu.name} 현재 수량 ${quantity}개`}
        >
          {quantity}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleInc}
          aria-label={`${menu.name} 수량 증가`}
        >
          +
        </Button>
      </div>
    </article>
  );
});

export default CartItem;
