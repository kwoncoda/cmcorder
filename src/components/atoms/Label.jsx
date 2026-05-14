// Label — atom (COMPONENT_GUIDE.md §2.5).
// 모든 input 1:1 대응 — placeholder 라벨 X (DESIGN §12.5, AI 슬롭 #15).
// required prop 시 빨간 별표 + aria-label="필수" (스크린리더 안내).
import { forwardRef } from 'react';

const Label = forwardRef(function Label(
  { htmlFor, required = false, children, className = '', ...rest },
  ref,
) {
  const cls = [
    'block',
    'text-ink',
    'font-medium',
    'text-sm',
    'mb-2xs',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label ref={ref} htmlFor={htmlFor} className={cls} {...rest}>
      {children}
      {required && (
        <span className="text-danger ml-1" aria-label="필수">
          *
        </span>
      )}
    </label>
  );
});

export default Label;
