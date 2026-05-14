// Checkbox — atom (COMPONENT_GUIDE.md §2.4).
// 라벨 통합형 — 라벨 클릭도 토글되도록 hitbox 56px 보장.
// "□ 학번 없음 (외부인)" (UX-7), "□ 쿠폰 사용" 등에 사용.
// focus-visible: 형광 옐로 outline (DESIGN §12.3).
import { forwardRef } from 'react';

const Checkbox = forwardRef(function Checkbox(
  { id, label, className = '', ...rest },
  ref,
) {
  const wrapperCls = [
    'inline-flex items-center gap-sm',
    'min-h-[56px]',
    'cursor-pointer',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label htmlFor={id} className={wrapperCls}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="w-5 h-5 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 cursor-pointer"
        {...rest}
      />
      <span className="text-ink text-sm select-none">{label}</span>
    </label>
  );
});

export default Checkbox;
