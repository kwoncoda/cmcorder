// Spinner — atom (COMPONENT_GUIDE.md §2.7).
// role=status + aria-label (스크린리더에 로딩 상태 전달).
// sm/md/lg 3 사이즈 — Button 내부(sm/md) · 카드 내부(md) · 풀스크린(lg).
// 모션: currentColor 기반 원형 회전 1초 1바퀴. motion-reduce 시 정적 (DESIGN §9.5).
import { forwardRef } from 'react';

const sizeMap = {
  sm: 'w-3 h-3 border',
  md: 'w-4 h-4 border-2',
  lg: 'w-6 h-6 border-2',
};

const Spinner = forwardRef(function Spinner(
  { size = 'md', label = '로딩 중', className = '', ...rest },
  ref,
) {
  const sizeCls = sizeMap[size] ?? sizeMap.md;
  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={`inline-block ${sizeCls} border-current border-r-transparent rounded-full animate-spin motion-reduce:animate-none ${className}`}
      {...rest}
    />
  );
});

export default Spinner;
