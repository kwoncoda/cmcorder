// A-5 메뉴 관리 (IMPLEMENTATION_PLAN §5.4).
//
// 핵심 결정:
//  - 8 메뉴 카드 + 품절·추천 토글 (낙관적 업데이트 — 클릭 즉시 UI 반영).
//  - API 실패 시 롤백 + 인라인 에러 메시지 (UX-1: 토스트 X).
//  - 401 → /admin/login (effect — render 중 navigate 금지).
//  - 페이지 ≤120줄 — 외부 인프라 (useApi/apiFetch/atoms) 위임.
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

// 모든 분기에 admin-menu-page testid 유지 — App.test 라우팅 회귀.
function Wrapper({ children }) {
  return <section data-testid="admin-menu-page" className="flex flex-col gap-md p-md">{children}</section>;
}

export default function MenuAdminPage() {
  const navigate = useNavigate();
  const query = useApi(
    ({ signal }) => apiFetch('/admin/api/menus', { schema: MenuListSchema, signal }),
    [],
  );
  const [optimistic, setOptimistic] = useState({}); // { [id]: { soldOut?, recommended? } }
  const [actionError, setActionError] = useState(null);

  // 401 → 로그인 (render 중 navigate 금지).
  useEffect(() => {
    if (query.error?.status === 401) navigate('/admin/login');
  }, [query.error, navigate]);

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
      // 롤백 — 해당 id 의 낙관 키를 제거.
      setOptimistic((o) => {
        const next = { ...o };
        delete next[id];
        return next;
      });
      setActionError(err instanceof ApiError ? err.message : '갱신에 실패했어요.');
    }
  };

  return (
    <Wrapper>
      <h1 className="font-display font-black text-2xl">🍽️ 메뉴 관리</h1>
      {actionError && (
        <p role="alert" className="text-danger text-sm" data-testid="action-error">{actionError}</p>
      )}
      <ul className="flex flex-col gap-sm">
        {menus.map((m) => (
          <li key={m.id} data-testid={`menu-row-${m.id}`} className="bg-card-bg text-card-ink rounded-md p-md flex flex-col gap-sm shadow-card">
            <div className="flex items-center justify-between gap-sm">
              <span className="font-display font-bold text-base">{m.name}</span>
              <PriceTag value={m.basePrice} className="text-card-ink" />
            </div>
            <div className="flex gap-sm flex-wrap">
              <Button
                size="sm"
                variant={m.soldOut ? 'danger' : 'secondary'}
                onClick={() => togglePatch(m.id, { soldOut: !m.soldOut })}
                data-testid={`toggle-soldout-${m.id}`}
              >
                {m.soldOut ? '품절됨 (해제)' : '품절 토글'}
              </Button>
              <Button
                size="sm"
                variant={m.recommended ? 'primary' : 'secondary'}
                onClick={() => togglePatch(m.id, { recommended: !m.recommended })}
                data-testid={`toggle-recommended-${m.id}`}
              >
                {m.recommended ? '추천중 (해제)' : '사장님 추천'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Wrapper>
  );
}
