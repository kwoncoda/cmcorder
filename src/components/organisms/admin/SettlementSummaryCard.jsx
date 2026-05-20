// SettlementSummaryCard — organism (adjustment 라운드 Subagent 4 + Codex P1-1 fix).
//
// 정산 요약 카드 — design-bundle .settle-card (screens-admin.jsx:677-701).
// 항목:
//   - 총 주문 / 총 상품금액 / 쿠폰 (건/할인) / 실수령 예상 / 통장 입력 / 차이.
//
// 회귀:
//   - 「총 상품금액」 = summary.gross_amount (= NET + 쿠폰 할인 = 주문항목 단가 합계).
//   - 「실수령 예상」 = summary.total_amount (NET). 추가 차감 X.
//     ★ adjustment Codex P1-1 (2026-05-20) — orders.total_price는 calculatePrice()에서
//       이미 (subtotal - discount)이므로 NET. 이전 (total_amount - coupon_discount_total)는
//       쿠폰 이중 차감. 정합성 회귀로 보호.
//   - bank 차이는 NET(=실수령 예상) 기준으로 비교.
//   - isAggregate=true 시 data-testid 'settlement-aggregate-summary'.
//   - sub-testid 보존: bank-section / bank-total-input / bank-diff / coupon-summary.
//
// 통장 입력은 controlled — bankTotalInput(문자열) + onBankTotalChange(str).
// SettlementPage 가 state 보유 (ZIP 다운로드 query 와 공유).
import { forwardRef } from 'react';
import PriceTag from '../../molecules/PriceTag.jsx';

function parseBankTotal(input) {
  if (!input) return null;
  const n = Number(input.toString().replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const SettlementSummaryCard = forwardRef(function SettlementSummaryCard(
  { summary, isAggregate = false, bankTotalInput = '', onBankTotalChange },
  ref,
) {
  const couponCount = summary.coupon_count ?? 0;
  const couponDiscountTotal = summary.coupon_discount_total ?? 0;
  const totalAmount = summary.total_amount ?? 0;
  // gross_amount fallback: 구버전 응답 호환 위해 누락 시 total + 쿠폰 할인 합산.
  const grossAmount = summary.gross_amount ?? totalAmount + couponDiscountTotal;
  // 실수령 예상 = NET = total_amount (이중 차감 X).
  const expected = totalAmount;
  const bankTotal = parseBankTotal(bankTotalInput);
  const diff = bankTotal !== null ? totalAmount - bankTotal : null;
  const summaryTestid = isAggregate ? 'settlement-aggregate-summary' : 'settlement-summary';

  return (
    <section
      ref={ref}
      data-testid={summaryTestid}
      className="settle-card bg-elevated rounded-md p-md flex flex-col gap-sm"
      aria-label="정산 요약"
    >
      <div className="text-xs text-accent font-semibold uppercase tracking-wide">정산 요약</div>
      <div className="flex justify-between">
        <span className="text-muted">총 주문</span>
        <span className="font-mono tabular-nums font-bold">{summary.total_orders ?? 0}건</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">총 상품금액</span>
        <PriceTag value={grossAmount} className="font-bold" />
      </div>
      <div className="flex justify-between">
        <span className="text-muted">진행 중 주문</span>
        <span className="font-mono tabular-nums">{summary.in_progress_count ?? 0}건</span>
      </div>
      <div className="flex justify-between" data-testid="coupon-summary">
        <span className="text-muted">쿠폰</span>
        <span className="font-mono tabular-nums">
          {couponCount}건 · -{couponDiscountTotal.toLocaleString('ko-KR')}원
        </span>
      </div>
      <div className="flex justify-between border-t border-divider pt-sm font-bold">
        <span>실수령 예상</span>
        <span className="font-mono tabular-nums text-accent">
          {expected.toLocaleString('ko-KR')}원
        </span>
      </div>

      <div className="flex flex-col gap-xs mt-sm" data-testid="bank-section">
        <label htmlFor="bank-total" className="text-xs text-muted">통장 입금 합계 (수동 입력)</label>
        <input
          id="bank-total"
          data-testid="bank-total-input"
          inputMode="numeric"
          placeholder="예: 700000"
          value={bankTotalInput}
          onChange={(e) => onBankTotalChange?.(e.target.value.replace(/\D/g, ''))}
          className="bg-bg text-ink p-sm rounded-md border border-divider font-mono tabular-nums text-right"
        />
        {diff !== null && (
          <div className="flex justify-between" data-testid="bank-diff">
            <span className="text-muted">매출 − 통장 = 차이</span>
            <span className={`font-mono tabular-nums font-bold ${diff === 0 ? 'text-ink' : 'text-warning'}`}>
              {diff > 0 ? '+' : ''}{diff.toLocaleString('ko-KR')}원
            </span>
          </div>
        )}
      </div>
    </section>
  );
});

export default SettlementSummaryCard;
