// C-6 조리 현황 — design-bundle ScreenStatus (screens-customer.jsx:567-646).
// CustomerLayout 공통 헤더 사용 (P1 #1) — 자체 .app-header 제거.
// design-bundle 구조: stage-copy / ready-banner / mascot / dogtag sm / sticky StatusChip + HOLD CTA.
// 테스트 보호: STATE_LABEL 한글 카피, "실시간 연결이 끊어졌어요", "주문 #N", role=status aria-live.
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
import StatusChip from '../../components/molecules/StatusChip.jsx';
import MascotState from '../../components/molecules/MascotState.jsx';
import DogTagFrame from '../../components/molecules/DogTagFrame.jsx';

const STATE_LABEL = {
  ORDERED:           '주문 접수됨 — 입금 대기 중',
  TRANSFER_REPORTED: '이체 완료 요청 — 본부 확인 중',
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
  const { token, query: tokenQuery, withQuery } = useOrderToken(id);
  const [pulse, setPulse] = useState(false);

  const initialQuery = useApi(({ signal }) => apiFetch(withQuery(API.ORDER(id)), { schema: OrderSchema, signal }), [id, token]);
  const handleStatusChange = (prev, next) => {
    if (prev !== 'READY' && next === 'READY') {
      navigator.vibrate?.([200, 100, 200]); setPulse(true); setTimeout(() => setPulse(false), 4000);
    }
  };
  const stream = useOrderPolling({ orderId: id, authToken: token, onStatusChange: handleStatusChange, enabled: !!id });
  const is404 = initialQuery.error?.status === 404;
  useEffect(() => { if (is404) navigate('/error/404', { replace: true }); }, [is404, navigate]);

  if (initialQuery.isLoading) return <LoadingState variant="page" label="주문 정보 가져오는 중…" minimumDelay={0} />;
  if (initialQuery.error) {
    if (is404) return null;
    return <ErrorState variant="page" title="주문 정보를 불러올 수 없어요" description="잠시 후 다시 시도해 주세요." onAction={initialQuery.refetch} actionLabel="다시 시도" />;
  }
  const order = stream.snapshot ?? initialQuery.data;
  if (!order) return null;
  const currentStatus = order.status;
  const mascotState = currentStatus === 'COOKING' ? 'cooking' : currentStatus === 'READY' || currentStatus === 'DONE' ? 'arrive' : currentStatus === 'CANCELED' ? 'canceled' : 'default';
  const history = { ORDERED: order.created_at, TRANSFER_REPORTED: order.transferred_at, PAID: order.paid_at, COOKING: order.cooking_at, READY: order.ready_at, DONE: order.done_at };

  return (
    <section data-testid="status-page">
      <div className="back-bar">
        <button type="button" onClick={() => navigate('/menu')} aria-label="뒤로">←</button>
        <h1>주문 #{order.no ?? id}</h1>
        <span className="meta">LIVE</span>
      </div>
      {!stream.isConnected && (
        <div className="banner-top" role="alert" data-testid="sse-disconnected">⚠️ 실시간 연결이 끊어졌어요. 자동으로 다시 연결됩니다.</div>
      )}
      <OrderTimeline current={currentStatus} history={history} showMiniview />
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px' }}>
        <MascotState state={mascotState} size="md" useFallback={false} />
      </div>
      <div className={`stage-copy${pulse ? ' business-badge-blink' : ''}`} role="status" aria-live="polite">
        <div className="big">{STATE_LABEL[currentStatus] ?? '주문 상태 갱신 중…'}</div>
      </div>
      {currentStatus === 'READY' && (
        <div className="ready-banner" role="alert">
          <div className="big">✅ #{order.no ?? id}번<br />수령 가능해요!</div>
          <div className="sub">부스에서 호명을 들어주세요.<br />도그태그를 보여주세요.</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px 16px' }}>
        <DogTagFrame no={order.no ?? id} total={100} date={order.operating_date} size="sm"
          pulse={currentStatus === 'READY'} role="img" aria-label={`주문 번호 ${order.no ?? id} 도그태그`} />
      </div>
      {currentStatus === 'HOLD' && (
        <div className="warn-banner danger" role="alert"><span><b>이체 확인이 보류되었어요.</b><br />부스 운영진에게 문의해 주세요.</span></div>
      )}
      <div style={{ height: 132 }} />
      <div className="sticky-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', fontSize: 12, color: 'var(--color-muted)', padding: '0 4px' }}>
          <span>현재 상태</span><StatusChip status={currentStatus} />
        </div>
        {currentStatus === 'ORDERED' && (
          <button type="button" className="btn btn-primary btn-lg btn-block" data-testid="status-page-ordered-cta" onClick={() => navigate(`/orders/${id}/transfer${tokenQuery}`)}>
            이체 완료 요청
          </button>
        )}
        {/* P2-1: HOLD는 서버 정책상 사용자 재요청 차단 — CTA 제거. 위 warn-banner 안내로 처리. */}
      </div>
    </section>
  );
}
