// Task 5.5 — SettlementPage 단위 테스트.
//
// 회귀 보호:
//  - Loading / Error 분기 + 재시도
//  - 401 응답 시 /admin/login redirect
//  - 정산 요약 렌더 (total_orders, total_amount, in_progress_count)
//  - ★ in_progress_count > 0 시 close-guard 표시 + 마감 버튼 disabled (ADR-012)
//  - ★ in_progress_count = 0 시 마감 버튼 enabled
//  - ★ 마감 클릭 시 API 호출 + businessState 'CLOSED' 전이 (G13)
//  - 마감 실패 시 에러 메시지
//  - is_closed=true 시 버튼 라벨 변경
//  - ZIP 버튼 클릭 시 window.open 호출 (?date= ?bank= 포함)
//  - a11y (axe)
//  - 페이지 ≤120줄 (§3.5 1조)
//
// adjustment 라운드 (Subagent 4) 추가:
//  - 3-box 카드 모두 렌더 (settlement-summary, settlement-backup-card, settlement-menu-sales-card)
//  - 합산 모드(`all`) → 백업 카드 다운로드 버튼 disabled
//  - useApi 두 번 호출 (settlement summary + menu-sales)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

vi.mock('../../../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));
import { useApi } from '../../../hooks/useApi.js';

vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch, ApiError } from '../../../api/client.js';

import SettlementPage from '../SettlementPage.jsx';
import useBusinessStateStore from '../../../store/businessState.js';

// menu_update 라운드 (2026-05-20) — 메뉴별 판매 10행 픽스처 + 가격 갱신.
const MENU_SALES_8 = [
  { menu_id:  1, code: 'BANDAGE',    name: '후라이드',     category: 'chicken', base_price:  8000, quantity: 42, revenue: 336000 },
  { menu_id:  2, code: 'FIRST_AID',  name: '양념',         category: 'chicken', base_price:  9000, quantity: 38, revenue: 342000 },
  { menu_id:  3, code: 'MED_KIT',    name: '뿌링클',       category: 'chicken', base_price: 11000, quantity: 51, revenue: 561000 },
  { menu_id:  4, code: 'SYRINGE',    name: '감자튀김',     category: 'side',    base_price:  4000, quantity: 28, revenue: 112000 },
  { menu_id:  5, code: 'DEFIB',      name: '뿌링감자튀김', category: 'side',    base_price:  5000, quantity:  0, revenue:      0 },
  { menu_id:  6, code: 'ADRENALINE', name: '칠리스',       category: 'side',    base_price:  4500, quantity: 14, revenue:  63000 },
  { menu_id:  7, code: 'PAINKILLER', name: '콜라',         category: 'drink',   base_price:  2000, quantity: 33, revenue:  66000 },
  { menu_id:  8, code: 'ENERGY',     name: '사이다',       category: 'drink',   base_price:  2000, quantity: 28, revenue:  56000 },
  { menu_id:  9, code: 'bluezone',   name: '생수',         category: 'side',    base_price:  1000, quantity:  5, revenue:   5000 },
  { menu_id: 10, code: 'fuel',       name: '양념 소스',    category: 'side',    base_price:   500, quantity: 12, revenue:   6000 },
];

const SAMPLE_BACKUPS = [
  { name: 'auto-2026-05-20T08-30-00-000Z.zip', size_bytes: 2_100_000, mtime: '2026-05-20T08:30:00.000Z' },
  { name: 'auto-2026-05-20T06-30-00-000Z.zip', size_bytes: 1_800_000, mtime: '2026-05-20T06:30:00.000Z' },
  { name: 'auto-2026-05-20T04-30-00-000Z.zip', size_bytes: 1_400_000, mtime: '2026-05-20T04:30:00.000Z' },
];

const SAMPLE_SETTLEMENT = {
  operating_date: '2026-05-20',
  total_orders: 42,
  total_amount: 756000,
  in_progress_count: 0,
  is_closed: false,
  // P1-3: 정산 보조 — 쿠폰 요약 백엔드 합쳐서 응답.
  coupon_count: 5,
  coupon_discount_total: 5000,
};

const IN_PROGRESS_SETTLEMENT = {
  operating_date: '2026-05-20',
  total_orders: 42,
  total_amount: 756000,
  in_progress_count: 3,
  is_closed: false,
};

const CLOSED_SETTLEMENT = {
  operating_date: '2026-05-20',
  total_orders: 42,
  total_amount: 756000,
  in_progress_count: 0,
  is_closed: true,
};

function renderPage(initialPath = '/admin/settlement') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/settlement" element={<SettlementPage />} />
        <Route
          path="/admin/login"
          element={<div data-testid="login-page-stub">로그인</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useBusinessStateStore.setState({ status: 'OPEN', operating_date: '2026-05-20' });
  // adjustment 라운드 — useApi는 페이지(2건 — settlement + menu-sales) + 백업카드(1건) 총 3회 호출.
  // 호출 순서에 의존하지 않도록 fetcher 함수 inspect 후 매칭.
  useApi.mockImplementation((fetcher) => {
    const src = String(fetcher);
    if (src.includes('menu-sales') || src.includes('MENU_SALES') || src.includes('fetchAggregateMenuSales')) {
      return { data: MENU_SALES_8, isLoading: false, error: null, refetch: vi.fn() };
    }
    if (src.includes('backups') || src.includes('BACKUPS')) {
      return { data: SAMPLE_BACKUPS, isLoading: false, error: null, refetch: vi.fn() };
    }
    return { data: SAMPLE_SETTLEMENT, isLoading: false, error: null, refetch: vi.fn() };
  });
});

afterEach(() => {
  cleanup();
});

// 헬퍼 — 페이지의 settlement useApi 호출만 특정 결과로 덮는다.
// menu-sales / backups 는 기본 mockImplementation 유지.
function overrideSettlementApi(result) {
  useApi.mockImplementation((fetcher) => {
    const src = String(fetcher);
    if (src.includes('menu-sales') || src.includes('MENU_SALES') || src.includes('fetchAggregateMenuSales')) {
      return { data: MENU_SALES_8, isLoading: false, error: null, refetch: vi.fn() };
    }
    if (src.includes('backups') || src.includes('BACKUPS')) {
      return { data: SAMPLE_BACKUPS, isLoading: false, error: null, refetch: vi.fn() };
    }
    return result;
  });
}

describe('SettlementPage', () => {
  it('★ Loading 분기', () => {
    overrideSettlementApi({ data: null, isLoading: true, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('★ Error 분기 + 다시 시도', () => {
    const refetch = vi.fn();
    overrideSettlementApi({
      data: null,
      isLoading: false,
      error: new ApiError('서버 오류', { status: 500 }),
      refetch,
    });
    renderPage();
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('★ 401 응답 시 /admin/login redirect', async () => {
    overrideSettlementApi({
      data: null,
      isLoading: false,
      error: new ApiError('인증 필요', { status: 401 }),
      refetch: vi.fn(),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('login-page-stub')).toBeInTheDocument();
    });
  });

  it('★ 정산 요약 렌더 — total_orders + total_amount + in_progress_count', () => {
    renderPage();
    const summary = screen.getByTestId('settlement-summary');
    expect(summary).toHaveTextContent('42건');
    expect(summary).toHaveTextContent('756,000원');
    expect(summary).toHaveTextContent('0건');
    expect(screen.getByRole('heading', { name: /정산/ })).toHaveTextContent('2026-05-20');
  });

  it('★ in_progress_count > 0 시 close-guard 표시 + 마감 버튼 disabled (ADR-012)', () => {
    overrideSettlementApi({ data: IN_PROGRESS_SETTLEMENT, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('close-guard')).toBeInTheDocument();
    expect(screen.getByTestId('close-guard')).toHaveTextContent(/3건/);
    expect(screen.getByTestId('close-settlement-btn')).toBeDisabled();
  });

  it('★ in_progress_count = 0 시 마감 버튼 enabled', () => {
    renderPage();
    expect(screen.queryByTestId('close-guard')).not.toBeInTheDocument();
    expect(screen.getByTestId('close-settlement-btn')).not.toBeDisabled();
  });

  it('★ 마감 클릭 시 API 호출 + businessState=CLOSED 전이 (G13)', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    renderPage();
    fireEvent.click(screen.getByTestId('close-settlement-btn'));
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/admin/api/settlement/close',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(useBusinessStateStore.getState().status).toBe('CLOSED');
  });

  it('★ 마감 실패 시 인라인 에러 메시지 + status 변동 X', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('마감 실패', { status: 500 }));
    renderPage();
    fireEvent.click(screen.getByTestId('close-settlement-btn'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('마감 실패');
    });
    expect(useBusinessStateStore.getState().status).toBe('OPEN');
  });

  it('★ is_closed=true 시 버튼 라벨 변경 + 비활성', () => {
    overrideSettlementApi({ data: CLOSED_SETTLEMENT, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    const btn = screen.getByTestId('close-settlement-btn');
    expect(btn).toHaveTextContent(/마감 완료/);
    expect(btn).toBeDisabled();
  });

  // ── P1-3 (Codex 리뷰) 정산 보조 ────────────────────────────
  it('★ P1-3 — 쿠폰 사용 N건 / 할인 합 표시', () => {
    renderPage();
    // SAMPLE_SETTLEMENT.coupon_count = 5, coupon_discount_total = 5000
    expect(screen.getByText(/쿠폰/)).toBeInTheDocument();
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent(/5\s*건/);
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent(/5[,.]?000/);
  });

  it('★ P1-3 — 통장 입금 합계 입력 → 차이 계산 표시', () => {
    renderPage();
    const input = screen.getByTestId('bank-total-input');
    fireEvent.change(input, { target: { value: '700000' } });
    // 매출 756,000 - 통장 700,000 = +56,000 (회수 부족 표시)
    expect(screen.getByTestId('bank-diff')).toHaveTextContent(/56[,.]?000/);
  });

  it('★ P1-3 — 통장 합계 미입력 시 차이 0 또는 비표시', () => {
    renderPage();
    expect(screen.queryByTestId('bank-diff')).toBeNull();
  });

  // ── P1-5 (Codex v3) 일자별/합산 정산 UI ─────────────────────
  it('★ P1-5 — 일자 셀렉터 렌더 (5/20 / 5/21 / 합산 3개 옵션)', () => {
    renderPage();
    const sel = screen.getByTestId('settlement-date-select');
    expect(sel).toBeInTheDocument();
    const opts = sel.querySelectorAll('option');
    const values = Array.from(opts).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['2026-05-20', '2026-05-21', 'all']));
  });

  it('★ P1-5 — 5/21 선택 시 useApi가 date=2026-05-21 query 호출', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('settlement-date-select'), {
      target: { value: '2026-05-21' },
    });
    // adjustment 라운드 — useApi가 3번(settlement + menu-sales + backups) 호출되므로
    // settlement fetcher를 식별하기 위해 source에 settlementUrl 패턴이 들어간 호출만 선택.
    // (settlement fetcher 는 selectedDate 가 'all' 이 아니면 settlementUrl(selectedDate) 사용)
    const settlementCalls = useApi.mock.calls.filter(([fn]) => {
      const s = String(fn);
      return !s.includes('menu-sales') && !s.includes('MENU_SALES') && !s.includes('backups') && !s.includes('BACKUPS');
    });
    const fetchFn = settlementCalls[settlementCalls.length - 1][0];
    apiFetch.mockResolvedValueOnce({});
    fetchFn({ signal: new AbortController().signal });
    const calledPath = apiFetch.mock.calls[0]?.[0] ?? '';
    expect(calledPath).toContain('date=2026-05-21');
  });

  it('★ P1-5 — 합산(all) 선택 시 settlement-aggregate-summary testid + 헤더 "합산" 라벨', () => {
    // 합산 실제 sum 로직은 settlement-aggregate.test.js의 unit으로 검증.
    // 페이지 레벨에서는 selectedDate='all' 시 testid 전환 + 헤더 라벨만 검증.
    // (useApi mock이 SAMPLE_SETTLEMENT를 반환하므로 합산 수치는 페이지에서 검증 불가)
    renderPage();
    fireEvent.change(screen.getByTestId('settlement-date-select'), {
      target: { value: 'all' },
    });
    expect(screen.getByTestId('settlement-aggregate-summary')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/합산/);
  });

  it('★ ZIP 버튼 클릭 시 window.open 호출 (?date= + ?bank=)', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    // ZIP 다운로드 버튼은 백업 카드로 이동 — testid 'download-zip-btn' 유지.
    fireEvent.click(screen.getByTestId('download-zip-btn'));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('/admin/api/settlement/zip');
    expect(url).toContain('date=2026-05-20');
    // bank 미입력 시 빈 문자열 — 라우트는 빈 값을 "미입력"으로 처리.
    expect(url).toContain('bank=');
    expect(openSpy.mock.calls[0][1]).toBe('_blank');
    openSpy.mockRestore();
  });

  it('★ ZIP 버튼 — bank 입력 시 ?bank=N 반영', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    fireEvent.change(screen.getByTestId('bank-total-input'), { target: { value: '700000' } });
    fireEvent.click(screen.getByTestId('download-zip-btn'));
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('bank=700000');
    openSpy.mockRestore();
  });

  it('★ a11y 위반 없음', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/admin/SettlementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });

  // ── adjustment 라운드 (Subagent 4) — 3-box 그리드 ─────────────
  it('★ adjustment — 3-box 카드 모두 렌더 (summary, backup, menu-sales)', () => {
    renderPage();
    expect(screen.getByTestId('settlement-summary')).toBeInTheDocument();
    expect(screen.getByTestId('settlement-backup-card')).toBeInTheDocument();
    expect(screen.getByTestId('settlement-menu-sales-card')).toBeInTheDocument();
  });

  it('★ adjustment — 합산(all) 모드 시 백업 카드 다운로드 버튼 disabled', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('settlement-date-select'), { target: { value: 'all' } });
    expect(screen.getByTestId('download-zip-btn')).toBeDisabled();
  });

  it('★ menu_update — 메뉴별 판매 10행 + ID 순 + 0건 메뉴 표시', () => {
    renderPage();
    const bars = screen.getAllByTestId(/^menu-sales-bar-/);
    expect(bars).toHaveLength(10);
    expect(bars[0]).toHaveTextContent('후라이드');
    expect(bars[9]).toHaveTextContent('양념 소스');
    const zero = screen.getByTestId('menu-sales-bar-5');
    expect(zero).toHaveTextContent('0건');
  });
});
