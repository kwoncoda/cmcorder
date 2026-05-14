// C-1 메뉴 페이지 — Task 4.2.
//
// 사용자 메인 진입점. 메뉴 8종 + 분류 탭 + 정적 BEST 영역 + 하단 카트 바.
//
// 설계 (§3.5 1조 — 페이지 ≤120줄):
//  - data fetch: useMenuData() hook 위임 (스키마 검증 포함)
//  - 표시: Organisms 합성만 (RecommendedBanner / CategoryTabs / MenuList / StickyCartBar)
//  - 3분기: Loading / Error / Empty (분류 필터 결과 0건)
//  - StickyCartBar 는 Zustand 직접 구독 (§3.5 2조) — 카트 상태 props X
//
// 관련 결정:
//  - 결정 E: 정적 BEST ("🔥 학생회 추천 BEST")
//  - G11 / UX §6.1 / §3.5 1·2조
//  - ADR-017 변경: 정적 추천 (동적 집계 X — 일회성 서비스)
import { useState } from 'react';
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

// 분류 탭 정의 — chicken/side/drink 는 CATEGORY_MAP 키와 일치.
const CATEGORIES = [
  { value: 'all',     label: '전체' },
  { value: 'chicken', label: '치킨' },
  { value: 'side',    label: '사이드' },
  { value: 'drink',   label: '음료' },
];

export default function MenuPage() {
  const { menus, popular, isLoading, error, refetch } = useMenuData();
  const [category, setCategory] = useState('all');
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  // 3분기 — Loading / Error 시 wrapper 로 testid 유지 (App 라우팅 회귀).
  if (isLoading) {
    return (
      <div data-testid="menu-page">
        <LoadingState variant="page" label="메뉴 가져오는 중…" minimumDelay={0} />
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="menu-page">
        <ErrorState
          variant="page"
          title="메뉴를 불러오지 못했어요"
          description="네트워크를 확인하고 다시 시도해 주세요."
          code={error.code ?? 'NETWORK'}
          actionLabel="다시 시도"
          onAction={refetch}
        />
      </div>
    );
  }

  const filteredMenus =
    category === 'all' ? menus : menus.filter((m) => m.category === category);

  return (
    <section
      data-testid="menu-page"
      className="flex flex-col gap-md p-md pb-24"
    >
      <RecommendedBanner menus={popular} onAdd={(menu) => addItem(menu)} />
      <CategoryTabs
        categories={CATEGORIES}
        value={category}
        onChange={setCategory}
      />
      {filteredMenus.length === 0 ? (
        <EmptyState
          title={category === 'all' ? '메뉴가 없어요' : '이 분류의 메뉴가 없어요'}
          description={
            category === 'all'
              ? '운영진에게 문의해 주세요.'
              : '다른 분류를 선택해 보세요.'
          }
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
