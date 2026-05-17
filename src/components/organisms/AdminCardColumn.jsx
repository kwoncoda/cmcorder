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
// - **Bug 9, 10 (2026-05-17): inline 액션 버튼**. design-bundle screens-admin.jsx
//   295~322 라인 정합. 액션 row 의 button 은 onAction 으로 전이 호출.
// - **find_error_v2 (2026-05-18): 카드 클릭 네비게이션 제거.** 본문은 단순 div
//   섹션으로 표시만 — onSelect 콜백 미사용. /admin/orders/:id 라우트는 유지
//   (직접 URL 진입 가능) 하지만 칸반 카드에서 진입 경로는 제거. 액션 버튼만
//   상호작용 가능. cursor-pointer / hover:opacity-90 제거.
// - **find_error_v2 (2026-05-18): items 미리보기.** 카드에 order.items 최대 3개를
//   "이름 ×수량" 으로 노출. 초과 시 "외 N개".
import { forwardRef, useMemo } from 'react';
import StatusChip from '../molecules/StatusChip.jsx';
import { elapsedMinutes as elapsedMinutesUtil } from '../../utils/time.js';

// 경과 분 계산 — transferred_at 없으면 0.
// Bug 7 (2026-05-17): elapsedMinutesUtil로 위임 — SQLite 'YYYY-MM-DD HH:MM:SS' (UTC, marker 없음)
// 형식을 UTC로 강제 해석해 브라우저 KST 540분 오차 회귀를 차단한다. ISO Z 형식은 그대로 통과.
// now 인자는 useMemo deps에서 new Date(tick) 으로 주입.
function calcElapsedMinutes(transferredAt, now = new Date()) {
  return elapsedMinutesUtil(transferredAt, now);
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

// Bug 9, 10: 상태별 inline 액션 매트릭스.
// design-bundle screens-admin.jsx 295~322 라인 + ADR-025 합법 전이 정합.
//   ORDERED           → 취소
//   TRANSFER_REPORTED → 확인 / 보류
//   PAID              → 조리 시작
//   COOKING           → 조리 완료
//   READY             → 전달 완료
//   HOLD              → 이체 확인 / 취소  (find_error_v2: 재확인 → 이체 확인 으로 라벨 변경)
const ACTION_BY_STATUS = {
  ORDERED: [{ label: '취소', to: 'CANCELED', variant: 'danger' }],
  TRANSFER_REPORTED: [
    { label: '확인', to: 'PAID', variant: 'primary' },
    { label: '보류', to: 'HOLD', variant: 'danger' },
  ],
  PAID: [{ label: '조리 시작', to: 'COOKING', variant: 'primary' }],
  COOKING: [{ label: '조리 완료', to: 'READY', variant: 'primary' }],
  READY: [{ label: '전달 완료', to: 'DONE', variant: 'primary' }],
  HOLD: [
    { label: '이체 확인', to: 'PAID', variant: 'primary' },
    { label: '취소', to: 'CANCELED', variant: 'danger' },
  ],
};

// items 미리보기 — 최대 3개를 "이름 ×수량" 으로 반환, 초과 시 surplus 카운트.
function previewItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const head = items.slice(0, 3);
  const surplus = items.length - head.length;
  return { head, surplus };
}

// OrderCard — 단순 함수 컴포넌트 (P2-3 Codex v3 — memo 제거, A 방향).
// 폴링 5초마다 order reference 새로 생성되므로 memo 효과 0이라 단순화.
//
// find_error_v2 (2026-05-18): 카드 클릭 네비게이션 제거.
//   - 본문은 <div> 정적 표시 — onSelect prop 미사용.
//   - cursor-pointer / hover:opacity-90 클래스 제거.
//   - 액션 버튼만 인터랙션 (이체 확인/조리 시작 등).
function OrderCard({ order, tick, onAction, isPending = false }) {
  const elapsedMin = useMemo(
    () => calcElapsedMinutes(order.transferred_at, new Date(tick)),
    [order.transferred_at, tick],
  );
  const tone = elapsedTone(elapsedMin);
  const displayName = pickName(order);
  const priceText = formatPrice(order.total_price);
  const actions = ACTION_BY_STATUS[order.status] ?? [];
  const itemsPreview = previewItems(order.items);

  const cls = [
    'text-left w-full',
    'bg-card-bg text-card-ink',
    'rounded-md p-md shadow-card',
    'border-2',
    tone,
    'transition-all duration-tap',
  ].join(' ');

  return (
    <article data-testid={`admin-order-card-${order.id}`} className={cls}>
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
      {itemsPreview && (
        <ul className="mt-2xs flex flex-col gap-3xs text-xs text-card-muted">
          {itemsPreview.head.map((it, idx) => (
            <li key={`${it.menu_id ?? it.name}-${idx}`} className="truncate">
              {it.name} ×{it.quantity}
            </li>
          ))}
          {itemsPreview.surplus > 0 && (
            <li className="text-card-muted">외 {itemsPreview.surplus}개</li>
          )}
        </ul>
      )}
      <div className="mt-2xs flex items-center justify-between gap-sm">
        <StatusChip status={order.status} size="sm" />
        <span className="font-mono tabular-nums text-xs text-card-ink">
          {elapsedMin}분 경과
        </span>
      </div>
      {actions.length > 0 && (
        <div className="mt-sm flex gap-xs">
          {actions.map((a) => (
            <button
              key={a.to}
              type="button"
              onClick={() => {
                if (isPending) return;
                onAction?.(order.id, a.to);
              }}
              disabled={isPending}
              aria-busy={isPending || undefined}
              className={`btn btn-${a.variant ?? 'primary'} btn-sm flex-1`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

const AdminCardColumn = forwardRef(function AdminCardColumn(
  {
    title,
    status,
    orders = [],
    tick = Date.now(),
    // onSelectOrder 는 deprecated (find_error_v2): 카드 클릭 네비게이션 제거.
    // prop 자체는 받지만 무시 — 기존 호출자의 회귀 차단용 fallthrough.
    onSelectOrder: _onSelectOrder,
    onAction,
    pendingOrderId = null,
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
          <li className="text-muted text-xs">해당 상태 주문 없음</li>
        ) : (
          orders.map((o) => (
            // key={o.id} — index 금지 (§3.5 7조).
            <li key={o.id}>
              <OrderCard
                order={o}
                tick={tick}
                onAction={onAction}
                isPending={o.id === pendingOrderId}
              />
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
