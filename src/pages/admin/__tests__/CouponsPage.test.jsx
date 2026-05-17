// find_error_v2 — CouponsPage 단위 테스트.
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

import CouponsPage from '../CouponsPage.jsx';

const SAMPLE = [
  {
    id: 1,
    order_id: 17,
    order_no: 17,
    name: '홍길동',
    student_id: '202637001',
    coupon_name: '컴모융 1,000원 할인',
    discount_amount: 1000,
    used_at: '2026-05-20T17:30:00Z',
  },
  {
    id: 2,
    order_id: 18,
    order_no: 18,
    name: '박서연',
    student_id: '202637088',
    coupon_name: '컴모융 1,000원 할인',
    discount_amount: 1000,
    used_at: '2026-05-20T17:32:00Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <CouponsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CouponsPage', () => {
  it('★ Empty — 사용된 쿠폰 없으면 안내', async () => {
    apiFetch.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/사용된 쿠폰이 없어요/)).toBeInTheDocument();
    });
  });

  it('★ 목록 — 학번·이름·쿠폰명·주문번호·할인 표시', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('coupon-row-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('coupon-row-2')).toBeInTheDocument();
    // 학번
    expect(screen.getByText('202637001')).toBeInTheDocument();
    expect(screen.getByText('202637088')).toBeInTheDocument();
    // 이름 · 쿠폰명 (한 노드에 같이 표시)
    expect(screen.getByText(/홍길동 · 컴모융 1,000원 할인/)).toBeInTheDocument();
    expect(screen.getByText(/박서연 · 컴모융 1,000원 할인/)).toBeInTheDocument();
    // 주문번호
    expect(screen.getByText('#17')).toBeInTheDocument();
    expect(screen.getByText('#18')).toBeInTheDocument();
    // 할인 금액 (-1,000원 셀이 2개)
    expect(screen.getAllByText('-1,000원')).toHaveLength(2);
  });

  // P2-3 (Codex 리뷰) — 모바일 반응형 — 행 구조에 .coupon-usage-row 클래스 적용.
  it('★ P2-3 — 행에 coupon-usage-row 클래스 적용 (반응형 CSS hook)', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('coupon-row-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('coupon-row-1')).toHaveClass('coupon-usage-row');
    expect(screen.getByTestId('coupon-usage-head')).toHaveClass('coupon-usage-row');
    // 이름·쿠폰 셀에는 cu-cell-name-coupon (모바일 전체 폭 hook).
    const nameCell = screen.getByText(/홍길동 · 컴모융 1,000원 할인/);
    expect(nameCell).toHaveClass('cu-cell-name-coupon');
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
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/CouponsPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
