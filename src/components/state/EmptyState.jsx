// EmptyState — state component (Task 2.11).
// UX §6.1 / COMPONENT_GUIDE §5 — 빈 상태 공통 컴포넌트.
//
// 구성: 마스코트 + 제목(title) + 설명(description) + 다음 액션 CTA.
// 토스트 알림 X — 인라인 CTA 만 (UX-1).
//
// variant:
//   - 'card' (기본): elevated 배경 + rounded-md — 페이지 내부 카드 영역.
//   - 'page'        : min-h-screen — 페이지 전체를 채우는 풀스크린.
//
// 접근성:
//   - role="status" + aria-label=title — 스크린리더에 상태 안내.
//   - MascotState 의 aria-label "치킨이닭 마스코트 — …" 가 중복 안내되지만
//     역할이 다르므로 (마스코트=img / 영역=status) axe 위반 없음.
//
// 관련 결정: UX §6.1 / COMPONENT_GUIDE §5
import { forwardRef } from 'react';
import MascotState from '../molecules/MascotState.jsx';
import Button from '../atoms/Button.jsx';

const EmptyState = forwardRef(function EmptyState(
  {
    title,
    description,
    mascot = 'default',
    actionLabel,
    onAction,
    variant = 'card',
    className = '',
    ...rest
  },
  ref,
) {
  const baseCls =
    variant === 'page'
      ? 'min-h-screen flex flex-col items-center justify-center gap-md p-lg bg-bg text-ink'
      : 'flex flex-col items-center justify-center gap-md p-lg bg-elevated text-ink rounded-md';

  return (
    <section
      ref={ref}
      role="status"
      aria-label={title}
      data-testid="empty-state"
      className={`${baseCls} ${className}`.trim()}
      {...rest}
    >
      <MascotState state={mascot} size="md" useFallback />
      {title && (
        <h2 className="font-display font-bold text-xl text-center">{title}</h2>
      )}
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

export default EmptyState;
