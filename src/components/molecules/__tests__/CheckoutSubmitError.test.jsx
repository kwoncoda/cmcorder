// design_fix_v3 round 2 — CheckoutSubmitError molecule 단위 테스트.
//
// 회귀 보호:
//   - error=null 시 렌더 X
//   - code='ALREADY_USED' → 화면 가운데 모달 (role=alertdialog + aria-modal + 마스코트 + 안내 + 두 버튼)
//   - 모달 열림 시 "쿠폰 사용 해제" 버튼에 포커스 + body overflow=hidden
//   - "쿠폰 사용 해제" 클릭 → onClearCoupon
//   - "닫기" 버튼 / Escape 키 / backdrop 클릭 → onClose
//   - 닫힘(언마운트) 시 이전 포커스 복귀 + body overflow 복귀
//   - 그 외 code → inline-field (작은 빨간 텍스트)
//   - a11y (axe)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import CheckoutSubmitError from '../CheckoutSubmitError.jsx';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const couponError = { message: '이미 쿠폰을 사용한 학번이에요.', code: 'ALREADY_USED' };

describe('CheckoutSubmitError', () => {
  it('error=null 시 렌더 X', () => {
    const { container } = render(
      <CheckoutSubmitError error={null} onClearCoupon={() => {}} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('★ ALREADY_USED → 화면 가운데 모달 (role=alertdialog + aria-modal + 마스코트 + 안내 + 두 버튼)', () => {
    render(
      <CheckoutSubmitError
        error={couponError}
        onClearCoupon={() => {}}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByTestId('checkout-coupon-blocked');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'coupon-blocked-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'coupon-blocked-hint');
    // 가운데 정렬 (fixed inset-0 + flex items-center justify-center)
    expect(dialog.className).toMatch(/\bfixed\b/);
    expect(dialog.className).toMatch(/\binset-0\b/);
    expect(dialog.className).toMatch(/\bitems-center\b/);
    expect(dialog.className).toMatch(/\bjustify-center\b/);
    // 메시지·안내
    expect(screen.getByText('이미 쿠폰을 사용한 학번이에요.')).toBeInTheDocument();
    expect(
      screen.getByText(/쿠폰 사용을 해제하면 같은 학번으로 일반 주문은 가능해요/),
    ).toBeInTheDocument();
    // 마스코트 (canceled 이모지 😢 fallback)
    expect(screen.getByText('😢')).toBeInTheDocument();
    // 두 버튼
    expect(screen.getByRole('button', { name: '쿠폰 사용 해제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
  });

  it('★ 모달 열림 시 "쿠폰 사용 해제" 버튼에 포커스', () => {
    render(
      <CheckoutSubmitError error={couponError} onClearCoupon={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByRole('button', { name: '쿠폰 사용 해제' })).toHaveFocus();
  });

  it('★ 모달 열림 시 body overflow=hidden (스크롤 잠금)', () => {
    render(
      <CheckoutSubmitError error={couponError} onClearCoupon={() => {}} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('★ ALREADY_USED — "쿠폰 사용 해제" 클릭 → onClearCoupon 호출', () => {
    const onClearCoupon = vi.fn();
    render(
      <CheckoutSubmitError
        error={couponError}
        onClearCoupon={onClearCoupon}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 사용 해제' }));
    expect(onClearCoupon).toHaveBeenCalledTimes(1);
  });

  it('★ ALREADY_USED — "닫기" 클릭 → onClose 호출', () => {
    const onClose = vi.fn();
    render(
      <CheckoutSubmitError
        error={couponError}
        onClearCoupon={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('★ ALREADY_USED — Escape 키 → onClose 호출', () => {
    const onClose = vi.fn();
    render(
      <CheckoutSubmitError
        error={couponError}
        onClearCoupon={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('★ ALREADY_USED — backdrop 클릭 → onClose 호출', () => {
    const onClose = vi.fn();
    render(
      <CheckoutSubmitError
        error={couponError}
        onClearCoupon={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('coupon-blocked-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('★ 모달 언마운트 시 이전 포커스 복귀 + body overflow 복귀', () => {
    document.body.style.overflow = 'auto';
    const trigger = document.createElement('button');
    trigger.textContent = '발신 버튼';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <CheckoutSubmitError error={couponError} onClearCoupon={() => {}} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe('hidden');

    // error=null 로 rerender → 모달 언마운트 → effect cleanup.
    rerender(
      <CheckoutSubmitError error={null} onClearCoupon={() => {}} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it('★ 다른 code 시 inline-field (작은 빨간 텍스트) — 모달 미렌더', () => {
    render(
      <CheckoutSubmitError
        error={{ message: '메뉴가 매진되었습니다', code: 'MENU_SOLD_OUT' }}
        onClearCoupon={() => {}}
        onClose={() => {}}
      />,
    );
    const inline = screen.getByTestId('error-state-inline');
    expect(inline).toHaveAttribute('role', 'alert');
    expect(inline.className).toMatch(/\btext-danger\b/);
    expect(inline.textContent).toBe('메뉴가 매진되었습니다');
    // 모달 영역은 미렌더
    expect(screen.queryByTestId('checkout-coupon-blocked')).toBeNull();
  });

  it('★ code 없는 에러도 inline-field (TABLE_NOT_AVAILABLE 같은 케이스)', () => {
    render(
      <CheckoutSubmitError
        error={{ message: '테이블이 이용 중이에요.' }}
        onClearCoupon={() => {}}
        onClose={() => {}}
      />,
    );
    const inline = screen.getByTestId('error-state-inline');
    expect(inline.textContent).toBe('테이블이 이용 중이에요.');
    expect(screen.queryByTestId('checkout-coupon-blocked')).toBeNull();
  });

  it('a11y 위반 없음 — ALREADY_USED 모달', async () => {
    const { container } = render(
      <CheckoutSubmitError
        error={couponError}
        onClearCoupon={() => {}}
        onClose={() => {}}
      />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
