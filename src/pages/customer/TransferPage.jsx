// C-5 이체 신고 — design-bundle ScreenTransfer 정합 (.back-bar + .section + sticky-bar).
// 기능 로직 유지: useApi + apiFetch + BusinessClosedError 위임 + token query.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, BusinessClosedError, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { useApi } from '../../hooks/useApi.js';
import { OrderSchema } from '../../api/schemas.js';
import { useOrderToken } from '../../hooks/useOrderToken.js';
import TransferReportForm from '../../components/organisms/TransferReportForm.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

const fmt = (n) => n.toLocaleString('ko-KR');

export default function TransferPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, query: tokenQuery, withQuery } = useOrderToken(id);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const orderQuery = useApi(
    ({ signal }) => apiFetch(withQuery(API.ORDER(id)), { schema: OrderSchema, signal }),
    [id, token],
  );

  if (orderQuery.isLoading) {
    return <LoadingState variant="page" label="주문 정보 가져오는 중…" minimumDelay={0} />;
  }
  if (orderQuery.error) {
    return (
      <ErrorState variant="page" title="주문을 찾을 수 없어요"
        description="잠시 후 다시 시도해 주세요."
        actionLabel="다시 시도" onAction={orderQuery.refetch} />
    );
  }

  const handleSubmit = async (formData) => {
    setSubmitting(true); setServerError(null);
    try {
      await apiFetch(withQuery(API.ORDER_TRANSFER_REPORT(id)), { method: 'POST', body: formData });
      navigate(`/orders/${id}/status${tokenQuery}`);
    } catch (err) {
      if (err instanceof BusinessClosedError) throw err;
      // find_error_v2 — 이미 신고된 주문이면 status 페이지로 이동 (서버에 이미 접수된 상태).
      // P2-1 (Codex 리뷰): status 페이지에 1회성 flash 안내를 location.state로 전달해 사용자에게 명확히 노출.
      if (err instanceof ApiError && err.code === 'TRANSFER_ALREADY_REPORTED') {
        navigate(`/orders/${id}/status${tokenQuery}`, {
          state: { flash: 'TRANSFER_ALREADY_REPORTED', message: err.message },
        });
        return;
      }
      setServerError(err instanceof ApiError ? err.message : '이체 완료 요청에 실패했어요.');
    } finally { setSubmitting(false); }
  };

  const order = orderQuery.data;
  const total = order?.total_price ?? 0;

  return (
    <section data-testid="transfer-page">
      <div className="back-bar">
        <button type="button" onClick={() => navigate(`/orders/${id}/complete${tokenQuery}`)} aria-label="뒤로">←</button>
        <h1>💸 이체 확인 요청</h1>
        <span className="meta">#{order?.no ?? id}</span>
      </div>

      <div className="section">
        <div className="section-label">결제 정보 확인</div>
        <div className="receipt" style={{ margin: 0, background: 'transparent', border: 'none', padding: 0 }}>
          <div className="line">
            <span className="label">주문번호</span>
            <span className="price" style={{ color: 'var(--color-accent)' }}>#{order?.no ?? id}</span>
          </div>
          {order?.depositor_name && (
            <div className="line"><span className="label">주문자</span><span>{order.depositor_name}</span></div>
          )}
          <div className="line total">
            <span className="label">결제 금액</span>
            <span className="price price-lg" style={{ color: 'var(--color-accent)' }}>{fmt(total)}원</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-label">이체 완료 요청</div>
        <TransferReportForm
          orderId={Number(id)}
          expectedAmount={total}
          loading={submitting}
          error={serverError}
          onSubmit={handleSubmit}
          formId="transfer-report-form"
          hideSubmit
        />
      </div>

      <div style={{ height: 96 }} />
      <div className="sticky-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40 }}>
        <button type="submit" form="transfer-report-form" className="btn btn-primary btn-lg btn-block"
          disabled={submitting}>
          {submitting ? '전송 중…' : '이체 완료 요청'}
        </button>
      </div>
    </section>
  );
}
