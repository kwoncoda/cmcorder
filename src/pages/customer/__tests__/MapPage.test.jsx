// Task 4.8 — MapPage 통합 테스트.
//
// 회귀 보호:
//  - 진입 시 BoothMinimapModal open (자동 표시, 메인 이미지 /map/table-location.webp)
//  - ?order_id=5 시 본인 테이블 강조 (이미지 aria-label "내 테이블 5번")
//  - 쿼리 없을 시 myTableNo=undefined ("내 테이블" aria-label 없음)
//  - 닫기 클릭 시 navigate(-1) (history back)
//  - 임시 T1~T16 격자 보드 노출 X (이미지 기반 UI 교체)
//  - design_fix_v3: minimap-legend (내 테이블 / 총 N개 테이블) 미노출
//  - a11y (axe)
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';

import MapPage from '../MapPage.jsx';

// 라우팅 트래커 — navigate(-1) 검증용.
// MemoryRouter는 history 스택을 가지므로 initialEntries로 이전 페이지를 두면
// 닫기 시 그 페이지로 이동하는지 검증 가능.
function LocationTracker() {
  const location = useLocation();
  return <div data-testid="location-pathname">{location.pathname}</div>;
}

function renderPage(initialEntries = ['/menu', '/map']) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
      <Routes>
        <Route path="/map" element={<MapPage />} />
        <Route
          path="/menu"
          element={
            <>
              <div data-testid="menu-page-stub">메뉴 페이지</div>
              <LocationTracker />
            </>
          }
        />
        <Route path="*" element={<LocationTracker />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // body overflow lock 정리 (BoothMinimapModal effect).
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('MapPage', () => {
  it('★ 진입 시 BoothMinimapModal 자동 표시', () => {
    renderPage();
    expect(screen.getByTestId('booth-minimap-modal')).toBeInTheDocument();
    expect(screen.getByText(/테이블 지도/)).toBeInTheDocument();
  });

  it('★ 메인 이미지 /map/table-location.webp 렌더 (격자 fallback 미노출)', () => {
    renderPage(['/menu', '/map']);
    const img = screen.getByAltText('테이블 위치 약도');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('/map/table-location.webp');
    // 임시 T1~T16 격자 보드는 더이상 렌더되면 안 된다.
    expect(screen.queryByTestId('map-fallback-grid')).not.toBeInTheDocument();
    expect(screen.queryByText('T16')).not.toBeInTheDocument();
  });

  it('★ design_fix_v3 — legend 문구 ("내 테이블" / "총 N개 테이블") 미노출', () => {
    renderPage(['/menu', '/map']);
    expect(screen.queryByText(/총 \d+개 테이블/)).not.toBeInTheDocument();
    expect(screen.queryByText(/내 테이블:/)).not.toBeInTheDocument();
  });

  it('★ ?order_id=5 시 본인 테이블 5번 강조 (이미지 aria-label)', () => {
    renderPage(['/menu', '/map?order_id=5']);
    // 이미지 모드 — 메인 이미지에 "내 테이블 5번" aria-label.
    expect(screen.getByLabelText('내 테이블 5번')).toBeInTheDocument();
  });

  it('★ 쿼리 없을 시 myTableNo=undefined — "내 테이블" aria-label 없음', () => {
    renderPage(['/menu', '/map']);
    // 이미지 모드 + myTableNo 없음 — "내 테이블 N번" aria-label 미부여.
    expect(screen.queryByLabelText(/내 테이블/)).not.toBeInTheDocument();
  });

  it('★ 닫기 버튼 클릭 시 navigate(-1) — 이전 페이지(/menu)로 이동', () => {
    renderPage(['/menu', '/map']);
    fireEvent.click(screen.getByTestId('modal-close-top'));
    expect(screen.getByTestId('menu-page-stub')).toBeInTheDocument();
  });

  it('★ section data-testid="map-page" 노출 (회귀)', () => {
    renderPage();
    expect(screen.getByTestId('map-page')).toBeInTheDocument();
  });

  it('a11y 위반 없음 (axe)', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/MapPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
