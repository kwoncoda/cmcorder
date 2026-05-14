// Divider — atom (COMPONENT_GUIDE.md §2.8).
// 3 variant:
//   - solid : 실선 1px `--color-divider`
//   - dashed: 점선 (메뉴 카드 내부 가격·라벨 구분)
//   - stamp : 거친 도장 톤 빨강 (운영진 헤더 — DESIGN §11)
// label 있으면 가운데 텍스트 + 양쪽 줄 패턴 (role=separator + aria-orientation=horizontal).
// label 없으면 단순 <hr> (HTML 시맨틱 + 암시적 role=separator).
import { forwardRef } from 'react';

const variantClasses = {
  solid: 'border-t border-divider',
  dashed: 'border-t border-dashed border-divider',
  stamp: 'border-t-2 border-dashed border-stamp-red opacity-70',
};

const Divider = forwardRef(function Divider(
  { variant = 'solid', label, className = '', ...rest },
  ref,
) {
  const variantCls = variantClasses[variant] ?? variantClasses.solid;

  if (label) {
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation="horizontal"
        className={`flex items-center gap-sm my-md ${className}`}
        {...rest}
      >
        <span className={`flex-1 ${variantCls}`} aria-hidden="true" />
        <span className="text-muted text-xs">{label}</span>
        <span className={`flex-1 ${variantCls}`} aria-hidden="true" />
      </div>
    );
  }

  return (
    <hr
      ref={ref}
      className={`my-md ${variantCls} ${className}`}
      {...rest}
    />
  );
});

export default Divider;
