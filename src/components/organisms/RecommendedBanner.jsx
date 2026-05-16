// RecommendedBanner — design-bundle .best-banner(보급품 박스) + MenuCard 3개 그리드.
//
// 마크업: <section class="best-banner"> (메타 정보) + 별도 <div class="best-grid"> (3개 카드).
// 테스트 회귀 보호: "🔥 학생회 추천 BEST" 텍스트, MenuCard 3개 heading (후라이드/양념/뿌링클).
import { forwardRef } from 'react';
import MenuCard from './MenuCard.jsx';

const RecommendedBanner = forwardRef(function RecommendedBanner(
  { menus = [], onAdd, className = '', ...rest },
  ref,
) {
  if (menus.length === 0) return null;

  return (
    <section
      ref={ref}
      data-testid="recommended-banner"
      aria-labelledby="recommended-title"
      className={`flex flex-col gap-sm ${className}`.trim()}
      {...rest}
    >
      <div className="best-banner">
        <div className="airdrop-icon" aria-hidden="true">
          <span className="airdrop-grade">★</span>
        </div>
        <div className="airdrop-body">
          <div className="airdrop-label" id="recommended-title">🔥 학생회 추천 BEST</div>
          <div className="airdrop-sub">{menus.map((m) => m.name).join(' · ')}</div>
        </div>
        <div className="airdrop-stencil" aria-hidden="true">
          WINNER WINNER<br />CHICKEN DINNER
        </div>
      </div>
      <div className="grid grid-cols-3 gap-sm" style={{ padding: '0 16px' }}>
        {menus.slice(0, 3).map((m) => (
          <MenuCard
            key={m.id}
            menu={m}
            recommended
            useFallback={!m.image}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  );
});

export default RecommendedBanner;
