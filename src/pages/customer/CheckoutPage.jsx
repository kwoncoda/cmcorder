// C-3 주문 정보 입력 — Task 4.4 (§3.5 1조 ≤120줄).
//  - useState controlled · 학번 정규식 ADR-019 · 외부인 "학번 없음" ADR-021.
//  - 페이로드 ADR-020 Pattern B (가격 X). BusinessClosedError → G13 위임.
//  - P0-4: 응답 access_token sessionStorage 저장 + URL search 전파.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCartStore, { cartSelectors } from '../../store/cart.js';
import { apiFetch, BusinessClosedError, ApiError } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { storeOrderToken } from '../../hooks/useOrderToken.js';
import Label from '../../components/atoms/Label.jsx';
import Input from '../../components/atoms/Input.jsx';
import Checkbox from '../../components/atoms/Checkbox.jsx';
import Button from '../../components/atoms/Button.jsx';
import PriceTag from '../../components/molecules/PriceTag.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';
import DeliveryTypeSelector from '../../components/organisms/DeliveryTypeSelector.jsx';

const STUDENT_ID_PATTERN = /^\d{2}\d{2}37\d{3}$/;

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore(cartSelectors.totalPrice);
  const clearCart = useCartStore((s) => s.clear);
  const navigate = useNavigate();

  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [isExternal, setIsExternal] = useState(false);
  const [deliveryType, setDeliveryType] = useState('dineIn');
  const [tableNo, setTableNo] = useState('');
  const [useCoupon, setUseCoupon] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // 검증 — render 중 계산 (§3.5 4조). useEffect로 derive X.
  const errors = {
    studentId: !isExternal && !STUDENT_ID_PATTERN.test(studentId)
      ? '학번 형식이 올바르지 않습니다 (예: 20263701)' : '',
    name: !name.trim() ? '이름을 입력하세요' : '',
    tableNo: deliveryType === 'dineIn' && !tableNo.trim()
      ? '테이블 번호를 입력하세요' : '',
  };
  const isValid = !errors.studentId && !errors.name && !errors.tableNo && items.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ studentId: true, name: true, tableNo: true });
    if (!isValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await apiFetch(API.ORDERS, {
        method: 'POST',
        body: {
          items: items.map((i) => ({ menu_id: i.menuId, quantity: i.quantity })),
          student_id: isExternal ? null : studentId,
          name, is_external: isExternal, delivery_type: deliveryType,
          table_no: deliveryType === 'dineIn' ? Number(tableNo) : null,
          coupon: !isExternal && useCoupon ? { used: true } : null,
        },
      });
      // P0-4: access_token 저장 + URL search param 전파.
      storeOrderToken(order.id, order.access_token);
      clearCart();
      const tq = order.access_token ? `?token=${encodeURIComponent(order.access_token)}` : '';
      navigate(`/orders/${order.id}/complete${tq}`);
    } catch (err) {
      if (err instanceof BusinessClosedError) throw err; // useGlobalErrorHandler 위임
      setSubmitError(err instanceof ApiError ? err.message : '주문 접수에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form data-testid="checkout-page" onSubmit={handleSubmit} className="flex flex-col gap-md p-md pb-24" noValidate>
      <h2 className="font-display font-black text-2xl">주문 정보 입력</h2>
      <Checkbox id="isExternal" checked={isExternal} onChange={(e) => setIsExternal(e.target.checked)} label="학번 없음 (외부인)" />
      {!isExternal && (
        <div>
          <Label htmlFor="studentId" required>학번</Label>
          <Input id="studentId" type="text" inputMode="numeric" placeholder="20263701" value={studentId}
            onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setTouched((t) => ({ ...t, studentId: true }))}
            invalid={touched.studentId && !!errors.studentId}
            errorMessage={touched.studentId ? errors.studentId : ''} />
        </div>
      )}
      <div>
        <Label htmlFor="name" required>이름</Label>
        <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          invalid={touched.name && !!errors.name} errorMessage={touched.name ? errors.name : ''} />
      </div>
      <DeliveryTypeSelector value={deliveryType} onChange={setDeliveryType} />
      {deliveryType === 'dineIn' && (
        <div>
          <Label htmlFor="tableNo" required>테이블 번호 (1~16)</Label>
          <Input id="tableNo" type="text" inputMode="numeric" value={tableNo}
            onChange={(e) => setTableNo(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setTouched((t) => ({ ...t, tableNo: true }))}
            invalid={touched.tableNo && !!errors.tableNo}
            errorMessage={touched.tableNo ? errors.tableNo : ''} />
        </div>
      )}
      {!isExternal && (
        <Checkbox id="useCoupon" checked={useCoupon} onChange={(e) => setUseCoupon(e.target.checked)} label="🎫 학과 쿠폰 사용 (할인)" />
      )}
      {submitError && <ErrorState variant="inline-field" title={submitError} />}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-md bg-elevated border-t border-divider flex items-center justify-between gap-md">
        <PriceTag value={totalPrice} size="lg" className="text-ink font-semibold" />
        <Button type="submit" variant="primary" size="lg" loading={submitting}>주문 접수</Button>
      </div>
    </form>
  );
}
