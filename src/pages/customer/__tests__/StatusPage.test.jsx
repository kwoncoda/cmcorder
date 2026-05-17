// Task 4.7 — StatusPage 통합 테스트 (21 케이스).
//
// 회귀 보호:
//  - 3분기: Loading / Error(5xx) / Error 404 redirect
//  - 8 상태별 한글 카피 (STATE_LABEL 매핑)
//  - ★ onStatusChange — PAID → READY 시 vibrate 1회 + pulse
//  - ★ 새로고침 후 status=READY 직진입 시 vibrate 0회 (prev=null이므로 onStatusChange 호출 X)
//  - ★ READY 이외 전이 시 진동 X
//  - ★ 동일 status 재전송 시 진동 X
//  - aria-live polite 카피 — 상태 변경 시 announce
//  - SSE 끊김 시 ErrorState 안내
//  - OrderTimeline 5단계 + history 미니뷰 표시
//  - a11y (axe)
//  - ★ 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

// useApi + useOrderPolling 둘 다 mock — 폴링/네트워크 완전 격리.
vi.mock('../../../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));
vi.mock('../../../hooks/useOrderPolling.js', () => ({
  useOrderPolling: vi.fn(),
}));

import { useApi } from '../../../hooks/useApi.js';
import { useOrderPolling } from '../../../hooks/useOrderPolling.js';

import StatusPage from '../StatusPage.jsx';

const SAMPLE_ORDER = {
  id: 17,
  no: 17,
  operating_date: '2026-05-20',
  status: 'PAID',
  items: [{ menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 }],
  total_price: 18000,
  created_at: '17:30',
  transferred_at: '17:31',
  paid_at: '17:33',
};

function renderPage(initialPath = '/orders/17/status') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/orders/:id/status" element={<StatusPage />} />
        <Route path="/map" element={<div data-testid="map-page-stub">지도</div>} />
        {/* 404 redirect target */}
        <Route path="*" element={<div data-testid="catchall-404">404</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  navigator.vibrate = vi.fn();
  // 기본 mock — 각 테스트가 필요한 만큼 override.
  useApi.mockReturnValue({
    data: SAMPLE_ORDER,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  });
  useOrderPolling.mockReturnValue({
    snapshot: null,
    status: null,
    error: null,
    isConnected: true,
  });
});

afterEach(() => {
  cleanup();
});

describe('StatusPage', () => {
  // ── 3분기 처리 ──────────────────────────────────────────────
  it('★ Loading 분기 — 첫 진입 시 LoadingState 노출', () => {
    useApi.mockReturnValue({ data: null, error: null, isLoading: true, refetch: vi.fn() });
    renderPage();
    // 메인 페이지 콘텐츠 미렌더.
    expect(screen.queryByTestId('status-page')).not.toBeInTheDocument();
  });

  it('★ Error(5xx) 분기 — ErrorState + "다시 시도" 버튼', () => {
    useApi.mockReturnValue({
      data: null,
      error: { status: 500, message: '서버 오류' },
      isLoading: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/주문 정보를 불러올 수 없어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('★ Error 404 시 catch-all 으로 redirect (페이지 미렌더)', async () => {
    useApi.mockReturnValue({
      data: null,
      error: { status: 404, message: 'not found' },
      isLoading: false,
      refetch: vi.fn(),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('catchall-404')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('status-page')).not.toBeInTheDocument();
  });

  // ── 8 상태별 한글 카피 ───────────────────────────────────────
  it.each([
    ['ORDERED', '주문 접수됨'],
    ['TRANSFER_REPORTED', '이체 완료 요청'],
    ['PAID', '입금 확인 완료'],
    ['COOKING', '조리 중'],
    ['READY', '픽업 준비 완료'],
    ['DONE', '수령 완료'],
    ['HOLD', '운영진 확인'],
    ['CANCELED', '취소'],
  ])('status=%s 시 한글 카피 "%s" 포함 (aria-live 영역)', (status, copy) => {
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    renderPage();
    // aria-live polite 영역 안에서만 검색 — StatusChip 등 다른 컴포넌트와 충돌 회피.
    const live = screen.getByRole('status');
    expect(within(live).getByText(new RegExp(copy))).toBeInTheDocument();
  });

  // ── ★ onStatusChange — 진동·pulse 부수효과 (§3.5 5조) ──────────
  it('★ onStatusChange PAID → READY 시 vibrate 1회', () => {
    // useOrderPolling mock — onStatusChange 핸들러 캡쳐 후 직접 호출.
    let capturedHandler;
    useOrderPolling.mockImplementation(({ onStatusChange }) => {
      capturedHandler = onStatusChange;
      return {
        snapshot: { ...SAMPLE_ORDER, status: 'PAID' },
        status: 'PAID',
        error: null,
        isConnected: true,
      };
    });
    renderPage();
    expect(navigator.vibrate).not.toHaveBeenCalled();
    capturedHandler('PAID', 'READY');
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    expect(navigator.vibrate).toHaveBeenCalledWith([200, 100, 200]);
  });

  it('★ 새로고침 후 status=READY 직진입 시 vibrate 0회 (prev=null)', () => {
    // 초기 useApi 데이터가 READY — onStatusChange 호출 X (prev=null 이라 useOrderPolling 자체 차단).
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status: 'READY' },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    useOrderPolling.mockReturnValue({
      snapshot: null,
      status: null,
      error: null,
      isConnected: true,
    });
    renderPage();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('★ READY 이외 전이는 진동 X — onStatusChange(ORDERED → PAID)', () => {
    let capturedHandler;
    useOrderPolling.mockImplementation(({ onStatusChange }) => {
      capturedHandler = onStatusChange;
      return {
        snapshot: { ...SAMPLE_ORDER, status: 'PAID' },
        status: 'PAID',
        error: null,
        isConnected: true,
      };
    });
    renderPage();
    capturedHandler('ORDERED', 'PAID');
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('★ 동일 status 재전송 시 진동 X — onStatusChange(READY → READY)', () => {
    // useOrderPolling에서 자동 차단되지만 핸들러 안에서도 prev === next 회귀.
    let capturedHandler;
    useOrderPolling.mockImplementation(({ onStatusChange }) => {
      capturedHandler = onStatusChange;
      return {
        snapshot: { ...SAMPLE_ORDER, status: 'READY' },
        status: 'READY',
        error: null,
        isConnected: true,
      };
    });
    renderPage();
    capturedHandler('READY', 'READY');
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  // ── aria-live polite ────────────────────────────────────────
  it('★ aria-live polite 영역 — 상태 카피 announce', () => {
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status: 'COOKING' },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    renderPage();
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent(/조리 중! 잠시만/);
  });

  // ── SSE 끊김 안내 ───────────────────────────────────────────
  it('★ SSE 끊김 시 안내 노출 — isConnected=false', () => {
    useOrderPolling.mockReturnValue({
      snapshot: null,
      status: null,
      error: null,
      isConnected: false,
    });
    renderPage();
    expect(screen.getByTestId('sse-disconnected')).toBeInTheDocument();
    expect(screen.getByText(/실시간 연결이 끊어졌어요/)).toBeInTheDocument();
  });

  it('★ SSE 연결 정상 시 끊김 안내 미렌더', () => {
    useOrderPolling.mockReturnValue({
      snapshot: null,
      status: null,
      error: null,
      isConnected: true,
    });
    renderPage();
    expect(screen.queryByTestId('sse-disconnected')).not.toBeInTheDocument();
  });

  // ── OrderTimeline 통합 (UX §5.1 보강) ──────────────────────────
  it('★ OrderTimeline 5단계 progressbar 표시', () => {
    renderPage();
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuemax', '5');
  });

  it('★ OrderTimeline history 미니뷰 — created_at/paid_at 시각 표시', () => {
    renderPage();
    // 단계별 진입 시각 (PAID 까지 진입 → ORDERED·TRANSFER·PAID 시각).
    expect(screen.getByText('17:30')).toBeInTheDocument(); // ORDERED
    expect(screen.getByText('17:31')).toBeInTheDocument(); // TRANSFER_REPORTED
    expect(screen.getByText('17:33')).toBeInTheDocument(); // PAID
  });

  // ── SSE snapshot 우선 ───────────────────────────────────────
  it('★ SSE snapshot 우선 — useApi 데이터 위에 덮어쓰기', () => {
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status: 'PAID' },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    useOrderPolling.mockReturnValue({
      snapshot: { ...SAMPLE_ORDER, status: 'COOKING' },
      status: 'COOKING',
      error: null,
      isConnected: true,
    });
    renderPage();
    // snapshot 의 COOKING 우선 — aria-live 영역 안에서 검색.
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent(/조리 중! 잠시만/);
  });

  // ── 주문 번호 표시 ───────────────────────────────────────────
  it('주문 번호 #17 표시', () => {
    renderPage();
    expect(screen.getByText(/주문 #17/)).toBeInTheDocument();
  });

  // ── 기본 testid ──────────────────────────────────────────────
  it('section data-testid="status-page" 노출', () => {
    renderPage();
    expect(screen.getByTestId('status-page')).toBeInTheDocument();
  });

  // ── a11y ────────────────────────────────────────────────────
  it('a11y 위반 없음 (axe)', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── Bug 5 — ORDERED 상태 시 sticky-bar 에 이체 완료 요청 CTA ──
  it('★ status=ORDERED 시 sticky-bar 에 "이체 완료 요청" CTA 노출', () => {
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status: 'ORDERED' },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('button', { name: /이체 완료 요청/ }),
    ).toBeInTheDocument();
  });

  it('★ status=ORDERED CTA 클릭 시 /orders/:id/transfer 로 navigate', () => {
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status: 'ORDERED' },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    // transfer 라우트 stub 을 단독 렌더링 — renderPage 와 별개로 단일 트리.
    render(
      <MemoryRouter initialEntries={['/orders/17/status']}>
        <Routes>
          <Route path="/orders/:id/status" element={<StatusPage />} />
          <Route
            path="/orders/:id/transfer"
            element={<div data-testid="transfer-page-stub">이체</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('status-page-ordered-cta'));
    expect(screen.getByTestId('transfer-page-stub')).toBeInTheDocument();
  });

  // ── P2-1 (Codex 최종 리뷰) — HOLD UX 정책 ────────────────────────
  // 서버가 HOLD → TRANSFER_REPORTED 사용자 재요청을 409로 막으므로, status 화면에서도
  // 재제출 CTA를 노출하면 안 된다. 대신 "부스 운영진 문의" 안내로 통일.
  it('★ P2-1 — status=HOLD 시 "이체 정보 다시 보내기" CTA 미노출', () => {
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status: 'HOLD' },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.queryByRole('button', { name: /이체 정보 다시 보내기/ })).not.toBeInTheDocument();
    // ORDERED CTA도 노출되지 않아야 함 (다른 상태 CTA 침투 회귀).
    expect(screen.queryByTestId('status-page-ordered-cta')).not.toBeInTheDocument();
  });

  it('★ P2-1 — status=HOLD 시 "부스 운영진에게 문의" 안내 노출', () => {
    useApi.mockReturnValue({
      data: { ...SAMPLE_ORDER, status: 'HOLD' },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/부스 운영진에게 문의/)).toBeInTheDocument();
  });

  // ── 회귀 — 페이지 줄수 ────────────────────────────────────
  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/StatusPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
