// Radio — atom (COMPONENT_GUIDE.md §2.4).
// Checkbox 와 동일 패턴, type="radio". 동일 name 공유로 그룹 형성.
// hitbox 56px · focus-visible 형광 옐로.
import { forwardRef } from 'react';

const Radio = forwardRef(function Radio(
  { id, label, className = '', ...rest },
  ref,
) {
  const wrapperCls = [
    'inline-flex items-center gap-sm',
    'min-h-[56px]',
    'cursor-pointer',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label htmlFor={id} className={wrapperCls}>
      <input
        ref={ref}
        id={id}
        type="radio"
        className="w-5 h-5 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 cursor-pointer"
        {...rest}
      />
      <span className="text-ink text-sm select-none">{label}</span>
    </label>
  );
});

export default Radio;
