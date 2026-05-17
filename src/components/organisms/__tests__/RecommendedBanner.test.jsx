// Task 4.2 — RecommendedBanner organism 단위 테스트.
//
// find_error_v2 정비 (2026-05-18): 추천 영역 줍기 UI 제거 — banner subtitle 만 유지.
// 회귀 포인트:
//  - 빈 popular 시 미렌더
//  - 카피 "🔥 학생회 추천 BEST" — 결정 E
//  - subtitle 에 메뉴 이름 표시 (· 구분자)
//  - MenuCard 3-grid 미렌더 (줍기 버튼 X)
//  - onAdd prop 전달돼도 무시 + 에러 X
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

  it('subtitle 에 메뉴 이름 · 구분자 형식으로 표시', () => {
    render(<RecommendedBanner menus={POPULAR} />);
    expect(screen.getByText('후라이드 · 양념 · 뿌링클')).toBeInTheDocument();
  });

  it('★ MenuCard 3-grid 미렌더 — 추천 영역 줍기 UI 제거', () => {
    render(<RecommendedBanner menus={POPULAR} />);
    // MenuCard 가 노출하던 menu-card-{id} testid 가 banner 안에 없어야 함.
    expect(screen.queryByTestId('menu-card-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-card-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-card-3')).not.toBeInTheDocument();
  });

  it('★ "줍기" 버튼 미렌더 — 추천 영역 카드 제거', () => {
    render(<RecommendedBanner menus={POPULAR} />);
    expect(screen.queryByRole('button', { name: /줍기/ })).not.toBeInTheDocument();
  });

  it('onAdd prop 전달돼도 에러 없이 무시', () => {
    const onAdd = () => { throw new Error('onAdd 호출되면 안 됨'); };
    expect(() => render(<RecommendedBanner menus={POPULAR} onAdd={onAdd} />)).not.toThrow();
  });
});
