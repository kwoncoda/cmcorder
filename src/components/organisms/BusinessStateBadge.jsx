// BusinessStateBadge — organism (IMPLEMENTATION_PLAN §2.8 / G13 / ADR-026 / 결정 h).
// 본부 대시보드 헤더에 표시하는 영업 상태 배지.
//
// 3 시각 상태:
//   1. status='OPEN'                          → 🟢 영업 중 (녹·정적)
//   2. status='CLOSED' + shouldBeOpen=false   → 🔴 영업 외 (빨·정적)  — 예: 영업 시간 외
//   3. status='CLOSED' + shouldBeOpen=true    → 🔴 영업 외 (빨·깜박)  — 예: 16:30 지났는데 사장님이 "장사 시작" 안 누름
//
// 결정 h: 깜박은 *세션 X, 매번 재생* — sessionStorage 사용 X.
//   사장님이 화면을 새로 열 때마다 즉시 인지하도록. reduced motion 시 정적 (components.css @media).
//
// Phase 3에서 zustand 영업 상태 구독으로 교체 예정 — 본 단계는 props만.
import { forwardRef } from 'react';

const BusinessStateBadge = forwardRef(function BusinessStateBadge(
  { status = 'CLOSED', shouldBeOpen = false, className = '', ...rest },
  ref,
) {
  // status 값 정규화 — 'OPEN' 외 모두 CLOSED 취급 (방어).
  const isOpen = status === 'OPEN';
  const needsAttention = !isOpen && shouldBeOpen;

  // 색상 클래스 — Tailwind 토큰(bg-success / bg-danger).
  // text-card-ink 는 어두운 카드 위 잉크 — bg-success(녹)·bg-danger(빨) 모두 대비 충분.
  const colorCls = isOpen
    ? 'bg-success text-card-ink'
    : needsAttention
    ? 'bg-danger text-card-ink business-badge-blink'
    : 'bg-danger text-card-ink';

  const icon = isOpen ? '🟢' : '🔴';
  const label = isOpen ? '영업 중 (OPEN)' : '영업 외 (CLOSED)';

  // 공통 베이스 — pill 모양 + 굵은 폰트 + 외곽선.
  const baseCls = [
    'inline-flex items-center gap-xs',
    'px-md py-xs rounded-pill',
    'font-display font-bold text-sm',
    'border-2 border-current',
  ].join(' ');

  return (
    <span
      ref={ref}
      role="status"
      aria-live="polite"
      data-testid="business-state-badge"
      className={[baseCls, colorCls, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
});

export default BusinessStateBadge;
