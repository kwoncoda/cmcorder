// A-7 내역 — find_error_v3 (2026-05-18) 통합 감사 로그 (주문/메뉴/시스템 4탭).
// GET /admin/api/history?type=<filter> → action_name·actor + source 별 추가 필드.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { HistoryListSchema } from '../../api/schemas.js';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';
import { displayActor } from '../../utils/admin-display.js';

const TABS = [
  ['all', '전체'],
  ['orders', '주문'],
  ['menus', '메뉴'],
  ['system', '시스템'],
];

function Wrap({ children }) {
  return <section data-testid="admin-history-page" className="admin-page">{children}</section>;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function computeCounts(tab, list) {
  const c = { all: 0, orders: 0, menus: 0, system: 0 };
  if (tab === 'all') {
    c.all = list.length;
    for (const r of list) {
      if (r.category === 'order') c.orders += 1;
      else if (r.category === 'menu') c.menus += 1;
      else if (r.category === 'system') c.system += 1;
    }
  } else {
    c[tab] = list.length;
  }
  return c;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const query = useApi(
    ({ signal }) => apiFetch(`${API.ADMIN_HISTORY}?type=${tab}`, { schema: HistoryListSchema, signal }),
    [tab],
  );

  if (query.isLoading) {
    return <Wrap><LoadingState variant="page" label="내역 로딩 중…" minimumDelay={0} /></Wrap>;
  }
  if (query.error) {
    if (query.error.status === 401) { navigate('/admin/login'); return null; }
    return (
      <Wrap>
        <ErrorState variant="page" title="내역을 불러올 수 없어요"
          actionLabel="다시 시도" onAction={query.refetch} />
      </Wrap>
    );
  }

  const list = Array.isArray(query.data) ? query.data : [];
  const counts = computeCounts(tab, list);

  return (
    <Wrap>
      <div className="admin-page-head"><h1>내역 ({list.length}건)</h1></div>
      <div style={{ display: 'flex', gap: 6 }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button"
            data-testid={`history-tab-${k}`}
            className={'admin-tab ' + (tab === k ? 'active' : '')}
            onClick={() => setTab(k)}>
            {label} ({counts[k] ?? 0})
          </button>
        ))}
      </div>
      <div className="admin-info-bar">
        <span>전체·주문·메뉴·시스템 이벤트 (최신 순).</span>
      </div>
      {list.length === 0 ? (
        <EmptyState variant="page" title="해당 조건의 내역이 없어요"
          description="다른 탭을 선택하거나 잠시 후 다시 확인해 주세요." mascot="default" />
      ) : (
        <div className="log-feed" data-testid="history-feed">
          {list.map((l) => (
            <div key={l.id} className="log-row" data-testid={`history-row-${l.id}`}>
              <div className="log-time">{fmtTime(l.created_at)}</div>
              <div className="log-icon" aria-hidden="true">•</div>
              <div className="log-body">
                <div className="log-line">
                  <span className="log-action">{l.action_name}</span>
                  {l.order_no != null && <span className="log-order">#{l.order_no}</span>}
                  {l.target_name && <span className="log-menu">{l.target_name}</span>}
                  {l.from_status != null && l.to_status != null && (
                    <span className="log-transition"><code>{l.from_status}</code> → <code>{l.to_status}</code></span>
                  )}
                  {l.before_value != null && l.after_value != null && (
                    <span className="log-transition"><code>{l.before_value}</code> → <code>{l.after_value}</code></span>
                  )}
                </div>
                {l.note && <div className="log-sub">{l.note}</div>}
              </div>
              <div className="log-actor">{displayActor(l.actor)}</div>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
}
