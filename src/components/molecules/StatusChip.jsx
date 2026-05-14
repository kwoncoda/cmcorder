// StatusChip — molecule (COMPONENT_GUIDE §3.4 / DESIGN §5.4).
// 8 주문 상태(영문 코드 → 한글 + 이모지 + 색).
// 이모지는 aria-hidden=true (decorative) — 텍스트가 SR 읽음.
// 알 수 없는 status fallback: ORDERED.
// size: 'sm' (text-2xs), 'md' (text-xs, 기본).
import { forwardRef } from 'react';

// 8 상태별 라벨·이모지·색 매핑 (모듈 최상위 — §3.5 6조).
// cls: 완전 Tailwind 클래스 문자열 (purge 안전).
// 카드 영역(밝은 흙색 배경)에선 text-card-ink, 본문 영역에선 text-ink 사용.
// 색 매칭 — DESIGN §5.4 + tokens.css 시맨틱 토큰:
//   ORDERED   → info (파랑 — 진행 시작 신호)
//   TRANSFER  → warning (주황 — 사용자 행동 필요)
//   PAID/DONE → success (녹색 — 긍정 완료)
//   COOKING/READY → accent (형광 옐로 — 호명·완료 신호)
//   HOLD      → warning (주황 — 주의)
//   CANCELED  → danger (빨강 — 부정 종료)
const STATUS_CONFIG = {
  ORDERED:           { label: '주문 접수',    icon: '⏳', cls: 'bg-info text-ink' },
  TRANSFER_REPORTED: { label: '입금 확인 중', icon: '💸', cls: 'bg-warning text-card-ink' },
  PAID:              { label: '조리 시작',    icon: '✓',  cls: 'bg-success text-ink' },
  COOKING:           { label: '조리 중',      icon: '🔥', cls: 'bg-accent text-card-ink' },
  READY:             { label: '수령 대기',    icon: '✅', cls: 'bg-accent text-card-ink' },
  DONE:              { label: '수령 완료',    icon: '🎉', cls: 'bg-success text-ink' },
  HOLD:              { label: '보류',         icon: '⚠️', cls: 'bg-warning text-card-ink' },
  CANCELED:          { label: '취소',         icon: '❌', cls: 'bg-danger text-ink' },
};

// size → Tailwind 클래스 매핑 (완전 문자열).
const SIZE_CLASSES = {
  sm: 'text-2xs px-2 py-3xs',
  md: 'text-xs px-xs py-2xs',
};

const BASE_CLASSES = [
  'inline-flex items-center gap-2xs',
  'rounded-pill',
  'font-medium',
  'select-none',
].join(' ');

const StatusChip = forwardRef(function StatusChip(
  { status, size = 'md', className = '', ...rest },
  ref,
) {
  // 알 수 없는 status fallback: ORDERED.
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.ORDERED;
  const sizeCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  const cls = [BASE_CLASSES, sizeCls, config.cls, className].filter(Boolean).join(' ');

  return (
    <span ref={ref} className={cls} {...rest}>
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
});

export default StatusChip;
