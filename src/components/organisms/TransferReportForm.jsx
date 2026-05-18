// TransferReportForm — organism (IMPLEMENTATION_PLAN §2.7 / ADR-021 / USER_FLOW §4.2).
// 이체 확인 폼 — 은행 콤보 + 입금자 이름 + (선택) "다른 이름 이체" 토글 + 입금 금액.
//
// 설계 결정:
// - **plain controlled inputs** — react-hook-form은 Phase 3 도입 예정.
//   props 시그니처는 (이후 react-hook-form 적용 시) 동일 onSubmit({...}) 콜백 호환.
// - **모듈 최상위 BANK_OPTIONS** (§3.5 6조) — 동적 보간 회피.
// - 검증: 단순 — Phase 3에서 zod 스키마로 교체. 본 단계는 빈값·양수 검증만.
// - touched state — onBlur 시 표시. 제출 시 모든 필드 touched 처리 후 에러 노출.
// - amount 입력: 숫자 외 문자 자동 제거 (천 단위 콤마·"원" 등 자유 입력 허용).
// - "다른 이름 이체" — useOtherName=true 시 추가 otherName Input 조건부 활성.
//   체크박스만으로 절반 처리, 다른 이름 입력은 *조건부* 노출 (Cognitive load 감소).
// - 은행=기타 → customBank Input 조건부 활성 (드물게 사용 — 6대 은행이 99%).
// - design_fix v5 → v6 (2026-05-18, Codex P1 회귀 복원):
//   v5 에서 디자인 단순화 차원에서 "다른 이름으로 이체" 체크박스를 제거했으나
//   서버는 `use_other_name` / `other_name` 매칭 기능 (server/domain/transfer-matching.js)
//   을 그대로 유지하고 있어 다른 명의 이체 신고 경로가 프런트에서 차단됨. v6 에서 복원.
// - 카드 형광 옐로 텍스트 X (AI 슬롭 #26) — 폼 영역은 본문 톤.
// - forwardRef — 호출자가 form DOM 직접 접근 가능 (focus 제어 등).
import { forwardRef, useState } from 'react';
import Label from '../atoms/Label.jsx';
import Input from '../atoms/Input.jsx';
import Select from '../atoms/Select.jsx';
import Checkbox from '../atoms/Checkbox.jsx';
import Button from '../atoms/Button.jsx';

// 한국 6대 은행 + 기타 (모듈 최상위 — §3.5 6조).
// placeholder 옵션(value='')으로 미선택 상태 명시.
const BANK_OPTIONS = [
  { value: '',     label: '은행을 선택하세요' },
  { value: '국민',   label: '국민은행' },
  { value: '신한',   label: '신한은행' },
  { value: '우리',   label: '우리은행' },
  { value: '하나',   label: '하나은행' },
  { value: '농협',   label: 'NH농협' },
  { value: '카카오', label: '카카오뱅크' },
  { value: '기타',   label: '기타 (직접 입력)' },
];

const TransferReportForm = forwardRef(function TransferReportForm(
  {
    orderId,
    expectedAmount = 0,
    onSubmit,
    onCancel,
    loading = false,
    error = null,
    className = '',
    // design-bundle: page-level sticky CTA 우선 — 호출자가 hideSubmit=true 로 form 내부 submit 버튼 숨김.
    // 외부 submit 버튼은 `<button type="submit" form={formId}>` 패턴으로 form id 매칭. default false (기존 회귀 보존).
    hideSubmit = false,
    formId,
    ...rest
  },
  ref,
) {
  const [bank, setBank] = useState('');
  const [customBank, setCustomBank] = useState('');
  const [depositorName, setDepositorName] = useState('');
  const [useOtherName, setUseOtherName] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [amount, setAmount] = useState(String(expectedAmount));
  const [touched, setTouched] = useState({});

  const showCustomBank = bank === '기타';
  const showOtherName = useOtherName;

  // 검증 — 단순 (Phase 3에서 zod로 교체 예정).
  const errors = {
    bank: !bank
      ? '은행을 선택하세요'
      : showCustomBank && !customBank.trim()
      ? '은행명을 입력하세요'
      : '',
    depositorName: !depositorName.trim() ? '입금자 이름을 입력하세요' : '',
    otherName: showOtherName && !otherName.trim() ? '다른 이름을 입력하세요' : '',
    amount: !/^\d+$/.test(amount) || Number(amount) <= 0 ? '금액은 양수여야 합니다' : '',
  };
  const isValid =
    !errors.bank && !errors.depositorName && !errors.otherName && !errors.amount;

  const markAllTouched = () =>
    setTouched({
      bank: true,
      customBank: true,
      depositorName: true,
      otherName: true,
      amount: true,
    });

  const handleSubmit = (e) => {
    e.preventDefault();
    markAllTouched();
    if (!isValid) return;
    onSubmit?.({
      bank,
      customBank: showCustomBank ? customBank : undefined,
      depositorName,
      useOtherName,
      otherName: showOtherName ? otherName : undefined,
      amount: Number(amount),
    });
  };

  const wrapperCls = ['flex flex-col gap-md', className].filter(Boolean).join(' ');

  return (
    <form
      ref={ref}
      id={formId}
      onSubmit={handleSubmit}
      className={wrapperCls}
      noValidate
      aria-label="이체 완료 요청 폼"
      data-order-id={orderId}
      {...rest}
    >
      {error && (
        <p role="alert" className="text-danger text-sm" data-testid="form-error">
          {error}
        </p>
      )}

      <div>
        <Label htmlFor="bank" required>은행</Label>
        <Select
          id="bank"
          name="bank"
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, bank: true }))}
          invalid={touched.bank && !!errors.bank}
          errorMessage={touched.bank ? errors.bank : ''}
        >
          {BANK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      {showCustomBank && (
        <div>
          <Label htmlFor="customBank" required>은행명 (직접 입력)</Label>
          <Input
            id="customBank"
            type="text"
            value={customBank}
            onChange={(e) => setCustomBank(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, customBank: true }))}
          />
        </div>
      )}

      <div>
        <Label htmlFor="depositorName" required>입금자 이름</Label>
        <Input
          id="depositorName"
          type="text"
          value={depositorName}
          onChange={(e) => setDepositorName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, depositorName: true }))}
          invalid={touched.depositorName && !!errors.depositorName}
          errorMessage={touched.depositorName ? errors.depositorName : ''}
        />
      </div>

      <Checkbox
        id="useOtherName"
        checked={useOtherName}
        onChange={(e) => setUseOtherName(e.target.checked)}
        label="다른 이름으로 이체했어요"
      />

      {showOtherName && (
        <div>
          <Label htmlFor="otherName" required>이체한 사람 이름</Label>
          <Input
            id="otherName"
            type="text"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, otherName: true }))}
            invalid={touched.otherName && !!errors.otherName}
            errorMessage={touched.otherName ? errors.otherName : ''}
          />
        </div>
      )}

      <div>
        <Label htmlFor="amount" required>입금 금액 (원)</Label>
        <Input
          id="amount"
          type="text"
          inputMode="numeric"
          pattern="\d+"
          value={amount}
          // 숫자 외 자동 제거 — "18,000원" → "18000" (사용자 친화).
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
          invalid={touched.amount && !!errors.amount}
          errorMessage={touched.amount ? errors.amount : ''}
        />
      </div>

      {!hideSubmit && (
        <div className="flex gap-sm">
          <Button type="submit" variant="primary" block loading={loading}>
            이체 완료 요청
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
              취소
            </Button>
          )}
        </div>
      )}
    </form>
  );
});

export default TransferReportForm;
