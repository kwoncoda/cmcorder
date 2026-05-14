// ErrorState — state component (Task 2.11).
// UX §6.3 / COMPONENT_GUIDE §5 — 오류 상태 공통 컴포넌트.
//
// 카피 원칙: 사실 + 회복 경로. 사용자 책임 카피 금지 (UX §6.3).
//   예) "잘못된 입력입니다" (X) → "필수 항목입니다" (O)
//   예) "다시 확인해 주세요" → "네트워크를 확인하고 다시 시도해 주세요" (회복 경로)
//
// variant:
//   - 'card' (기본): 마스코트(canceled=😢) + title + description + code + 복구 CTA.
//   - 'page'        : min-h-screen — 풀스크린 (ErrorBoundary fallback 등).
//   - 'inline-field': <p> 한 줄 — 폼 필드 옆 빨간 작은 에러 텍스트 (toast 대체 — UX-1).
//
// 접근성:
//   - card/page: role="alert" + aria-live="assertive" — 스크린리더 즉시 안내.
//   - inline-field: role="alert" + 본문 텍스트만 (마스코트·버튼 미렌더).
//
// 관련 결정: UX §6.3 / COMPONENT_GUIDE §5 / UX-1 (토스트 X)
import { forwardRef } from 'react';
import MascotState from '../molecules/MascotState.jsx';
import Button from '../atoms/Button.jsx';

const ErrorState = forwardRef(function ErrorState(
  {
    title = '오류가 발생했어요',
    description,
    code,
    actionLabel,
    onAction,
    variant = 'card',
    className = '',
    ...rest
  },
  ref,
) {
  // inline-field — 폼 필드 인라인 에러 텍스트 (작고 가벼움).
  if (variant === 'inline-field') {
    return (
      <p
        ref={ref}
        role="alert"
        data-testid="error-state-inline"
        className={`text-danger text-xs ${className}`.trim()}
        {...rest}
      >
        {title}
      </p>
    );
  }

  const baseCls =
    variant === 'page'
      ? 'min-h-screen flex flex-col items-center justify-center gap-md p-lg bg-bg text-ink'
      : 'flex flex-col items-center justify-center gap-md p-lg bg-elevated text-ink rounded-md';

  return (
    <section
      ref={ref}
      role="alert"
      aria-live="assertive"
      data-testid="error-state"
      className={`${baseCls} ${className}`.trim()}
      {...rest}
    >
      <MascotState state="canceled" size="md" useFallback />
      {code && (
        <p className="font-mono tabular-nums text-xs text-muted">[{code}]</p>
      )}
      <h2 className="font-display font-bold text-xl text-center">{title}</h2>
      {description && (
        <p className="text-sm text-muted text-center max-w-prose">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </section>
  );
});

export default ErrorState;
