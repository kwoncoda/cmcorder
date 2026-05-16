// MascotState — design-bundle .mascot + 5종 state 분기.
// 자산은 단일 mascot.png — design-bundle 시안과 동일하게 모든 state 가 같은 이미지 공유.
//
// 마크업: <div class="mascot mascot-{size} mascot-fade {mascot-cooking-idle}? w-{n} h-{n}">
//   <img src="/mascot/mascot.png" class="w-full h-full object-contain" />
// useFallback=true 또는 onError 시 이모지로 안전망.
import { useState, forwardRef } from 'react';

const STATE_CONFIG = {
  default:  { label: '기본',    fallbackEmoji: '🪖' },
  dispatch: { label: '출동',    fallbackEmoji: '🏃' },
  cooking:  { label: '조리 중', fallbackEmoji: '🔥' },
  arrive:   { label: '도착',    fallbackEmoji: '🎉' },
  canceled: { label: '취소',    fallbackEmoji: '😢' },
};

// Tailwind 사이즈(테스트 회귀) + design-bundle .mascot-{size} 병행.
const SIZE_CLASSES = {
  sm: 'w-16 h-16 text-3xl mascot-sm',
  md: 'w-24 h-24 text-4xl mascot-md',
  lg: 'w-32 h-32 text-4xl mascot-lg',
};
// img width/height 명시 (P3 #12 — layout shift 방지). Tailwind w-*/h-* 가 우선시 적용됨.
const SIZE_PX = { sm: 64, md: 96, lg: 128 };

const MASCOT_SRC = '/mascot/mascot.png';

const MascotState = forwardRef(function MascotState(
  {
    state = 'default',
    size = 'md',
    useFallback = true,
    className = '',
    ...rest
  },
  ref,
) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.default;
  const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const idleClass = state === 'cooking' ? 'mascot-cooking-idle' : '';

  const [imageFailed, setImageFailed] = useState(false);
  const showEmoji = useFallback || imageFailed;

  const wrapperCls = [
    'inline-flex items-center justify-center',
    sizeCls,
    'mascot-fade',
    idleClass,
    className,
  ].filter(Boolean).join(' ');

  const altLabel = `치킨이닭 마스코트 — ${config.label}`;

  return (
    <div ref={ref} className={wrapperCls} {...rest}>
      {showEmoji ? (
        <span role="img" aria-label={altLabel}>{config.fallbackEmoji}</span>
      ) : (
        <img
          src={MASCOT_SRC}
          alt={altLabel}
          className="w-full h-full object-contain"
          onError={() => setImageFailed(true)}
          width={SIZE_PX[size] ?? SIZE_PX.md}
          height={SIZE_PX[size] ?? SIZE_PX.md}
        />
      )}
    </div>
  );
});

export default MascotState;
