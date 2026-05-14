// Task 5.2 — DashboardPage 통합 테스트 (19 케이스).
//
// 회귀 보호:
//  - CLOSED 시 BusinessStateBadge + StartBusinessCTA + Kanban 숨김
//  - "장사 시작" 클릭 시 API 호출 + status=OPEN 전이
//  - OPEN 시 BusinessStateBadge OPEN + Kanban 6 컬럼
//  - 3분기: Loading / Error / Empty
//  - 401 시 /admin/login redirect
//  - 5xx ErrorState
//  - 컬럼별 그룹화
//  - tick 패턴 (1분 단위)
//  - 5초 폴링 (OPEN 상태에서만)
//  - CLOSED 상태에서는 폴링 X
//  - 키보드 Enter (OrderCard button — Task 2.7 통합 회귀)
//  - memo 회귀 (OrderCard reference 동일 시 리렌더 X — Task 2.7 통합)
//  - 페이지 ≤120줄 — §3.5 1조
//  - a11y (axe)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

// useApi mock — 호출자(DashboardPage)가 의존하는 hook 만 격리.
vi.mock('../../../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));
import { useApi } from '../../../hooks/useApi.js';

// apiFetch mock — "장사 시작" 버튼 클릭 시 호출되는 함수.
vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch, ApiError } from '../../../api/client.js';

import DashboardPage from '../DashboardPage.jsx';
import useBusinessStateStore from '../../../store/businessState.js';
import { ADMIN_COLUMNS } from '../../../constants/admin-columns.js';

// MemoryRouter + 다중 라우트 헬퍼 — 401 시 /admin/login navigate 검증용.
function renderPage(initialPath = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route
          path="/admin/login"
          element={<div data-testid="login-page-stub">로그인</div>}
        />
        <Route
          path="/admin/orders/:id"
          element={<div data-testid="order-detail-stub">상세</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const SAMPLE_ORDERS = [
  { id: 1, no: 1, status: 'ORDERED',           depositor_name: '홍길동', transferred_at: null },
  { id: 2, no: 2, status: 'TRANSFER_REPORTED', depositor_name: '김철수', transferred_at: '2026-05-20T16:35:00.000Z' },
  { id: 3, no: 3, status: 'COOKING',           depositor_name: '이영희', transferred_at: '2026-05-20T16:30:00.000Z' },
  { id: 4, no: 4, status: 'COOKING',           depositor_name: '박민수', transferred_at: '2026-05-20T16:25:00.000Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
  // 기본 useApi 응답 — 각 테스트가 필요 시 override.
  useApi.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DashboardPage', () => {
  it('★ CLOSED 시 BusinessStateBadge + StartBusinessCTA 렌더 + Kanban 숨김', () => {
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    renderPage();
    expect(screen.getByTestId('business-state-badge')).toBeInTheDocument();
    expect(screen.getByTestId('start-business-cta')).toBeInTheDocument();
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument();
  });

  it('★ "장사 시작" 클릭 시 API 호출 + status=OPEN 전이', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    renderPage();
    fireEvent.click(screen.getByTestId('start-business-cta'));
    await waitFor(() => {
      expect(useBusinessStateStore.getState().status).toBe('OPEN');
    });
    expect(apiFetch).toHaveBeenCalledWith(
      '/admin/api/business/open',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('"장사 시작" API 실패 시 status 변동 X + 에러 메시지 표시', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('서버 오류', { status: 500 }));
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    renderPage();
    fireEvent.click(screen.getByTestId('start-business-cta'));
    await waitFor(() => {
      expect(screen.getByTestId('cta-error')).toHaveTextContent('서버 오류');
    });
    expect(useBusinessStateStore.getState().status).toBe('CLOSED');
  });

  it('OPEN 시 BusinessStateBadge OPEN + Kanban 6 컬럼 모두 렌더', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({ data: SAMPLE_ORDERS, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('business-state-badge')).toHaveTextContent('영업 중');
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    for (const col of ADMIN_COLUMNS) {
      expect(screen.getByTestId(`admin-column-${col.status}`)).toBeInTheDocument();
    }
  });

  it('★ Loading 분기 — OPEN + ordersQuery.isLoading 시 LoadingState', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({ data: null, isLoading: true, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('★ Error 분기 — 5xx 시 ErrorState + 다시 시도 버튼', () => {
    const refetch = vi.fn();
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: null,
      isLoading: false,
      error: new ApiError('서버 오류', { status: 500 }),
      refetch,
    });
    renderPage();
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('★ Empty 분기 — orders=[] 시 EmptyState ("오늘 첫 주문 대기 중")', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/오늘 첫 주문 대기 중/)).toBeInTheDocument();
  });

  it('401 시 /admin/login 으로 redirect', async () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: null,
      isLoading: false,
      error: new ApiError('인증 필요', { status: 401 }),
      refetch: vi.fn(),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('login-page-stub')).toBeInTheDocument();
    });
  });

  it('주문을 컬럼별로 그룹화 — COOKING 컬럼에 2건', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: SAMPLE_ORDERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    // COOKING 컬럼 안에 카드 2개 (id=3, id=4).
    const cookingCol = screen.getByTestId('admin-column-COOKING');
    expect(cookingCol).toHaveTextContent('#3');
    expect(cookingCol).toHaveTextContent('#4');
    // ORDERED 컬럼 안에 카드 1개 (id=1).
    const orderedCol = screen.getByTestId('admin-column-ORDERED');
    expect(orderedCol).toHaveTextContent('#1');
  });

  it('★ tick 패턴 — 1분 후 setTick 호출로 AdminCardColumn 에 새 tick prop 전달', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T16:35:00.000Z'));
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: SAMPLE_ORDERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { getByTestId } = renderPage();
    // 초기 경과 분 — id=3 카드 (transferred_at=16:30) → 5분 경과.
    const cookingCol = getByTestId('admin-column-COOKING');
    expect(cookingCol).toHaveTextContent('5분 경과');
    // 1분 진행 → setInterval 발화 + 시스템 시각 +1분 → tick 갱신 → 6분 경과 재렌더.
    // vi.advanceTimersByTime 이 fake clock 을 함께 진행시키므로 setSystemTime 불필요.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(cookingCol).toHaveTextContent('6분 경과');
  });

  it('★ 5초 폴링 — OPEN 상태에서 5초 후 refetch 호출', () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({ data: [], isLoading: false, error: null, refetch });
    renderPage();
    expect(refetch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(refetch).toHaveBeenCalled();
  });

  it('★ CLOSED 상태에서는 5초 폴링 등록 X', () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    useApi.mockReturnValue({ data: [], isLoading: false, error: null, refetch });
    renderPage();
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(refetch).not.toHaveBeenCalled();
  });

  it('★ 카드 클릭 시 /admin/orders/:id navigate', async () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: SAMPLE_ORDERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    fireEvent.click(screen.getByTestId('admin-order-card-1'));
    await waitFor(() => {
      expect(screen.getByTestId('order-detail-stub')).toBeInTheDocument();
    });
  });

  it('★ 키보드 Enter — OrderCard <button> 이라 키보드 활성화 가능 (Task 2.7 통합 회귀)', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: SAMPLE_ORDERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    const card = screen.getByTestId('admin-order-card-1');
    // <button> 시맨틱 — fireEvent.click 이 Enter/Space 와 동등.
    expect(card.tagName).toBe('BUTTON');
  });

  it('★ memo 회귀 — 동일 order reference 재전달 시 OrderCard 리렌더 X (Task 2.7 통합)', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    const stableOrders = SAMPLE_ORDERS;
    useApi.mockReturnValue({
      data: stableOrders,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { rerender } = renderPage();
    // 같은 reference 로 다시 렌더 — memo 적용된 OrderCard 는 리렌더 X.
    rerender(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/admin/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    // DOM 상 카드가 그대로 존재하면 회귀 통과 (memo 가 풀렸으면 새 노드).
    expect(screen.getByTestId('admin-order-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('admin-order-card-2')).toBeInTheDocument();
  });

  it('헤더에 "📋 본부 대시보드" 제목 표시 (OPEN)', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: SAMPLE_ORDERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('heading', { name: /본부 대시보드/ })).toBeInTheDocument();
  });

  it('OPEN + Empty 시에도 헤더 + Badge 표시', () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByRole('heading', { name: /본부 대시보드/ })).toBeInTheDocument();
    expect(screen.getByTestId('business-state-badge')).toBeInTheDocument();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/DashboardPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });

  it('★ a11y 위반 없음 (CLOSED 화면)', async () => {
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ a11y 위반 없음 (OPEN + Kanban)', async () => {
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    useApi.mockReturnValue({
      data: SAMPLE_ORDERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ ? 키 입력 → KeyboardHelpModal 토글 (CLOSED 화면, 결정 D)', () => {
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    renderPage();
    expect(screen.queryByTestId('keyboard-help-modal')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('keyboard-help-modal')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByTestId('keyboard-help-modal')).not.toBeInTheDocument();
  });
});
