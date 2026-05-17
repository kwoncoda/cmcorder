// Task 2.7 — TransferReportForm organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.7 / ADR-021 / USER_FLOW §4.2.
//
// 회귀 보호 항목:
//   - 은행 6개 옵션 + "기타" 옵션 (placeholder 포함 총 8개)
//   - 은행=기타 선택 시 customBank input 조건부 활성
//   - "다른 이름 이체" 체크 시 otherName input 조건부 활성
//   - expectedAmount 기본값으로 amount 초기 채워짐
//   - 필수 필드 누락 시 onSubmit 호출 X + 에러 메시지 표시
//   - 정상 제출 시 onSubmit({bank, depositorName, amount, useOtherName, ...}) 호출
//   - useOtherName=true 시 otherName 포함 제출
//   - loading 시 제출 버튼 disabled + aria-busy
//   - error prop 시 alert 표시
//   - forwardRef 로 form 참조 전달
//   - a11y (axe)
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import TransferReportForm from '../TransferReportForm.jsx';

describe('TransferReportForm', () => {
  it('초기 렌더 — 은행·입금자 이름·다른 이름·금액 필드 모두 존재', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} />);
    // Label은 required 시 별표(*) 포함 → 정규식 매칭.
    expect(screen.getByLabelText(/^은행/)).toBeInTheDocument();
    expect(screen.getByLabelText(/입금자 이름/)).toBeInTheDocument();
    expect(screen.getByLabelText(/다른 이름으로 이체/)).toBeInTheDocument();
    expect(screen.getByLabelText(/입금 금액/)).toBeInTheDocument();
  });

  it('은행 옵션 — placeholder 1 + 6 은행 + 기타 = 총 8개', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} />);
    const select = screen.getByLabelText(/^은행/);
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(8);
    // 라벨 텍스트로 6대 은행 + 기타 확인
    const labels = Array.from(options).map((o) => o.textContent);
    expect(labels).toEqual(
      expect.arrayContaining([
        '국민은행',
        '신한은행',
        '우리은행',
        '하나은행',
        'NH농협',
        '카카오뱅크',
        '기타 (직접 입력)',
      ]),
    );
  });

  it('은행=기타 선택 시 customBank Input 활성', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} />);
    fireEvent.change(screen.getByLabelText(/^은행/), { target: { value: '기타' } });
    expect(screen.getByLabelText(/은행명/)).toBeInTheDocument();
  });

  it('은행=국민 등 일반 선택 시 customBank Input 미렌더', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} />);
    fireEvent.change(screen.getByLabelText(/^은행/), { target: { value: '국민' } });
    expect(screen.queryByLabelText(/은행명/)).not.toBeInTheDocument();
  });

  it('"다른 이름으로 이체" 체크 시 otherName Input 활성', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} />);
    fireEvent.click(screen.getByLabelText(/다른 이름으로 이체/));
    expect(screen.getByLabelText(/이체한 사람 이름/)).toBeInTheDocument();
  });

  it('"다른 이름으로 이체" 미체크 시 otherName Input 미렌더', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} />);
    expect(screen.queryByLabelText(/이체한 사람 이름/)).not.toBeInTheDocument();
  });

  it('expectedAmount 기본값으로 amount 채워짐', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} />);
    expect(screen.getByLabelText(/입금 금액/)).toHaveValue('18000');
  });

  it('필수 필드 누락 시 onSubmit 호출 X + 에러 메시지 표시', () => {
    const onSubmit = vi.fn();
    render(<TransferReportForm orderId={17} expectedAmount={18000} onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByLabelText('이체 완료 요청 폼'));
    expect(onSubmit).not.toHaveBeenCalled();
    // placeholder option(<option>) + error alert(<p>) 둘 다 "은행을 선택하세요" 텍스트.
    // role="alert" P 태그 (Input atom의 errorMessage 패턴) 로 특정.
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => el.textContent === '은행을 선택하세요')).toBe(true);
    expect(alerts.some((el) => el.textContent === '입금자 이름을 입력하세요')).toBe(true);
  });

  it('정상 제출 시 onSubmit({bank, depositorName, amount, useOtherName:false}) 호출', () => {
    const onSubmit = vi.fn();
    render(<TransferReportForm orderId={17} expectedAmount={18000} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^은행/), { target: { value: '국민' } });
    fireEvent.change(screen.getByLabelText(/입금자 이름/), {
      target: { value: '홍길동' },
    });
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        bank: '국민',
        depositorName: '홍길동',
        amount: 18000,
        useOtherName: false,
      }),
    );
  });

  it('useOtherName=true 시 otherName 포함 제출', () => {
    const onSubmit = vi.fn();
    render(<TransferReportForm orderId={17} expectedAmount={18000} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^은행/), { target: { value: '국민' } });
    fireEvent.change(screen.getByLabelText(/입금자 이름/), {
      target: { value: '홍길동' },
    });
    fireEvent.click(screen.getByLabelText(/다른 이름으로 이체/));
    fireEvent.change(screen.getByLabelText(/이체한 사람 이름/), {
      target: { value: '김철수' },
    });
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        useOtherName: true,
        otherName: '김철수',
      }),
    );
  });

  it('은행=기타 + customBank 입력 시 customBank 포함 제출', () => {
    const onSubmit = vi.fn();
    render(<TransferReportForm orderId={17} expectedAmount={18000} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^은행/), { target: { value: '기타' } });
    fireEvent.change(screen.getByLabelText(/은행명/), {
      target: { value: '새마을금고' },
    });
    fireEvent.change(screen.getByLabelText(/입금자 이름/), {
      target: { value: '홍길동' },
    });
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        bank: '기타',
        customBank: '새마을금고',
      }),
    );
  });

  it('loading 시 제출 버튼 disabled + aria-busy (Spinner 표시)', () => {
    render(<TransferReportForm orderId={17} expectedAmount={18000} loading />);
    // loading 시 Button 내용물이 Spinner로 교체됨 (accessible name = "로딩 중").
    const btn = screen.getByRole('button', { name: /로딩 중/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('error prop 시 alert 영역 표시', () => {
    render(
      <TransferReportForm
        orderId={17}
        expectedAmount={18000}
        error="이체 정보가 일치하지 않습니다"
      />,
    );
    expect(screen.getByTestId('form-error')).toHaveTextContent(
      '이체 정보가 일치하지 않습니다',
    );
  });

  it('amount 입력 — 숫자 외 문자 자동 제거', () => {
    render(<TransferReportForm orderId={17} expectedAmount={0} />);
    const amount = screen.getByLabelText(/입금 금액/);
    fireEvent.change(amount, { target: { value: '18,000원' } });
    expect(amount).toHaveValue('18000');
  });

  it('amount = 0 / 음수 시 에러 메시지 ("금액은 양수")', () => {
    const onSubmit = vi.fn();
    render(<TransferReportForm orderId={17} expectedAmount={0} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^은행/), { target: { value: '국민' } });
    fireEvent.change(screen.getByLabelText(/입금자 이름/), {
      target: { value: '홍길동' },
    });
    fireEvent.submit(screen.getByLabelText('이체 완료 요청 폼'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('금액은 양수여야 합니다')).toBeInTheDocument();
  });

  it('onCancel 제공 시 취소 버튼 렌더 + 클릭 동작', () => {
    const onCancel = vi.fn();
    render(
      <TransferReportForm orderId={17} expectedAmount={18000} onCancel={onCancel} />,
    );
    const cancelBtn = screen.getByRole('button', { name: /취소/ });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('forwardRef 로 form 참조 전달', () => {
    const ref = createRef();
    render(<TransferReportForm ref={ref} orderId={17} expectedAmount={18000} />);
    expect(ref.current).toBeInstanceOf(HTMLFormElement);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <TransferReportForm orderId={17} expectedAmount={18000} />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
