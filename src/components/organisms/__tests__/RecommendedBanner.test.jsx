// Task 4.2 — RecommendedBanner organism 단위 테스트.
//
// 회귀 포인트:
//  - 빈 popular 시 미렌더 (정적 BEST 없으면 영역 비움)
//  - 카피 "🔥 학생회 추천 BEST" — 결정 E
//  - MenuCard 3개 렌더 (TOP 3)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecommendedBanner from '../RecommendedBanner.jsx';

const POPULAR = [
  { id: 1, code: 'BANDAGE',   name: '후라이드', category: 'chicken', basePrice: 18000 },
  { id: 2, code: 'FIRST_AID', name: '양념',     category: 'chicken', basePrice: 19000 },
  { id: 3, code: 'MED_KIT',   name: '뿌링클',   category: 'chicken', basePrice: 21000 },
];

describe('RecommendedBanner', () => {
  it('★ 빈 popular 시 미렌더', () => {
    render(<RecommendedBanner menus={[]} />);
    expect(screen.queryByTestId('recommended-banner')).not.toBeInTheDocument();
  });

  it('★ 카피 "🔥 학생회 추천 BEST" — 결정 E', () => {
    render(<RecommendedBanner menus={POPULAR} />);
    expect(screen.getByText('🔥 학생회 추천 BEST')).toBeInTheDocument();
  });

  it('MenuCard 3개 렌더', () => {
    render(<RecommendedBanner menus={POPULAR} />);
    // MenuFallback 이 name 을 별도 노출하므로 heading 으로 식별 (MenuCard 본명 h3).
    expect(screen.getByRole('heading', { name: '후라이드' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '양념' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '뿌링클' })).toBeInTheDocument();
  });
});
