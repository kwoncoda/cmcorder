// C-6 조리 현황 — Task 4.7 (§3.5 1조 ≤120줄, 폴링 + READY 진동·깜박).
//  - useApi 초기 snapshot · useOrderPolling 5초 fallback · onStatusChange 부수효과.
//  - P0-4: useOrderToken으로 ?token= 자동. aria-live · 3분기 Loading/Error/404 redirect.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useOrderPolling } from '../../hooks/useOrderPolling.js';
import { apiFetch } from '../../api/client.js';
import { OrderSchema } from '../../api/schemas.js';
import { API } from '../../api/routes.js';
import { useOrderToken } from '../../hooks/useOrderToken.js';
import OrderTimeline from '../../components/organisms/OrderTimeline.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import Button from '../../components/atoms/Button.jsx';
import StatusChip from '../../components/molecules/StatusChip.jsx';

// 8 상태 → 한글 안내 카피 (모듈 최상위, §3.5 6조).
const STATE_LABEL = {
  ORDERED:           '주문 접수됨 — 입금 대기 중',
  TRANSFER_REPORTED: '이체 신고 완료 — 본부 확인 대기',
  PAID:              '입금 확인 완료 — 조리 대기',
  COOKING:           '조리 중! 잠시만 기다려 주세요.',
  READY:             '🍗 픽업 준비 완료! 본부로 와 주세요!',
  DONE:              '수령 완료. 맛있게 드세요!',
  HOLD:              '운영진 확인 필요 — 본부로 문의해 주세요.',
  CANCELED:          '취소된 주문입니다.',
};

export default function StatusPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // P0-4: useOrderToken이 URL ↔ sessionStorage를 통합 — 외부인 ?token= 도 흡수.
  const { token, withQuery } = useOrderToken(id);
  const [pulse, setPulse] = useState(false);

  // 초기 snapshot — 새로고침 후 직진입 시에도 정상 표시.
  const initialQuery = useApi(
    ({ signal }) => apiFetch(withQuery(API.ORDER(id)), { schema: OrderSchema, signal }),
    [id, token],
  );

  // 폴링 이벤트 핸들러 — 진동·깜박 부수효과 (§3.5 5조).
  // useOrderPolling 자체가 prev=null 시 콜백 호출 X → 새로고침 후 READY 직진입 시 진동 X.
  const handleStatusChange = (prev, next) => {
    if (prev !== 'READY' && next === 'READY') {
      navigator.vibrate?.([200, 100, 200]);
      setPulse(true);
      setTimeout(() => setPulse(false), 4000);
    }
  };

  const stream = useOrderPolling({
    orderId: id,
    authToken: token,
    onStatusChange: handleStatusChange,
    enabled: !!id,
  });

  // 404 redirect — effect 안에서 (렌더 도중 호출 회피).
  const is404 = initialQuery.error?.status === 404;
  useEffect(() => { if (is404) navigate('/error/404', { replace: true }); }, [is404, navigate]);

  if (initialQuery.isLoading) {
    return <LoadingState variant="page" label="주문 정보 가져오는 중…" minimumDelay={0} />;
  }
  if (initialQuery.error) {
    if (is404) return null;
    return (
      <ErrorState variant="page" title="주문 정보를 불러올 수 없어요"
        description="잠시 후 다시 시도해 주세요."
        onAction={initialQuery.refetch} actionLabel="다시 시도" />
    );
  }

  // SSE snapshot 우선, 없으면 초기 query.
  const order = stream.snapshot ?? initialQuery.data;
  if (!order) return null;

  const currentStatus = order.status;
  const history = {
    ORDERED:           order.created_at,
    TRANSFER_REPORTED: order.transferred_at,
    PAID:              order.paid_at,
    COOKING:           order.cooking_at,
    READY:             order.ready_at,
    DONE:              order.done_at,
  };

  return (
    <section data-testid="status-page" className="flex flex-col gap-md p-md">
      <header className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">주문 #{order.no}</h1>
        <StatusChip status={currentStatus} />
      </header>
      <div role="status" aria-live="polite"
        className={`p-md rounded-md bg-elevated ${pulse ? 'border-2 border-accent business-badge-blink' : ''}`}>
        <p className="font-display font-bold text-base">
          {STATE_LABEL[currentStatus] ?? '주문 상태 갱신 중…'}
        </p>
      </div>
      <OrderTimeline current={currentStatus} history={history} showMiniview />
      {!stream.isConnected && (
        <p role="alert" className="text-warning text-xs text-center" data-testid="sse-disconnected">
          ⚠️ 실시간 연결이 끊어졌어요. 자동으로 다시 연결됩니다.
        </p>
      )}
      <Button variant="ghost" size="md" onClick={() => navigate('/map')} aria-label="부스 약도 열기">
        🗺️ 부스 약도
      </Button>
    </section>
  );
}
