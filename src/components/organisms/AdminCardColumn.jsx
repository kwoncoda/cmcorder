// AdminCardColumn — organism (IMPLEMENTATION_PLAN §2.7 / §3.5 6조·7조 / ADR-021).
// 본부 대시보드 칸반 컬럼 — 상태별 주문 카드 묶음.
//
// 설계 결정 (§3.5 7조 메모이즈):
// - **OrderCard는 모듈 최상위** (§3.5 6조) — AdminCardColumn 안에 정의하면
//   부모 리렌더마다 새 함수 reference 생성 → React.memo 무용지물.
// - **React.memo로 OrderCard 감쌈** — 5초 폴링 후 *변하지 않은 카드는 리렌더 X*.
//   props가 primitive 또는 안정 reference (order 객체 reference 유지) 가정.
// - **useMemo([order.transferred_at, tick])** — elapsed_minutes는 카드 내부에서
//   재계산. tick은 부모(KanbanBoard)가 1분 단위 발행 → 1분당 1회 재계산.
//   transferred_at 안 바뀌면 캐시 유지.
// - 5분/10분 경과 시 노란/빨간 border 강조 — 운영자 시각 신호.
// - key={order.id} — index 금지 (§3.5 7조).
// - 카드 클릭은 시맨틱 <button> — 키보드 Enter·Space 기본 동작 (focus-visible 자동).
import { forwardRef, memo, useMemo } from 'react';
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

// OrderCard — React.memo 적용. 동일 props (order reference + tick) 시 리렌더 X.
// ※ named export — 테스트에서 memo wrap 회귀 검증용.
const OrderCard = memo(function OrderCard({ order, tick, onSelect }) {
  // tick props가 같으면 deps 동일 → 캐시된 elapsedMin 반환.
  // tick이 1분 단위로 갱신되면 재계산.
  const elapsedMin = useMemo(
    () => calcElapsedMinutes(order.transferred_at, new Date(tick)),
    [order.transferred_at, tick],
  );
  const tone = elapsedTone(elapsedMin);

  // 시맨틱 button — focus-visible·Enter·Space 기본 처리.
  // 카드 톤: bg-card-bg + text-card-ink (DESIGN — 본문 영역과 구분).
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
      <div className="font-display font-bold text-base">#{order.no}</div>
      <div className="text-xs text-card-muted truncate">
        {order.depositorName ?? '(이름 없음)'}
      </div>
      <div className="mt-2xs flex items-center justify-between gap-sm">
        <StatusChip status={order.status} size="sm" />
        <span className="font-mono tabular-nums text-xs text-card-ink">
          {elapsedMin}분 경과
        </span>
      </div>
    </button>
  );
});

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
