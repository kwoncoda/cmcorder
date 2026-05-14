// Input — atom (COMPONENT_GUIDE.md §2.2 / DESIGN.md §12.5).
// 한 줄 텍스트 입력 — text·tel·email·number·password.
// placeholder 는 도움말일 뿐, 라벨은 별도 <Label> 컴포넌트로 (AI 슬롭 #15).
// invalid + errorMessage 시 aria-invalid · aria-describedby · role="alert" 패턴.
// inputMode·pattern·maxLength 는 ...rest 로 자연 패스 (학번 = inputMode="numeric"+pattern="\d{8}").
// forwardRef — react-hook-form register 호환 (Phase 3).
import { forwardRef } from 'react';

// 베이스 — w-full · min-h 48px(모바일 hitbox) · 카드 톤 · focus-visible(형광 옐로).
const baseClasses = [
  'w-full',
  'min-h-[48px]',
  'px-md py-sm',
  'rounded-md',
  'bg-card-bg text-card-ink',
  'border-2',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
  'focus:border-accent',
  'disabled:bg-muted/20 disabled:cursor-not-allowed',
  'placeholder:text-card-muted',
].join(' ');

const Input = forwardRef(function Input(
  { id, invalid = false, errorMessage = '', className = '', ...rest },
  ref,
) {
  // errorMessage 있을 때만 aria-describedby + alert 영역 노출.
  const errorId = errorMessage && id ? `${id}-error` : undefined;

  const cls = [
    baseClasses,
    invalid ? 'border-danger' : 'border-card-divider',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <input
        ref={ref}
        id={id}
        className={cls}
        aria-invalid={invalid || undefined}
        aria-describedby={errorId}
        {...rest}
      />
      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="text-danger text-xs mt-2xs"
        >
          {errorMessage}
        </p>
      )}
    </>
  );
});

export default Input;
