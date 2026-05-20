// adjustment 라운드 Subagent 4 — 정산 페이지 3-box 그리드 리디자인 (§3.5 8조 ≤120줄).
//  - 좌상 SettlementSummaryCard · 우상 SettlementBackupCard · 하단 SettlementMenuSalesCard(wide).
//  - 두 useApi (settlement summary + menu-sales). 합산 모드는 settlement-aggregate 헬퍼.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import useBusinessStateStore from '../../store/businessState.js';
import { DATE_OPTIONS, settlementUrl, fetchAggregateSettlement, fetchAggregateMenuSales } from './settlement-aggregate.js';
import Button from '../../components/atoms/Button.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import SettlementSummaryCard from '../../components/organisms/admin/SettlementSummaryCard.jsx';
import SettlementBackupCard from '../../components/organisms/admin/SettlementBackupCard.jsx';
import SettlementMenuSalesCard from '../../components/organisms/admin/SettlementMenuSalesCard.jsx';

const SettlementSchema = z.object({
  operating_date: z.string(), total_orders: z.number(), total_amount: z.number(),
  in_progress_count: z.number(), is_closed: z.boolean().optional(),
  coupon_count: z.number().optional(), coupon_discount_total: z.number().optional(),
});

const Wrapper = ({ children }) => (
  <section data-testid="admin-settlement-page" className="flex flex-col gap-md p-md">{children}</section>
);

export default function SettlementPage() {
  const navigate = useNavigate();
  const operatingDate = useBusinessStateStore((s) => s.operating_date);
  const setStatus = useBusinessStateStore((s) => s.setStatus);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(null);
  const [bankTotalInput, setBankTotalInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(operatingDate);

  const query = useApi(
    ({ signal }) => selectedDate === 'all'
      ? fetchAggregateSettlement(signal)
      : apiFetch(settlementUrl(selectedDate), { schema: SettlementSchema, signal }),
    [selectedDate],
  );
  const menuQuery = useApi(
    ({ signal }) => selectedDate === 'all'
      ? fetchAggregateMenuSales(signal)
      : apiFetch(`${API.ADMIN_SETTLEMENT_MENU_SALES}?date=${encodeURIComponent(selectedDate)}`, { signal }),
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

  const handleDownloadZip = () => {
    if (isAggregate) return;
    const bank = bankTotalInput || '';
    window.open(`${API.ADMIN_SETTLEMENT_ZIP}?date=${encodeURIComponent(selectedDate)}&bank=${encodeURIComponent(bank)}`, '_blank');
  };

  return (
    <Wrapper>
      <div className="flex items-center justify-between gap-sm">
        <h1 className="font-display font-black text-2xl">정산 — {headerLabel}</h1>
        <select aria-label="정산 일자 선택" data-testid="settlement-date-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-bg text-ink p-sm rounded-md border border-divider">
          {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {!isAggregate && settlement.in_progress_count > 0 && !settlement.is_closed && (
        <p role="alert" className="text-warning text-sm" data-testid="close-guard">진행 중 주문 {settlement.in_progress_count}건이 있어 마감할 수 없어요.</p>
      )}
      {closeError && <p role="alert" className="text-danger text-sm" data-testid="close-error">{closeError}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <SettlementSummaryCard summary={settlement} isAggregate={isAggregate} bankTotalInput={bankTotalInput} onBankTotalChange={setBankTotalInput} />
        <SettlementBackupCard canDownloadManual={!isAggregate} onManualDownload={handleDownloadZip} />
        <SettlementMenuSalesCard menuSales={Array.isArray(menuQuery.data) ? menuQuery.data : []} />
      </div>
      <Button variant="danger" size="lg" block loading={closing} disabled={!canClose} onClick={handleClose} data-testid="close-settlement-btn">
        {isAggregate ? '(합산 보기 — 마감은 일자 선택 후)' : settlement.is_closed ? '마감 완료' : '오늘 정산 마감'}
      </Button>
    </Wrapper>
  );
}
