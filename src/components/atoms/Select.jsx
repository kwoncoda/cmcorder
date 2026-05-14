// Select — atom (COMPONENT_GUIDE.md §2.3).
// native <select> 우선 — 커스텀 드롭다운은 모바일 UX 떨어져 미사용.
// invalid + errorMessage 패턴은 Input 과 동일.
import { forwardRef } from 'react';

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
].join(' ');

const Select = forwardRef(function Select(
  {
    id,
    invalid = false,
    errorMessage = '',
    children,
    className = '',
    ...rest
  },
  ref,
) {
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
      <select
        ref={ref}
        id={id}
        className={cls}
        aria-invalid={invalid || undefined}
        aria-describedby={errorId}
        {...rest}
      >
        {children}
      </select>
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

export default Select;
