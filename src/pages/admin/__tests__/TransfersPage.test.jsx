// Task 5.3 — TransfersPage 단위 테스트 (7 케이스).
//
// 회귀 보호:
//  - Loading 분기
//  - Error 분기 + 재시도
//  - 비어있음 — EmptyState 렌더
//  - 목록 표시 — 카드 N개
//  - 카드 클릭 시 /admin/orders/:id 이동
//  - 401 응답 시 /admin/login redirect
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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

import TransfersPage from '../TransfersPage.jsx';

const SAMPLE_TRANSFERS = [
  {
    id: 17,
    no: 17,
    depositor_name: '홍길동',
    bank: '국민',
    amount: 18000,
    transferred_at: '17:31',
    status: 'TRANSFER_REPORTED',
  },
  {
    id: 18,
    no: 18,
    depositor_name: '김철수',
    bank: '신한',
    amount: 24000,
    transferred_at: '17:33',
    status: 'TRANSFER_REPORTED',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <TransfersPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TransfersPage', () => {
  it('★ Loading 분기 — fetch 중 본문(list/empty) 미렌더', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    // testid 래퍼는 항상 노출(라우팅 회귀용) — 본문 list/empty 만 미렌더 확인.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(/확인 대기 중인 이체가 없어요/)).not.toBeInTheDocument();
  });

  it('★ Error 분기 — fetch 실패 시 ErrorState + 재시도', async () => {
    apiFetch.mockRejectedValue(new ApiError('Server error', { status: 500 }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/이체 목록을 불러올 수 없어요/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('★ 비어있을 시 EmptyState 표시', async () => {
    apiFetch.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/확인 대기 중인 이체가 없어요/)).toBeInTheDocument();
    });
  });

  it('★ 목록 표시 — 카드 2개', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_TRANSFERS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('transfer-row-17')).toBeInTheDocument();
    });
    expect(screen.getByTestId('transfer-row-18')).toBeInTheDocument();
    expect(screen.getByText(/이체 확인/)).toBeInTheDocument();
  });

  it('★ 카드 클릭 시 /admin/orders/:id 이동', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_TRANSFERS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('transfer-row-17')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('transfer-row-17'));
    expect(navigateMock).toHaveBeenCalledWith('/admin/orders/17');
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
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/TransfersPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
