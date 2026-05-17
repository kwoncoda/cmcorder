// A-8 쿠폰 — find_error_v2 (2026-05-18) 쿠폰 사용 내역.
// GET /admin/api/coupons/usage → 사용 시각 / 주문 / 이름 / 학번 / 쿠폰명 / 할인 금액.
// 단순 list view (필터·검색 없음 — scope 최소화).
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';

const CouponUsageListSchema = z.array(
  z.object({
    id: z.number(), order_id: z.number(), order_no: z.number(),
    name: z.string(), student_id: z.string(),
    coupon_name: z.string(), discount_amount: z.number(), used_at: z.string(),
  }),
);

function Wrap({ children }) {
  return <section data-testid="admin-coupons-page" className="admin-page">{children}</section>;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const HEAD_STYLE = { fontSize: 13, color: 'var(--color-muted)' };

export default function CouponsPage() {
  const navigate = useNavigate();
  const query = useApi(
    ({ signal }) =>
      apiFetch(API.ADMIN_COUPONS_USAGE, { schema: CouponUsageListSchema, signal }),
    [],
  );

  if (query.isLoading) {
    return <Wrap><LoadingState variant="page" label="쿠폰 내역 로딩 중…" minimumDelay={0} /></Wrap>;
  }
  if (query.error) {
    if (query.error.status === 401) { navigate('/admin/login'); return null; }
    return (
      <Wrap>
        <ErrorState variant="page" title="쿠폰 내역을 불러올 수 없어요"
          actionLabel="다시 시도" onAction={query.refetch} />
      </Wrap>
    );
  }

  const list = Array.isArray(query.data) ? query.data : [];
  const totalDiscount = list.reduce((s, r) => s + (r.discount_amount ?? 0), 0);

  if (list.length === 0) {
    return (
      <Wrap>
        <div className="admin-page-head"><h1>🎫 쿠폰</h1></div>
        <EmptyState variant="page" title="사용된 쿠폰이 없어요"
          description="쿠폰이 사용되면 자동으로 표시됩니다." mascot="default" />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div className="admin-page-head"><h1>🎫 쿠폰 ({list.length}건)</h1></div>
      <div className="admin-info-bar">
        <span>📊 사용 <b>{list.length}건</b> · 총 할인 <b>{totalDiscount.toLocaleString('ko-KR')}원</b></span>
      </div>
      <div className="settle-grid">
        <div className="settle-card wide">
          <div className="coupon-usage-row" data-testid="coupon-usage-head">
            <span className="mono" style={HEAD_STYLE}>시각</span>
            <span className="mono" style={HEAD_STYLE}>학번</span>
            <span className="cu-cell-name-coupon" style={HEAD_STYLE}>이름 · 쿠폰</span>
            <span className="cu-cell-order" style={{ ...HEAD_STYLE, textAlign: 'right' }}>주문</span>
            <span className="cu-cell-discount" style={{ ...HEAD_STYLE, textAlign: 'right' }}>할인</span>
          </div>
          {list.map((r) => (
            <div key={r.id} className="coupon-usage-row" data-testid={`coupon-row-${r.id}`}
              style={{ borderTop: '1px dashed var(--color-divider)' }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtTime(r.used_at)}</span>
              <span className="mono" style={{ fontSize: 13 }}>{r.student_id}</span>
              <span className="cu-cell-name-coupon" style={{ fontSize: 13 }}>{r.name} · {r.coupon_name}</span>
              <span className="cu-cell-order mono" style={{ fontSize: 13, color: 'var(--color-accent)', textAlign: 'right' }}>#{r.order_no}</span>
              <span className="cu-cell-discount mono" style={{ fontSize: 13, textAlign: 'right' }}>-{r.discount_amount.toLocaleString('ko-KR')}원</span>
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}
