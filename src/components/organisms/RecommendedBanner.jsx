// RecommendedBanner — design-bundle .best-banner(보급품 박스) 영역.
//
// find_error_v2 정비 (2026-05-18): 내부 MenuCard 3-card 그리드(줍기 UI) 제거.
// banner 본체(airdrop-icon · body · stencil)만 유지하고, subtitle 에 popular 메뉴 이름을 · 구분자로 나열.
//
// 마크업: <section> > <div class="best-banner">  (3-grid 제거)
// 테스트 회귀 보호: "🔥 학생회 추천 BEST" 텍스트, subtitle 의 메뉴 이름 · 결합.
import { forwardRef } from 'react';

const RecommendedBanner = forwardRef(function RecommendedBanner(
  // onAdd 는 과거 카드 그리드에서 사용. find_error_v2 이후 시그니처 호환을 위해 흡수 후 무시.
  { menus = [], className = '', onAdd: _onAdd, ...rest },
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
    </section>
  );
});

export default RecommendedBanner;
