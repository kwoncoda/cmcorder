// Icon — atom (COMPONENT_GUIDE.md §2.6).
// 얇은 래퍼. children에 lucide-react SVG 컴포넌트를 주입하는 패턴.
// - 사용처는 *named import* 만 (§3.5 8조): `import { Map } from 'lucide-react'`.
// - barrel(`import * as Icons`)·default 모두 차단 — bundle.test.js 회귀가 잡음.
// - label 있으면 role=img + aria-label, decorative 시 aria-hidden=true.
// - 사이즈는 호출자 SVG의 size prop 으로 제어 (lucide-react 자체 prop) — 본 래퍼는 정렬·aria 표준화만.
import { forwardRef } from 'react';

const Icon = forwardRef(function Icon(
  { children, label, decorative = false, className = '', ...rest },
  ref,
) {
  const aria = decorative
    ? { 'aria-hidden': 'true' }
    : { 'aria-label': label, role: 'img' };

  return (
    <span
      ref={ref}
      className={`inline-flex items-center justify-center ${className}`}
      {...aria}
      {...rest}
    >
      {children}
    </span>
  );
});

export default Icon;
