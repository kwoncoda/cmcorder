// C-3 주문 정보 — design-bundle ScreenCheckout (screens-customer.jsx:211-381).
// 6-col 테이블 grid, 쿠폰 eligibility(opacity/disabled), receipt + sticky discount.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCartStore, { cartSelectors } from '../../store/cart.js';
import { apiFetch, BusinessClosedError, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { storeOrderToken } from '../../hooks/useOrderToken.js';
import Label from '../../components/atoms/Label.jsx';
import Input from '../../components/atoms/Input.jsx';
import Checkbox from '../../components/atoms/Checkbox.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import DeliveryTypeSelector from '../../components/organisms/DeliveryTypeSelector.jsx';

const SID_PATTERN = /^\d{2}\d{2}37\d{3}$/;
const SID_9 = /^\d{9}$/;
const fmt = (n) => n.toLocaleString('ko-KR');
const TABLES = [1,2,3,4,5,6,7,8,9,10,11,12];

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(cartSelectors.totalPrice);
  const clearCart = useCartStore((s) => s.clear);
  const navigate = useNavigate();
  const [sid, setSid] = useState(''); const [name, setName] = useState('');
  const [external, setExternal] = useState(false); const [delivery, setDelivery] = useState('dineIn');
  const [tableNo, setTableNo] = useState(''); const [coupon, setCoupon] = useState(false);
  const [touched, setTouched] = useState({}); const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const sidIs9 = SID_9.test(sid); const sidDeptOK = SID_PATTERN.test(sid);
  const nameValid = name.trim().length >= 1;
  const couponEligible = !external && sidIs9 && sidDeptOK && nameValid;
  const useCoupon = coupon && couponEligible;
  const discount = useCoupon ? 1000 : 0;
  const total = Math.max(0, subtotal - discount);

  const errors = { sid: !external && !sidDeptOK ? '학번 형식이 올바르지 않습니다 (예: 20263701)' : '',
    name: !nameValid ? '이름을 입력하세요' : '', tableNo: delivery === 'dineIn' && !tableNo ? '테이블 번호를 선택해 주세요' : '' };
  const valid = !errors.sid && !errors.name && !errors.tableNo && items.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault(); setTouched({ sid: true, name: true, tableNo: true });
    if (!valid) return; setBusy(true); setSubmitError(null);
    try {
      const order = await apiFetch(API.ORDERS, { method: 'POST', body: {
        items: items.map((i) => ({ menu_id: i.menuId, quantity: i.quantity })),
        student_id: external ? null : sid, name, is_external: external, delivery_type: delivery,
        table_no: delivery === 'dineIn' ? Number(tableNo) : null,
        coupon: useCoupon ? { used: true } : null,
      } });
      storeOrderToken(order.id, order.access_token); clearCart();
      const tq = order.access_token ? `?token=${encodeURIComponent(order.access_token)}` : '';
      navigate(`/orders/${order.id}/complete${tq}`);
    } catch (err) {
      if (err instanceof BusinessClosedError) throw err;
      setSubmitError(err instanceof ApiError ? err.message : '주문 접수에 실패했어요.');
    } finally { setBusy(false); }
  };

  return (
    <form data-testid="checkout-page" onSubmit={handleSubmit} noValidate>
      <div className="back-bar">
        <button type="button" onClick={() => navigate('/cart')} aria-label="뒤로">←</button><h1>주문 정보</h1>
      </div>
      <div className="section">
        <div className="section-label">① 신원 확인</div>
        <Checkbox id="isExternal" checked={external} onChange={(e) => { setExternal(e.target.checked); if (e.target.checked) setCoupon(false); }} label="학번 없음 (외부인)" />
        {!external && (<div className="field">
          <Label htmlFor="studentId" required>학번</Label>
          <Input id="studentId" type="text" inputMode="numeric" placeholder="예: 202637042" value={sid}
            onChange={(e) => setSid(e.target.value.replace(/\D/g, ''))} onBlur={() => setTouched((t) => ({ ...t, sid: true }))}
            invalid={touched.sid && !!errors.sid} errorMessage={touched.sid ? errors.sid : ''} />
        </div>)}
        <div className="field">
          <Label htmlFor="name" required>이름</Label>
          <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            invalid={touched.name && !!errors.name} errorMessage={touched.name ? errors.name : ''} />
        </div>
      </div>
      <div className="section">
        <div className="section-label">② 수령 방법</div>
        <DeliveryTypeSelector value={delivery} onChange={setDelivery} />
        {delivery === 'dineIn' && (<div className="field" style={{ marginTop: 12 }}>
          <Label htmlFor="tableNo" required>테이블 번호 (1~12)</Label>
          <div role="radiogroup" aria-label="좌석 번호" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {TABLES.map((n) => (<button key={n} type="button" role="radio" aria-checked={String(n) === tableNo}
              tabIndex={String(n) === tableNo || (!tableNo && n === 1) ? 0 : -1}
              className={`radio-cell ${String(n) === tableNo ? 'active' : ''}`} style={{ padding: '10px 0', fontSize: 14 }}
              onClick={() => { setTableNo(String(n)); setTouched((t) => ({ ...t, tableNo: true })); }}>{n}</button>))}
          </div>
          <Input id="tableNo" type="text" inputMode="numeric" value={tableNo} onChange={(e) => setTableNo(e.target.value.replace(/\D/g, ''))}
            style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
            tabIndex={-1} invalid={touched.tableNo && !!errors.tableNo} errorMessage={touched.tableNo ? errors.tableNo : ''} />
        </div>)}
      </div>
      {!external && (<div className="section">
        <div className="section-label">③ 쿠폰</div>
        <div style={{ opacity: couponEligible ? 1 : 0.55, pointerEvents: couponEligible ? 'auto' : 'none' }}>
          <Checkbox id="useCoupon" checked={coupon} onChange={(e) => setCoupon(e.target.checked)} label="🎫 쿠폰 사용 (컴모융 학생 한정 1,000원 할인)" disabled={!couponEligible} />
        </div>
        <p className="hint" style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', margin: '4px 0 0' }}>
          {couponEligible ? '✓ 학번 확인 완료 — 1,000원 할인 적용 가능' : '※ 학번 9자리 + 이름 입력 시 활성화됩니다.'}
        </p>
      </div>)}
      <div className="receipt">
        {items.map((it) => (
          <div key={it.menuId} className="line"><span className="label">{it.name} × {it.quantity}</span><span className="price">{fmt(it.basePrice * it.quantity)}원</span></div>
        ))}
        {discount > 0 && (<div className="line"><span className="label">쿠폰 할인</span><span className="price price-discount">−{fmt(discount)}원</span></div>)}
        <div className="line total"><span className="label">합계</span><span className="price price-lg" style={{ color: 'var(--color-accent)' }}>{fmt(total)}원</span></div>
      </div>
      {submitError && <ErrorState variant="inline-field" title={submitError} />}
      <div style={{ height: 96 }} />
      <div className="sticky-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40 }}>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} aria-label="주문 접수">{busy ? '접수 중…' : `📋 주문 접수 · ${fmt(total)}원`}</button>
      </div>
    </form>);
}
