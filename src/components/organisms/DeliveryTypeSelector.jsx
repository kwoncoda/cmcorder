// DeliveryTypeSelector — organism (Task 4.4 보조).
// 매장 식사 / 포장 라디오 그룹. CheckoutPage 분리용 (페이지 ≤120줄 — §3.5 1조).
//
// props:
//  - value: 'dineIn' | 'takeout'
//  - onChange(value): 라디오 변경 콜백
//
// 접근성:
//  - fieldset/legend 그룹화 — 스크린리더에 "수령 방식 — 매장 식사" 식 안내.
import Radio from '../atoms/Radio.jsx';

export default function DeliveryTypeSelector({ value, onChange }) {
  return (
    <fieldset>
      <legend className="font-display font-bold text-sm mb-2xs">수령 방식</legend>
      <div className="flex gap-md">
        <Radio
          id="dineIn"
          name="deliveryType"
          value="dineIn"
          checked={value === 'dineIn'}
          onChange={(e) => onChange(e.target.value)}
          label="매장 식사"
        />
        <Radio
          id="takeout"
          name="deliveryType"
          value="takeout"
          checked={value === 'takeout'}
          onChange={(e) => onChange(e.target.value)}
          label="포장"
        />
      </div>
    </fieldset>
  );
}
