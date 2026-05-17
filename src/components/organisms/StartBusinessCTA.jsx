// StartBusinessCTA — organism (IMPLEMENTATION_PLAN §2.8 / G13 / ADR-026).
// 본부 대시보드 — 영업이 CLOSED 일 때 "장사 시작" 큰 형광 옐로 CTA.
//
// 렌더 규칙:
//   - status='OPEN'                          → 렌더 X (null) — 이미 영업 중 CTA 불필요
//   - status='CLOSED' + shouldBeOpen=true   → 큰 형광 옐로 (primary, bg-accent) "🚀 장사 시작"
//   - status='CLOSED' + shouldBeOpen=false  → secondary 톤 "장사 시작 (시간 전)" + 안내 카피
//
// 클릭 모션: 200ms scale(0.96) → 1 (tap 피드백) — components.css `.start-business-cta-press`.
// JS 측: 클릭 즉시 pressed=true → setTimeout 200ms 후 pressed=false → 단발 모션.
// reduced motion 시 components.css @media 가 animation: none 강제.
//
// 에러 표시: error prop → 인라인 alert (`role="alert"`, data-testid=cta-error).
// API 호출: 본 단계는 onStart 콜백만 — 실제 API 호출은 Phase 6 (호출자가 콜백 구현).
import { forwardRef, useState } from 'react';
import Button from '../atoms/Button.jsx';

const StartBusinessCTA = forwardRef(function StartBusinessCTA(
  {
    status = 'CLOSED',
    shouldBeOpen = false,
    onStart,
    loading = false,
    error = null,
    className = '',
    ...rest
  },
  ref,
) {
  const [pressed, setPressed] = useState(false);

  // status=OPEN 이면 CTA 불필요 — 아무것도 렌더 X.
  if (status === 'OPEN') {
    return null;
  }

  // shouldBeOpen=true → primary (큰 형광 옐로 강조).
  // shouldBeOpen=false → secondary (시간 안 됨 — 톤 다운).
  const isPrimary = shouldBeOpen;

  const handleClick = () => {
    // 200ms 모션 트리거 — 클래스 추가 후 200ms 뒤 해제.
    setPressed(true);
    setTimeout(() => setPressed(false), 200);
    onStart?.();
  };

  const ariaLabel = isPrimary
    ? '장사 시작 (지금 영업 시작)'
    : '장사 시작 (영업 시간 전)';

  // find_error_v2 (2026-05-18): secondary 변형(시간 전)은 full-width 가 아니라
  // 컨텐츠 크기로 표시되고 가운데 정렬된다. primary(긴급) 는 기존대로 full-width.
  const buttonWrapperCls = isPrimary
    ? 'flex flex-col gap-sm'
    : 'flex flex-col items-center justify-center gap-sm';

  return (
    <div
      ref={ref}
      className={[buttonWrapperCls, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Button
        variant={isPrimary ? 'primary' : 'secondary'}
        size="lg"
        block={isPrimary}
        loading={loading}
        onClick={handleClick}
        data-testid="start-business-cta"
        className={pressed ? 'start-business-cta-press' : ''}
        aria-label={ariaLabel}
      >
        {isPrimary ? '장사 시작' : '장사 시작 (시간 전)'}
      </Button>
      {!isPrimary && (
        <p className="text-xs text-muted text-center">
          아직 영업 시작 시간이 아닙니다.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-danger text-sm"
          data-testid="cta-error"
        >
          {error}
        </p>
      )}
    </div>
  );
});

export default StartBusinessCTA;
