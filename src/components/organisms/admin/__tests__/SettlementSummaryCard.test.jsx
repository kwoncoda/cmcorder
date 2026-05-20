// adjustment 라운드 Subagent 4 — SettlementSummaryCard 단위 테스트.
//
// 정산 요약 카드 — 총 주문 / 총 상품금액 / 쿠폰(건/할인) / 실수령 예상 /
// 통장 입력 / 차이.
// design-bundle .settle-card (screens-admin.jsx:677-701).
//
// 회귀 보호:
//  - 「총 상품금액」 = summary.gross_amount 표시 (= 주문항목 단가 합계).
//  - 「실수령 예상」 = summary.total_amount 표시 (NET, 추가 차감 X).
//    ★ adjustment 라운드 Codex P1-1 (2026-05-20) — 이전엔 total_amount - coupon_discount_total
//      이중 차감이었다. orders.total_price가 calculatePrice()에서 이미 NET이므로 한 번만 빠짐.
//  - bank input change → onBankTotalChange(value) 호출.
//  - bank 입력값 있을 때만 차이 row(data-testid=bank-diff) 노출.
//  - isAggregate=true → testid 'settlement-aggregate-summary'.
//  - sub testid 보존: bank-section / bank-total-input / bank-diff / coupon-summary.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettlementSummaryCard from '../SettlementSummaryCard.jsx';

const SUMMARY = {
  operating_date: '2026-05-20',
  total_orders: 42,
  total_amount: 756000,        // NET (쿠폰 할인 후 = 실수령 예상)
  gross_amount: 761000,         // NET + 쿠폰 할인 = 주문항목 단가 합계
  in_progress_count: 0,
  is_closed: false,
  coupon_count: 5,
  coupon_discount_total: 5000,
};

describe('SettlementSummaryCard', () => {
  it('★ Codex P1-1 — 실수령 예상 = summary.total_amount (이중 차감 X)', () => {
    render(
      <SettlementSummaryCard
        summary={SUMMARY}
        isAggregate={false}
        bankTotalInput=""
        onBankTotalChange={vi.fn()}
      />,
    );
    // 실수령 예상은 NET 그대로 756,000원. 751,000(=756,000-5,000)은 이중 차감 결함.
    expect(screen.getByText(/실수령 예상/)).toBeInTheDocument();
    const card = screen.getByTestId('settlement-summary');
    expect(card).toHaveTextContent('756,000');
    expect(card).not.toHaveTextContent('751,000');
  });

  it('★ Codex P1-1 — 총 상품금액 라인 = summary.gross_amount', () => {
    render(
      <SettlementSummaryCard
        summary={SUMMARY}
        isAggregate={false}
        bankTotalInput=""
        onBankTotalChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/총 상품금액/)).toBeInTheDocument();
    expect(screen.getByTestId('settlement-summary')).toHaveTextContent('761,000');
  });

  it('★ bank input change → onBankTotalChange 호출', () => {
    const onChange = vi.fn();
    render(
      <SettlementSummaryCard
        summary={SUMMARY}
        isAggregate={false}
        bankTotalInput=""
        onBankTotalChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('bank-total-input'), {
      target: { value: '700000' },
    });
    expect(onChange).toHaveBeenCalledWith('700000');
  });

  it('★ bank 입력 시 차이 row 노출 + 미입력 시 비표시', () => {
    const { rerender } = render(
      <SettlementSummaryCard
        summary={SUMMARY}
        isAggregate={false}
        bankTotalInput=""
        onBankTotalChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('bank-diff')).toBeNull();

    rerender(
      <SettlementSummaryCard
        summary={SUMMARY}
        isAggregate={false}
        bankTotalInput="700000"
        onBankTotalChange={vi.fn()}
      />,
    );
    // 매출 756,000 - 통장 700,000 = +56,000
    expect(screen.getByTestId('bank-diff')).toHaveTextContent(/56,?000/);
  });

  it('★ isAggregate=true → testid "settlement-aggregate-summary"', () => {
    render(
      <SettlementSummaryCard
        summary={{ ...SUMMARY, operating_date: 'all' }}
        isAggregate={true}
        bankTotalInput=""
        onBankTotalChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('settlement-aggregate-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('settlement-summary')).toBeNull();
  });

  it('쿠폰 요약 노출 (5건 / -5,000원)', () => {
    render(
      <SettlementSummaryCard
        summary={SUMMARY}
        isAggregate={false}
        bankTotalInput=""
        onBankTotalChange={vi.fn()}
      />,
    );
    const coupon = screen.getByTestId('coupon-summary');
    expect(coupon).toHaveTextContent(/5\s*건/);
    expect(coupon).toHaveTextContent(/5,?000/);
  });
});
