// IconLabel — molecule (COMPONENT_GUIDE §3.3).
// 아이콘 + 텍스트 조합. icon ReactNode(lucide-react SVG 등) 또는 string(이모지) 모두 지원.
// - 이모지 string 은 자동 aria-hidden 처리 (decorative).
// - ReactNode 는 호출자가 a11y 직접 처리 (Icon atom 사용 권장).
// - text 는 일반 텍스트 — SR이 읽음.
// gap: 'xs' (4px = --space-2xs), 'sm' (8px = --space-xs), 'md' (12px = --space-sm).
// inline: true 시 inline-flex (텍스트 흐름 내), false 시 flex (블록).
import { forwardRef } from 'react';

// gap → Tailwind 클래스 매핑 (모듈 최상위 — §3.5 6조).
// 동적 보간 X — 완전 문자열로 purge 안전.
const GAP_CLASSES = {
  xs: 'gap-2xs',
  sm: 'gap-xs',
  md: 'gap-sm',
};

const IconLabel = forwardRef(function IconLabel(
  {
    icon,
    text,
    gap = 'sm',
    inline = false,
    className = '',
    ...rest
  },
  ref,
) {
  const gapCls = GAP_CLASSES[gap] ?? GAP_CLASSES.sm;
  const layoutCls = inline ? 'inline-flex' : 'flex';

  const cls = [layoutCls, 'items-center', gapCls, className].filter(Boolean).join(' ');

  // icon string 이모지 자동 aria-hidden — decorative 처리.
  // ReactNode 는 그대로 렌더 — 호출자가 a11y 책임.
  const iconNode =
    typeof icon === 'string' ? <span aria-hidden="true">{icon}</span> : icon;

  return (
    <span ref={ref} className={cls} {...rest}>
      {iconNode}
      <span>{text}</span>
    </span>
  );
});

export default IconLabel;
