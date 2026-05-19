// 라우팅 셸 (Task 0.3).
// - BrowserRouter + 14 라우트(사용자 9 + 관리자 6) + 404 catch-all.
// - 사용자 9 페이지: 즉시 진입이라 정적 import (메인 번들).
// - 관리자 6 페이지: 학생회 5명만 진입이라 React.lazy 로 코드 스플릿
//   (USER_FLOW §3.5 8조 — 번들 위생).
// - ErrorBoundary 가 렌더 단계 throw 를 잡아 ErrorPage(code=500) 로 대체.
// - Suspense fallback: Task 2.11 LoadingState 위임. PageLoading 은 testid 호환 유지 래퍼.
// - 라우터 비포함 형태 `AppRoutes` 를 별도 export → 테스트는 MemoryRouter 로 감싸 격리.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import MenuPage from './pages/customer/MenuPage.jsx';
import CartPage from './pages/customer/CartPage.jsx';
import CheckoutPage from './pages/customer/CheckoutPage.jsx';
import CompletePage from './pages/customer/CompletePage.jsx';
import TransferPage from './pages/customer/TransferPage.jsx';
import StatusPage from './pages/customer/StatusPage.jsx';
import MapPage from './pages/customer/MapPage.jsx';
import ClosedPage from './pages/customer/ClosedPage.jsx';
import ErrorPage from './pages/customer/ErrorPage.jsx';

import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoadingState from './components/state/LoadingState.jsx';
import CustomerLayout from './components/layouts/CustomerLayout.jsx';
import AdminLayout from './components/layouts/AdminLayout.jsx';

// 관리자 6 페이지 — React.lazy 로 별도 chunk 분리.
const AdminLoginPage = lazy(() => import('./pages/admin/LoginPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/admin/DashboardPage.jsx'));
const AdminOrderDetailPage = lazy(() =>
  import('./pages/admin/OrderDetailPage.jsx'),
);
const AdminTransfersPage = lazy(() => import('./pages/admin/TransfersPage.jsx'));
const AdminMenuPage = lazy(() => import('./pages/admin/MenuAdminPage.jsx'));
const AdminSettlementPage = lazy(() =>
  import('./pages/admin/SettlementPage.jsx'),
);
// find_error_v2 — 내역(history) + 쿠폰(coupons) 탭 복원.
const AdminHistoryPage = lazy(() => import('./pages/admin/HistoryPage.jsx'));
const AdminCouponsPage = lazy(() => import('./pages/admin/CouponsPage.jsx'));
// Subagent 4 — 테이블 잠금 페이지.
const AdminTablesPage = lazy(() => import('./pages/admin/TablesPage.jsx'));

// Suspense fallback — Task 2.11 LoadingState 위임 래퍼.
// minimumDelay=0 — Suspense fallback 은 시점이 명확하므로 깜박 회피 지연 불필요.
// data-testid="page-loading" — 기존 App.test.jsx 회귀 호환 (...rest 로 전달).
export function PageLoading() {
  return (
    <LoadingState
      variant="page"
      label="로딩 중…"
      minimumDelay={0}
      data-testid="page-loading"
    />
  );
}

// ErrorBoundary fallback — 함수형으로 error 를 받아 ErrorPage(code=500) 로 전달.
function PageError({ error }) {
  return <ErrorPage code={500} message={error?.message ?? '알 수 없는 오류'} />;
}

// 라우터 비포함 라우팅 트리. 테스트에서 MemoryRouter 로 감싸 격리 가능.
export function AppRoutes() {
  return (
    <ErrorBoundary fallback={PageError}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* 사용자 — 정적 import + CustomerLayout 래핑 (Task 4.1).
              헤더(로고+지도) 공통 + 423 reactive 가드 (/closed redirect). */}
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<Navigate to="/menu" replace />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders/:id/complete" element={<CompletePage />} />
            <Route path="/orders/:id/transfer" element={<TransferPage />} />
            <Route path="/orders/:id/status" element={<StatusPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/closed" element={<ClosedPage />} />
          </Route>

          {/* 관리자 — React.lazy 코드 스플릿 + AdminLayout 공통 nav (P1-4 Codex v3).
              login은 nav 미렌더 (인증 전 — AdminLayout 내부에서 분기). */}
          <Route element={<AdminLayout />}>
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
            <Route path="/admin/transfers" element={<AdminTransfersPage />} />
            {/* P1-4: /admin/menu → /admin/menus (plural — 문서 SCREEN §3 정합) */}
            <Route path="/admin/menus" element={<AdminMenuPage />} />
            <Route path="/admin/settlement" element={<AdminSettlementPage />} />
            {/* find_error_v2 — 내역/쿠폰 라우트 복원 */}
            <Route path="/admin/history" element={<AdminHistoryPage />} />
            <Route path="/admin/coupons" element={<AdminCouponsPage />} />
            {/* Subagent 4 — 테이블 잠금 */}
            <Route path="/admin/tables" element={<AdminTablesPage />} />
          </Route>

          {/* 404 catch-all */}
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
