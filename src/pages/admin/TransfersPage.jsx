// A-4 이체 확인 페이지 — TRANSFER_REPORTED 상태 주문 목록.
// 카드 클릭 → /admin/orders/:id 로 이동해 OrderDetailPage 에서 6 액션 처리.
//
// 페이지 testid 는 모든 분기(loading/error/empty/list) 공통 래핑 — App.test.jsx 회귀.
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';

import StatusChip from '../../components/molecules/StatusChip.jsx';
import PriceTag from '../../components/molecules/PriceTag.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';

const TransferListSchema = z.array(z.object({
  id: z.number(),
  no: z.number(),
  depositor_name: z.string().nullable(),
  bank: z.string().nullable(),
  amount: z.number(),
  transferred_at: z.string().nullable(),
  status: z.string(),
}));

function Wrapper({ children }) {
  return <section data-testid="admin-transfers-page" className="flex flex-col gap-md">{children}</section>;
}

export default function TransfersPage() {
  const navigate = useNavigate();
  const query = useApi(
    ({ signal }) => apiFetch(API.ADMIN_TRANSFERS, { schema: TransferListSchema, signal }),
    [],
  );

  if (query.isLoading) return <Wrapper><LoadingState variant="page" label="이체 목록 로딩 중…" /></Wrapper>;
  if (query.error) {
    if (query.error.status === 401) { navigate('/admin/login'); return null; }
    return (
      <Wrapper>
        <ErrorState
          variant="page"
          title="이체 목록을 불러올 수 없어요"
          actionLabel="다시 시도"
          onAction={query.refetch}
        />
      </Wrapper>
    );
  }

  // array 가 아닌 경우(스키마 mock 우회 등)도 안전하게 empty 로 처리.
  const list = Array.isArray(query.data) ? query.data : [];
  if (list.length === 0) {
    return (
      <Wrapper>
        <EmptyState
          variant="page"
          title="확인 대기 중인 이체가 없어요"
          description="새 이체가 들어오면 자동으로 표시됩니다."
          mascot="default"
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="p-md flex flex-col gap-md">
        <h1 className="font-display font-black text-2xl">이체 확인 ({list.length}건)</h1>
        <ul className="flex flex-col gap-sm">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => navigate(`/admin/orders/${t.id}`)}
                className="w-full text-left bg-card-bg text-card-ink rounded-md p-md shadow-card hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
                data-testid={`transfer-row-${t.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-base">#{t.no}</span>
                  <StatusChip status={t.status} size="sm" showIcon={false} />
                </div>
                <div className="flex justify-between text-sm mt-2xs">
                  <span>{t.depositor_name ?? '(이름 없음)'}</span>
                  <PriceTag value={t.amount} size="sm" />
                </div>
                <div className="text-xs text-card-muted mt-2xs">
                  {t.bank ?? '은행 정보 없음'} · {t.transferred_at ?? ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Wrapper>
  );
}
