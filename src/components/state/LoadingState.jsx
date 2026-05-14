// LoadingState — state component (Task 2.11).
// UX §6.2 / COMPONENT_GUIDE §5 — 로딩 상태 공통 컴포넌트.
//
// 구성: Spinner + 라벨 + (옵션) 최소 표시 지연(minimumDelay) — 깜박 회피.
//
// minimumDelay 동작 (UX §6.2):
//   - 기본 500ms — 빠르게 끝나는 fetch 가 화면을 깜박이지 않도록 첫 500ms 는 미표시.
//   - 0 으로 지정 시 즉시 표시 (Suspense fallback 등 시점이 명확한 경우).
//
// variant:
//   - 'card' (기본): elevated + rounded-md — 페이지 내부 카드 영역.
//   - 'page'        : min-h-screen — 페이지 풀스크린 (Suspense fallback).
//   - 'inline'      : inline-flex — 버튼·문장 안 인라인 표시.
//
// 접근성:
//   - role="status" + aria-live="polite" + aria-busy="true"
//   - Spinner atom 의 role="status" 와 중복되지만 의미상 OK (영역=로딩 안내, 스피너=시각 표지).
//
// 관련 결정: UX §6.2 / COMPONENT_GUIDE §5
import { useEffect, useState, forwardRef } from 'react';
import Spinner from '../atoms/Spinner.jsx';

const LoadingState = forwardRef(function LoadingState(
  {
    label = '불러오는 중…',
    minimumDelay = 500,
    variant = 'card',
    className = '',
    ...rest
  },
  ref,
) {
  // minimumDelay=0 시 즉시 visible. 양수일 때만 setTimeout 으로 지연.
  const [visible, setVisible] = useState(minimumDelay === 0);

  useEffect(() => {
    if (minimumDelay === 0) return undefined;
    const timer = setTimeout(() => setVisible(true), minimumDelay);
    return () => clearTimeout(timer);
  }, [minimumDelay]);

  if (!visible) return null;

  const baseCls =
    variant === 'page'
      ? 'min-h-screen flex flex-col items-center justify-center gap-md p-lg'
      : variant === 'inline'
        ? 'inline-flex items-center gap-sm'
        : 'flex flex-col items-center justify-center gap-md p-lg bg-elevated rounded-md';

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="loading-state"
      className={`${baseCls} ${className}`.trim()}
      {...rest}
    >
      <Spinner size={variant === 'inline' ? 'sm' : 'lg'} label={label} />
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
});

export default LoadingState;
