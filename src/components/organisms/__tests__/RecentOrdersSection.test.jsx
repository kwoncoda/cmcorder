// Bug 13 — RecentOrdersSection organism 회귀 테스트.
//
// 회귀 포인트:
//  - store에 진행 중 주문 있을 때 카드 노출 + StatusChip 표시
//  - 카드 클릭 시 /orders/:id/status?token=... 네비 (token 포함)
//  - DONE 상태는 fetch 후 카드 숨김 (TERMINAL)
//  - CANCELED 상태도 숨김
//  - 진행 중 주문 0개일 때 섹션 자체 미렌더
//  - fetch 실패 시 카드 숨김
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RecentOrdersSection from '../RecentOrdersSection.jsx';
import useRecentOrdersStore from '../../../store/recentOrders.js';

// apiFetch mock — fetch 격리.
vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch } from '../../../api/client.js';

function renderSection(initialPath = '/menu') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/menu" element={<RecentOrdersSection />} />
        <Route
          path="/orders/:id/status"
          element={<div data-testid="status-page-stub" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useRecentOrdersStore.setState({ orders: [] });
  vi.clearAllMocks();
});

describe('RecentOrdersSection (Bug 13)', () => {
  it('★ store 진행 중 주문 0개 — 섹션 미렌더', () => {
    renderSection();
    expect(screen.queryByTestId('recent-orders-section')).not.toBeInTheDocument();
  });

  it('★ 진행 중 주문 있을 때 카드 노출', async () => {
    apiFetch.mockResolvedValue({ status: 'COOKING' });
    useRecentOrdersStore.setState({
      orders: [{ id: 7, no: 12, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    expect(screen.getByTestId('recent-orders-section')).toBeInTheDocument();
    expect(screen.getByTestId('recent-order-card-7')).toBeInTheDocument();
    expect(screen.getByText('주문 #12')).toBeInTheDocument();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders/7?token=tkn'),
    ));
  });

  it('★ 카드 클릭 시 /orders/:id/status?token=... 네비', async () => {
    apiFetch.mockResolvedValue({ status: 'PAID' });
    useRecentOrdersStore.setState({
      orders: [{ id: 7, no: 12, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    fireEvent.click(screen.getByTestId('recent-order-card-7'));
    await waitFor(() => expect(screen.getByTestId('status-page-stub')).toBeInTheDocument());
  });

  it('★ DONE 상태 — 카드 숨김 + store에서 자동 제거 (P2-3)', async () => {
    apiFetch.mockResolvedValue({ status: 'DONE' });
    useRecentOrdersStore.setState({
      orders: [{ id: 8, no: 13, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('recent-order-card-8')).not.toBeInTheDocument());
    // P2-3: terminal 상태는 store에서도 자동 제거되어 다음 마운트에 fetch 안 함.
    await waitFor(() => expect(useRecentOrdersStore.getState().orders.find((o) => o.id === 8)).toBeUndefined());
  });

  it('★ CANCELED 상태 — 카드 숨김', async () => {
    apiFetch.mockResolvedValue({ status: 'CANCELED' });
    useRecentOrdersStore.setState({
      orders: [{ id: 9, no: 14, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('recent-order-card-9')).not.toBeInTheDocument());
  });

  // ── P2-2 (Codex 최종 리뷰) — fetch 실패 시 즉시 제거하지 않음 ────────
  // 네트워크/5xx 같은 일시 오류로 사용자 재진입 경로가 사라지면 안 된다.
  // terminal 상태(DONE/CANCELED)만 store에서 제거. 나머지 실패는 카드 유지 + 안내.
  it('★ P2-2 — fetch 네트워크 오류 시 카드 유지 + 안내 문구 + store 보존', async () => {
    apiFetch.mockRejectedValue(new Error('network'));
    useRecentOrdersStore.setState({
      orders: [{ id: 10, no: 15, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    // 카드는 유지된다.
    expect(screen.getByTestId('recent-order-card-10')).toBeInTheDocument();
    // 안내 문구 노출.
    expect(screen.getByText(/상태를 불러오지 못했어요/)).toBeInTheDocument();
    // store에서도 제거되지 않음 — 새로고침/재시도로 회복 가능.
    expect(useRecentOrdersStore.getState().orders.find((o) => o.id === 10)).toBeDefined();
  });

  it('★ P2-2 — 5xx 서버 오류도 카드 유지 (store 보존)', async () => {
    // ApiError 형태로 5xx 시뮬.
    const { ApiError } = await import('../../../api/client.js');
    apiFetch.mockRejectedValue(new ApiError('서버 오류', { status: 500, code: 'INTERNAL' }));
    useRecentOrdersStore.setState({
      orders: [{ id: 11, no: 16, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.getByTestId('recent-order-card-11')).toBeInTheDocument();
    expect(useRecentOrdersStore.getState().orders.find((o) => o.id === 11)).toBeDefined();
  });

  it('★ P2-3 — 모든 카드가 terminal(DONE)일 때만 섹션 미렌더 (store auto-empty)', async () => {
    apiFetch.mockResolvedValue({ status: 'DONE' });
    useRecentOrdersStore.setState({
      orders: [
        { id: 20, no: 20, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() },
        { id: 21, no: 21, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() },
      ],
    });
    renderSection();
    await waitFor(() => expect(useRecentOrdersStore.getState().orders).toHaveLength(0));
    await waitFor(() => expect(screen.queryByTestId('recent-orders-section')).not.toBeInTheDocument());
  });

  // ── table_lock: TERMINAL 확장 (DINING / SETTLED) ──────────────
  it('★ DINING 상태 — 카드 숨김 + store에서 자동 제거', async () => {
    apiFetch.mockResolvedValue({ status: 'DINING' });
    useRecentOrdersStore.setState({
      orders: [{ id: 40, no: 40, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('recent-order-card-40')).not.toBeInTheDocument());
    await waitFor(() => expect(useRecentOrdersStore.getState().orders.find((o) => o.id === 40)).toBeUndefined());
  });

  it('★ SETTLED 상태 — 카드 숨김 + store에서 자동 제거', async () => {
    apiFetch.mockResolvedValue({ status: 'SETTLED' });
    useRecentOrdersStore.setState({
      orders: [{ id: 41, no: 41, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('recent-order-card-41')).not.toBeInTheDocument());
    await waitFor(() => expect(useRecentOrdersStore.getState().orders.find((o) => o.id === 41)).toBeUndefined());
  });

  it('★ READY 상태 — 카드 유지 (DINING/SETTLED 숨김이 READY에 영향 X)', async () => {
    apiFetch.mockResolvedValue({ status: 'READY' });
    useRecentOrdersStore.setState({
      orders: [{ id: 42, no: 42, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }],
    });
    renderSection();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.getByTestId('recent-order-card-42')).toBeInTheDocument();
  });

  it('★ P2-3 — 마운트 시 pruneStale 호출로 TTL 지난 항목 사전 제거', async () => {
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    apiFetch.mockResolvedValue({ status: 'COOKING' });
    useRecentOrdersStore.setState({
      orders: [
        { id: 30, no: 30, token: 'tkn', operating_date: '2026-05-15', savedAt: Date.now() - THREE_DAYS }, // stale
        { id: 31, no: 31, token: 'tkn', operating_date: '2026-05-20', savedAt: Date.now() }, // fresh
      ],
    });
    renderSection();
    // stale은 마운트 시 pruneStale로 즉시 제거되어 fetch도 안 일어남.
    await waitFor(() => expect(useRecentOrdersStore.getState().orders.find((o) => o.id === 30)).toBeUndefined());
    expect(useRecentOrdersStore.getState().orders.find((o) => o.id === 31)).toBeDefined();
  });
});
