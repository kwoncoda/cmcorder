// StartBusinessCTA — organism (IMPLEMENTATION_PLAN §2.8 / G13 / ADR-026).
// 본부 대시보드 — CLOSED 상태에서 "장사 시작" CTA.
//
// design_fix (2026-05-18): design_bundle screens-admin.jsx .start-cta.urgent 구조 복원.
//   원본은 .start-cta 가 flex row (cta-mascot · left · Button) 이며 Button 이 직접 flex 자식.
//   기존 wrapper div 가 layout 을 어지럽혀 원본 옐로 stencil 강조가 깨졌으므로
//   primary 시 display:contents 로 Button 을 .start-cta 의 직접 자식으로 노출한다.
//   `btn-primary` 리터럴 클래스도 함께 부여해 .start-cta.urgent .btn-primary CSS
//   (stencil · stamp-black border · 옐로 ring) 가 적용되도록.
//
// 렌더 규칙:
//   - status='OPEN'                          → null
//   - status='CLOSED' + shouldBeOpen=true   → 큰 형광 옐로 (primary, .btn-primary)
//   - status='CLOSED' + shouldBeOpen=false  → secondary 톤 + "시간 전" 안내
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

  if (status === 'OPEN') return null;

  const isPrimary = shouldBeOpen;
  const handleClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 200);
    onStart?.();
  };

  const ariaLabel = isPrimary ? '장사 시작 (지금 영업 시작)' : '장사 시작 (영업 시간 전)';
  const buttonLabel = isPrimary ? '장사 시작 →' : '장사 시작 (시간 전)';
  const buttonExtraCls = [
    isPrimary ? 'btn-primary' : '',
    pressed ? 'start-business-cta-press' : '',
  ].filter(Boolean).join(' ');

  if (isPrimary) {
    return (
      <div ref={ref} className={className} style={{ display: 'contents' }} {...rest}>
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onClick={handleClick}
          data-testid="start-business-cta"
          className={buttonExtraCls}
          aria-label={ariaLabel}
        >
          {buttonLabel}
        </Button>
        {error && (
          <p role="alert" className="text-danger text-sm" data-testid="cta-error" style={{ margin: 0, flexBasis: '100%' }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={['flex flex-col items-center justify-center gap-sm', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Button
        variant="secondary"
        size="lg"
        loading={loading}
        onClick={handleClick}
        data-testid="start-business-cta"
        className={buttonExtraCls}
        aria-label={ariaLabel}
      >
        {buttonLabel}
      </Button>
      <p className="text-xs text-muted text-center">아직 영업 시작 시간이 아닙니다.</p>
      {error && (
        <p role="alert" className="text-danger text-sm" data-testid="cta-error">
          {error}
        </p>
      )}
    </div>
  );
});

export default StartBusinessCTA;
