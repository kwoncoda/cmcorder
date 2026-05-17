// A-6/A-7 정산 + ZIP — Task 5.5 + P1-3 + P1-5 (Codex v3) (§3.5 1조 ≤120줄).
//  - 요약 + 통장 합계/차이 + 쿠폰 + 일자별/합산 + 마감 + ZIP. P1-5: 5/20 / 5/21 / 합산.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import useBusinessStateStore from '../../store/businessState.js';
import { DATE_OPTIONS, settlementUrl, fetchAggregateSettlement } from './settlement-aggregate.js';
import Button from '../../components/atoms/Button.jsx';
import PriceTag from '../../components/molecules/PriceTag.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

const SettlementSchema = z.object({
  operating_date: z.string(), total_orders: z.number(), total_amount: z.number(),
  in_progress_count: z.number(), is_closed: z.boolean().optional(),
  coupon_count: z.number().optional(), coupon_discount_total: z.number().optional(),
});

function Wrapper({ children }) {
  return <section data-testid="admin-settlement-page" className="flex flex-col gap-md p-md">{children}</section>;
}

export default function SettlementPage() {
  const navigate = useNavigate();
  const operatingDate = useBusinessStateStore((s) => s.operating_date);
  const setStatus = useBusinessStateStore((s) => s.setStatus);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(null);
  const [bankTotalInput, setBankTotalInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(operatingDate);

  const query = useApi(
    ({ signal }) =>
      selectedDate === 'all'
        ? fetchAggregateSettlement(signal)
        : apiFetch(settlementUrl(selectedDate), { schema: SettlementSchema, signal }),
    [selectedDate],
  );
  useEffect(() => { if (query.error?.status === 401) navigate('/admin/login'); }, [query.error, navigate]);

  if (query.isLoading) return <Wrapper><LoadingState variant="page" label="정산 로딩 중…" minimumDelay={0} /></Wrapper>;
  if (query.error) {
    if (query.error.status === 401) return null;
    return <Wrapper><ErrorState variant="page" title="정산 정보를 불러올 수 없어요" actionLabel="다시 시도" onAction={query.refetch} /></Wrapper>;
  }

  const settlement = query.data;
  const isAggregate = selectedDate === 'all';
  const canClose = !isAggregate && settlement.in_progress_count === 0 && !settlement.is_closed;
  const couponCount = settlement.coupon_count ?? 0;
  const couponDiscountTotal = settlement.coupon_discount_total ?? 0;
  const bankTotal = bankTotalInput ? Number(bankTotalInput.replace(/\D/g, '')) : null;
  const diff = bankTotal !== null && Number.isFinite(bankTotal) ? settlement.total_amount - bankTotal : null;
  const summaryTestid = isAggregate ? 'settlement-aggregate-summary' : 'settlement-summary';
  const headerLabel = isAggregate ? '합산 (5/20 + 5/21)' : settlement.operating_date;

  const handleClose = async () => {
    if (!canClose) return;
    setClosing(true); setCloseError(null);
    try {
      await apiFetch(API.ADMIN_SETTLEMENT_CLOSE, { method: 'POST', body: {} });
      setStatus('CLOSED'); query.refetch();
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : '마감에 실패했어요.');
    } finally { setClosing(false); }
  };

  const handleDownloadZip = () => window.open(API.ADMIN_SETTLEMENT_ZIP, '_blank');

  return (
    <Wrapper>
      <div className="flex items-center justify-between gap-sm">
        <h1 className="font-display font-black text-2xl">정산 — {headerLabel}</h1>
        <select aria-label="정산 일자 선택" data-testid="settlement-date-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-bg text-ink p-sm rounded-md border border-divider">
          {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="bg-elevated rounded-md p-md flex flex-col gap-sm" data-testid={summaryTestid}>
        <div className="flex justify-between"><span className="text-muted">총 주문 수</span><span className="font-mono tabular-nums font-bold">{settlement.total_orders}건</span></div>
        <div className="flex justify-between"><span className="text-muted">총 매출</span><PriceTag value={settlement.total_amount} className="font-bold" /></div>
        <div className="flex justify-between"><span className="text-muted">진행 중 주문</span><span className="font-mono tabular-nums">{settlement.in_progress_count}건</span></div>
        <div className="flex justify-between" data-testid="coupon-summary">
          <span className="text-muted">쿠폰</span>
          <span className="font-mono tabular-nums">{couponCount}건 · -{couponDiscountTotal.toLocaleString('ko-KR')}원</span>
        </div>
      </div>

      <div className="bg-elevated rounded-md p-md flex flex-col gap-sm" data-testid="bank-section">
        <label htmlFor="bank-total" className="text-sm text-muted">통장 입금 합계 (수동 입력)</label>
        <input id="bank-total" data-testid="bank-total-input" inputMode="numeric" placeholder="예: 700000"
          value={bankTotalInput} onChange={(e) => setBankTotalInput(e.target.value.replace(/\D/g, ''))}
          className="bg-bg text-ink p-sm rounded-md border border-divider font-mono tabular-nums" />
        {diff !== null && (
          <div className="flex justify-between" data-testid="bank-diff">
            <span className="text-muted">매출 − 통장 = 차이</span>
            <span className={`font-mono tabular-nums font-bold ${diff === 0 ? 'text-ink' : 'text-warning'}`}>
              {diff > 0 ? '+' : ''}{diff.toLocaleString('ko-KR')}원
            </span>
          </div>
        )}
      </div>

      {!isAggregate && settlement.in_progress_count > 0 && !settlement.is_closed && (
        <p role="alert" className="text-warning text-sm" data-testid="close-guard">진행 중 주문 {settlement.in_progress_count}건이 있어 마감할 수 없어요 (ADR-012).</p>
      )}
      {closeError && <p role="alert" className="text-danger text-sm" data-testid="close-error">{closeError}</p>}

      <div className="flex flex-col gap-sm">
        <Button variant="danger" size="lg" block loading={closing} disabled={!canClose} onClick={handleClose} data-testid="close-settlement-btn">
          {isAggregate ? '(합산 보기 — 마감은 일자 선택 후)' : settlement.is_closed ? '마감 완료' : '오늘 정산 마감'}
        </Button>
        <Button variant="secondary" size="md" onClick={handleDownloadZip} data-testid="download-zip-btn">ZIP 다운로드</Button>
      </div>
    </Wrapper>
  );
}
