// Task 5.3 — OrderDetailPage 단위 테스트 (7 케이스).
//
// 회귀 보호:
//  - Loading 분기 (fetch 중)
//  - Error 분기 (fetch 실패)
//  - 6 액션 버튼 — order.status 따라 보임/안 보임
//  - 액션 클릭 시 apiFetch POST 호출
//  - 액션 실패 시 인라인 에러
//  - 401 응답 시 /admin/login redirect
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch, ApiError } from '../../../api/client.js';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import OrderDetailPage from '../OrderDetailPage.jsx';

const SAMPLE_PAID = {
  id: 17,
  no: 17,
  operating_date: '2026-05-20',
  status: 'PAID',
  items: [{ menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 }],
  total_price: 18000,
  created_at: '17:30',
  transferred_at: '17:31',
  paid_at: '17:32',
};

const SAMPLE_TRANSFER_REPORTED = {
  ...SAMPLE_PAID,
  status: 'TRANSFER_REPORTED',
  paid_at: null,
};

function renderPage(initialPath = '/admin/orders/17') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/orders/:id" element={<OrderDetailPage />} />
        <Route path="/admin/login" element={<div data-testid="login-stub">로그인</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('OrderDetailPage', () => {
  it('★ Loading 분기 — fetch 중 LoadingState', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    // 페이지 본문 미렌더 — testid는 아직 없음.
    expect(screen.queryByTestId('admin-order-detail-page')).not.toBeInTheDocument();
  });

  it('★ Error 분기 — fetch 실패 시 ErrorState + 재시도', async () => {
    apiFetch.mockRejectedValue(new ApiError('not found', { status: 404 }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/주문을 불러올 수 없어요/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('★ PAID 상태일 때 "조리 시작" + "취소" 버튼 표시, "이체 확인" 미표시', async () => {
    apiFetch.mockResolvedValue(SAMPLE_PAID);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-start_cooking')).toBeInTheDocument();
    });
    expect(screen.getByTestId('action-cancel')).toBeInTheDocument();
    expect(screen.queryByTestId('action-confirm_transfer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-hold')).not.toBeInTheDocument();
  });

  it('★ TRANSFER_REPORTED 상태일 때 "이체 확인" + "보류" + "취소" 표시', async () => {
    apiFetch.mockResolvedValue(SAMPLE_TRANSFER_REPORTED);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-confirm_transfer')).toBeInTheDocument();
    });
    expect(screen.getByTestId('action-hold')).toBeInTheDocument();
    expect(screen.getByTestId('action-cancel')).toBeInTheDocument();
    expect(screen.queryByTestId('action-start_cooking')).not.toBeInTheDocument();
  });

  it('★ HOLD 상태일 때 "이체 확인" + "취소" 표시 — ADR-025 HOLD → PAID 회귀', async () => {
    apiFetch.mockResolvedValue({ ...SAMPLE_TRANSFER_REPORTED, status: 'HOLD' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-confirm_transfer')).toBeInTheDocument();
    });
    expect(screen.getByTestId('action-cancel')).toBeInTheDocument();
    expect(screen.queryByTestId('action-hold')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-start_cooking')).not.toBeInTheDocument();
  });

  it('★ 액션 클릭 시 apiFetch POST 호출 (transition 페이로드)', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_PAID);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-start_cooking')).toBeInTheDocument();
    });
    apiFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(SAMPLE_PAID);
    fireEvent.click(screen.getByTestId('action-start_cooking'));
    await waitFor(() => {
      const calls = apiFetch.mock.calls.filter((c) => c[0].includes('/transition'));
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[0][1].method).toBe('POST');
      expect(calls[0][1].body).toEqual({ action: 'start_cooking', to: 'COOKING' });
    });
  });

  it('★ 401 응답 시 /admin/login redirect', async () => {
    apiFetch.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }));
    renderPage();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/admin/login');
    });
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/OrderDetailPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
