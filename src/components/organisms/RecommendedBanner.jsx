// RecommendedBanner — organism (Task 4.2 + P2-1 Codex v3 2026-05-15).
//
// "🔥 학생회 추천 BEST" TOP 3 영역 — 어드민이 메뉴 관리에서 recommended
// 토글로 직접 선택 (ADR-017 변경 2026-05-15: 동적 랭킹·판매 수·fallback 모두 폐기).
//
// 핵심:
//  - menus 비어있으면 미렌더 — 어드민이 토글 안 한 경우 BEST 영역 자체 노출 X
//  - MenuCard 3개 grid-cols-3 — 작은 일러스트로 가로 배치 (메뉴 본 목록과 분리 인식)
//  - recommended prop 으로 MenuCard 의 도장 표시 (오른쪽 상단 RECOMMENDED 스탬프)
//  - 판매 수 표시 X (P2-1 사용자 결정)
//
// 관련 결정: ADR-017 변경 / G11 / UX §6.1 / AI 슬롭 #26
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
