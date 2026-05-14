// Task 4.4 — CheckoutPage 통합 테스트.
//
// 회귀 보호 (18 케이스):
//  - 학번 정규식 ^\d{2}\d{2}37\d{3}$ (ADR-019) — 6 케이스
//  - "학번 없음" 체크 시 학번 input 사라짐 (조건부 필드 — useState 기반 §3.5 7조)
//  - 외부인 체크 시 쿠폰 체크박스 사라짐
//  - 매장 식사 선택 시 테이블 input 활성 / 포장 선택 시 비활성
//  - 쿠폰 체크박스 동작
//  - 빈 카트일 때 navigate X (UX 가드)
//  - 폼 제출 시 POST /api/orders 호출 + clearCart + navigate
//  - 폼 검증 실패 시 제출 막힘 + inline 에러 표시
//  - 서버 에러 시 ErrorState inline 렌더
//  - 페이지 ≤120줄 — §3.5 1조
//  - a11y
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';
import CheckoutPage from '../CheckoutPage.jsx';
import useCartStore from '../../../store/cart.js';

// apiFetch mock — 서버 호출 격리.
vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});
import { apiFetch, ApiError } from '../../../api/client.js';

const ITEM = { menuId: 1, name: '후라이드', basePrice: 18000, quantity: 1, category: 'chicken' };

function renderPage(initialPath = '/checkout') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route
          path="/orders/:id/complete"
          element={<div data-testid="complete-page-stub">완료</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useCartStore.setState({ items: [ITEM] });
  vi.clearAllMocks();
});

describe('CheckoutPage', () => {
  // ── 학번 정규식 (^\d{2}\d{2}37\d{3}$) — ADR-019 — 6 케이스 ───────
  it('★ 학번 정규식 — 유효 학번 "202637001" 통과 (에러 없음)', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '202637001' } });
    fireEvent.blur(input);
    expect(screen.queryByText(/학번 형식이 올바르지 않습니다/)).not.toBeInTheDocument();
  });

  it('★ 학번 정규식 — 자릿수 부족 "20263700" (8자리) 차단', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '20263700' } });
    fireEvent.blur(input);
    expect(screen.getByText(/학번 형식이 올바르지 않습니다/)).toBeInTheDocument();
  });

  it('★ 학번 정규식 — 학과 코드 미일치 "202612345" (37 X) 차단', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '202612345' } });
    fireEvent.blur(input);
    expect(screen.getByText(/학번 형식이 올바르지 않습니다/)).toBeInTheDocument();
  });

  it('★ 학번 정규식 — 비숫자 자동 strip ("20a2637b001" → "202637001")', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '20a2637b001' } });
    // 비숫자 strip 후 9자리 → 유효
    expect(input.value).toBe('202637001');
  });

  it('★ 학번 정규식 — 빈 값 차단 (필수)', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(screen.getByText(/학번 형식이 올바르지 않습니다/)).toBeInTheDocument();
  });

  it('★ 학번 정규식 — 자릿수 초과 "2026370012" (10자리) 차단', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '2026370012' } });
    fireEvent.blur(input);
    expect(screen.getByText(/학번 형식이 올바르지 않습니다/)).toBeInTheDocument();
  });

  // ── 외부인 ("학번 없음") 분기 — useState 조건부 ───────────────
  it('★ "학번 없음" 체크 시 학번 input 사라짐 (조건부 필드)', () => {
    const { container } = renderPage();
    expect(container.querySelector('input#studentId')).not.toBeNull();
    fireEvent.click(screen.getByLabelText(/학번 없음/));
    expect(container.querySelector('input#studentId')).toBeNull();
  });

  it('★ "학번 없음" 체크 시 쿠폰 체크박스 사라짐 (외부인은 쿠폰 X)', () => {
    renderPage();
    expect(screen.getByLabelText(/쿠폰/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/학번 없음/));
    expect(screen.queryByLabelText(/쿠폰/)).not.toBeInTheDocument();
  });

  // ── 수령 방식 / 테이블 분기 — useState 조건부 ────────────────
  it('★ 매장 식사 선택(기본값) 시 테이블 input 활성', () => {
    renderPage();
    expect(screen.getByLabelText(/테이블/)).toBeInTheDocument();
  });

  it('★ 포장 선택 시 테이블 input 비활성 (DOM 미렌더)', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText(/포장/));
    expect(screen.queryByLabelText(/테이블/)).not.toBeInTheDocument();
  });

  // ── 쿠폰 ────────────────────────────────────────────────────
  it('쿠폰 체크박스 토글 동작', () => {
    renderPage();
    const cb = screen.getByLabelText(/쿠폰/);
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  // ── 폼 제출 흐름 ─────────────────────────────────────────────
  it('★ 폼 검증 통과 시 apiFetch 호출 + clearCart + navigate', async () => {
    apiFetch.mockResolvedValue({ id: 42 });
    renderPage();

    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('complete-page-stub')).toBeInTheDocument(),
    );
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('★ 폼 검증 실패 시 제출 차단 (apiFetch 미호출)', async () => {
    apiFetch.mockResolvedValue({ id: 42 });
    renderPage();
    // 비어 있는 상태에서 제출
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    // 검증 에러 표시
    expect(screen.getByText(/학번 형식이 올바르지 않습니다/)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('★ 빈 카트 + 모든 필드 정상 시에도 제출 차단', () => {
    useCartStore.setState({ items: [] });
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('★ 서버 에러(ApiError) 시 ErrorState inline 렌더', async () => {
    apiFetch.mockRejectedValue(
      new ApiError('메뉴가 매진되었습니다', { status: 409, code: 'MENU_SOLD_OUT' }),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() =>
      expect(screen.getByText(/메뉴가 매진되었습니다/)).toBeInTheDocument(),
    );
  });

  it('★ 외부인 모드 제출 — student_id null + is_external true 페이로드', async () => {
    apiFetch.mockResolvedValue({ id: 99 });
    renderPage();
    fireEvent.click(screen.getByLabelText(/학번 없음/));
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '외부인' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opts] = apiFetch.mock.calls[0];
    expect(opts.body.is_external).toBe(true);
    expect(opts.body.student_id).toBeNull();
  });

  // ── 회귀 — 페이지 줄수 + a11y ────────────────────────────────
  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/CheckoutPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });

  it('a11y 위반 없음 (기본 폼)', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
