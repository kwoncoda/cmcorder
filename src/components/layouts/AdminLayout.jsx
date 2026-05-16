// AdminLayout — design-bundle .admin-shell + .admin-topnav (screens-admin.jsx:48-76) 정합.
// 5종 nav: 본부 / 메뉴 / 내역 / 정산 / 쿠폰 + biz-badge + admin1 + 로그아웃.
// 내역(history)·쿠폰(coupons)은 시안에 명시된 P1 Phase 2 라벨 — 라우트 미구현 시 disabled.
// 기존 /admin/transfers 라우트는 보존 (이체확인 보조 화면 — main nav 에서 제거하되 라우팅은 유지).
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { apiFetch, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { useApi } from '../../hooks/useApi.js';
import { BusinessStateSchema } from '../../api/schemas.js';
import useBusinessStateStore from '../../store/businessState.js';

// design-bundle 5종 nav + 기존 /admin/transfers 보존.
// 내역/쿠폰은 P1 Phase 2 — 라우트 미구현이라 disabled placeholder.
const ITEMS = [
  { to: '/admin/dashboard',  label: '본부',     testid: 'admin-nav-dashboard' },
  { to: '/admin/menus',      label: '메뉴',     testid: 'admin-nav-menus' },
  { to: '/admin/history',    label: '내역',     testid: 'admin-nav-history',    disabled: true },
  { to: '/admin/settlement', label: '정산',     testid: 'admin-nav-settlement' },
  { to: '/admin/transfers',  label: '이체확인', testid: 'admin-nav-transfers' },
  { to: '/admin/coupons',    label: '쿠폰',     testid: 'admin-nav-coupons',    disabled: true },
];

function formatNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const showNav = !location.pathname.startsWith('/admin/login');
  const status = useBusinessStateStore((s) => s.status);
  const syncFromServer = useBusinessStateStore((s) => s.syncFromServer);

  // biz-badge 표시용 sync (DashboardPage 와 별개 1회).
  const businessQuery = useApi(({ signal }) => showNav ? apiFetch(API.ADMIN_BUSINESS_STATE, { schema: BusinessStateSchema, signal }) : Promise.resolve(null), [showNav]);
  useEffect(() => { if (businessQuery.data?.status) syncFromServer(businessQuery.data); }, [businessQuery.data, syncFromServer]);

  const handleLogout = async () => {
    try { await apiFetch(API.ADMIN_LOGOUT, { method: 'POST', body: {} }); }
    catch (err) { if (!(err instanceof ApiError)) throw err; /* 무시 - 어차피 로그인 화면 이동 */ }
    finally { navigate('/admin/login'); }
  };

  return (
    <div className="admin-shell">
      {showNav && (
        <nav className="admin-topnav" data-testid="admin-nav" aria-label="관리자 메뉴">
          <Link to="/admin/dashboard" className="logo" style={{ textDecoration: 'none' }}>치킨이닭 · 본부</Link>
          <div className="nav">
            {ITEMS.map((it) => (
              it.disabled ? (
                <span key={it.to} className="nav-link" data-testid={it.testid} aria-disabled="true"
                  title="Phase 2 구현 예정" style={{ opacity: 0.4, cursor: 'not-allowed' }}>{it.label}</span>
              ) : (
                <NavLink key={it.to} to={it.to} data-testid={it.testid}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{it.label}</NavLink>
              )
            ))}
          </div>
          <div className="right">
            <span className={`biz-badge ${status === 'OPEN' ? 'open' : 'closed'}`} aria-live="polite" data-testid="admin-biz-badge">
              <span aria-hidden="true">{status === 'OPEN' ? '🟢' : '🔴'}</span>{status === 'OPEN' ? 'OPEN' : 'CLOSED'}
            </span>
            <span>{formatNow()}</span>
            <span>admin1</span>
            <button type="button" className="nav-link" data-testid="admin-logout-btn" onClick={handleLogout}
              style={{ color: 'var(--color-muted)', cursor: 'pointer' }}>로그아웃</button>
          </div>
        </nav>
      )}
      <main className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
