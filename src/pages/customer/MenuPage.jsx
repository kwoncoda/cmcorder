// C-1 메뉴 페이지 — design-bundle ScreenMenu (screens-customer.jsx:32-132) 정합.
// 5개 카테고리(전체/추천/치킨/사이드/음료) + best-banner (보급품 박스만, 카드 중복 X) + .menu-grid.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuData } from '../../hooks/useMenuData.js';
import useCartStore from '../../store/cart.js';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import EmptyState from '../../components/state/EmptyState.jsx';
import RecommendedBanner from '../../components/organisms/RecommendedBanner.jsx';
import CategoryTabs from '../../components/organisms/CategoryTabs.jsx';
import MenuList from '../../components/organisms/MenuList.jsx';
import StickyCartBar from '../../components/organisms/StickyCartBar.jsx';
import RecentOrdersSection from '../../components/organisms/RecentOrdersSection.jsx';

const CATEGORIES = [
  { value: 'all',         label: '전체' },
  { value: 'recommended', label: '추천' },
  { value: 'chicken',     label: '치킨' },
  { value: 'side',        label: '사이드' },
  { value: 'drink',       label: '음료' },
];

export default function MenuPage() {
  const { menus, popular, isLoading, error, refetch } = useMenuData();
  const [category, setCategory] = useState('all');
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  // ★ useMemo 는 early return *위* 에 — React Hook 순서 규칙. menus 는 useMenuData 가
  //   `menuQuery.data ?? []` 로 항상 배열을 보장하므로 isLoading=true 시에도 안전.
  const filteredMenus = useMemo(() => {
    if (category === 'all') return menus;
    if (category === 'recommended') return menus.filter((m) => m.recommended);
    return menus.filter((m) => m.category === category);
  }, [category, menus]);

  if (isLoading) return (<div data-testid="menu-page"><LoadingState variant="page" label="메뉴 가져오는 중…" minimumDelay={0} /></div>);
  if (error) return (
    <div data-testid="menu-page">
      <ErrorState variant="page" title="메뉴를 불러오지 못했어요" description="네트워크를 확인하고 다시 시도해 주세요." code={error.code ?? 'NETWORK'} actionLabel="다시 시도" onAction={refetch} />
    </div>
  );

  return (
    <section data-testid="menu-page" style={{ paddingBottom: 96 }}>
      <RecentOrdersSection />
      <CategoryTabs categories={CATEGORIES} value={category} onChange={setCategory} />
      {category === 'all' && <RecommendedBanner menus={popular} onAdd={(menu) => addItem(menu)} />}
      {filteredMenus.length === 0 ? (
        <EmptyState
          title={category === 'all' ? '메뉴가 없어요' : '이 분류의 메뉴가 없어요'}
          description={category === 'all' ? '운영진에게 문의해 주세요.' : '다른 분류를 살펴보세요.'}
          mascot="default"
          actionLabel={category !== 'all' ? '전체 보기' : undefined}
          onAction={category !== 'all' ? () => setCategory('all') : undefined}
        />
      ) : (
        <MenuList menus={filteredMenus} onAdd={(menu) => addItem(menu)} />
      )}
      <StickyCartBar onCheckout={() => navigate('/cart')} />
    </section>
  );
}
