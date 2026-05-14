// Task 5.5 — SettlementPage 단위 테스트 (12 케이스).
//
// 회귀 보호:
//  - Loading / Error 분기 + 재시도
//  - 401 응답 시 /admin/login redirect
//  - 정산 요약 렌더 (total_orders, total_amount, in_progress_count)
//  - ★ in_progress_count > 0 시 close-guard 표시 + 마감 버튼 disabled (ADR-012)
//  - ★ in_progress_count = 0 시 마감 버튼 enabled
//  - ★ 마감 클릭 시 API 호출 + businessState 'CLOSED' 전이 (G13)
//  - 마감 실패 시 에러 메시지
//  - is_closed=true 시 버튼 라벨 변경
//  - ZIP 버튼 클릭 시 window.open 호출
//  - a11y (axe)
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

vi.mock('../../../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));
import { useApi } from '../../../hooks/useApi.js';

vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch, ApiError } from '../../../api/client.js';

import SettlementPage from '../SettlementPage.jsx';
import useBusinessStateStore from '../../../store/businessState.js';

const SAMPLE_SETTLEMENT = {
  operating_date: '2026-05-20',
  total_orders: 42,
  total_amount: 756000,
  in_progress_count: 0,
  is_closed: false,
};

const IN_PROGRESS_SETTLEMENT = {
  operating_date: '2026-05-20',
  total_orders: 42,
  total_amount: 756000,
  in_progress_count: 3,
  is_closed: false,
};

const CLOSED_SETTLEMENT = {
  operating_date: '2026-05-20',
  total_orders: 42,
  total_amount: 756000,
  in_progress_count: 0,
  is_closed: true,
};

function renderPage(initialPath = '/admin/settlement') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/settlement" element={<SettlementPage />} />
        <Route
          path="/admin/login"
          element={<div data-testid="login-page-stub">로그인</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
  useApi.mockReturnValue({
    data: SAMPLE_SETTLEMENT,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

describe('SettlementPage', () => {
  it('★ Loading 분기', () => {
    useApi.mockReturnValue({ data: null, isLoading: true, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('★ Error 분기 + 다시 시도', () => {
    const refetch = vi.fn();
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

  it('★ 401 응답 시 /admin/login redirect', async () => {
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

  it('★ 정산 요약 렌더 — total_orders + total_amount + in_progress_count', () => {
    renderPage();
    const summary = screen.getByTestId('settlement-summary');
    expect(summary).toHaveTextContent('42건');
    expect(summary).toHaveTextContent('756,000원');
    expect(summary).toHaveTextContent('0건');
    expect(screen.getByRole('heading', { name: /정산/ })).toHaveTextContent('2026-05-20');
  });

  it('★ in_progress_count > 0 시 close-guard 표시 + 마감 버튼 disabled (ADR-012)', () => {
    useApi.mockReturnValue({ data: IN_PROGRESS_SETTLEMENT, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('close-guard')).toBeInTheDocument();
    expect(screen.getByTestId('close-guard')).toHaveTextContent(/3건/);
    expect(screen.getByTestId('close-settlement-btn')).toBeDisabled();
  });

  it('★ in_progress_count = 0 시 마감 버튼 enabled', () => {
    renderPage();
    expect(screen.queryByTestId('close-guard')).not.toBeInTheDocument();
    expect(screen.getByTestId('close-settlement-btn')).not.toBeDisabled();
  });

  it('★ 마감 클릭 시 API 호출 + businessState=CLOSED 전이 (G13)', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    renderPage();
    fireEvent.click(screen.getByTestId('close-settlement-btn'));
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/admin/api/settlement/close',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(useBusinessStateStore.getState().status).toBe('CLOSED');
  });

  it('★ 마감 실패 시 인라인 에러 메시지 + status 변동 X', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('마감 실패', { status: 500 }));
    renderPage();
    fireEvent.click(screen.getByTestId('close-settlement-btn'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('마감 실패');
    });
    expect(useBusinessStateStore.getState().status).toBe('OPEN');
  });

  it('★ is_closed=true 시 버튼 라벨 변경 + 비활성', () => {
    useApi.mockReturnValue({ data: CLOSED_SETTLEMENT, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    const btn = screen.getByTestId('close-settlement-btn');
    expect(btn).toHaveTextContent(/마감 완료/);
    expect(btn).toBeDisabled();
  });

  it('★ ZIP 버튼 클릭 시 window.open 호출', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    fireEvent.click(screen.getByTestId('download-zip-btn'));
    expect(openSpy).toHaveBeenCalledWith('/admin/api/settlement/zip', '_blank');
    openSpy.mockRestore();
  });

  it('★ a11y 위반 없음', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/SettlementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
