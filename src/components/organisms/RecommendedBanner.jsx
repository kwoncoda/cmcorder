// RecommendedBanner — organism (Task 4.2).
//
// "🔥 학생회 추천 BEST" 정적 TOP 3 영역 — 결정 E (관리자 토글 기반 정적 추천).
//
// 핵심:
//  - menus 비어있으면 미렌더 (불필요 공간 차지 X)
//  - MenuCard 3개 grid-cols-3 — 작은 일러스트로 가로 배치 (메뉴 본 목록과 분리 인식)
//  - recommended prop 으로 MenuCard 의 도장 표시 (오른쪽 상단 RECOMMENDED 스탬프)
//  - 카피 "🔥 학생회 추천 BEST" — 형광 옐로 텍스트 X (AI 슬롭 #26)
//
// 관련 결정: 결정 E / G11 / UX §6.1 / AI 슬롭 #26
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
      <h2 id="recommended-title" className="font-display font-bold text-lg text-ink">
        🔥 학생회 추천 BEST
      </h2>
      <div className="grid grid-cols-3 gap-sm">
        {menus.map((m) => (
          <MenuCard
            key={m.id}
            menu={m}
            recommended
            useFallback
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  );
});

export default RecommendedBanner;
