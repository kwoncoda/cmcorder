// Task 4.1 — CustomerLayout 단위 테스트.
// 공통 레이아웃 (헤더·로고·🗺️ 아이콘) + 423 reactive 가드.
// USER_FLOW §4.6 + §3.5 3조 (API 호출 단일 reactive) / 결정 i / G13.
//
// 핵심 회귀:
//  - 헤더 로고 + 인벤토리 버튼 렌더 + a11y 통과 (design_fix_v5: 헤더 미니맵 버튼 삭제)
//  - <Outlet/>로 자식 라우트 렌더
//  - BusinessClosedError (HTTP 423) catch → /closed redirect
//  - 진행 중 주문 페이지(/orders/:id/{complete,transfer,status})에서는 redirect X
//    (이미 PAID/READY/DONE 등 정산 가드 통과 = 영향 X)
//  - 일반 에러는 redirect 발화 X
//
// 폴링은 *사용하지 않는다*. unhandledrejection 단일 진입점만 (+ P0-5 마운트 시 1회 sync).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CustomerLayout from '../CustomerLayout.jsx';
import { BusinessClosedError } from '../../../api/client.js';
import useBusinessStateStore from '../../../store/businessState.js';

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

// fetch mock — /api/business-state 응답 제어.
function mockBusinessStateResponse(body, status = 200) {
  const orig = global.fetch;
  global.fetch = vi.fn(async (url) => {
    if (typeof url === 'string' && url.includes('/api/business-state')) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
    return orig ? orig(url) : new Response('not-mocked', { status: 404 });
  });
}

describe('CustomerLayout', () => {
  beforeEach(() => {
    // 기본은 OPEN — 기존 테스트들이 redirect 미발화를 가정하기 때문.
    // P0-5 CLOSED 케이스에서는 mockBusinessStateResponse + setState로 명시 변경.
    useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
    mockBusinessStateResponse({ status: 'OPEN', operating_date: '2026-05-20' });
  });

  it('헤더 로고 + 인벤토리 버튼이 렌더된다', () => {
    renderWithLayout('/menu');
    expect(screen.getByText('🍗 치킨이닭')).toBeInTheDocument();
    expect(screen.getByTestId('header-cart-link')).toBeInTheDocument();
  });

  it('자식 라우트가 Outlet 으로 렌더된다', () => {
    renderWithLayout('/menu');
    expect(screen.getByTestId('test-page')).toBeInTheDocument();
  });

  // design_fix_v5 (2026-05-20, 사용자 요청): 헤더 미니맵 버튼 삭제 —
  // 홈 카테고리 바 위 TableMapCTA(/map 으로 가는 Link)가 단일 진입점.
  it('★ design_fix_v5 — 헤더 미니맵 버튼은 더 이상 존재하지 않는다', () => {
    renderWithLayout('/menu');
    expect(screen.queryByTestId('header-map-link')).not.toBeInTheDocument();
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

  // ── P0-5 (Codex 리뷰) CLOSED GET 가드 ────────────────────────
  it('★ P0-5 — 마운트 시 서버가 CLOSED 응답 → /menu에서 /closed redirect', async () => {
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    mockBusinessStateResponse({ status: 'CLOSED', operating_date: '2026-05-20' });
    renderWithLayout('/menu');
    await waitFor(
      () => expect(screen.getByTestId('closed-redirect-target')).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it('★ P0-5 — CLOSED 응답이어도 /orders/:id/status에서는 redirect X (진행 중 보호)', async () => {
    useBusinessStateStore.setState({ status: 'CLOSED', operating_date: '2026-05-20' });
    mockBusinessStateResponse({ status: 'CLOSED', operating_date: '2026-05-20' });
    renderWithLayout('/orders/17/status');
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByTestId('test-page')).toBeInTheDocument();
    expect(screen.queryByTestId('closed-redirect-target')).not.toBeInTheDocument();
  });

  it('★ P0-5 — OPEN 응답 시 redirect 발화 X', async () => {
    mockBusinessStateResponse({ status: 'OPEN', operating_date: '2026-05-20' });
    renderWithLayout('/menu');
    await new Promise((r) => setTimeout(r, 300));
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
