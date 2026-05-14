// Task 4.1 — CustomerLayout 단위 테스트.
// 공통 레이아웃 (헤더·로고·🗺️ 아이콘) + 423 reactive 가드.
// USER_FLOW §4.6 + §3.5 3조 (API 호출 단일 reactive) / 결정 i / G13.
//
// 핵심 회귀:
//  - 헤더 로고 + 지도 아이콘 렌더 + a11y 통과
//  - <Outlet/>로 자식 라우트 렌더
//  - BusinessClosedError (HTTP 423) catch → /closed redirect
//  - 진행 중 주문 페이지(/orders/:id/{complete,transfer,status})에서는 redirect X
//    (이미 PAID/READY/DONE 등 정산 가드 통과 = 영향 X)
//  - 일반 에러는 redirect 발화 X
//
// 폴링은 *사용하지 않는다*. unhandledrejection 단일 진입점만.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CustomerLayout from '../CustomerLayout.jsx';
import { BusinessClosedError } from '../../../api/client.js';

// 테스트용 자식 페이지 (Outlet 검증용).
function TestPage() {
  return <div data-testid="test-page">테스트 페이지</div>;
}

// /closed 라우트 placeholder — redirect 검증용.
function ClosedPagePlaceholder() {
  return <div data-testid="closed-redirect-target">closed 페이지</div>;
}

function renderWithLayout(initialPath = '/menu') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<CustomerLayout />}>
          <Route path="/menu" element={<TestPage />} />
          <Route path="/cart" element={<TestPage />} />
          <Route path="/orders/:id/status" element={<TestPage />} />
          <Route path="/orders/:id/complete" element={<TestPage />} />
          <Route path="/orders/:id/transfer" element={<TestPage />} />
        </Route>
        <Route path="/closed" element={<ClosedPagePlaceholder />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CustomerLayout', () => {
  it('헤더 로고 + 지도 아이콘이 렌더된다', () => {
    renderWithLayout('/menu');
    expect(screen.getByText('🍗 치킨이닭')).toBeInTheDocument();
    expect(screen.getByTestId('header-map-link')).toBeInTheDocument();
  });

  it('자식 라우트가 Outlet 으로 렌더된다', () => {
    renderWithLayout('/menu');
    expect(screen.getByTestId('test-page')).toBeInTheDocument();
  });

  it('지도 아이콘은 /map 으로 가는 링크다', () => {
    renderWithLayout('/menu');
    const link = screen.getByTestId('header-map-link');
    expect(link).toHaveAttribute('href', '/map');
  });

  it('★ BusinessClosedError unhandledrejection 시 /closed 로 redirect', () => {
    renderWithLayout('/menu');

    // BusinessClosedError 가 reject 된 promise 로 전파됐다고 시뮬.
    act(() => {
      const event = new Event('unhandledrejection');
      event.reason = new BusinessClosedError({});
      event.preventDefault = vi.fn();
      window.dispatchEvent(event);
    });

    // navigate가 호출되어 /closed 페이지가 렌더됨.
    expect(screen.getByTestId('closed-redirect-target')).toBeInTheDocument();
    // 원래 페이지는 더 이상 렌더되지 않는다.
    expect(screen.queryByTestId('test-page')).not.toBeInTheDocument();
  });

  it('★ 진행 중 주문 /orders/:id/status 에서는 423 시 redirect X', () => {
    renderWithLayout('/orders/17/status');
    expect(screen.getByTestId('test-page')).toBeInTheDocument();

    act(() => {
      const event = new Event('unhandledrejection');
      event.reason = new BusinessClosedError({});
      event.preventDefault = vi.fn();
      window.dispatchEvent(event);
    });

    // 여전히 같은 페이지 (보호 대상)
    expect(screen.getByTestId('test-page')).toBeInTheDocument();
    expect(screen.queryByTestId('closed-redirect-target')).not.toBeInTheDocument();
  });

  it('★ /orders/:id/complete 도 redirect X (진행 중 보호)', () => {
    renderWithLayout('/orders/17/complete');

    act(() => {
      const event = new Event('unhandledrejection');
      event.reason = new BusinessClosedError({});
      event.preventDefault = vi.fn();
      window.dispatchEvent(event);
    });

    expect(screen.getByTestId('test-page')).toBeInTheDocument();
    expect(screen.queryByTestId('closed-redirect-target')).not.toBeInTheDocument();
  });

  it('★ /orders/:id/transfer 도 redirect X (진행 중 보호)', () => {
    renderWithLayout('/orders/17/transfer');

    act(() => {
      const event = new Event('unhandledrejection');
      event.reason = new BusinessClosedError({});
      event.preventDefault = vi.fn();
      window.dispatchEvent(event);
    });

    expect(screen.getByTestId('test-page')).toBeInTheDocument();
    expect(screen.queryByTestId('closed-redirect-target')).not.toBeInTheDocument();
  });

  it('일반 에러는 redirect 발화 X (console.error 만)', () => {
    renderWithLayout('/menu');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => {
      const event = new Event('unhandledrejection');
      event.reason = new Error('기타 에러');
      window.dispatchEvent(event);
    });

    // 여전히 같은 페이지 — redirect 안 일어남.
    expect(screen.getByTestId('test-page')).toBeInTheDocument();
    expect(screen.queryByTestId('closed-redirect-target')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  // axe-core 의 colorContrast 룰은 jsdom 에서 canvas getContext 폴백 경로를 타서
  //  매우 느리다. CustomerLayout 은 헤더에 두 개의 <Link> + Icon 트리라
  //  병렬 실행 부하 하에 기본 5s testTimeout 을 자주 넘긴다.
  //  실제 색 대비는 디자인 토큰 단계(Task 1.x)에서 보장 → 본 테스트는
  //  레이아웃 구조의 a11y(랜드마크·aria 등)만 검사한다.
  it('a11y 위반 없음 (axe-core, color-contrast 제외)', async () => {
    const { container } = renderWithLayout('/menu');
    const { axe } = await import('vitest-axe');
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  }, 20_000);
});
