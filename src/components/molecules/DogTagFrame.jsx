// DogTagFrame — design-bundle .dogtag (components.jsx:49-75) 정합.
//
// 마크업: <div class="dogtag {dogtag-sm}? {dogtag-drop}? {dogtag-pulse}?" role="status">
//   <div class="tag-label">ORDER NO</div>
//   <div class="tag-no">#{no}<span class="small">/{total}</span></div>
//   <div class="tag-date">{date}</div>
//
// 핵심 유지:
//   - useState 초기화 함수로 첫 렌더부터 dropping 결정 — sessionStorage 멱등.
//   - StrictMode 2-mount 환경에서도 1회만 발화.
//   - reduced motion 시 진동 회피.
import { useEffect, useState, forwardRef } from 'react';

const DogTagFrame = forwardRef(function DogTagFrame(
  {
    no,
    total = 100,
    date,
    dropping = false,
    pulse = false,
    size = 'md',
    // role prop — default 'status' (DogTag 단독 사용 시 SR 안내).
    // 같은 페이지에 다른 role=status 영역이 있으면 호출자가 'img' 등으로 override.
    role = 'status',
    ariaLive = 'polite',
    className = '',
    ...rest
  },
  ref,
) {
  const [shouldAnimate] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!dropping || no == null) return false;
    const key = `dogtag-shown-${no}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  });

  useEffect(() => {
    if (!shouldAnimate) return;
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq?.matches) return;
    navigator.vibrate?.([60, 30, 60]);
  }, [shouldAnimate]);

  const cls = [
    'dogtag',
    size === 'sm' ? 'dogtag-sm' : '',
    shouldAnimate ? 'dogtag-drop' : '',
    pulse ? 'dogtag-pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} role={role} aria-live={role === 'status' ? ariaLive : undefined} className={cls} {...rest}>
      <div className="tag-label">ORDER NO</div>
      <div className="tag-no font-display font-black">
        <span>#{no}</span>
        <span className="small">/{total}</span>
      </div>
      <div className="tag-date font-mono tabular-nums">{date}</div>
    </div>
  );
});

export default DogTagFrame;
