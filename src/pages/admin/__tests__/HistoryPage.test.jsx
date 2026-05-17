// find_error_v3 — HistoryPage 단위 테스트 (4탭 필터 확장).
//
// 회귀:
//  - Loading 분기 — testid 래퍼만 노출
//  - Empty — '해당 조건의 내역이 없어요'
//  - 목록 렌더 — 행마다 시간 · action_name · actor
//  - 탭 4개 (전체/주문/메뉴/시스템) + 클릭 시 type 쿼리로 fetch
//  - 카운트 표시
//  - 401 → /admin/login redirect
//  - 페이지 ≤140줄 (find_error_v3 — 4탭 + 카운트로 한도 확대)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
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

const SAMPLE_ALL = [
  {
    id: 'o-1',
    source: 'order',
    category: 'order',
    event_type: 'PAID',
    action_name: '이체 확인',
    actor: 'admin',
    order_id: 17,
    order_no: 17,
    from_status: 'TRANSFER_REPORTED',
    to_status: 'PAID',
    target_id: null,
    target_name: null,
    before_value: null,
    after_value: null,
    note: null,
    created_at: '2026-05-20T17:31:00Z',
  },
  {
    id: 'a-2',
    source: 'admin',
    category: 'menu',
    event_type: 'SOLDOUT_ON',
    action_name: '품절 처리',
    actor: 'admin',
    order_id: null,
    order_no: null,
    from_status: null,
    to_status: null,
    target_id: 1,
    target_name: '후라이드',
    before_value: 'false',
    after_value: 'true',
    note: null,
    created_at: '2026-05-20T17:30:00Z',
  },
  {
    id: 'a-1',
    source: 'admin',
    category: 'system',
    event_type: 'BUSINESS_OPEN',
    action_name: '장사 시작',
    actor: 'admin',
    order_id: null,
    order_no: null,
    from_status: null,
    to_status: null,
    target_id: null,
    target_name: null,
    before_value: null,
    after_value: null,
    note: null,
    created_at: '2026-05-20T15:00:00Z',
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

  it('★ 목록 — 행마다 action_name·actor 표시 (default type=all)', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ALL);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-row-o-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('history-row-a-2')).toBeInTheDocument();
    expect(screen.getByTestId('history-row-a-1')).toBeInTheDocument();
    expect(screen.getByText('이체 확인')).toBeInTheDocument();
    expect(screen.getByText('품절 처리')).toBeInTheDocument();
    expect(screen.getByText('장사 시작')).toBeInTheDocument();
  });

  it('★ 4탭 (전체/주문/메뉴/시스템) 렌더링', async () => {
    apiFetch.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-tab-all')).toBeInTheDocument();
    });
    expect(screen.getByTestId('history-tab-orders')).toBeInTheDocument();
    expect(screen.getByTestId('history-tab-menus')).toBeInTheDocument();
    expect(screen.getByTestId('history-tab-system')).toBeInTheDocument();
  });

  it('★ 카운트 표시 — 각 탭 라벨에 (N) 포함', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ALL);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-row-o-1')).toBeInTheDocument();
    });
    // 전체 3, 주문 1, 메뉴 1, 시스템 1
    expect(screen.getByTestId('history-tab-all').textContent).toContain('3');
    expect(screen.getByTestId('history-tab-orders').textContent).toContain('1');
    expect(screen.getByTestId('history-tab-menus').textContent).toContain('1');
    expect(screen.getByTestId('history-tab-system').textContent).toContain('1');
  });

  it('★ 탭 클릭 시 type 쿼리 파라미터로 fetch — orders', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ALL);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-tab-orders')).toBeInTheDocument();
    });
    apiFetch.mockClear();
    apiFetch.mockResolvedValueOnce([SAMPLE_ALL[0]]);
    fireEvent.click(screen.getByTestId('history-tab-orders'));
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled();
      const calledUrl = apiFetch.mock.calls[0][0];
      expect(calledUrl).toContain('type=orders');
    });
  });

  it('★ 탭 클릭 시 type=menus 쿼리', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ALL);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-tab-menus')).toBeInTheDocument();
    });
    apiFetch.mockClear();
    apiFetch.mockResolvedValueOnce([SAMPLE_ALL[1]]);
    fireEvent.click(screen.getByTestId('history-tab-menus'));
    await waitFor(() => {
      const calledUrl = apiFetch.mock.calls[0][0];
      expect(calledUrl).toContain('type=menus');
    });
  });

  it('★ 활성 탭 표시 — active 클래스', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ALL);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-tab-all')).toBeInTheDocument();
    });
    // default는 'all'
    expect(screen.getByTestId('history-tab-all').className).toContain('active');
    apiFetch.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByTestId('history-tab-system'));
    await waitFor(() => {
      expect(screen.getByTestId('history-tab-system').className).toContain('active');
    });
  });

  it('★ 401 → /admin/login redirect', async () => {
    apiFetch.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }));
    renderPage();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/admin/login');
    });
  });

  it("★ find_error_v3 — actor 'admin' row 는 '어드민' 으로 표시", async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ALL);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('history-row-o-1')).toBeInTheDocument();
    });
    const row = screen.getByTestId('history-row-o-1');
    // log-actor 영역에 '어드민' 표시 + 'admin' 영문 표시는 부재.
    expect(row.querySelector('.log-actor')?.textContent).toBe('어드민');
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
