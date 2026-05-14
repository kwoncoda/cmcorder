// DogTagFrame — molecule ★ Memorable thing (Task 2.3).
// 절정 컴포넌트: 떨어지는 모션 600ms + sessionStorage 단발 (DESIGN §9.6 + 결정 h).
//
// 시안: docs/design-bundle/components.jsx line 48-75 (DogTag) — useEffect 패턴을 *변경*함.
//
// 핵심 결정 (§3.5 4조 — rerender-derived-state-no-effect):
//   - 첫 렌더부터 dropping 클래스 결정 → `useState(() => 초기화 함수)` 패턴.
//   - useEffect 후행 setState 시 첫 프레임은 모션 클래스 없음 → 한 프레임 깜박 회귀.
//   - 시안의 useEffect/useRef 조합은 본 컴포넌트에서 폐기.
//
// 진동(navigator.vibrate)은 *부수효과* — useEffect(mount 1회) 정당.
//   ★ useState 초기화 함수가 1회만 실행되도록 보장 → StrictMode 2-mount 가드.
//   reduced motion 사용자는 진동도 회피.
//
// 외형 (DESIGN §1 + §5.1):
//   - 사각형 + 한쪽 모서리 둥근 (radius-tag: 8px 8px 4px 4px → Tailwind `rounded-tag`)
//   - 군용 도그태그 미학 — bg-card-bg (흙색), text-card-ink
//   - shadow-elevated (tokens.css)
//   - 주문번호: font-display font-black (Pretendard Black)
//   - 일자: font-mono tabular-nums (JetBrains Mono)
//
// 접근성:
//   - role=status + aria-live=polite — 도그태그 등장 시 SR 안내.
//   - reduced motion 사용자 → 모션 X (components.css media query) + 진동 X.
//
// 관련 결정: DESIGN §1·§9.3·§9.6·ADR-026 §1·결정 h + §3.5 4조
import { useEffect, useState, forwardRef } from 'react';

// 크기별 Tailwind 클래스 — 모듈 최상위 (§3.5 6조).
// 완전 문자열 (동적 보간 X) → Tailwind purge 안전.
const SIZE_CLASSES = {
  sm: 'w-32 px-md py-sm text-base',
  md: 'w-48 px-lg py-md text-lg',
};

const DogTagFrame = forwardRef(function DogTagFrame(
  {
    no,
    total = 100,
    date,
    dropping = false,
    pulse = false,
    size = 'md',
    className = '',
    ...rest
  },
  ref,
) {
  // ── ★ 핵심: 첫 렌더부터 dropping 결정 (§3.5 4조) ──
  // useEffect 후행 setState 시 첫 렌더에는 클래스 없음 → 한 프레임 깜박 회귀.
  // useState 초기화 함수는 *첫 렌더 직전* 1회 실행 → 첫 페인트부터 모션 포함.
  // StrictMode 2-mount 환경에서도 초기화 함수는 한 번만 실행 보장.
  const [shouldAnimate] = useState(() => {
    // SSR 안전 — Vite 클라이언트 한정이지만 명시 가드.
    if (typeof window === 'undefined') return false;
    if (!dropping || no == null) return false;
    const key = `dogtag-shown-${no}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  });

  // 진동 API — 첫 진입 시(shouldAnimate=true)에만 1회.
  // reduced motion 사용자는 회피. 일부 브라우저 미지원(Safari) → optional chaining.
  // useEffect(mount 1회) — useState 가드 덕에 StrictMode 2-mount 환경에서도 한 번만 발화.
  useEffect(() => {
    if (!shouldAnimate) return;
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq?.matches) return;
    navigator.vibrate?.([60, 30, 60]);
  }, [shouldAnimate]);

  const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  // 베이스 클래스 — 도그태그 외형 + 모션 클래스 조건부 합성.
  // origin-top: 떨어지는 모션 회전축이 상단 (자연스러운 진자 운동).
  const baseCls = [
    'inline-block',
    'bg-card-bg text-card-ink',
    'rounded-tag',
    'shadow-elevated',
    'select-none',
    'origin-top',
    sizeCls,
    shouldAnimate ? 'dogtag-drop' : '',
    pulse ? 'dogtag-pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} role="status" aria-live="polite" className={baseCls} {...rest}>
      <div className="text-3xs uppercase tracking-wider opacity-70">ORDER NO</div>
      <div className="flex items-baseline gap-1 font-display font-black">
        <span className="text-3xl">#{no}</span>
        <span className="text-sm opacity-60">/{total}</span>
      </div>
      <div className="text-xs font-mono tabular-nums opacity-70 mt-2xs">{date}</div>
    </div>
  );
});

export default DogTagFrame;
