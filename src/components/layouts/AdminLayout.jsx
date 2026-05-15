// AdminLayout — Task P1-4 (Codex v3 2026-05-15).
//
// F-A-004 명세: 본부/메뉴/정산/쿠폰/시스템 nav.
// 운영 범위 (ADR-029 메뉴 CRUD 축소 + F-A-036~039 쿠폰 P1):
//   - 본부 (`/admin/dashboard`)
//   - 메뉴 (`/admin/menus`)
//   - 정산 (`/admin/settlement`)
//   - 이체확인 (`/admin/transfers`)
//   - 쿠폰/시스템은 Phase 2 (`docs/CODEX_REVIEW_FIX_SUMMARY.md` v3)
//
// /admin/login 진입 시 nav 미렌더 — 인증 전 화면.
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const ITEMS = [
  { to: '/admin/dashboard', label: '본부', testid: 'admin-nav-dashboard' },
  { to: '/admin/menus', label: '메뉴', testid: 'admin-nav-menus' },
  { to: '/admin/settlement', label: '정산', testid: 'admin-nav-settlement' },
  { to: '/admin/transfers', label: '이체확인', testid: 'admin-nav-transfers' },
];

export default function AdminLayout() {
  const location = useLocation();
  const showNav = !location.pathname.startsWith('/admin/login');

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      {showNav && (
        <nav
          data-testid="admin-nav"
          aria-label="관리자 메뉴"
          className="flex items-center gap-md p-md bg-elevated border-b border-divider"
        >
          <Link to="/admin/dashboard" className="font-display font-bold text-lg mr-md">
            🍗 본부
          </Link>
          <ul className="flex items-center gap-sm">
            {ITEMS.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  data-testid={it.testid}
                  className={({ isActive }) =>
                    [
                      'px-sm py-2xs rounded-md text-sm',
                      isActive ? 'bg-accent text-ink font-bold' : 'text-muted hover:bg-divider',
                    ].join(' ')
                  }
                >
                  {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
