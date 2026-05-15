// A-5 메뉴 관리 — Task 5.4 + P1-4 (Codex 리뷰) (§3.5 1조 ≤120줄).
//  - 메뉴 카드 + 품절·추천 토글 + 가격 편집 (P1-4 추가).
//  - API 실패 시 롤백 + 인라인 에러 (UX-1 토스트 X). 401 → /admin/login.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { MenuListSchema } from '../../api/schemas.js';

import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';
import Button from '../../components/atoms/Button.jsx';
import PriceTag from '../../components/molecules/PriceTag.jsx';

function Wrapper({ children }) {
  return <section data-testid="admin-menu-page" className="flex flex-col gap-md p-md">{children}</section>;
}

export default function MenuAdminPage() {
  const navigate = useNavigate();
  const query = useApi(
    ({ signal }) => apiFetch('/admin/api/menus', { schema: MenuListSchema, signal }),
    [],
  );
  const [optimistic, setOptimistic] = useState({});
  const [actionError, setActionError] = useState(null);
  // P1-4: 편집 중인 메뉴 id + 입력값. id=null이면 편집 모드 X.
  const [editing, setEditing] = useState({ id: null, value: '' });

  useEffect(() => { if (query.error?.status === 401) navigate('/admin/login'); }, [query.error, navigate]);

  if (query.isLoading) return <Wrapper><LoadingState variant="page" label="메뉴 로딩 중…" minimumDelay={0} /></Wrapper>;
  if (query.error) {
    if (query.error.status === 401) return null;
    return <Wrapper><ErrorState variant="page" title="메뉴 목록을 불러올 수 없어요" actionLabel="다시 시도" onAction={query.refetch} /></Wrapper>;
  }

  const baseMenus = Array.isArray(query.data) ? query.data : [];
  if (baseMenus.length === 0) {
    return <Wrapper><EmptyState variant="page" title="메뉴가 없어요" description="시드 스크립트 실행 후 다시 확인해 주세요." /></Wrapper>;
  }
  const menus = baseMenus.map((m) => ({ ...m, ...(optimistic[m.id] ?? {}) }));

  const togglePatch = async (id, patch) => {
    setActionError(null);
    setOptimistic((o) => ({ ...o, [id]: { ...(o[id] ?? {}), ...patch } }));
    try {
      await apiFetch(API.ADMIN_MENU_TOGGLE(id), { method: 'POST', body: patch });
    } catch (err) {
      setOptimistic((o) => { const n = { ...o }; delete n[id]; return n; });
      setActionError(err instanceof ApiError ? err.message : '갱신에 실패했어요.');
    }
  };

  const savePrice = async (id) => {
    const v = Number(editing.value);
    if (!Number.isInteger(v) || v <= 0) {
      setActionError('가격은 양의 정수여야 합니다.');
      return;
    }
    setEditing({ id: null, value: '' });
    await togglePatch(id, { base_price: v });
    setOptimistic((o) => ({ ...o, [id]: { ...(o[id] ?? {}), basePrice: v } }));
  };

  return (
    <Wrapper>
      <h1 className="font-display font-black text-2xl">🍽️ 메뉴 관리</h1>
      {actionError && (<p role="alert" className="text-danger text-sm" data-testid="action-error">{actionError}</p>)}
      <ul className="flex flex-col gap-sm">
        {menus.map((m) => (
          <li key={m.id} data-testid={`menu-row-${m.id}`} className="bg-card-bg text-card-ink rounded-md p-md flex flex-col gap-sm shadow-card">
            <div className="flex items-center justify-between gap-sm">
              <span className="font-display font-bold text-base">{m.name}</span>
              {editing.id === m.id ? (
                <div className="flex items-center gap-xs">
                  <input data-testid={`price-input-${m.id}`} inputMode="numeric" value={editing.value}
                    onChange={(e) => setEditing({ id: m.id, value: e.target.value.replace(/\D/g, '') })}
                    className="bg-bg text-ink p-xs rounded-md border border-divider font-mono tabular-nums w-24" />
                  <Button size="sm" variant="primary" data-testid={`save-price-${m.id}`} onClick={() => savePrice(m.id)}>저장</Button>
                  <Button size="sm" variant="ghost" data-testid={`cancel-price-${m.id}`} onClick={() => setEditing({ id: null, value: '' })}>취소</Button>
                </div>
              ) : (
                <div className="flex items-center gap-xs">
                  <PriceTag value={m.basePrice} className="text-card-ink" />
                  <Button size="sm" variant="ghost" data-testid={`edit-price-${m.id}`}
                    onClick={() => setEditing({ id: m.id, value: String(m.basePrice) })}>가격 편집</Button>
                </div>
              )}
            </div>
            <div className="flex gap-sm flex-wrap">
              <Button size="sm" variant={m.soldOut ? 'danger' : 'secondary'} onClick={() => togglePatch(m.id, { soldOut: !m.soldOut })} data-testid={`toggle-soldout-${m.id}`}>
                {m.soldOut ? '품절됨 (해제)' : '품절 토글'}
              </Button>
              <Button size="sm" variant={m.recommended ? 'primary' : 'secondary'} onClick={() => togglePatch(m.id, { recommended: !m.recommended })} data-testid={`toggle-recommended-${m.id}`}>
                {m.recommended ? '🔥 BEST 표시중 (해제)' : '🔥 BEST 표시'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Wrapper>
  );
}
