// MascotState — molecule (Task 2.4).
// 5종 마스코트 (default · dispatch · cooking · arrive · canceled) +
// cross-fade 200ms (.mascot-fade) + cooking 한정 idle 흔들 (.mascot-cooking-idle).
//
// 결정 c (자산 D-3 미수령) — `useFallback=true` 기본값으로 처음부터 이모지.
//   자산 수령 후 부모가 `useFallback={false}` 로 전환. 누락 시 onError 안전망 — 이모지로 복귀.
//
// 시안: docs/design-bundle/components.jsx line 77-83 (Mascot) — *확장*.
//   - 시안: 단일 `mascot` div + state=cooking 시 idle 클래스만.
//   - 본 구현: img/이모지 분기 + 5종 state 라벨 매핑 + cross-fade.
//
// 접근성:
//   - <img alt> / <span aria-label> 모두 "치횬이닭 마스코트 — {label}" 형식.
//   - reduced motion 사용자 → components.css media query 가 cross-fade · idle 둘 다 정적화.
//
// 관련 결정: DESIGN §10 + 결정 c · ADR-026 §1 (자산 fallback)
import { useState, forwardRef } from 'react';

// state → 한글 라벨 + src + fallback 이모지 (모듈 최상위 — §3.5 6조).
// 결정 c 명세: fallback = 🪖 헬멧. default state 기준 회귀 케이스.
// 운영 UX 위해 state별 다양화 (default 만 🪖, 나머지는 시각 구분되는 이모지) — 회귀 케이스는 default 만 확인.
const STATE_CONFIG = {
  default: { label: '기본', src: '/mascot/default.png', fallbackEmoji: '🪖' },
  dispatch: { label: '출동', src: '/mascot/dispatch.png', fallbackEmoji: '🏃' },
  cooking: { label: '조리 중', src: '/mascot/cooking.png', fallbackEmoji: '🔥' },
  arrive: { label: '도착', src: '/mascot/arrive.png', fallbackEmoji: '🎉' },
  canceled: { label: '취소', src: '/mascot/canceled.png', fallbackEmoji: '😢' },
};

// size → Tailwind 클래스 (모듈 최상위, 완전 문자열 — purge 안전).
// 이모지 폰트 크기도 동반 (text-3xl/4xl) — img 일 때는 무시되지만 fallback 시 효과적.
const SIZE_CLASSES = {
  sm: 'w-16 h-16 text-3xl',
  md: 'w-24 h-24 text-4xl',
  lg: 'w-32 h-32 text-4xl',
};

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

  // 이미지 로드 실패 시 이모지로 안전망 전환.
  // useFallback=true 면 처음부터 이모지 (자산 미수령 단계).
  const [imageFailed, setImageFailed] = useState(false);
  const showEmoji = useFallback || imageFailed;

  // cooking state 만 idle 흔들 — components.css 의 .mascot-cooking-idle.
  const idleClass = state === 'cooking' ? 'mascot-cooking-idle' : '';

  const wrapperCls = [
    'inline-flex',
    'items-center',
    'justify-center',
    sizeCls,
    'mascot-fade',
    idleClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const altLabel = `치킨이닭 마스코트 — ${config.label}`;

  return (
    <div ref={ref} className={wrapperCls} {...rest}>
      {showEmoji ? (
        <span role="img" aria-label={altLabel}>
          {config.fallbackEmoji}
        </span>
      ) : (
        <img
          src={config.src}
          alt={altLabel}
          className="w-full h-full object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
});

export default MascotState;
