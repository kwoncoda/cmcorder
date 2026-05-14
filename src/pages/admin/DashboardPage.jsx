// A-2 본부 대시보드 (IMPLEMENTATION_PLAN §5.2 / G13 / SCREEN §3.7).
//
// CLOSED 시: BusinessStateBadge + StartBusinessCTA (Kanban 숨김).
// OPEN 시 : 헤더 + 6 컬럼 Kanban + 5초 폴링 + 1분 tick.
//
// 핵심 결정 (§3.5 1·6·7조 / Task 2.7):
//  - 페이지 ≤120줄 — 표시 로직은 Organism(AdminCardColumn)에 위임.
//  - tick state 1분 발행 → AdminCardColumn 에 prop 전달 → OrderCard useMemo deps.
//  - 5초 폴링 — useApi.refetch — OPEN 상태에서만 등록 (CLOSED 시 setInterval X).
//  - 401 → /admin/login navigate.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import useBusinessStateStore, { businessStateSelectors } from '../../store/businessState.js';
import AdminCardColumn from '../../components/organisms/AdminCardColumn.jsx';
import BusinessStateBadge from '../../components/organisms/BusinessStateBadge.jsx';
import StartBusinessCTA from '../../components/organisms/StartBusinessCTA.jsx';
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
  const shouldBeOpen = useBusinessStateStore(businessStateSelectors.shouldBeOpen);

  const [tick, setTick] = useState(() => Date.now());
  const [startError, setStartError] = useState(null);
  const [starting, setStarting] = useState(false);

  // 1분 tick — elapsed_minutes 재계산용 (AdminCardColumn 내부 useMemo deps).
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 5초 폴링 — OPEN 상태에서만.
  const ordersQuery = useApi(({ signal }) => apiFetch(API.ADMIN_ORDERS, { signal }), []);
  const { refetch } = ordersQuery;
  useEffect(() => {
    if (status !== 'OPEN') return undefined;
    const id = setInterval(() => refetch(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, refetch]);

  // 401 → 로그인으로 이동 (render 중 navigate 금지 → effect).
  useEffect(() => {
    if (ordersQuery.error?.status === 401) navigate('/admin/login');
  }, [ordersQuery.error, navigate]);

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
    </section>
  );
}
