// find_error_v3 (2026-05-18) — AdminLayout 단위 테스트.
//
// 회귀:
//  - 5개 nav 항목 (본부·메뉴·내역·정산·쿠폰) 렌더
//  - '이체확인' nav 항목 미렌더 (admin-nav-transfers testid 부재)
//  - 우상단 actor 라벨이 'admin1' 문자열이 아닌 '어드민' 으로 표시
//  - login 경로는 nav 미렌더 (인증 전)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import useBusinessStateStore from '../../../store/businessState.js';

function TestPage() {
  return <div data-testid="test-page">page</div>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin/login" element={<TestPage />} />
          <Route path="/admin/dashboard" element={<TestPage />} />
          <Route path="/admin/menus" element={<TestPage />} />
          <Route path="/admin/history" element={<TestPage />} />
          <Route path="/admin/settlement" element={<TestPage />} />
          <Route path="/admin/coupons" element={<TestPage />} />
          <Route path="/admin/transfers" element={<TestPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
  // useApi 가 호출하는 fetch 를 격리.
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ status: 'OPEN', operating_date: '2026-05-20' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

describe('AdminLayout — find_error_v3 nav · actor 라벨', () => {
  it('★ 5개 nav 항목 렌더 (본부·메뉴·내역·정산·쿠폰)', () => {
    renderAt('/admin/dashboard');
    expect(screen.getByTestId('admin-nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('admin-nav-menus')).toBeInTheDocument();
    expect(screen.getByTestId('admin-nav-history')).toBeInTheDocument();
    expect(screen.getByTestId('admin-nav-settlement')).toBeInTheDocument();
    expect(screen.getByTestId('admin-nav-coupons')).toBeInTheDocument();
  });

  it("★ '이체확인' nav 항목 제거 — admin-nav-transfers testid 부재", () => {
    renderAt('/admin/dashboard');
    expect(screen.queryByTestId('admin-nav-transfers')).not.toBeInTheDocument();
  });

  it("★ 우상단 actor 라벨이 'admin1' 이 아닌 '어드민' 으로 표시", () => {
    renderAt('/admin/dashboard');
    expect(screen.queryByText('admin1')).not.toBeInTheDocument();
    expect(screen.getByText('어드민')).toBeInTheDocument();
  });

  it('/admin/login 경로는 nav 미렌더', () => {
    renderAt('/admin/login');
    expect(screen.queryByTestId('admin-nav')).toBeNull();
  });

  it('/admin/transfers 경로 직접 접근 시 TransfersPage 영역 렌더 가능 (라우트 보존)', () => {
    // 라우트 자체는 보존 — nav 에서만 제거. 자식 라우트 렌더 확인.
    renderAt('/admin/transfers');
    expect(screen.getByTestId('test-page')).toBeInTheDocument();
  });

  it('★ find_error_v3 — biz-badge 안의 dot이 CSS 원형(.biz-dot)이고 이모지 미사용 (OPEN)', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    renderAt('/admin/dashboard');
    const badge = screen.getByTestId('admin-biz-badge');
    expect(badge.querySelector('.biz-dot.is-open')).not.toBeNull();
    expect(badge.textContent).not.toMatch(/🟢|🔴/);
  });

  it('★ find_error_v3 — biz-badge dot CLOSED 시 .biz-dot.is-closed 노드', () => {
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    renderAt('/admin/dashboard');
    const badge = screen.getByTestId('admin-biz-badge');
    expect(badge.querySelector('.biz-dot.is-closed')).not.toBeNull();
    expect(badge.textContent).not.toMatch(/🟢|🔴/);
  });
});
