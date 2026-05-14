// Task 4.9 — ClosedPage 통합 테스트 (5 케이스).
//
// 회귀 보호:
//  - 쿼리 reason=before-open 시 ClosedScreen with reason='before-open'
//  - 쿼리 reason 없을 시 default 'before-open'
//  - operatingDate 쿼리 전달
//  - testid 노출
//  - a11y (axe)
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

import ClosedPage from '../ClosedPage.jsx';

function renderPage(initialPath = '/closed') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/closed" element={<ClosedPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('ClosedPage', () => {
  it('★ 기본 reason=before-open — "아직 영업 시작 전" 카피', () => {
    renderPage();
    expect(screen.getByText(/아직 영업 시작 전/)).toBeInTheDocument();
  });

  it('★ ?reason=after-close 시 "오늘 영업이 끝났어요" 카피', () => {
    renderPage('/closed?reason=after-close');
    expect(screen.getByText(/오늘 영업이 끝났어요/)).toBeInTheDocument();
  });

  it('★ ?reason=both-days-done 시 "축제 부스가 종료" 카피', () => {
    renderPage('/closed?reason=both-days-done');
    expect(screen.getByText(/축제 부스가 종료/)).toBeInTheDocument();
  });

  it('★ ?date=2026-05-21 쿼리 operatingDate 전달 — 5월 21일 (목) 강조', () => {
    renderPage('/closed?date=2026-05-21');
    // 운영 일정 카드에 5/21 행 존재.
    expect(screen.getByText(/5월 21일/)).toBeInTheDocument();
  });

  it('★ 운영 일정 카드 노출 (operating-schedule testid)', () => {
    renderPage();
    expect(screen.getByTestId('operating-schedule')).toBeInTheDocument();
  });

  it('★ section data-testid="closed-page" 노출 (회귀)', () => {
    renderPage();
    expect(screen.getByTestId('closed-page')).toBeInTheDocument();
  });

  it('a11y 위반 없음 (axe)', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/ClosedPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
