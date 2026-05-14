// Task 5.4 — MenuAdminPage 단위 테스트 (10 케이스).
//
// 회귀 보호:
//  - Loading / Error 분기 + 재시도
//  - 401 응답 시 /admin/login redirect
//  - 메뉴 목록 렌더 (이름 + 가격)
//  - 품절 토글 클릭 → API 호출 + 낙관적 업데이트
//  - 추천 토글 클릭 → API 호출 + 낙관적 업데이트
//  - API 실패 시 낙관적 업데이트 롤백 + 에러 메시지
//  - EmptyState (데이터=[])
//  - a11y (axe)
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

// useApi mock — 호출자(MenuAdminPage)가 의존하는 hook 만 격리.
vi.mock('../../../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));
import { useApi } from '../../../hooks/useApi.js';

// apiFetch mock — 토글 클릭 시 호출되는 함수.
vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch, ApiError } from '../../../api/client.js';

import MenuAdminPage from '../MenuAdminPage.jsx';

const SAMPLE_MENUS = [
  { id: 1, code: 'BHC_FRIED', name: '후라이드', category: 'chicken', basePrice: 18000, soldOut: false, recommended: false },
  { id: 2, code: 'BHC_YANGNYEOM', name: '양념', category: 'chicken', basePrice: 19000, soldOut: false, recommended: true },
  { id: 3, code: 'BHC_HALFNHALF', name: '반반', category: 'chicken', basePrice: 19500, soldOut: true, recommended: false },
];

function renderPage(initialPath = '/admin/menus') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/menus" element={<MenuAdminPage />} />
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
  // 기본 useApi 응답 — 각 테스트가 필요 시 override.
  useApi.mockReturnValue({
    data: SAMPLE_MENUS,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

describe('MenuAdminPage', () => {
  it('★ Loading 분기 — useApi.isLoading=true 시 LoadingState', () => {
    useApi.mockReturnValue({ data: null, isLoading: true, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('★ Error 분기 — 5xx 시 ErrorState + 다시 시도 버튼', () => {
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

  it('★ 메뉴 목록 렌더 — 이름 + 가격 표시', () => {
    renderPage();
    expect(screen.getByTestId('menu-row-1')).toHaveTextContent('후라이드');
    expect(screen.getByTestId('menu-row-1')).toHaveTextContent('18,000원');
    expect(screen.getByTestId('menu-row-2')).toHaveTextContent('양념');
    expect(screen.getByTestId('menu-row-3')).toHaveTextContent('반반');
  });

  it('★ 품절 토글 클릭 → API 호출 + 낙관적 업데이트 (UI 즉시 변경)', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    renderPage();
    const toggleBtn = screen.getByTestId('toggle-soldout-1');
    fireEvent.click(toggleBtn);
    // 낙관적 업데이트 — 즉시 UI 변경 (소프트 검증: API 호출).
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/admin/api/menus/1/toggle',
        expect.objectContaining({ method: 'POST', body: { soldOut: true } }),
      );
    });
    // 라벨 변경 (낙관) — id=1 은 원래 soldOut=false → true 로 전환.
    expect(screen.getByTestId('toggle-soldout-1')).toHaveTextContent(/품절됨/);
  });

  it('★ 추천 토글 클릭 → API 호출 + 낙관적 업데이트', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    renderPage();
    const toggleBtn = screen.getByTestId('toggle-recommended-1');
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/admin/api/menus/1/toggle',
        expect.objectContaining({ method: 'POST', body: { recommended: true } }),
      );
    });
    expect(screen.getByTestId('toggle-recommended-1')).toHaveTextContent(/추천중/);
  });

  it('★ API 실패 시 낙관 롤백 + 인라인 에러 메시지', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('서버 오류', { status: 500 }));
    renderPage();
    fireEvent.click(screen.getByTestId('toggle-soldout-1'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('서버 오류');
    });
    // 롤백 — 원래 라벨 (품절 토글) 으로 복귀.
    expect(screen.getByTestId('toggle-soldout-1')).toHaveTextContent('품절 토글');
  });

  it('★ EmptyState — 데이터=[] 시 표시', () => {
    useApi.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/메뉴가 없어요/)).toBeInTheDocument();
  });

  it('★ a11y 위반 없음', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/MenuAdminPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
