// Task 0.3 — 라우팅 셸 회귀 테스트.
// - 사용자 9 라우트(C-1~C-9) + 관리자 6 라우트(A-1~A-7) + 404 catch-all + ErrorBoundary.
// - MemoryRouter 로 initialEntries 지정해 각 경로 진입 시 placeholder 가 렌더되는지 확인.
// - 관리자 페이지는 React.lazy 라 Suspense fallback 을 거치므로 waitFor 로 비동기 대기.
// - Task 4.5/4.6 이후: CompletePage/TransferPage 는 useParams.id 기반 fetch 를 수행하므로
//   apiFetch 를 mock (SAMPLE_ORDER 반환) 해야 진입 testid 가 노출된다.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// apiFetch mock — fetch 의존 페이지(CompletePage/TransferPage)가 정상 분기로 진입하도록.
vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual('../api/client.js');
  return {
    ...actual,
    apiFetch: vi.fn(async () => ({
      id: 17,
      no: 17,
      operating_date: '2026-05-20',
      status: 'ORDERED',
      items: [],
      total_price: 18000,
    })),
  };
});

import { AppRoutes, PageLoading } from '../App.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

// MemoryRouter 로 BrowserRouter 를 대체해 라우팅을 격리 테스트한다.
// AppRoutes 는 라우터를 포함하지 않으므로 테스트에서 자유롭게 감쌀 수 있다.
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('App 라우팅 — 사용자 페이지 (정적 import)', () => {
  it.each([
    ['/', 'menu-page'], // 루트 → /menu 리다이렉트 후 MenuPage 렌더
    ['/menu', 'menu-page'],
    ['/cart', 'cart-page'],
    ['/checkout', 'checkout-page'],
    ['/orders/17/complete', 'complete-page'],
    ['/orders/17/transfer', 'transfer-page'],
    ['/orders/17/status', 'status-page'],
    ['/map', 'map-page'],
    ['/closed', 'closed-page'],
  ])('%s 진입 시 testid=%s 렌더', async (path, testid) => {
    renderAt(path);
    await waitFor(() => {
      expect(screen.getByTestId(testid)).toBeInTheDocument();
    });
  });

  it('알 수 없는 경로(/nonexistent)는 404 ErrorPage 를 렌더', async () => {
    renderAt('/nonexistent');
    await waitFor(() => {
      expect(screen.getByTestId('error-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('error-page')).toHaveTextContent('404');
  });
});

describe('App 라우팅 — 관리자 페이지 (React.lazy 코드 스플릿)', () => {
  it.each([
    ['/admin/login', 'admin-login-page'],
    ['/admin/dashboard', 'admin-dashboard-page'],
    ['/admin/orders/17', 'admin-order-detail-page'],
    ['/admin/transfers', 'admin-transfers-page'],
    // P1-4 (Codex v3): /admin/menu → /admin/menus (plural — 문서 SCREEN §3 정합)
    ['/admin/menus', 'admin-menu-page'],
    ['/admin/settlement', 'admin-settlement-page'],
    // find_error_v2 — 내역/쿠폰 lazy 라우트 복원.
    ['/admin/history', 'admin-history-page'],
    ['/admin/coupons', 'admin-coupons-page'],
  ])('%s lazy 로드 완료 후 testid=%s 렌더', async (path, testid) => {
    renderAt(path);
    await waitFor(() => {
      expect(screen.getByTestId(testid)).toBeInTheDocument();
    });
  });
});

// ── P1-4 (Codex v3) 관리자 nav ─────────────────────────────────
// find_error_v3 (2026-05-18) — '이체확인' nav 제거 (라우트·페이지·API 는 보존).
describe('App 라우팅 — 관리자 공통 nav (P1-4 F-A-004)', () => {
  it.each(['/admin/dashboard', '/admin/menus', '/admin/settlement', '/admin/transfers'])(
    '%s 진입 시 관리자 nav가 본부/메뉴/내역/정산/쿠폰 5개 링크를 렌더',
    async (path) => {
      renderAt(path);
      const nav = await screen.findByTestId('admin-nav');
      expect(nav).toBeInTheDocument();
      // 5개 링크 (find_error_v3 — 이체확인 nav 제거)
      expect(screen.getByTestId('admin-nav-dashboard')).toHaveAttribute('href', '/admin/dashboard');
      expect(screen.getByTestId('admin-nav-menus')).toHaveAttribute('href', '/admin/menus');
      expect(screen.getByTestId('admin-nav-history')).toHaveAttribute('href', '/admin/history');
      expect(screen.getByTestId('admin-nav-settlement')).toHaveAttribute('href', '/admin/settlement');
      expect(screen.getByTestId('admin-nav-coupons')).toHaveAttribute('href', '/admin/coupons');
      // 이체확인 nav 항목은 제거됨 — 라우트·페이지·API 는 보존되어 직접 접근은 가능.
      expect(screen.queryByTestId('admin-nav-transfers')).toBeNull();
    },
  );

  it('/admin/login은 nav 미렌더 (인증 전)', async () => {
    renderAt('/admin/login');
    await screen.findByTestId('admin-login-page');
    expect(screen.queryByTestId('admin-nav')).toBeNull();
  });
});

describe('Suspense fallback — PageLoading 컴포넌트', () => {
  // 실제 App 의 lazy chunk 는 jsdom/Vite test 환경에서 dynamic import 가
  // 동기적으로 resolve 되는 경향이 있어, render 직후 fallback 캡쳐가 불안정하다.
  // 따라서 (a) PageLoading 컴포넌트 자체와
  //       (b) 영구 pending lazy 를 Suspense fallback 로 감쌀 때 PageLoading 이 노출되는지
  // 두 가지로 검증한다.
  it('PageLoading 은 로딩 중… 텍스트와 page-loading testid 를 갖는다', () => {
    render(<PageLoading />);
    const el = screen.getByTestId('page-loading');
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('로딩 중…');
    expect(el).toHaveAttribute('role', 'status');
  });

  it('Suspense 내부 lazy 가 pending 이면 PageLoading 이 fallback 으로 표시된다', async () => {
    const { lazy: lazyOf, Suspense: SuspenseOf } = await import('react');
    // 절대 resolve 되지 않는 promise — Suspense 가 fallback 을 계속 유지하게 만든다.
    const NeverReady = lazyOf(() => new Promise(() => {}));
    render(
      <SuspenseOf fallback={<PageLoading />}>
        <NeverReady />
      </SuspenseOf>,
    );
    expect(screen.getByTestId('page-loading')).toBeInTheDocument();
  });
});

describe('ErrorBoundary — 자식이 throw 하면 fallback 렌더', () => {
  function Bomb() {
    throw new Error('의도된 오류');
  }

  it('함수형 fallback 에 error 를 전달한다', () => {
    // ErrorBoundary 내부 componentDidCatch 가 console.error 를 호출하므로,
    // 테스트 출력 노이즈를 막기 위해 spy 로 잡아둔다.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary
        fallback={({ error }) => (
          <div data-testid="boundary-fallback">{error.message}</div>
        )}
      >
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('boundary-fallback')).toHaveTextContent(
      '의도된 오류',
    );
    spy.mockRestore();
  });
});
