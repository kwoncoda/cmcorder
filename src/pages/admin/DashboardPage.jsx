// A-2 본부 대시보드 — design-bundle .admin-board 6-col Kanban + .start-cta.urgent 정합.
// 기능: useApi sync + 5초 폴링 + 1분 tick + ? help + 401 navigate.
// find_error_v3 (2026-05-18): 어드민 이모지 제거 + CLOSED 시 카드 내부 inline 장사 시작 + 6컬럼 동시 표시.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { BusinessStateSchema } from '../../api/schemas.js';
import useBusinessStateStore, { businessStateSelectors } from '../../store/businessState.js';
import AdminCardColumn from '../../components/organisms/AdminCardColumn.jsx';
import BusinessStateBadge from '../../components/organisms/BusinessStateBadge.jsx';
import StartBusinessCTA from '../../components/organisms/StartBusinessCTA.jsx';
import KeyboardHelpModal from '../../components/organisms/KeyboardHelpModal.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import { ADMIN_COLUMNS, groupOrdersByStatus } from '../../constants/admin-columns.js';

const POLL_INTERVAL_MS = 5_000;
const TICK_INTERVAL_MS = 60_000;

export default function DashboardPage() {
  const navigate = useNavigate();
  const status = useBusinessStateStore((s) => s.status);
  const setStatus = useBusinessStateStore((s) => s.setStatus);
  const syncFromServer = useBusinessStateStore((s) => s.syncFromServer);
  const shouldBeOpen = useBusinessStateStore(businessStateSelectors.shouldBeOpen);

  const [tick, setTick] = useState(() => Date.now());
  const [startError, setStartError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [actionPending, setActionPending] = useState(null); const [actionError, setActionError] = useState(null); // P1-2 inline action 진행/실패 상태

  useEffect(() => { const id = setInterval(() => setTick(Date.now()), TICK_INTERVAL_MS); return () => clearInterval(id); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '?') return;
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      setShowHelp((s) => !s);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const businessQuery = useApi(({ signal }) => apiFetch(API.ADMIN_BUSINESS_STATE, { schema: BusinessStateSchema, signal }), []);
  useEffect(() => { if (businessQuery.data?.status) syncFromServer(businessQuery.data); }, [businessQuery.data, syncFromServer]);

  const ordersQuery = useApi(({ signal }) => apiFetch(API.ADMIN_ORDERS, { signal }), []);
  const { refetch } = ordersQuery;
  useEffect(() => {
    if (status !== 'OPEN') return undefined;
    const id = setInterval(() => refetch(), POLL_INTERVAL_MS); return () => clearInterval(id);
  }, [status, refetch]);

  useEffect(() => { if (ordersQuery.error?.status === 401) navigate('/admin/login'); }, [ordersQuery.error, navigate]);

  const handleStartBusiness = async () => {
    setStarting(true); setStartError(null);
    try { await apiFetch(API.ADMIN_BUSINESS_OPEN, { method: 'POST', body: {} }); setStatus('OPEN'); refetch(); }
    catch (err) { setStartError(err instanceof ApiError ? err.message : '장사 시작에 실패했어요.'); }
    finally { setStarting(false); }
  };

  const handleAction = async (orderId, to) => {
    if (actionPending !== null) return;
    setActionPending(orderId); setActionError(null);
    try { await apiFetch(API.ADMIN_ORDER_TRANSITION(orderId), { method: 'POST', body: { to } }); refetch(); }
    catch (err) { if (err instanceof ApiError && err.status === 401) { navigate('/admin/login'); return; } setActionError(err instanceof ApiError ? err.message : '상태 변경에 실패했어요.'); }
    finally { setActionPending(null); }
  };

  const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : []; const byColumn = groupOrdersByStatus(orders);
  const board = (<div className="admin-board" data-testid="kanban-board">{ADMIN_COLUMNS.map((col) => (
    <AdminCardColumn key={col.status} title={col.title} status={col.status} orders={byColumn[col.status]}
      tick={tick} pendingOrderId={actionPending} onAction={handleAction} />))}</div>);

  if (status !== 'OPEN') {
    return (
      <section data-testid="admin-dashboard-page" className="admin-page">
        <div className={`start-cta ${shouldBeOpen ? 'urgent' : ''}`}>
          <div className="cta-mascot"><div className="mascot mascot-sm" /></div>
          <div className="left">
            <div className="cta-eyebrow">CLOSED · 사용자 주문 차단 중</div>
            <h2>장사 시작</h2><p>버튼을 누르면 사용자 주문이 즉시 활성화됩니다.</p>
          </div>
          <StartBusinessCTA status={status} shouldBeOpen={shouldBeOpen} loading={starting} error={startError} onStart={handleStartBusiness} />
          <BusinessStateBadge status={status} shouldBeOpen={shouldBeOpen} />
        </div>
        {board}
        <KeyboardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      </section>
    );
  }

  if (ordersQuery.isLoading) return <LoadingState variant="page" label="주문 목록 로딩 중…" minimumDelay={0} />;
  if (ordersQuery.error) { if (ordersQuery.error.status === 401) return null;
    return <ErrorState variant="page" title="주문을 불러올 수 없어요" actionLabel="다시 시도" onAction={refetch} />; }

  return (
    <section data-testid="admin-dashboard-page" className="admin-page">
      <div className="open-status">
        <div className="open-dot"><span className="pulse" /></div>
        <div className="open-text"><b>영업 중</b> · 사용자 주문 가능</div>
        <span className="open-hint">영업 종료는 <b>정산 탭 → 오늘 정산 마감</b></span>
      </div>
      <header className="admin-page-head">
        <h1>본부 대시보드</h1>
        <div style={{ marginLeft: 'auto' }}><BusinessStateBadge status={status} shouldBeOpen /></div>
      </header>
      {actionError && (<div role="alert" data-testid="admin-action-error" className="warn-banner danger" style={{ margin: '8px 0' }}>{actionError}</div>)}
      {board}
      <KeyboardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </section>
  );
}
