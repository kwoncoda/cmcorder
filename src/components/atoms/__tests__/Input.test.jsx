// Task 1.2 — Input atom 단위 테스트.
// COMPONENT_GUIDE.md §2.2 / DESIGN.md §12.5 (inputmode·pattern·aria-describedby).
// placeholder 는 도움말일 뿐 라벨 대체 X — 별도 <Label> 컴포넌트.
// invalid + errorMessage 시 aria-invalid · aria-describedby · role="alert".
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Input from '../Input.jsx';
import Label from '../Label.jsx';

describe('Input', () => {
  it('id 와 type 이 input 으로 전달된다 (기본 type=text)', () => {
    render(<Input id="name" />);
    const input = document.getElementById('name');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.tagName).toBe('INPUT');
  });

  it('controlled value/onChange 패턴이 동작한다', () => {
    const onChange = vi.fn();
    render(<Input id="x" value="202637" onChange={onChange} />);
    const input = document.getElementById('x');
    expect(input).toHaveValue('202637');
    fireEvent.change(input, { target: { value: '20263701' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('type="tel" + inputMode="numeric" + pattern 전달 (학번 패턴 — DESIGN §12.5)', () => {
    render(
      <Input
        id="student-id"
        type="tel"
        inputMode="numeric"
        pattern="\d{8}"
        maxLength={8}
      />,
    );
    const input = document.getElementById('student-id');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('pattern', '\\d{8}');
    expect(input).toHaveAttribute('maxlength', '8');
  });

  it('invalid + errorMessage 시 aria-invalid, aria-describedby, role=alert 패턴 적용', () => {
    render(
      <Input
        id="student-id"
        invalid
        errorMessage="학번 형식이 올바르지 않아요"
      />,
    );
    const input = document.getElementById('student-id');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'student-id-error');
    const err = screen.getByRole('alert');
    expect(err).toHaveTextContent('학번 형식이 올바르지 않아요');
    expect(err).toHaveAttribute('id', 'student-id-error');
  });

  it('errorMessage 없을 때 aria-invalid · aria-describedby · alert 모두 없음', () => {
    render(<Input id="x" />);
    const input = document.getElementById('x');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('forwardRef 로 input DOM 참조를 전달한다 (react-hook-form 호환)', () => {
    const ref = createRef();
    render(<Input ref={ref} id="x" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('placeholder 는 그대로 전달되지만 라벨은 별도 (AI 슬롭 #15)', () => {
    render(
      <>
        <Label htmlFor="x">학번</Label>
        <Input id="x" placeholder="예: 20263701" />
      </>,
    );
    const input = screen.getByLabelText('학번');
    expect(input).toHaveAttribute('placeholder', '예: 20263701');
  });

  it('a11y 위반 없음 (Label + Input + 에러 메시지 결합)', async () => {
    const { container } = render(
      <>
        <Label htmlFor="student-id" required>
          학번
        </Label>
        <Input
          id="student-id"
          type="tel"
          inputMode="numeric"
          pattern="\d{8}"
          invalid
          errorMessage="학번 형식이 올바르지 않아요"
        />
      </>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
