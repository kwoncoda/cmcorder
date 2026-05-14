// PriceTag — molecule (COMPONENT_GUIDE §3.2 / DESIGN §5.4).
// 가격 표시 — 천 단위 콤마 + font-mono tabular-nums (숫자 폭 균일).
// - 천 단위 콤마: `Intl.NumberFormat('ko-KR')` (한국 로케일 — 의도 명시).
// - font-mono (JetBrains Mono — tokens.css) + tabular-nums: 0~9 각 같은 폭 → 가격 줄맞춤.
// - strikethrough: 옛 가격 표시 (할인·취소된 가격).
// - negative: "-" 접두 + danger 색 (할인 금액).
// - size: 'sm' (text-xs), 'md' (text-sm, 기본), 'lg' (text-lg) — 모듈 최상위 SIZE_CLASSES.
// - unit: 'won' (기본 — "원" 접미) 또는 'none' (단위 생략).
//   USD 등 향후 확장은 명세 시 추가. 현재는 won/none 만.
// 접근성: 가격 텍스트 자체가 의미 → 별도 aria-label 불필요.
// forwardRef.
import { forwardRef } from 'react';

// size → Tailwind 클래스 매핑 (모듈 최상위 — §3.5 6조).
// 동적 보간 X — 완전 문자열로 purge 안전.
const SIZE_CLASSES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

// 화폐 단위 매핑 — won/none 만 명세. 알 수 없는 unit → 'won' fallback.
const UNIT_SUFFIX = {
  won: '원',
  none: '',
};

// 한국 로케일 천 단위 콤마 formatter — 모듈 최상위 1회 생성 (성능).
const formatter = new Intl.NumberFormat('ko-KR');

const PriceTag = forwardRef(function PriceTag(
  {
    value,
    unit = 'won',
    strikethrough = false,
    size = 'md',
    negative = false,
    className = '',
    ...rest
  },
  ref,
) {
  const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const suffix = UNIT_SUFFIX[unit] ?? UNIT_SUFFIX.won;

  // 천 단위 콤마 적용한 절댓값 + 음수 접두 (있을 시).
  const formatted = formatter.format(value);
  const sign = negative ? '-' : '';
  const text = `${sign}${formatted}${suffix}`;

  // 색: 기본은 부모 색 상속, negative 시 text-danger.
  // line-through: 옛 가격 표시.
  const cls = [
    'font-mono tabular-nums',
    sizeCls,
    negative ? 'text-danger' : '',
    strikethrough ? 'line-through' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span ref={ref} className={cls} {...rest}>
      {text}
    </span>
  );
});

export default PriceTag;
