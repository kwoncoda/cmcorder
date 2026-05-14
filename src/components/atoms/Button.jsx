// Button — atom (COMPONENT_GUIDE.md §2.1).
// 5 variant(primary/secondary/ghost/danger + disabled prop) · 3 size(sm 44 / md 48 / lg 56).
// 모바일 hitbox: sm 44px 이상 (DESIGN — 모바일 터치 최소 영역).
// focus-visible: 형광 옐로 outline + offset 2px (DESIGN §12.3).
// loading: spinner + aria-busy=true + disabled 자동.
// motion-reduce: spinner 정지 (DESIGN §9.5).
import { forwardRef } from 'react';

// variant 별 색 — 모두 토큰(tailwind.config.js extend.colors) 위에 매핑.
// primary: 형광 옐로 배경 + 카드 잉크 텍스트 (대비 충분 — DESIGN §3).
// secondary: 외곽선 형광 옐로 + 잉크 텍스트.
// ghost: 투명 배경 + 잉크 텍스트 (hover 시 elevated).
// danger: 위험 빨강 배경 + 잉크 텍스트.
const variantClasses = {
  primary:
    'bg-accent text-card-ink hover:bg-accent-pressed active:bg-accent-pressed disabled:bg-muted disabled:text-card-ink',
  secondary:
    'bg-transparent text-ink border-2 border-accent hover:bg-accent/10 disabled:border-muted disabled:text-muted',
  ghost:
    'bg-transparent text-ink hover:bg-elevated disabled:text-muted',
  danger:
    'bg-danger text-ink hover:opacity-90 disabled:opacity-50',
};

// size 별 min-height — 모바일 hitbox 보장 (sm 44 / md 48 / lg 56).
const sizeClasses = {
  sm: 'min-h-[44px] px-3 text-xs',
  md: 'min-h-[48px] px-4 text-sm',
  lg: 'min-h-[56px] px-6 text-base',
};

// 공통 베이스 — flex 정렬 · 폰트 · 라디우스 · 모션 · focus-visible · disabled 커서.
const baseClasses = [
  'inline-flex items-center justify-center gap-2',
  'font-semibold',
  'rounded-md',
  'transition-all duration-tap',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    disabled = false,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const cls = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    block ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
});

// Spinner — currentColor 기반 원형 회전. motion-reduce 시 정지.
function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin motion-reduce:animate-none"
      role="status"
      aria-label="로딩 중"
    />
  );
}

export default Button;
