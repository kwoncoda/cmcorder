// Task 4.2 — MenuPage 통합 테스트.
//
// 회귀 보호:
//  - 3분기 처리: Loading / Error / Empty (분류 필터 0건)
//  - 메뉴 로드 + RecommendedBanner + CategoryTabs + MenuList
//  - 분류 선택 시 필터링
//  - "줍기" 버튼 → cart store 에 추가
//  - StickyCartBar: totalQty=0 미렌더 → 추가 시 등장
//  - 페이지 ≤120줄 — §3.5 1조 (회귀 테스트)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuPage from '../MenuPage.jsx';
import useCartStore from '../../../store/cart.js';

// useMenuData mock — 호출자(MenuPage)가 의존하는 hook 만 격리.
vi.mock('../../../hooks/useMenuData.js', () => ({
  useMenuData: vi.fn(),
}));
import { useMenuData } from '../../../hooks/useMenuData.js';

const SAMPLE_MENUS = [
  { id: 1, code: 'BANDAGE',    name: '후라이드',   category: 'chicken', basePrice: 18000 },
  { id: 2, code: 'FIRST_AID',  name: '양념',       category: 'chicken', basePrice: 19000 },
  { id: 3, code: 'MED_KIT',    name: '뿌링클',     category: 'chicken', basePrice: 20000 },
  { id: 6, code: 'ADRENALINE', name: '감자튀김',   category: 'side',    basePrice: 4000 },
  { id: 7, code: 'PAINKILLER', name: '치즈볼',     category: 'side',    basePrice: 5000 },
  { id: 8, code: 'ENERGY',     name: '콜라',       category: 'drink',   basePrice: 2000 },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <MenuPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useCartStore.setState({ items: [] });
  vi.clearAllMocks();
});

describe('MenuPage', () => {
  it('★ Loading 분기 — fetch 중 LoadingState', () => {
    useMenuData.mockReturnValue({
      menus: [], popular: [], isLoading: true, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('★ Error 분기 — fetch 실패 시 ErrorState + 다시 시도 버튼', () => {
    const refetch = vi.fn();
    useMenuData.mockReturnValue({
      menus: [], popular: [], isLoading: false, error: { code: 'NETWORK' }, refetch,
    });
    renderPage();
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('메뉴 로드 후 MenuCard 렌더', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: SAMPLE_MENUS.slice(0, 3),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    // popular + menu list + MenuFallback 모두 name 노출 — heading 으로 식별.
    expect(screen.getAllByRole('heading', { name: '후라이드' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '감자튀김' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '콜라' })).toBeInTheDocument();
  });

  it('RecommendedBanner 표시 — 🔥 학생회 추천 BEST', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: SAMPLE_MENUS.slice(0, 3),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('🔥 학생회 추천 BEST')).toBeInTheDocument();
  });

  it('★ RecommendedBanner subtitle — 메뉴 이름 · 구분자', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: SAMPLE_MENUS.slice(0, 3),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('후라이드 · 양념 · 뿌링클')).toBeInTheDocument();
  });

  it('★ RecommendedBanner 안에 줍기 카드 미렌더 — find_error_v2', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: SAMPLE_MENUS.slice(0, 3),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    const banner = screen.getByTestId('recommended-banner');
    // banner 영역 안에는 menu-card-{id} 가 없어야 함 (MenuList 는 banner 바깥).
    expect(banner.querySelector('[data-testid^="menu-card-"]')).toBeNull();
    expect(banner.querySelector('button')).toBeNull();
  });

  it('CategoryTabs 4개 표시', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: [], isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId('category-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('category-tab-chicken')).toBeInTheDocument();
    expect(screen.getByTestId('category-tab-side')).toBeInTheDocument();
    expect(screen.getByTestId('category-tab-drink')).toBeInTheDocument();
  });

  it('★ 분류 선택 시 해당 분류만 필터', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: [], isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    fireEvent.click(screen.getByTestId('category-tab-drink'));
    expect(screen.getByRole('heading', { name: '콜라' })).toBeInTheDocument();
    // popular=[] 이므로 banner 미렌더 — chicken 메뉴는 list 에도 없음
    expect(screen.queryByRole('heading', { name: '후라이드' })).not.toBeInTheDocument();
  });

  it('★ Empty 분기 — 분류 필터 결과 0건 시 EmptyState + 전체 보기 버튼', () => {
    useMenuData.mockReturnValue({
      menus: [{ id: 1, code: 'X', name: '후라이드', category: 'chicken', basePrice: 18000 }],
      popular: [], isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    fireEvent.click(screen.getByTestId('category-tab-drink'));
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    // category=all 로 복귀 — 후라이드 다시 보임
    expect(screen.getByRole('heading', { name: '후라이드' })).toBeInTheDocument();
  });

  it('★ MenuCard "줍기" 버튼 클릭 시 cart 에 추가', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: [], isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    const buttons = screen.getAllByRole('button', { name: /줍기/ });
    fireEvent.click(buttons[0]);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('★ MenuCard 빼기 버튼 클릭 시 수량 감소 + 1→0 시 카트에서 제거', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: [], isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    // 2번 줍기 → quantity 2
    fireEvent.click(screen.getAllByRole('button', { name: /줍기/ })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /줍기/ })[0]);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
    // 빼기 → quantity 1
    fireEvent.click(screen.getAllByRole('button', { name: /한 개 빼기/ })[0]);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
    // 한 번 더 빼기 → 카트에서 제거
    fireEvent.click(screen.getAllByRole('button', { name: /한 개 빼기/ })[0]);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('★ StickyCartBar — totalQty=0 시 미렌더', () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: [], isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.queryByTestId('sticky-cart-bar')).not.toBeInTheDocument();
  });

  it('★ StickyCartBar — 카트 추가 시 등장', async () => {
    useMenuData.mockReturnValue({
      menus: SAMPLE_MENUS, popular: [], isLoading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /줍기/ })[0]);
    await waitFor(() =>
      expect(screen.getByTestId('sticky-cart-bar')).toBeInTheDocument(),
    );
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    // process.cwd() 는 프로젝트 루트 — Vitest 표준.
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/MenuPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
