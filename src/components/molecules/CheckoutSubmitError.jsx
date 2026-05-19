// CheckoutSubmitError — 주문 제출 에러 노출 분기.
// design_fix_v3 round 2 — "이미 쿠폰을 사용한 학번이에요." (ALREADY_USED) 는
// 폼 아래 카드/인라인이 아니라 화면 가운데 모달 팝업으로 띄워 잘 보이게 한다.
// (이전 카드는 sticky bar/긴 영수증 아래라 모바일에서 발견이 늦었음.)
// 그 외 에러(TABLE_NOT_AVAILABLE / MENU_SOLD_OUT / 네트워크 등)는 기존 inline-field 그대로.
import { useEffect, useRef } from 'react';
import ErrorState from '../state/ErrorState.jsx';
import Button from '../atoms/Button.jsx';
import MascotState from './MascotState.jsx';

const COUPON_BLOCKED_HINT = '쿠폰 사용을 해제하면 같은 학번으로 일반 주문은 가능해요.';

function CouponBlockedModal({ message, onClearCoupon, onClose }) {
  const actionBtnRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    actionBtnRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current?.(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="coupon-blocked-title"
      aria-describedby="coupon-blocked-hint"
      data-testid="checkout-coupon-blocked"
      className="fixed inset-0 z-50 flex items-center justify-center p-md"
    >
      <button
        type="button"
        aria-label="알림 닫기"
        className="absolute inset-0 bg-black/80"
        onClick={() => onClose?.()}
        data-testid="coupon-blocked-backdrop"
      />
      <div className="relative z-10 bg-elevated rounded-md p-lg max-w-sm w-full shadow-card flex flex-col items-center gap-md text-center">
        <MascotState state="canceled" size="md" useFallback />
        <h2 id="coupon-blocked-title" className="font-display font-bold text-lg">
          {message}
        </h2>
        <p id="coupon-blocked-hint" className="text-sm text-muted">
          {COUPON_BLOCKED_HINT}
        </p>
        <div className="flex flex-col gap-sm w-full">
          <Button
            ref={actionBtnRef}
            variant="primary"
            size="md"
            block
            onClick={() => onClearCoupon?.()}
          >
            쿠폰 사용 해제
          </Button>
          <Button variant="ghost" size="md" block onClick={() => onClose?.()}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSubmitError({ error, onClearCoupon, onClose }) {
  if (!error) return null;
  if (error.code === 'ALREADY_USED') {
    return (
      <CouponBlockedModal
        message={error.message}
        onClearCoupon={onClearCoupon}
        onClose={onClose}
      />
    );
  }
  return <ErrorState variant="inline-field" title={error.message} />;
}
