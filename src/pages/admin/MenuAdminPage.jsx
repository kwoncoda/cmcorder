// A-5 메뉴 관리 — design-bundle .admin-table 7-col grid (screens-admin.jsx:330-487).
// 회귀 보존: testid menu-row/toggle-soldout/toggle-recommended/edit-price/save-price/cancel-price/price-input.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { MenuListSchema } from '../../api/schemas.js';
import { effectForCode } from '../../constants/menu-effects.js';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';

const fmt = (n) => (n ?? 0).toLocaleString('ko-KR');
const CAT_LABEL = { chicken: '치킨', side: '사이드', drink: '음료' };

function Wrap({ children }) { return <section data-testid="admin-menu-page" className="admin-page">{children}</section>; }

export default function MenuAdminPage() {
  const navigate = useNavigate();
  const query = useApi(({ signal }) => apiFetch('/admin/api/menus', { schema: MenuListSchema, signal }), []);
  const [optimistic, setOptimistic] = useState({});
  const [actionError, setActionError] = useState(null);
  const [editing, setEditing] = useState({ id: null, value: '' });

  useEffect(() => { if (query.error?.status === 401) navigate('/admin/login'); }, [query.error, navigate]);

  if (query.isLoading) return <Wrap><LoadingState variant="page" label="메뉴 로딩 중…" minimumDelay={0} /></Wrap>;
  if (query.error) {
    if (query.error.status === 401) return null;
    return <Wrap><ErrorState variant="page" title="메뉴 목록을 불러올 수 없어요" actionLabel="다시 시도" onAction={query.refetch} /></Wrap>;
  }
  const base = Array.isArray(query.data) ? query.data : [];
  if (base.length === 0) return <Wrap><EmptyState variant="page" title="메뉴가 없어요" description="시드 스크립트 실행 후 다시 확인해 주세요." /></Wrap>;

  const menus = base.map((m) => ({ ...m, ...(optimistic[m.id] ?? {}) }));
  const patch = async (id, p) => {
    setActionError(null); setOptimistic((o) => ({ ...o, [id]: { ...(o[id] ?? {}), ...p } }));
    try { await apiFetch(API.ADMIN_MENU_TOGGLE(id), { method: 'POST', body: p }); }
    catch (err) { setOptimistic((o) => { const n = { ...o }; delete n[id]; return n; });
      setActionError(err instanceof ApiError ? err.message : '갱신에 실패했어요.'); }
  };
  const save = async (m) => {
    const v = Number(editing.value);
    if (!Number.isInteger(v) || v <= 0) { setActionError('가격은 양의 정수여야 합니다.'); return; }
    setEditing({ id: null, value: '' });
    await patch(m.id, { base_price: v });
    setOptimistic((o) => ({ ...o, [m.id]: { ...(o[m.id] ?? {}), basePrice: v } }));
  };

  return (
    <Wrap>
      <div className="admin-page-head"><h1>메뉴 관리</h1></div>
      {actionError && <p role="alert" className="admin-info-bar warn" data-testid="action-error">{actionError}</p>}
      <div className="admin-info-bar">
        <span>가격을 클릭하면 직접 편집할 수 있어요.</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-muted)' }}>가격 변경은 사용자 화면에 <b style={{ color: 'var(--color-accent)' }}>즉시 반영</b>됩니다.</span>
      </div>
      <div className="admin-table">
        <div className="admin-table-head">
          <div>이미지·이름</div><div>코드</div><div>효과</div><div>분류</div>
          <div className="num">가격</div><div>품절</div><div>추천</div>
        </div>
        {menus.map((m) => (
          <div key={m.id} className={`admin-table-row ${m.soldOut ? 'sold' : ''}`} data-testid={`menu-row-${m.id}`}>
            <div className="cell-name">
              <div className="tbl-thumb">{m.image && <img src={m.image} alt={m.name} width="36" height="36" loading="lazy" />}</div>
              <div><div className="tbl-name">{m.name}</div><div className="tbl-id">{(m.code ?? '').toUpperCase()}</div></div>
            </div>
            <div><code className="ammo">{m.code ?? '-'}</code></div>
            <div className="muted">{effectForCode(m.code)}</div>
            <div className="muted">{CAT_LABEL[m.category] ?? m.category}</div>
            <div className="num">
              {editing.id === m.id ? (
                <div className="price-edit">
                  <input data-testid={`price-input-${m.id}`} className="input mono" autoFocus value={editing.value}
                    onChange={(e) => setEditing({ id: m.id, value: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(m); if (e.key === 'Escape') setEditing({ id: null, value: '' }); }}
                    inputMode="numeric" style={{ width: 90, height: 32, padding: '0 8px', textAlign: 'right' }} />
                  <button type="button" className="bump-btn bump-btn-save" data-testid={`save-price-${m.id}`} onClick={() => save(m)} aria-label="저장">✓</button>
                  <button type="button" className="bump-btn bump-btn-danger" data-testid={`cancel-price-${m.id}`} onClick={() => setEditing({ id: null, value: '' })} aria-label="취소">✕</button>
                </div>
              ) : (
                <button type="button" data-testid={`edit-price-${m.id}`} className="price-display"
                  onClick={() => setEditing({ id: m.id, value: String(m.basePrice) })}>{fmt(m.basePrice)}<span>원</span></button>
              )}
            </div>
            <div>
              <button type="button" data-testid={`toggle-soldout-${m.id}`}
                className={`pill-toggle ${m.soldOut ? 'on danger' : ''}`} aria-pressed={!!m.soldOut}
                onClick={() => patch(m.id, { soldOut: !m.soldOut })}>{m.soldOut ? '품절됨 (해제)' : '품절 토글'}</button>
            </div>
            <div>
              <button type="button" data-testid={`toggle-recommended-${m.id}`}
                className={`pill-toggle ${m.recommended ? 'on accent' : ''}`} aria-pressed={!!m.recommended}
                onClick={() => patch(m.id, { recommended: !m.recommended })}>{m.recommended ? 'BEST 표시중 (해제)' : 'BEST 표시'}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="admin-foot-tip">
        ※ <code>POST /admin/api/menus/:id</code> — Pattern B (ADR-020): 가격 계산은 서버 권위, 클라이언트는 표시만.
      </div>
    </Wrap>
  );
}
