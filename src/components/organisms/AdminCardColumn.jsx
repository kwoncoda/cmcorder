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

// 식사 중(DINING) 경과 시간별 border tone — 식사는 더 긴 기준 적용.
//   60분 이상 → danger (빨강 — 자리 교체 필요)
//   30분 이상 → warning (주황 — 주의)
//   30분 미만 → divider (기본)
function diningElapsedTone(minutes) {
  if (minutes >= 60) return 'border-danger';
  if (minutes >= 30) return 'border-warning';
  return 'border-divider';
}

// find_error_v3 — design-bundle .order-card.warn / .order-card.danger 톤 매핑.
// elapsedTone 의 결과(Tailwind 클래스)에 대응하는 design-bundle CSS 클래스.
function orderCardDesignClass(tone) {
  if (tone === 'border-danger') return 'order-card danger';
  if (tone === 'border-warning') return 'order-card warn';
  return 'order-card';
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

// design_fix v5 — F1 카드에 이체 신고 은행 표시. bank='기타' 면 custom_bank fallback.
function formatBankLabel(order) {
  if (!order.bank) return null;
  if (order.bank === '기타') return order.custom_bank || '기타';
  return order.bank;
}

// design_fix v5 — F2 카드에 수령 위치(테이블/포장) 표시. 모든 상태에서 노출.
function formatLocationLabel(order) {
  if (order.delivery_type === 'takeout') return '포장';
  if (order.delivery_type === 'dineIn') {
    return order.table_no != null ? `테이블 ${order.table_no}` : '테이블 미지정';
  }
  return null;
}

// Bug 9, 10: 상태별 inline 액션 매트릭스.
// design-bundle screens-admin.jsx 295~322 라인 + ADR-025 합법 전이 정합.
//   ORDERED           → 취소
//   TRANSFER_REPORTED → 확인 / 보류
//   PAID              → 조리 시작
//   COOKING           → 조리 완료
//   READY             → 전달 완료 (dineIn → DINING / takeout → SETTLED, 아래 getActionsForOrder 분기)
//   DINING            → 테이블 준비 완료 (→ SETTLED)
//   HOLD              → 이체 확인 / 취소  (find_error_v2: 재확인 → 이체 확인 으로 라벨 변경)
const ACTION_BY_STATUS = {
  ORDERED: [{ label: '취소', to: 'CANCELED', variant: 'danger' }],
  TRANSFER_REPORTED: [
    { label: '확인', to: 'PAID', variant: 'primary' },
    { label: '보류', to: 'HOLD', variant: 'danger' },
  ],
  PAID: [{ label: '조리 시작', to: 'COOKING', variant: 'primary' }],
  COOKING: [{ label: '조리 완료', to: 'READY', variant: 'primary' }],
  READY:  [{ label: '전달 완료',        to: 'DINING',  variant: 'primary' }],
  DINING: [{ label: '테이블 준비 완료', to: 'SETTLED', variant: 'primary' }],
  HOLD: [
    { label: '이체 확인', to: 'PAID', variant: 'primary' },
    { label: '취소', to: 'CANCELED', variant: 'danger' },
  ],
};

// design_fix_v4 (2026-05-19): order 별 액션 결정.
//   - takeout READY 카드는 DINING 을 건너뛰고 SETTLED 로 직접 전이.
//     라벨은 dineIn 과 동일하게 "전달 완료" — 운영자 인지 부담 최소화.
//   - 그 외 상태/형태는 ACTION_BY_STATUS 표 그대로.
function getActionsForOrder(order) {
  if (order.status === 'READY' && order.delivery_type === 'takeout') {
    return [{ label: '전달 완료', to: 'SETTLED', variant: 'primary' }];
  }
  return ACTION_BY_STATUS[order.status] ?? [];
}

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
// design_fix (2026-05-18): design-bundle AdminOrderCard 구조 정렬.
//   - Tailwind bg-card-bg/text-card-ink 제거 (semantic .order-card 의 --color-bg/-ink 와 충돌 →
//     배경은 dark green 인데 글자는 dark brown 으로 잡혀 가독성 저하).
//   - semantic .id/.who/.meta/.amount/.row/.actions 클래스 사용 (원본과 동일).
//   - 위험 액션은 .order-card .actions button 기본 톤 (btn-danger* 제거) — primary 만 .primary.
//   - StatusChip 카드 내부 제거: 컬럼 헤더가 이미 상태를 나타냄.
//   - tone 클래스(border-divider/warning/danger) 는 기존 회귀 테스트 호환 위해 유지.
function OrderCard({ order, tick, onAction, isPending = false }) {
  const baselineAt = order.status === 'DINING' ? order.dining_at : order.transferred_at;
  const elapsedMin = useMemo(
    () => calcElapsedMinutes(baselineAt, new Date(tick)),
    [baselineAt, tick],
  );
  const tone = order.status === 'DINING' ? diningElapsedTone(elapsedMin) : elapsedTone(elapsedMin);
  const displayName = pickName(order);
  const priceText = formatPrice(order.total_price);
  const actions = getActionsForOrder(order);
  const itemsPreview = previewItems(order.items);
  const locationLabel = formatLocationLabel(order);
  const bankLabel = order.status === 'TRANSFER_REPORTED' ? formatBankLabel(order) : null;

  const cls = [
    orderCardDesignClass(tone),
    tone,
    'transition-all duration-tap',
  ].join(' ');

  return (
    <article data-testid={`admin-order-card-${order.id}`} className={cls}>
      <div className="row">
        <span className="id">#{order.no}</span>
        <span className="ago font-mono tabular-nums">{elapsedMin}분 경과</span>
      </div>
      <div className="who">{displayName ?? '(이름 없음)'}</div>
      {(locationLabel || bankLabel || itemsPreview) && (
        <div className="meta">
          {locationLabel && <div data-testid="order-location">{locationLabel}</div>}
          {bankLabel && <div data-testid="order-bank">은행: {bankLabel}</div>}
          {itemsPreview && itemsPreview.head.map((it, idx) => (
            <div key={`${it.menu_id ?? it.name}-${idx}`}>{it.name} ×{it.quantity}</div>
          ))}
          {itemsPreview && itemsPreview.surplus > 0 && <div>외 {itemsPreview.surplus}개</div>}
        </div>
      )}
      {priceText && (
        <div className="row"><span className="amount">{priceText}</span></div>
      )}
      {actions.length > 0 && (
        <div className="actions">
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
              className={a.variant === 'primary' ? 'primary' : undefined}
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
  // design-bundle .col / .col-head / .col-body — semantic CSS 가 background·radius·flex 모두 처리.
  // Tailwind bg-elevated 와 충돌하지 않게 utility 제거 (semantic 단일 출처).
  const wrapperCls = ['col', className].filter(Boolean).join(' ');

  return (
    <section
      ref={ref}
      data-testid={`admin-column-${status}`}
      className={wrapperCls}
      aria-label={`${title} 컬럼`}
      {...rest}
    >
      <header className="col-head">
        <h2 className="font-display font-bold">{title}</h2>
        <span className="count">{orders.length}</span>
      </header>

      <ol className="col-body" style={{ listStyle: 'none', margin: 0, padding: 8 }}>
        {orders.length === 0 ? (
          <li className="text-muted text-xs" style={{ textAlign: 'center', padding: '12px 4px' }}>해당 상태 주문 없음</li>
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
