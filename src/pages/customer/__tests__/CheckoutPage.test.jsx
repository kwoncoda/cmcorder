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
//  - Subagent 5: 테이블 가용성 UI (점유/식사/잠금 셀 disabled, 메시지 표시)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';
import CheckoutPage, { TABLE_NOT_AVAILABLE_MESSAGE } from '../CheckoutPage.jsx';
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

// 모든 테이블 available — availability mount fetch 기본값
const ALL_AVAILABLE = Array.from({ length: 15 }, (_, i) => ({ table_no: i + 1, status: 'available' }));

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

// POST /api/orders 호출 여부 확인 헬퍼 (availability fetch와 구분)
const wasPostCalled = () =>
  apiFetch.mock.calls.some(([, opts]) => opts?.method === 'POST');

beforeEach(() => {
  useCartStore.setState({ items: [ITEM] });
  vi.clearAllMocks();
  // 기본: 모든 테이블 available (availability mount fetch가 올바른 배열 반환)
  apiFetch.mockResolvedValue(ALL_AVAILABLE);
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
  it('★ 폼 검증 통과 시 apiFetch(POST) 호출 + clearCart + navigate', async () => {
    // apiFetch: 1st = availability(mount), 2nd = availability(refresh), 3rd = POST
    apiFetch.mockResolvedValue({ id: 42 });
    renderPage();

    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));

    await waitFor(() => expect(wasPostCalled()).toBe(true));
    await waitFor(() =>
      expect(screen.getByTestId('complete-page-stub')).toBeInTheDocument(),
    );
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('★ 폼 검증 실패 시 제출 차단 (POST 미호출)', async () => {
    renderPage();
    // 비어 있는 상태에서 제출
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    // 검증 에러 표시 (find_error_v2: 학번 9자리 메시지)
    expect(screen.getByText(/학번은 숫자 9자리로 입력해주세요/)).toBeInTheDocument();
    expect(wasPostCalled()).toBe(false);
  });

  it('★ find_error_v2 — 9자리 비-37 학번도 제출 성공 (coupon: null)', async () => {
    apiFetch.mockResolvedValue({ id: 77 });
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202111123' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() => expect(wasPostCalled()).toBe(true));
    const postCall = apiFetch.mock.calls.find(([, opts]) => opts?.method === 'POST');
    expect(postCall[1].body.student_id).toBe('202111123');
    expect(postCall[1].body.coupon).toBeNull();
  });

  it('★ 빈 카트 + 모든 필드 정상 시에도 제출 차단', async () => {
    useCartStore.setState({ items: [] });
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    // 제출 직전 refresh()가 await되는 async submit 이후에도 POST 호출 X
    await new Promise((r) => setTimeout(r, 50));
    expect(wasPostCalled()).toBe(false);
  });

  it('★ 서버 에러(ApiError) 시 ErrorState inline 렌더', async () => {
    // availability: OK, refresh: OK, POST: 에러
    apiFetch
      .mockResolvedValueOnce(ALL_AVAILABLE)  // mount availability
      .mockResolvedValueOnce(ALL_AVAILABLE)  // pre-submit refresh
      .mockRejectedValueOnce(new ApiError('메뉴가 매진되었습니다', { status: 409, code: 'MENU_SOLD_OUT' }));
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() =>
      expect(screen.getByText(/메뉴가 매진되었습니다/)).toBeInTheDocument(),
    );
  });

  it('★ design_fix_v3 round2 — ALREADY_USED 응답 시 화면 가운데 모달 팝업(role=alertdialog) 노출', async () => {
    apiFetch
      .mockResolvedValueOnce(ALL_AVAILABLE)
      .mockResolvedValueOnce(ALL_AVAILABLE)
      .mockRejectedValueOnce(new ApiError('이미 쿠폰을 사용한 학번이에요.', { status: 400, code: 'ALREADY_USED' }));
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637123' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });
    fireEvent.click(screen.getByLabelText(/컴모융 학생 1,000원 할인/));
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    // 모달 (가운데 정렬 + 마스코트 + 메시지 + 안내 + 쿠폰 해제 + 닫기 두 버튼) 노출
    await waitFor(() => expect(screen.getByTestId('checkout-coupon-blocked')).toBeInTheDocument());
    const dialog = screen.getByTestId('checkout-coupon-blocked');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.className).toMatch(/\bfixed\b/);
    expect(dialog.className).toMatch(/\binset-0\b/);
    expect(screen.getByText('이미 쿠폰을 사용한 학번이에요.')).toBeInTheDocument();
    expect(screen.getByText(/쿠폰 사용을 해제하면 같은 학번으로 일반 주문은 가능해요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '쿠폰 사용 해제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
    // 인라인 빨간 텍스트 (작은 한 줄)는 안 보여야 함
    expect(screen.queryByTestId('error-state-inline')).toBeNull();
  });

  it('★ design_fix_v3 round2 — ALREADY_USED 모달 "쿠폰 사용 해제" 클릭 → 쿠폰 체크 해제 + 모달 사라짐', async () => {
    apiFetch
      .mockResolvedValueOnce(ALL_AVAILABLE)
      .mockResolvedValueOnce(ALL_AVAILABLE)
      .mockRejectedValueOnce(new ApiError('이미 쿠폰을 사용한 학번이에요.', { status: 400, code: 'ALREADY_USED' }));
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637123' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });
    const couponCb = screen.getByLabelText(/컴모융 학생 1,000원 할인/);
    fireEvent.click(couponCb);
    expect(couponCb.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() => expect(screen.getByTestId('checkout-coupon-blocked')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 사용 해제' }));
    expect(couponCb.checked).toBe(false);
    expect(screen.queryByTestId('checkout-coupon-blocked')).toBeNull();
  });

  it('★ design_fix_v3 round2 — ALREADY_USED 모달 "닫기" 클릭 → 모달 닫힘 (쿠폰 체크는 유지)', async () => {
    apiFetch
      .mockResolvedValueOnce(ALL_AVAILABLE)
      .mockResolvedValueOnce(ALL_AVAILABLE)
      .mockRejectedValueOnce(new ApiError('이미 쿠폰을 사용한 학번이에요.', { status: 400, code: 'ALREADY_USED' }));
    renderPage();
    fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637123' } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '9' } });
    const couponCb = screen.getByLabelText(/컴모융 학생 1,000원 할인/);
    fireEvent.click(couponCb);
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() => expect(screen.getByTestId('checkout-coupon-blocked')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByTestId('checkout-coupon-blocked')).toBeNull();
    // 닫기는 쿠폰 체크 상태 유지 — 사용자가 직접 해제할지 선택
    expect(couponCb.checked).toBe(true);
  });

  it('★ 외부인 모드 제출 — student_id null + is_external true 페이로드', async () => {
    apiFetch.mockResolvedValue({ id: 99 });
    renderPage();
    fireEvent.click(screen.getByLabelText(/학번 없음/));
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '외부인' } });
    fireEvent.change(screen.getByLabelText(/테이블/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
    await waitFor(() => expect(wasPostCalled()).toBe(true));
    const postCall = apiFetch.mock.calls.find(([, opts]) => opts?.method === 'POST');
    expect(postCall[1].body.is_external).toBe(true);
    expect(postCall[1].body.student_id).toBeNull();
  });

  // ── Subagent 5 — 테이블 가용성 UI ───────────────────────────
  describe('테이블 가용성', () => {
    // 테이블 radiogroup 스코프 헬퍼 (DeliveryTypeSelector의 radio 2개와 구분)
    const tableGroup = () => screen.getByRole('radiogroup', { name: /좌석 번호/ });
    const tableBtn = (n) => within(tableGroup()).getAllByRole('radio').find((b) => b.textContent === String(n));

    const mkAvailability = (overrides = []) => {
      const base = Array.from({ length: 15 }, (_, i) => ({ table_no: i + 1, status: 'available' }));
      for (const { table_no, status } of overrides) {
        const idx = base.findIndex((t) => t.table_no === table_no);
        if (idx >= 0) base[idx] = { table_no, status };
      }
      return base;
    };

    afterEach(() => { vi.useRealTimers(); });

    it('5번 occupied → 5번 셀 aria-disabled="true"', async () => {
      apiFetch.mockResolvedValue(mkAvailability([{ table_no: 5, status: 'occupied' }]));
      renderPage();
      await waitFor(() => expect(tableBtn(5)).toHaveAttribute('aria-disabled', 'true'));
    });

    it('7번 dining → 7번 셀 aria-disabled="true"', async () => {
      apiFetch.mockResolvedValue(mkAvailability([{ table_no: 7, status: 'dining' }]));
      renderPage();
      await waitFor(() => expect(tableBtn(7)).toHaveAttribute('aria-disabled', 'true'));
    });

    it('10번 locked → 10번 셀 aria-disabled="true"', async () => {
      apiFetch.mockResolvedValue(mkAvailability([{ table_no: 10, status: 'locked' }]));
      renderPage();
      await waitFor(() => expect(tableBtn(10)).toHaveAttribute('aria-disabled', 'true'));
    });

    it('사용 가능 셀 클릭 → tableNo 선택됨', async () => {
      renderPage();
      const btn = tableBtn(3);
      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-checked', 'true');
    });

    it('사용 불가 셀 클릭 → tableNo 미선택 + 에러 메시지 표시', async () => {
      apiFetch.mockResolvedValue(mkAvailability([{ table_no: 5, status: 'occupied' }]));
      renderPage();
      await waitFor(() => expect(tableBtn(5)).toHaveAttribute('aria-disabled', 'true'));
      fireEvent.click(tableBtn(5));
      expect(tableBtn(5)).not.toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText(TABLE_NOT_AVAILABLE_MESSAGE)).toBeInTheDocument();
    });

    it('availability 5xx → 모든 셀 enable (graceful fallback)', async () => {
      apiFetch.mockRejectedValue(new Error('서버 오류'));
      renderPage();
      // hook 에러 처리 완료까지 대기 — isReady = true 후 aria-disabled 없음
      await waitFor(() => {
        const btns = within(tableGroup()).getAllByRole('radio');
        btns.forEach((btn) => expect(btn).not.toHaveAttribute('aria-disabled'));
      });
    });

    it('마운트 시 availability API 1회 호출, 30초 후에도 1회 (no polling)', async () => {
      vi.useFakeTimers();
      renderPage();
      // 마이크로태스크 플러시 (mock resolved → useApi state 업데이트)
      await vi.runAllTicks();
      const countBefore = apiFetch.mock.calls.filter(([url]) => url === '/api/tables/availability').length;
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();
      const countAfter = apiFetch.mock.calls.filter(([url]) => url === '/api/tables/availability').length;
      // mount 이후 추가 호출 없음 (no polling)
      expect(countAfter).toBe(countBefore);
      expect(countAfter).toBeGreaterThanOrEqual(1);
    });

    it('제출 시 두 번째 availability fetch 호출 (mount + pre-submit 총 2회)', async () => {
      apiFetch.mockResolvedValue({ id: 10 });
      renderPage();
      // 마운트 availability fetch 완료 대기
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/tables/availability', expect.any(Object)));
      fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
      fireEvent.click(tableBtn(3));
      fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
      await waitFor(() => expect(wasPostCalled()).toBe(true));
      const availCalls = apiFetch.mock.calls.filter(([url]) => url === '/api/tables/availability');
      expect(availCalls).toHaveLength(2); // mount + pre-submit
    });

    it('제출 직전 fetch에서 선택 테이블 occupied 발견 → POST 호출 X + 에러 메시지', async () => {
      // mount: available, refresh: 5번 occupied
      apiFetch
        .mockResolvedValueOnce(ALL_AVAILABLE)  // mount availability
        .mockResolvedValueOnce(mkAvailability([{ table_no: 5, status: 'occupied' }])); // pre-submit refresh
      renderPage();
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/tables/availability', expect.any(Object)));
      fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
      fireEvent.click(tableBtn(5));
      fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
      await waitFor(() => expect(screen.getByText(TABLE_NOT_AVAILABLE_MESSAGE)).toBeInTheDocument());
      expect(wasPostCalled()).toBe(false);
    });

    it('409 TABLE_NOT_AVAILABLE 응답 시 에러 메시지 표시', async () => {
      apiFetch
        .mockResolvedValueOnce(ALL_AVAILABLE)  // mount
        .mockResolvedValueOnce(ALL_AVAILABLE)  // pre-submit refresh
        .mockRejectedValueOnce(new ApiError(TABLE_NOT_AVAILABLE_MESSAGE, { status: 409, code: 'TABLE_NOT_AVAILABLE' }));
      renderPage();
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/tables/availability', expect.any(Object)));
      fireEvent.change(screen.getByLabelText('학번', { exact: false, selector: 'input#studentId' }), { target: { value: '202637001' } });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '홍길동' } });
      fireEvent.click(tableBtn(3));
      fireEvent.click(screen.getByRole('button', { name: '주문 접수' }));
      await waitFor(() => expect(screen.getByText(TABLE_NOT_AVAILABLE_MESSAGE)).toBeInTheDocument());
    });
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
