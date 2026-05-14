// StampBadge — molecule (COMPONENT_GUIDE.md §3.1 / DESIGN.md §8.1 / ADR-026 §8.1).
// 5 variant: recommended · sold-out · paid · done · canceled.
// CSS 도장 (SVG X — 2026-05-13 결정 C): border + Black Ops One + 회전 + box-shadow.
// 회전은 variant 별 고정 -3~+3 deg (랜덤 대신 — 테스트 회귀 친화 + 디자인 일관성).
//   "랜덤 회전" 명세는 시각 다양성 의도였으나, 5 variant 각 다른 각도(-3, +2, -2, +3, +1)로
//   동일 효과 + 테스트 안정성 확보. 페이지에 같은 도장 다회 노출 시엔 wrapper 회전 추가 검토.
// 색: recommended/paid/done = stamp-green, sold-out/canceled = stamp-red (가이드 결정).
// reduced motion: globals.css 가 transition-duration 0.01ms 강제 — 별도 motion-reduce 클래스 불필요.
//   등장 keyframe 모션은 본 atom 에서 생략 — Phase 4.2 MenuPage 통합 시 wrapper 에서 추가 결정.
// 접근성: role=img + aria-label="X 도장" (도장이 *내용*인 패턴).
// Tailwind 회전은 inline style 사용 (arbitrary `rotate-[Xdeg]` 동적 생성 시 purge 위험 회피).
import { forwardRef } from 'react';

// variant 별 설정 — 모듈 최상위 (CLAUDE.md §3.5 6조: VARIANT_CONFIG 패턴).
// label: 표시 텍스트 (대문자 영문 — 도장 미학)
// colorClasses: 완전한 Tailwind 클래스 문자열 (text-X border-X) — 동적 보간 X.
//   Tailwind purge 는 소스에서 *완전한* 클래스 문자열만 스캔 → `text-${token}` 형태 보간 X.
// rotation: CSS rotate() 인자 — 양수는 '2deg' (단항 '+' 없이도 CSS 유효)
const VARIANT_CONFIG = {
  recommended: {
    label: 'RECOMMENDED',
    colorClasses: 'text-stamp-green border-stamp-green',
    rotation: '-3deg',
  },
  'sold-out': {
    label: 'SOLD OUT',
    colorClasses: 'text-stamp-red border-stamp-red',
    rotation: '2deg',
  },
  paid: {
    label: 'PAID',
    colorClasses: 'text-stamp-green border-stamp-green',
    rotation: '-2deg',
  },
  done: {
    label: 'DONE',
    colorClasses: 'text-stamp-green border-stamp-green',
    rotation: '3deg',
  },
  canceled: {
    label: 'CANCELED',
    colorClasses: 'text-stamp-red border-stamp-red',
    rotation: '1deg',
  },
};

// 공통 베이스 클래스 — 도장 시각 + 모션 + 접근성.
// font-stencil: Black Ops One — fallback Pretendard (tokens.css 매핑).
// border-2 + rounded-sm: 직사각 도장 느낌 (rounded-md 면 너무 부드러움).
// uppercase + tracking-wider: 영문 도장 미학.
// select-none: 텍스트 드래그 선택 회피 (도장 미학).
// transition-transform + duration-stamp: 향후 hover/등장 모션 훅 (현재는 정적이지만
//   reduced motion 회귀 확보 + 통합 단계 확장 여지).
// origin-center: 회전 중심점 명시.
const BASE_CLASSES = [
  'inline-block',
  'px-3 py-1',
  'font-stencil',
  'text-sm font-black',
  'uppercase tracking-wider',
  'border-2 rounded-sm',
  'bg-transparent',
  'select-none',
  'transition-transform duration-stamp',
  'origin-center',
].join(' ');

const StampBadge = forwardRef(function StampBadge(
  { variant = 'recommended', label: customLabel, className = '', style, ...rest },
  ref,
) {
  // 알 수 없는 variant fallback — recommended.
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.recommended;
  const text = customLabel ?? config.label;

  const cls = [BASE_CLASSES, config.colorClasses, className].filter(Boolean).join(' ');

  // 회전은 inline style — Tailwind purge 위험 회피 + 동적 각도 안전.
  // 외부 style prop 이 있으면 합성 (transform 충돌 시 외부 우선).
  const mergedStyle = { transform: `rotate(${config.rotation})`, ...style };

  return (
    <span
      ref={ref}
      role="img"
      aria-label={`${text} 도장`}
      className={cls}
      style={mergedStyle}
      {...rest}
    >
      {text}
    </span>
  );
});

export default StampBadge;
