// C-5 이체 신고 페이지 — Task 4.6.
// 은행 입력 폼 + 제출 → /orders/:id/status redirect.
//
// 설계 (§3.5 1조 — 페이지 ≤120줄):
//  - TransferReportForm organism 합성 (Phase 2.7).
//  - useApi 로 주문 fetch — expectedAmount 자동 prefill.
//  - 3분기 처리: Loading / Error / Form 렌더.
//  - BusinessClosedError는 throw → CustomerLayout useGlobalErrorHandler 위임 (G13).
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, BusinessClosedError, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { useApi } from '../../hooks/useApi.js';
import { OrderSchema } from '../../api/schemas.js';
import TransferReportForm from '../../components/organisms/TransferReportForm.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

export default function TransferPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const orderQuery = useApi(
    ({ signal }) => apiFetch(API.ORDER(id), { schema: OrderSchema, signal }),
    [id],
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
    setSubmitting(true);
    setServerError(null);
    try {
      await apiFetch(API.ORDER_TRANSFER_REPORT(id), {
        method: 'POST',
        body: formData,
      });
      navigate(`/orders/${id}/status`);
    } catch (err) {
      if (err instanceof BusinessClosedError) throw err; // useGlobalErrorHandler 위임
      setServerError(err instanceof ApiError ? err.message : '이체 신고에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section data-testid="transfer-page" className="flex flex-col gap-md p-md">
      <h1 className="font-display font-black text-2xl">이체 신고</h1>
      <p className="text-sm text-muted">이체하신 정보를 정확하게 입력해 주세요.</p>
      <TransferReportForm
        orderId={Number(id)}
        expectedAmount={orderQuery.data?.total_price ?? 0}
        loading={submitting}
        error={serverError}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
