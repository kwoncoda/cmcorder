// A-7 내역 — find_error_v2 (2026-05-18) 주문 상태 변경 감사 로그.
// GET /admin/api/history → time + order# + action + from→to + actor.
// 단순 list view (CSV/filter/search 없음 — scope 최소화).
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';

const HistoryListSchema = z.array(
  z.object({
    id: z.number(),
    order_id: z.number(),
    order_no: z.number(),
    event_type: z.string(),
    from_status: z.string().nullable(),
    to_status: z.string().nullable(),
    action_name: z.string(),
    actor: z.string(),
    note: z.string().nullable(),
    created_at: z.string(),
  }),
);

function Wrap({ children }) {
  return (
    <section data-testid="admin-history-page" className="admin-page">
      {children}
    </section>
  );
}

// ISO 8601 Z → HH:MM:SS (브라우저 local time). Bug 7 정합.
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const query = useApi(
    ({ signal }) => apiFetch(API.ADMIN_HISTORY, { schema: HistoryListSchema, signal }),
    [],
  );

  if (query.isLoading) {
    return (
      <Wrap>
        <LoadingState variant="page" label="내역 로딩 중…" minimumDelay={0} />
      </Wrap>
    );
  }
  if (query.error) {
    if (query.error.status === 401) { navigate('/admin/login'); return null; }
    return (
      <Wrap>
        <ErrorState
          variant="page"
          title="내역을 불러올 수 없어요"
          actionLabel="다시 시도"
          onAction={query.refetch}
        />
      </Wrap>
    );
  }

  const list = Array.isArray(query.data) ? query.data : [];
  if (list.length === 0) {
    return (
      <Wrap>
        <div className="admin-page-head"><h1>📜 내역</h1></div>
        <EmptyState
          variant="page"
          title="해당 조건의 내역이 없어요"
          description="주문이 생기면 자동으로 표시됩니다."
          mascot="default"
        />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div className="admin-page-head"><h1>📜 내역 ({list.length}건)</h1></div>
      <div className="admin-info-bar">
        <span>📜 주문 상태 변경 이력 (최신 순).</span>
      </div>
      <div className="log-feed" data-testid="history-feed">
        {list.map((l) => (
          <div key={l.id} className="log-row" data-testid={`history-row-${l.id}`}>
            <div className="log-time">{fmtTime(l.created_at)}</div>
            <div className="log-icon" aria-hidden="true">•</div>
            <div className="log-body">
              <div className="log-line">
                <span className="log-action">{l.action_name}</span>
                <span className="log-order">#{l.order_no}</span>
                {l.from_status != null && l.to_status != null && (
                  <span className="log-transition">
                    <code>{l.from_status ?? '—'}</code> → <code>{l.to_status ?? '—'}</code>
                  </span>
                )}
              </div>
              {l.note && <div className="log-sub">{l.note}</div>}
            </div>
            <div className="log-actor">{l.actor}</div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}
