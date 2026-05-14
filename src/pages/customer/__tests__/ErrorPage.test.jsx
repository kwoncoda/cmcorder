// Task 4.9 — ErrorPage 통합 테스트 (5 케이스).
//
// 회귀 보호:
//  - 기본 code=404 시 "임무에서 사라졌어요" 카피 + 마스코트(canceled)
//  - code=500 시 "시스템 오류" 카피
//  - message prop 시 그 메시지 표시
//  - "메뉴 화면으로" CTA 클릭 시 /menu navigate
//  - role="alert" — 즉시 announce
//  - a11y (axe)
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

import ErrorPage from '../ErrorPage.jsx';

function renderPage({ code, message } = {}, initialPath = '/error') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/error"
          element={<ErrorPage code={code} message={message} />}
        />
        <Route path="/menu" element={<div data-testid="menu-page-stub">메뉴</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('ErrorPage', () => {
  it('★ 기본 code=404 — "임무에서 사라졌어요" 카피', () => {
    renderPage();
    expect(screen.getByText(/임무에서 사라졌어요/)).toBeInTheDocument();
    expect(screen.getByText(/\[404\]/)).toBeInTheDocument();
  });

  it('★ code=500 — "시스템 오류가 발생했어요" 카피', () => {
    renderPage({ code: 500 });
    expect(screen.getByText(/시스템 오류가 발생했어요/)).toBeInTheDocument();
    expect(screen.getByText(/\[500\]/)).toBeInTheDocument();
  });

  it('★ message prop 시 그 메시지 표시 (커스텀 description)', () => {
    renderPage({ code: 500, message: '백엔드 연결 실패' });
    expect(screen.getByText(/백엔드 연결 실패/)).toBeInTheDocument();
  });

  it('★ "메뉴 화면으로" 클릭 시 /menu navigate', () => {
    renderPage();
    fireEvent.click(screen.getByRole('link', { name: /메뉴 화면으로/ }));
    expect(screen.getByTestId('menu-page-stub')).toBeInTheDocument();
  });

  it('★ role="alert" — 즉시 SR 안내', () => {
    renderPage();
    const page = screen.getByTestId('error-page');
    expect(page).toHaveAttribute('role', 'alert');
  });

  it('★ section data-testid="error-page" 노출 (회귀)', () => {
    renderPage();
    expect(screen.getByTestId('error-page')).toBeInTheDocument();
  });

  it('a11y 위반 없음 (axe)', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/ErrorPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
