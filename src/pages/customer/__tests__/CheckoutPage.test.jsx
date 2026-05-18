// Task 4.4 — CheckoutPage 통합 테스트.
//
// 회귀 보호:
//  - find_error_v2: 학번 9자리는 주문, 5–6번째 자리 37은 쿠폰 한정 (정책 분리)
//  - "학번 없음" 체크 시 학번 input 사라짐 (조건부 필드 — useState 기반 §3.5 7조)
//  - 외부인 체크 시 쿠폰 체크박스 사라짐
//  - 매장 식사 선택 시 테이블 input 활성 / 포장 선택 시 비활성
//  - 쿠폰 체크박스 동작 + 컴모융(37)이 아니면 비활성 — 그러나 주문은 가능
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
  // ── 학번 정책 분리 (find_error_v2): 주문 9자리 / 쿠폰 5–6번째 자리 37 ───
  it('★ 주문 자격 — 유효 9자리 학번 "202637001" 통과 (에러 없음)', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '202637001' } });
    fireEvent.blur(input);
    expect(screen.queryByText(/학번은 숫자 9자리로 입력해주세요/)).not.toBeInTheDocument();
  });

  it('★ 주문 자격 — 9자리 비-37 학번 "202111123"도 주문 가능 (에러 X)', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '202111123' } });
    fireEvent.blur(input);
    expect(screen.queryByText(/학번은 숫자 9자리로 입력해주세요/)).not.toBeInTheDocument();
  });

  it('★ 주문 자격 — 자릿수 부족 "20263700" (8자리) 차단 (새 메시지)', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '20263700' } });
    fireEvent.blur(input);
    expect(screen.getByText(/학번은 숫자 9자리로 입력해주세요/)).toBeInTheDocument();
  });

  it('★ 입력 정규화 — 비숫자 자동 strip ("20a2637b001" → "202637001")', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '20a2637b001' } });
    expect(input.value).toBe('202637001');
  });

  it('★ 주문 자격 — 빈 값 차단 (필수)', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(screen.getByText(/학번은 숫자 9자리로 입력해주세요/)).toBeInTheDocument();
  });

  it('★ 주문 자격 — 자릿수 초과 "2026370012" (10자리) 차단', () => {
    renderPage();
    const input = screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' });
    fireEvent.change(input, { target: { value: '2026370012' } });
    fireEvent.blur(input);
    expect(screen.getByText(/학번은 숫자 9자리로 입력해주세요/)).toBeInTheDocument();
  });

  // ── 쿠폰 자격 — 컴모융(37)만 활성, 외 9자리는 비활성이되 주문 가능 ───
  // find_error_v3 — 쿠폰 라벨이 '컴모융 학생 1,000원 할인' 으로 단순화. 기존 /쿠폰/ 정규식 → /컴모융 학생 1,000원 할인/.
  it('★ 쿠폰 자격 — 9자리 비-37 학번은 쿠폰 비활성 (주문은 가능)', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202111123' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.blur(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }));
    expect(screen.getByLabelText(/컴모융 학생 1,000원 할인/)).toBeDisabled();
  });

  it('★ 쿠폰 자격 — 9자리 37 학번 + 이름 입력 시 쿠폰 활성', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637123' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    expect(screen.getByLabelText(/컴모융 학생 1,000원 할인/)).not.toBeDisabled();
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
    expect(screen.getByLabelText(/컴모융 학생 1,000원 할인/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/학번 없음/));
    expect(screen.queryByLabelText(/컴모융 학생 1,000원 할인/)).not.toBeInTheDocument();
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
    const cb = screen.getByLabelText(/컴모융 학생 1,000원 할인/);
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  // ── find_error_v3 — 쿠폰 라벨/안내 문구 단순화 ─────────────────
  it("★ find_error_v3 — 쿠폰 라벨 '컴모융 학생 1,000원 할인' (이모지·괄호 미포함)", () => {
    renderPage();
    const cb = screen.getByLabelText(/컴모융 학생 1,000원 할인/);
    expect(cb).toBeInTheDocument();
    // 옛 라벨('🎫 쿠폰 사용 (컴모융 학생 한정 1,000원 할인)') 부재 검증.
    expect(screen.queryByLabelText(/🎫/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/쿠폰 사용 \(/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/한정/)).not.toBeInTheDocument();
  });

  it("★ find_error_v3 — '컴모융(****37***)' 안내 문구 제거", () => {
    renderPage();
    // 9자리이지만 학과 코드 37 아닌 학번 입력 → 옛 정책으로는 '컴모융(****37***)' 안내가 떴음.
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202647001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.blur(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }));
    expect(screen.queryByText(/컴모융\(\*\*\*\*37\*\*\*\)/)).not.toBeInTheDocument();
  });

  it('★ design_fix — 쿠폰 영역 helper 문구 제거 (라벨만 노출)', () => {
    renderPage();
    // design_bundle ScreenCheckout 정합: 쿠폰 영역에는 라벨 외 보조 안내 문구를 표시하지 않는다.
    // 옛 통합 안내('학번 9자리 + 이름 입력 시 활성화됩니다.') 와 활성 시 안내('학번 확인 완료 ...') 모두 미노출.
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202647001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.blur(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }));
    expect(screen.queryByText(/학번 9자리 \+ 이름 입력 시 활성화됩니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/학번 확인 완료/)).not.toBeInTheDocument();
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
    // 검증 에러 표시 (find_error_v2: 학번 9자리 메시지)
    expect(screen.getByText(/학번은 숫자 9자리로 입력해주세요/)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('★ find_error_v2 — 9자리 비-37 학번도 제출 성공 (coupon: null)', async () => {
    apiFetch.mockResolvedValue({ id: 77 });
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202111123' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opts] = apiFetch.mock.calls[0];
    expect(opts.body.student_id).toBe('202111123');
    expect(opts.body.coupon).toBeNull();
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
