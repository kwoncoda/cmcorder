// find_error_v2 — HistoryPage 단위 테스트.
//
// 회귀:
//  - Loading 분기 — testid 래퍼만 노출
//  - Empty — '해당 조건의 내역이 없어요'
//  - 목록 렌더 — 행마다 시간 · 주문번호 · action_name · from→to · actor
//  - 401 → /admin/login redirect
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

import HistoryPage from '../HistoryPage.jsx';

const SAMPLE = [
  {
    id: 1,
    order_id: 17,
    order_no: 17,
    event_type: 'PAID',
    from_status: 'TRANSFER_REPORTED',
    to_status: 'PAID',
    action_name: '이체 확인',
    actor: 'admin',
    note: null,
    created_at: '2026-05-20T17:31:00Z',
  },
  {
    id: 2,
    order_id: 17,
    order_no: 17,
    event_type: 'CREATED',
    from_status: null,
    to_status: 'ORDERED',
    action_name: '주문 접수',
    actor: 'customer',
    note: null,
    created_at: '2026-05-20T17:25:00Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('HistoryPage', () => {
  it('★ Loading 분기 — list/empty 미렌더', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.queryByTestId('history-feed')).not.toBeInTheDocument();
    expect(screen.queryByText(/해당 조건의 내역이 없어요/)).not.toBeInTheDocument();
  });

  it('★ Empty — 빈 배열이면 안내 메시지', async () => {
    apiFetch.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/해당 조건의 내역이 없어요/)).toBeInTheDocument();
    });
  });

  it('★ 목록 — 행마다 시각·주문번호·action·from→to·actor 표시', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-row-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('history-row-2')).toBeInTheDocument();
    // action_name 라벨
    expect(screen.getByText('이체 확인')).toBeInTheDocument();
    expect(screen.getByText('주문 접수')).toBeInTheDocument();
    // order_no
    expect(screen.getAllByText('#17')).toHaveLength(2);
    // actor
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('customer')).toBeInTheDocument();
    // from→to chip
    expect(screen.getByText('TRANSFER_REPORTED')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
  });

  it('★ 401 → /admin/login redirect', async () => {
    apiFetch.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }));
    renderPage();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/admin/login');
    });
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/HistoryPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
