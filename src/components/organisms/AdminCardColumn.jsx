// AdminCardColumn — organism (IMPLEMENTATION_PLAN §2.7 / §3.5 6조 / ADR-021).
// 본부 대시보드 칸반 컬럼 — 상태별 주문 카드 묶음.
//
// 설계 결정:
// - **OrderCard는 모듈 최상위** (§3.5 6조) — 단순 함수 컴포넌트.
// - **React.memo 미적용 (P2-3 Codex v3 2026-05-15, A 방향):** 5초 폴링마다
//   fresh JSON으로 order reference가 매번 새로 생성 → memo 효과 0. 카드 ≤30개
//   운영 부하 미미. 단순화 우선.
// - **useMemo([order.transferred_at, tick])** — elapsed_minutes 재계산. tick은
//   부모가 1분 단위 발행 → 1분당 1회만 재계산.
// - 5분/10분 경과 시 노란/빨간 border 강조 — 운영자 시각 신호.
// - key={order.id} — index 금지 (§3.5 7조).
// - 카드 클릭은 시맨틱 <button> — 키보드 Enter·Space 기본 동작 (focus-visible 자동).
import { forwardRef, useMemo } from 'react';
import StatusChip from '../molecules/StatusChip.jsx';

// 경과 분 계산 — transferred_at 없으면 0, 잘못된 ISO 문자열도 0 fallback.
// now 인자는 useMemo deps에서 new Date(tick) 으로 주입.
function calcElapsedMinutes(transferredAt, now = new Date()) {
  if (!transferredAt) return 0;
  const t = new Date(transferredAt);
  if (Number.isNaN(t.getTime())) return 0;
  return Math.floor((now.getTime() - t.getTime()) / 60000);
}

// 경과 시간별 border tone (시맨틱 토큰).
//   10분 이상 → danger (빨강 — 대응 시급)
//   5분 이상  → warning (주황 — 주의)
//   5분 미만 → divider (기본)
function elapsedTone(minutes) {
  if (minutes >= 10) return 'border-danger';
  if (minutes >= 5) return 'border-warning';
  return 'border-divider';
}

// P1-2 (Codex 리뷰): 서버 실제 shape 호환.
//  - 이름: depositor_name (snake) → depositorName (camel) → name 순 fallback.
//  - 금액: total_price 표시 (F-A-007 요구).
function pickName(order) {
  return order.depositor_name ?? order.depositorName ?? order.name ?? null;
}
function formatPrice(n) {
  if (typeof n !== 'number') return '';
  return `${n.toLocaleString('ko-KR')}원`;
}

// OrderCard — 단순 함수 컴포넌트 (P2-3 Codex v3 — memo 제거, A 방향).
// 폴링 5초마다 order reference 새로 생성되므로 memo 효과 0이라 단순화.
function OrderCard({ order, tick, onSelect }) {
  const elapsedMin = useMemo(
    () => calcElapsedMinutes(order.transferred_at, new Date(tick)),
    [order.transferred_at, tick],
  );
  const tone = elapsedTone(elapsedMin);
  const displayName = pickName(order);
  const priceText = formatPrice(order.total_price);

  const cls = [
    'text-left w-full',
    'bg-card-bg text-card-ink',
    'rounded-md p-md shadow-card',
    'border-2',
    tone,
    'hover:opacity-90',
    'transition-all duration-tap',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
  ].join(' ');

  return (
    <button
      type="button"
      onClick={() => onSelect?.(order.id)}
      data-testid={`admin-order-card-${order.id}`}
      className={cls}
    >
      <div className="flex items-baseline justify-between gap-sm">
        <div className="font-display font-bold text-base">#{order.no}</div>
        {priceText && (
          <span className="font-mono tabular-nums text-sm text-card-ink">
            {priceText}
          </span>
        )}
      </div>
      <div className="text-xs text-card-muted truncate">
        {displayName ?? '(이름 없음)'}
      </div>
      <div className="mt-2xs flex items-center justify-between gap-sm">
        <StatusChip status={order.status} size="sm" />
        <span className="font-mono tabular-nums text-xs text-card-ink">
          {elapsedMin}분 경과
        </span>
      </div>
    </button>
  );
}

const AdminCardColumn = forwardRef(function AdminCardColumn(
  {
    title,
    status,
    orders = [],
    tick = Date.now(),
    onSelectOrder,
    className = '',
    ...rest
  },
  ref,
) {
  const wrapperCls = [
    'bg-elevated text-ink',
    'rounded-md p-md',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      ref={ref}
      data-testid={`admin-column-${status}`}
      className={wrapperCls}
      aria-label={`${title} 컬럼`}
      {...rest}
    >
      <header className="flex items-center justify-between mb-sm">
        <h2 className="font-display font-bold text-lg">{title}</h2>
        <span className="font-mono tabular-nums text-sm text-muted">
          {orders.length}
        </span>
      </header>

      <ol className="flex flex-col gap-sm">
        {orders.length === 0 ? (
          <li className="text-muted text-xs">비어 있음</li>
        ) : (
          orders.map((o) => (
            // key={o.id} — index 금지 (§3.5 7조).
            <li key={o.id}>
              <OrderCard order={o} tick={tick} onSelect={onSelectOrder} />
            </li>
          ))
        )}
      </ol>
    </section>
  );
});

// OrderCard는 memo 회귀 테스트용 named export.
export { OrderCard };
export default AdminCardColumn;
