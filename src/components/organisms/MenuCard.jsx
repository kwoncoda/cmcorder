// MenuCard — organism (IMPLEMENTATION_PLAN §2.5 / COMPONENT_GUIDE §4.x).
// PUBG 회복 아이템 일러스트 (또는 분류 이모지 fallback) + 본명 + 가격 + "줍기" 버튼.
//
// 핵심 결정:
// - **결정 f**: "줍기" 버튼만 클릭 영역. 카드 article 자체 onClick X
//   (오클릭 방지 + 학교 축제 모바일 환경에서 의도 명확화).
// - **G10**: 본명 그대로 (콜라/사이다 등 리스킨 X).
// - **ADR-006**: PUBG 일러스트 미수령 시 MenuFallback 분류 이모지 (🍗·🍟·🥤).
// - **AI 슬롭 #26**: 카드 내 *형광 옐로 텍스트* 금지. 본명·가격은 text-card-ink.
//   (단, "줍기" 버튼은 primary variant — 형광 옐로 *배경* OK, CTA 라서.)
//
// props:
// - menu: { id, code, name, category, basePrice, image?, soldOut? } — 필수
// - onAdd?(menu): 줍기 버튼 클릭 콜백 (soldOut 시 호출 X)
// - recommended?: 추천 도장 표시 (boolean)
// - soldOut?: 품절 도장 + 버튼 disabled (boolean — menu.soldOut 도 fallback)
// - useFallback?: true 면 MenuFallback 이모지, false 면 <img>. 기본 true (자산 미수령 가정).
//
// 도장(StampBadge) 은 절대 위치(오른쪽 상단) + pointer-events-none — 버튼 클릭 방해 X.
// recommended + soldOut 동시 시 sold-out 우선 (정보 우선순위 — 품절이 더 중요).
import { forwardRef } from 'react';
import Button from '../atoms/Button.jsx';
import StampBadge from '../molecules/StampBadge.jsx';
import PriceTag from '../molecules/PriceTag.jsx';
import MenuFallback from '../molecules/MenuFallback.jsx';

const MenuCard = forwardRef(function MenuCard(
  {
    menu,
    onAdd,
    recommended = false,
    soldOut = false,
    useFallback = true,
    className = '',
    ...rest
  },
  ref,
) {
  // 방어: menu 없으면 아무것도 렌더 X.
  if (!menu) return null;

  // soldOut prop > menu.soldOut 순. (호출자가 명시한 props 가 우선.)
  const isSoldOut = Boolean(soldOut || menu.soldOut);

  const handleAdd = () => {
    if (isSoldOut) return;
    onAdd?.(menu);
  };

  // 카드 컨테이너 클래스 — bg-card-bg(흙색) + 카드 잉크 텍스트 + shadow-card.
  // soldOut 시 opacity-50 으로 흐림 (시각 신호).
  const cardClass = [
    'relative',
    'flex flex-col gap-sm',
    'bg-card-bg text-card-ink',
    'rounded-md p-md',
    'shadow-card',
    isSoldOut ? 'opacity-50' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      ref={ref}
      data-testid={`menu-card-${menu.id}`}
      className={cardClass}
      {...rest}
    >
      {/* 도장 — 오른쪽 상단 절대 위치. pointer-events-none 으로 버튼 클릭 가로채지 않게. */}
      {/* sold-out 이 recommended 보다 우선 (정보 중요도). */}
      {isSoldOut && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <StampBadge variant="sold-out" />
        </div>
      )}
      {!isSoldOut && recommended && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <StampBadge variant="recommended" />
        </div>
      )}

      {/* 일러스트 영역 — useFallback 분기 (자산 단계별). */}
      <div className="aspect-square flex items-center justify-center">
        {useFallback ? (
          <MenuFallback category={menu.category} name={menu.name} size="lg" />
        ) : (
          <img
            src={menu.image}
            alt={`${menu.name} (${menu.category})`}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* 본명 (G10) — text-card-ink. 형광 옐로 (text-accent) X — AI 슬롭 #26. */}
      <h3 className="font-display font-bold text-base text-card-ink">
        {menu.name}
      </h3>

      {/* 가격 — text-card-ink. 형광 옐로 X — AI 슬롭 #26. */}
      <PriceTag value={menu.basePrice} className="text-card-ink" />

      {/* 줍기 버튼 — 결정 f: *유일한* 클릭 영역. */}
      {/* primary variant 는 형광 옐로 배경이지만 *버튼 CTA* 라 AI 슬롭 #26 회피. */}
      <Button
        variant="primary"
        size="md"
        block
        disabled={isSoldOut}
        onClick={handleAdd}
        aria-label={`${menu.name} ${isSoldOut ? '품절' : '줍기'}`}
      >
        {isSoldOut ? '품절' : '줍기'}
      </Button>
    </article>
  );
});

export default MenuCard;
