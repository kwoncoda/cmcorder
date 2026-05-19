// Subagent 4 — 어드민 테이블 잠금 페이지 (/admin/tables).
// 1~15 카드 그리드. 카드당 상태 배지 + 잠금/해제 단일 버튼 (Q4: 사유 입력 없음).
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { z } from 'zod';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

const TableStatusSchema = z.object({
  table_no: z.number(),
  status: z.enum(['available', 'occupied', 'dining', 'locked']),
  order_no: z.number().optional(),
  dining_at: z.string().nullable().optional(),
  locked_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
const TablesViewSchema = z.array(TableStatusSchema).length(15);

const STATUS_LABEL = {
  available: '사용 가능',
  locked: '잠김',
};
function badgeLabel(t) {
  if (t.status === 'occupied') return `이용 중 (#${t.order_no})`;
  if (t.status === 'dining')   return `식사 중 (#${t.order_no})`;
  return STATUS_LABEL[t.status] ?? t.status;
}

function Wrap({ children }) {
  return <section data-testid="admin-tables-page" className="admin-page">{children}</section>;
}

function TableCard({ table, pending, onToggle }) {
  const isLocked = table.status === 'locked';
  const action = isLocked ? 'unlock' : 'lock';
  return (
    <div className="table-lock-card" data-testid={`table-card-${table.table_no}`}>
      <span className="table-lock-no">#{table.table_no}</span>
      <span className={`table-lock-badge ${table.status}`}>{badgeLabel(table)}</span>
      <button type="button" style={{ width: '100%', fontSize: 12 }}
        className={isLocked ? 'btn btn-outline' : 'btn btn-danger-outline'}
        disabled={pending} aria-busy={pending}
        data-testid={`table-${table.table_no}-${action}`}
        onClick={() => onToggle(table.table_no, action)}>
        {isLocked ? '잠금 해제' : '잠금'}
      </button>
    </div>
  );
}

export default function TablesPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [hint, setHint] = useState(null);
  const query = useApi(
    ({ signal }) => apiFetch(API.ADMIN_TABLES, { schema: TablesViewSchema, signal }),
    [],
  );

  if (query.isLoading)
    return <Wrap><LoadingState variant="page" label="테이블 정보 로딩 중…" minimumDelay={0} /></Wrap>;
  if (query.error) {
    if (query.error.status === 401) { navigate('/admin/login'); return null; }
    return <Wrap><ErrorState variant="page" title="테이블 정보를 불러올 수 없어요"
      actionLabel="다시 시도" onAction={query.refetch} /></Wrap>;
  }

  const tables = Array.isArray(query.data) ? query.data : [];

  const handleToggle = async (table_no, action) => {
    if (pending !== null) return;
    setPending(table_no);
    setHint(null);
    try {
      const url = action === 'lock' ? API.ADMIN_TABLE_LOCK(table_no) : API.ADMIN_TABLE_UNLOCK(table_no);
      await apiFetch(url, { method: 'POST', body: {} });
      query.refetch();
      if (action === 'unlock') {
        const fresh = await apiFetch(API.ADMIN_TABLES, { schema: TablesViewSchema });
        const row = fresh.find((r) => r.table_no === table_no);
        if (row && (row.status === 'occupied' || row.status === 'dining')) {
          setHint('수동 잠금만 해제됐어요. 진행 중 주문 때문에 아직 사용할 수 없습니다.');
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/admin/login');
      else setHint('테이블 상태 변경에 실패했어요.');
    } finally {
      setPending(null);
    }
  };

  return (
    <Wrap>
      <div className="admin-page-head">
        <h1>테이블 잠금</h1>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>
          잠금 해제는 수동 잠금만 해제합니다. 진행 중 주문은 그대로 유지됩니다.
        </p>
      </div>
      {hint && (
        <div role="status" data-testid="tables-hint"
          style={{ padding: '10px 14px', background: 'rgba(249,115,22,0.10)',
            borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--color-warning, #d97706)' }}>
          {hint}
        </div>
      )}
      <div className="tables-grid" data-testid="tables-grid">
        {tables.map((t) => (
          <TableCard key={t.table_no} table={t} pending={pending === t.table_no} onToggle={handleToggle} />
        ))}
      </div>
    </Wrap>
  );
}
