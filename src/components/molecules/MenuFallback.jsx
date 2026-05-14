// MenuFallback — molecule (COMPONENT_GUIDE §3.7 / ADR-006).
// PUBG 일러스트 미수령 시 분류 이모지로 fallback.
// 배경: 메뉴 8종은 PUBG 회복 아이템 일러스트 (자산 D-3 수령 예정).
// 미수령 시 분류별 이모지로 대체 — 사용자가 카테고리 인지는 가능하도록.
// 분류 매핑(ADR-006):
//   chicken: bandage, first-aid, med-kit, syringe → 닭류 → 🍗
//   side:    defib, adrenaline                    → 사이드 → 🍟
//   drink:   painkiller, energy                   → 음료 → 🥤
// 알 수 없는 category fallback: ❓.
// aria-label="{category} {name} 일러스트 (대체)".
import { forwardRef } from 'react';

// category → 이모지 매핑 (모듈 최상위 — §3.5 6조).
const CATEGORY_EMOJI = {
  chicken: '🍗',
  side:    '🍟',
  drink:   '🥤',
};

// size → Tailwind 클래스 매핑 (이모지 크기).
const SIZE_CLASSES = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-3xl', // 메뉴 카드 — 64px 이모지 + 작은 이름
};

const MenuFallback = forwardRef(function MenuFallback(
  { category, name, size = 'md', className = '', ...rest },
  ref,
) {
  // 알 수 없는 category fallback: ❓.
  const emoji = CATEGORY_EMOJI[category] ?? '❓';
  const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  const ariaLabel = `${category} ${name} 일러스트 (대체)`;

  const cls = [
    'inline-flex flex-col items-center gap-2xs',
    'select-none',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span ref={ref} className={cls} role="img" aria-label={ariaLabel} {...rest}>
      <span aria-hidden="true" className={sizeCls}>
        {emoji}
      </span>
      <span className="text-xs text-card-muted">{name}</span>
    </span>
  );
});

export default MenuFallback;
