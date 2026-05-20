// design_fix_v4 Task 1 — TableMapCTA organism 단위 테스트.
//
// 메뉴 페이지 상단(카테고리 바 위)에 노출되는 가로 카드 CTA.
// 클릭 시 /map 으로 진입(기존 BoothMinimapModal 풀스크린 페이지) — 인플레이스 모달 X.
//
// 회귀 보호:
//  - 사용자 확정 카피 3종(제목/설명/보조) 모두 노출
//  - <Link to="/map"> — href 검증
//  - data-testid="home-table-map-cta" 노출
//  - public/map/table-location.webp 썸네일 활용
//  - 접근성: 명확한 aria-label 또는 키보드 접근 가능 (Link = native anchor)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TableMapCTA from '../TableMapCTA.jsx';

function renderCTA() {
  return render(
    <MemoryRouter>
      <TableMapCTA />
    </MemoryRouter>,
  );
}

describe('TableMapCTA', () => {
  it('★ 제목 "테이블 배치도" 노출', () => {
    renderCTA();
    expect(screen.getByText('테이블 배치도')).toBeInTheDocument();
  });

  it('★ 설명 "주문 전 테이블 위치를 확인해 주세요" 노출', () => {
    renderCTA();
    expect(screen.getByText('주문 전 테이블 위치를 확인해 주세요')).toBeInTheDocument();
  });

  it('★ 보조 카피 "배치도 보기" 노출', () => {
    renderCTA();
    expect(screen.getByText('배치도 보기')).toBeInTheDocument();
  });

  it('★ <Link to="/map"> — href 가 /map', () => {
    renderCTA();
    const link = screen.getByTestId('home-table-map-cta');
    expect(link).toHaveAttribute('href', '/map');
  });

  it('★ data-testid="home-table-map-cta" 노출', () => {
    renderCTA();
    expect(screen.getByTestId('home-table-map-cta')).toBeInTheDocument();
  });

  it('★ aria-label 로 의미 전달 — 부스 테이블 배치도', () => {
    renderCTA();
    const link = screen.getByTestId('home-table-map-cta');
    expect(link).toHaveAttribute('aria-label');
    expect(link.getAttribute('aria-label')).toMatch(/테이블 배치도/);
  });

  it('★ 썸네일 — public/map/table-location.webp 사용', () => {
    const { container } = renderCTA();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/map/table-location.webp');
    // 장식 이미지 — alt="" (옆 텍스트가 의미 운반)
    expect(img.getAttribute('alt')).toBe('');
  });

  it('★ 클릭 가능 영역 — anchor 단일 wrapper', () => {
    renderCTA();
    const link = screen.getByTestId('home-table-map-cta');
    expect(link.tagName).toBe('A');
  });
});
