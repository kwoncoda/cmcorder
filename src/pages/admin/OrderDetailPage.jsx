// A-3 주문 상세 — 6 액션 + OrderTimeline + 상태 전이.
// ADR-025: 합법 전이는 *백엔드* 가 검증. 페이지는 status 기반 UI 가용성만 표시.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { OrderSchema } from '../../api/schemas.js';
import { API } from '../../api/routes.js';

import OrderTimeline from '../../components/organisms/OrderTimeline.jsx';
import StatusChip from '../../components/molecules/StatusChip.jsx';
import PriceTag from '../../components/molecules/PriceTag.jsx';
import Button from '../../components/atoms/Button.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

// 6 액션 → 다음 상태 매핑 (백엔드가 합법성 최종 검증).
const ACTIONS = [
  { key: 'confirm_transfer', label: '이체 확인', to: 'PAID',     from: ['TRANSFER_REPORTED'] },
  { key: 'hold',             label: '보류',      to: 'HOLD',     from: ['TRANSFER_REPORTED'] },
  { key: 'cancel',           label: '취소',      to: 'CANCELED', from: ['ORDERED','TRANSFER_REPORTED','PAID','HOLD'] },
  { key: 'start_cooking',    label: '조리 시작', to: 'COOKING',  from: ['PAID'] },
  { key: 'finish_cooking',   label: '조리 완료', to: 'READY',    from: ['COOKING'] },
  { key: 'deliver',          label: '전달 완료', to: 'DONE',     from: ['READY'] },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(null);
  const [actionError, setActionError] = useState(null);

  const orderQuery = useApi(
    ({ signal }) => apiFetch(API.ADMIN_ORDER(id), { schema: OrderSchema, signal }),
    [id],
  );

  if (orderQuery.isLoading) return <LoadingState variant="page" label="주문 정보 로딩 중…" />;
  if (orderQuery.error) {
    if (orderQuery.error.status === 401) { navigate('/admin/login'); return null; }
    return <ErrorState variant="page" title="주문을 불러올 수 없어요" actionLabel="다시 시도" onAction={orderQuery.refetch} />;
  }

  const order = orderQuery.data;
  const availableActions = ACTIONS.filter((a) => a.from.includes(order.status));

  const handleAction = async (action) => {
    setSubmitting(action.key);
    setActionError(null);
    try {
      await apiFetch(API.ADMIN_ORDER_TRANSITION(id), {
        method: 'POST',
        body: { action: action.key, to: action.to },
      });
      orderQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { navigate('/admin/login'); return; }
      setActionError(err instanceof ApiError ? err.message : '액션 실패');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section data-testid="admin-order-detail-page" className="flex flex-col gap-md p-md">
      <header className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">주문 #{order.no}</h1>
        <StatusChip status={order.status} />
      </header>

      <section aria-labelledby="items-title" className="bg-elevated rounded-md p-md flex flex-col gap-sm">
        <h2 id="items-title" className="font-display font-bold text-base">주문 항목</h2>
        <ul className="flex flex-col gap-2xs">
          {order.items?.map((item, idx) => (
            <li key={idx} className="flex justify-between font-mono tabular-nums">
              <span>{item.name} × {item.quantity}</span>
              <PriceTag value={item.base_price * item.quantity} size="sm" />
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-divider pt-sm font-display font-bold">
          <span>합계</span>
          <PriceTag value={order.total_price} />
        </div>
      </section>

      <OrderTimeline
        current={order.status}
        history={{
          ORDERED: order.created_at,
          TRANSFER_REPORTED: order.transferred_at,
          PAID: order.paid_at,
          COOKING: order.cooking_at,
          READY: order.ready_at,
          DONE: order.done_at,
        }}
        showMiniview
      />

      {actionError && <p role="alert" className="text-danger text-sm">{actionError}</p>}

      <div className="grid grid-cols-2 gap-sm" data-testid="action-buttons">
        {availableActions.map((action) => (
          <Button
            key={action.key}
            variant={action.key === 'cancel' || action.key === 'hold' ? 'danger' : 'primary'}
            size="md"
            loading={submitting === action.key}
            disabled={submitting !== null}
            onClick={() => handleAction(action)}
            data-testid={`action-${action.key}`}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
