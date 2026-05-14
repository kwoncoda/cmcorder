// A-6/A-7 정산 + ZIP (IMPLEMENTATION_PLAN §5.5).
//
// 핵심 결정:
//  - 정산 요약 + "오늘 정산 마감" 버튼 + ZIP 다운로드 (수동).
//  - ADR-012: in_progress_count > 0 시 마감 차단 (UI · 백엔드 양쪽 가드).
//  - G13: 마감 성공 시 businessState 'CLOSED' 전이 — 사용자 측 423 단일 reactive 진입점.
//  - 401 → /admin/login (effect — render 중 navigate 금지).
//  - 페이지 ≤120줄.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import useBusinessStateStore from '../../store/businessState.js';

import Button from '../../components/atoms/Button.jsx';
import PriceTag from '../../components/molecules/PriceTag.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

// 서버 응답 스키마 — 추가 필드는 옵션 처리 (방어).
const SettlementSchema = z.object({
  operating_date: z.string(),
  total_orders: z.number(),
  total_amount: z.number(),
  in_progress_count: z.number(),
  is_closed: z.boolean().optional(),
});

// 모든 분기에 admin-settlement-page testid 유지 — App.test 라우팅 회귀.
function Wrapper({ children }) {
  return <section data-testid="admin-settlement-page" className="flex flex-col gap-md p-md">{children}</section>;
}

export default function SettlementPage() {
  const navigate = useNavigate();
  const setStatus = useBusinessStateStore((s) => s.setStatus);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(null);

  const query = useApi(
    ({ signal }) => apiFetch('/admin/api/settlement', { schema: SettlementSchema, signal }),
    [],
  );

  // 401 → 로그인.
  useEffect(() => {
    if (query.error?.status === 401) navigate('/admin/login');
  }, [query.error, navigate]);

  if (query.isLoading) return <Wrapper><LoadingState variant="page" label="정산 로딩 중…" minimumDelay={0} /></Wrapper>;
  if (query.error) {
    if (query.error.status === 401) return null;
    return <Wrapper><ErrorState variant="page" title="정산 정보를 불러올 수 없어요" actionLabel="다시 시도" onAction={query.refetch} /></Wrapper>;
  }

  const settlement = query.data;
  const canClose = settlement.in_progress_count === 0 && !settlement.is_closed;

  const handleClose = async () => {
    if (!canClose) return;
    setClosing(true);
    setCloseError(null);
    try {
      await apiFetch(API.ADMIN_SETTLEMENT_CLOSE, { method: 'POST', body: {} });
      setStatus('CLOSED');
      query.refetch();
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : '마감에 실패했어요.');
    } finally {
      setClosing(false);
    }
  };

  const handleDownloadZip = () => {
    // 새 탭 GET — 브라우저가 Content-Disposition 헤더로 자동 다운로드.
    window.open(API.ADMIN_SETTLEMENT_ZIP, '_blank');
  };

  return (
    <Wrapper>
      <h1 className="font-display font-black text-2xl">📊 정산 — {settlement.operating_date}</h1>
      <div className="bg-elevated rounded-md p-md flex flex-col gap-sm" data-testid="settlement-summary">
        <div className="flex justify-between">
          <span className="text-muted">총 주문 수</span>
          <span className="font-mono tabular-nums font-bold">{settlement.total_orders}건</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">총 매출</span>
          <PriceTag value={settlement.total_amount} className="font-bold" />
        </div>
        <div className="flex justify-between">
          <span className="text-muted">진행 중 주문</span>
          <span className="font-mono tabular-nums">{settlement.in_progress_count}건</span>
        </div>
      </div>

      {settlement.in_progress_count > 0 && !settlement.is_closed && (
        <p role="alert" className="text-warning text-sm" data-testid="close-guard">⚠️ 진행 중 주문 {settlement.in_progress_count}건이 있어 마감할 수 없어요 (ADR-012).</p>
      )}
      {closeError && <p role="alert" className="text-danger text-sm" data-testid="close-error">{closeError}</p>}

      <div className="flex flex-col gap-sm">
        <Button variant="danger" size="lg" block loading={closing} disabled={!canClose} onClick={handleClose} data-testid="close-settlement-btn">
          {settlement.is_closed ? '✅ 마감 완료' : '🔒 오늘 정산 마감'}
        </Button>
        <Button variant="secondary" size="md" onClick={handleDownloadZip} data-testid="download-zip-btn">📦 ZIP 다운로드</Button>
      </div>
    </Wrapper>
  );
}
