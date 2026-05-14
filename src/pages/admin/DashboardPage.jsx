// A-2 본부 대시보드 (IMPLEMENTATION_PLAN §5.2 / G13 / SCREEN §3.7 / 결정 D). 페이지 ≤120줄 (§3.5 1조).
// CLOSED: Badge + StartCTA. OPEN: 헤더 + 6컬럼 Kanban + 5초 폴링 + 1분 tick + ? 단축키 + 401 navigate.
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
import EmptyState from '../../components/state/EmptyState.jsx';
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

  // 1분 tick — elapsed_minutes 재계산용 (AdminCardColumn 내부 useMemo deps).
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ? 키 → 단축키 안내 토글 (결정 D). input/textarea 포커스 시 무시.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '?') return;
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      setShowHelp((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // I-2: 마운트 시 서버 영업 상태 sync — 새로고침 후 store 기본값 CLOSED 보정.
  const businessQuery = useApi(({ signal }) => apiFetch(API.ADMIN_BUSINESS_STATE, { schema: BusinessStateSchema, signal }), []);
  useEffect(() => { if (businessQuery.data?.status) syncFromServer(businessQuery.data); }, [businessQuery.data, syncFromServer]);

  // 5초 폴링 — OPEN 상태에서만.
  const ordersQuery = useApi(({ signal }) => apiFetch(API.ADMIN_ORDERS, { signal }), []);
  const { refetch } = ordersQuery;
  useEffect(() => {
    if (status !== 'OPEN') return undefined;
    const id = setInterval(() => refetch(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, refetch]);

  // 401 → 로그인으로 이동 (render 중 navigate 금지 → effect).
  useEffect(() => { if (ordersQuery.error?.status === 401) navigate('/admin/login'); }, [ordersQuery.error, navigate]);

  const handleStartBusiness = async () => {
    setStarting(true);
    setStartError(null);
    try {
      await apiFetch(API.ADMIN_BUSINESS_OPEN, { method: 'POST', body: {} });
      setStatus('OPEN');
      refetch();
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : '장사 시작에 실패했어요.');
    } finally {
      setStarting(false);
    }
  };

  // CLOSED — Kanban 숨김 + 큰 형광 옐로 CTA.
  if (status !== 'OPEN') {
    return (
      <section data-testid="admin-dashboard-page" className="min-h-screen flex flex-col items-center justify-center gap-md p-lg bg-bg">
        <BusinessStateBadge status={status} shouldBeOpen={shouldBeOpen} />
        <StartBusinessCTA status={status} shouldBeOpen={shouldBeOpen} loading={starting} error={startError} onStart={handleStartBusiness} />
        <KeyboardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      </section>
    );
  }

  // OPEN — 3 분기 (Loading / Error / Empty) + Kanban.
  if (ordersQuery.isLoading) return <LoadingState variant="page" label="주문 목록 로딩 중…" minimumDelay={0} />;
  if (ordersQuery.error) {
    if (ordersQuery.error.status === 401) return null; // navigate 진행 중.
    return <ErrorState variant="page" title="주문을 불러올 수 없어요" actionLabel="다시 시도" onAction={refetch} />;
  }
  const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : [];
  const byColumn = groupOrdersByStatus(orders);

  return (
    <section data-testid="admin-dashboard-page" className="flex flex-col gap-md p-md">
      <header className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">📋 본부 대시보드</h1>
        <BusinessStateBadge status={status} shouldBeOpen />
      </header>
      {orders.length === 0 ? (
        <EmptyState variant="card" title="오늘 첫 주문 대기 중" description="주문이 들어오면 여기에 표시됩니다." />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-md" data-testid="kanban-board">
          {ADMIN_COLUMNS.map((col) => (
            <AdminCardColumn key={col.status} title={col.title} status={col.status} orders={byColumn[col.status]} tick={tick} onSelectOrder={(id) => navigate(`/admin/orders/${id}`)} />
          ))}
        </div>
      )}
      <KeyboardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </section>
  );
}
