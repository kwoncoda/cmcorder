// CountBadge — molecule (COMPONENT_GUIDE §3.6).
// 숫자 표시 배지 (장바구니 개수 등). count > max → "{max}+".
// count 0 + hideZero → null (렌더 X — 0 숨김 패턴).
// label prop 으로 SR a11y 라벨 ("{label} {count}개").
// 둥근 배지 형태: rounded-full + bg-accent (형광 옐로) + text-card-ink.
import { forwardRef } from 'react';

// size → Tailwind 클래스 매핑 (모듈 최상위 — §3.5 6조).
// min-width 확보로 한 자리 숫자도 원형 유지.
const SIZE_CLASSES = {
  sm: 'text-2xs min-w-[16px] h-4 px-3xs',
  md: 'text-xs min-w-[20px] h-5 px-2xs',
};

const BASE_CLASSES = [
  'inline-flex items-center justify-center',
  'rounded-full',
  'bg-accent text-card-ink',
  'font-bold',
  'font-mono tabular-nums',
  'select-none',
].join(' ');

const CountBadge = forwardRef(function CountBadge(
  { count, max = 9, hideZero = false, label, size = 'md', className = '', ...rest },
  ref,
) {
  // 0 + hideZero → null 렌더.
  if (count === 0 && hideZero) return null;

  const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  // max 초과 시 "{max}+" 형식.
  const display = count > max ? `${max}+` : String(count);

  // label prop 있을 시 SR 친화 aria-label ("{label} {count}개").
  // 단순 숫자가 SR 에 의미 없으므로 label 권장.
  const ariaLabel = label ? `${label} ${count}개` : undefined;

  const cls = [BASE_CLASSES, sizeCls, className].filter(Boolean).join(' ');

  return (
    <span ref={ref} className={cls} aria-label={ariaLabel} {...rest}>
      {display}
    </span>
  );
});

export default CountBadge;
