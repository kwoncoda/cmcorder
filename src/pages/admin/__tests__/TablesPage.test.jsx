// Subagent 4 — TablesPage 단위 테스트.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
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

import TablesPage from '../TablesPage.jsx';

function makeTables(overrides = {}) {
  return Array.from({ length: 15 }, (_, i) => ({
    table_no: i + 1,
    status: 'available',
    ...(overrides[i + 1] ?? {}),
  }));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TablesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  navigateMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('TablesPage', () => {
  it('★ 로딩 중 LoadingState 노출', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('admin-tables-page')).toBeInTheDocument();
    expect(screen.getByText(/로딩 중/)).toBeInTheDocument();
  });

  it('★ 15개 카드 렌더', async () => {
    apiFetch.mockResolvedValue(makeTables());
    renderPage();
    await waitFor(() => expect(screen.getByTestId('tables-grid')).toBeInTheDocument());
    for (let i = 1; i <= 15; i++) {
      expect(screen.getByTestId(`table-card-${i}`)).toBeInTheDocument();
    }
  });

  it('★ 각 카드 testid 존재', async () => {
    apiFetch.mockResolvedValue(makeTables());
    renderPage();
    await waitFor(() => expect(screen.getByTestId('table-card-1')).toBeInTheDocument());
    expect(screen.getByTestId('table-card-15')).toBeInTheDocument();
  });

  it('★ 5번 occupied → 배지 "이용 중 (#12)", 버튼 "잠금"', async () => {
    apiFetch.mockResolvedValue(makeTables({ 5: { status: 'occupied', order_no: 12 } }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('table-card-5')).toBeInTheDocument());
    expect(screen.getByTestId('table-card-5').textContent).toContain('이용 중 (#12)');
    expect(screen.getByTestId('table-5-lock')).toBeInTheDocument();
    expect(screen.getByTestId('table-5-lock').textContent).toBe('잠금');
  });

  it('★ 7번 locked → 배지 "잠김", 버튼 "잠금 해제"', async () => {
    apiFetch.mockResolvedValue(makeTables({ 7: { status: 'locked' } }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('table-card-7')).toBeInTheDocument());
    expect(screen.getByTestId('table-card-7').textContent).toContain('잠김');
    expect(screen.getByTestId('table-7-unlock')).toBeInTheDocument();
    expect(screen.getByTestId('table-7-unlock').textContent).toBe('잠금 해제');
  });

  it('★ 잠금 클릭 → ADMIN_TABLE_LOCK POST 1회 호출', async () => {
    const tables = makeTables();
    apiFetch.mockResolvedValueOnce(tables).mockResolvedValue(tables);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('table-1-lock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('table-1-lock'));
    await waitFor(() => {
      const postCalls = apiFetch.mock.calls.filter(
        (c) => c[1]?.method === 'POST' && String(c[0]).includes('/lock'),
      );
      expect(postCalls).toHaveLength(1);
    });
  });

  it('★ 해제 클릭 → ADMIN_TABLE_UNLOCK POST 1회 호출', async () => {
    const lockedTables = makeTables({ 3: { status: 'locked' } });
    const unlockedTables = makeTables();
    apiFetch.mockResolvedValueOnce(lockedTables).mockResolvedValue(unlockedTables);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('table-3-unlock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('table-3-unlock'));
    await waitFor(() => {
      const postCalls = apiFetch.mock.calls.filter(
        (c) => c[1]?.method === 'POST' && String(c[0]).includes('/unlock'),
      );
      expect(postCalls).toHaveLength(1);
    });
  });

  it('★ 점유 + 잠금 해제 → refetch 후 여전히 occupied → 안내 문구 노출', async () => {
    const lockedTables = makeTables({ 5: { status: 'locked' } });
    const stillOccupied = makeTables({ 5: { status: 'occupied', order_no: 9 } });
    // 1st: 초기 fetch, 2nd: POST unlock (void), 3rd: fresh fetch after unlock
    apiFetch
      .mockResolvedValueOnce(lockedTables)
      .mockResolvedValueOnce(undefined) // POST unlock
      .mockResolvedValueOnce(stillOccupied) // fresh fetch
      .mockResolvedValue(stillOccupied); // refetch from query
    renderPage();
    await waitFor(() => expect(screen.getByTestId('table-5-unlock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('table-5-unlock'));
    await waitFor(() => {
      expect(screen.getByTestId('tables-hint')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tables-hint').textContent).toContain('수동 잠금만 해제됐어요');
  });

  it('★ 단순 잠금 해제 → available 됨 → 안내 문구 없음', async () => {
    const lockedTables = makeTables({ 2: { status: 'locked' } });
    const availableTables = makeTables();
    apiFetch
      .mockResolvedValueOnce(lockedTables)
      .mockResolvedValueOnce(undefined) // POST unlock
      .mockResolvedValue(availableTables); // fresh fetch
    renderPage();
    await waitFor(() => expect(screen.getByTestId('table-2-unlock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('table-2-unlock'));
    // hint should NOT appear
    await waitFor(() => {
      const calls = apiFetch.mock.calls.filter((c) => c[1]?.method === 'POST');
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByTestId('tables-hint')).toBeNull();
  });

  it('★ API 5xx → ErrorState 노출, 재시도 클릭 동작', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('서버 오류', { status: 500 }));
    apiFetch.mockResolvedValue(makeTables());
    renderPage();
    await waitFor(() => expect(screen.getByText(/불러올 수 없어요/)).toBeInTheDocument());
    const retry = screen.getByText(/다시 시도/);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId('tables-grid')).toBeInTheDocument());
  });

  it('★ 401 → /admin/login 이동', async () => {
    apiFetch.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }));
    renderPage();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin/login'));
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/TablesPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
