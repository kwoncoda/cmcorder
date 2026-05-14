// Task 1.2 — Select atom 단위 테스트.
// COMPONENT_GUIDE.md §2.3 native <select> 우선.
// invalid + errorMessage 패턴은 Input 과 동일.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Select from '../Select.jsx';
import Label from '../Label.jsx';

describe('Select', () => {
  it('children 옵션이 렌더되고 기본값을 갖는다', () => {
    render(
      <Select id="bank" defaultValue="">
        <option value="">은행 선택</option>
        <option value="kb">국민은행</option>
        <option value="shinhan">신한은행</option>
      </Select>,
    );
    const select = document.getElementById('bank');
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByText('국민은행')).toBeInTheDocument();
    expect(screen.getByText('신한은행')).toBeInTheDocument();
  });

  it('값 변경 시 onChange 콜백이 호출된다', () => {
    const onChange = vi.fn();
    render(
      <Select id="bank" defaultValue="" onChange={onChange}>
        <option value="">선택</option>
        <option value="kb">국민</option>
        <option value="shinhan">신한</option>
      </Select>,
    );
    const select = document.getElementById('bank');
    fireEvent.change(select, { target: { value: 'kb' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select).toHaveValue('kb');
  });

  it('invalid + errorMessage 시 aria-invalid / aria-describedby / role=alert', () => {
    render(
      <Select id="bank" invalid errorMessage="은행을 선택해 주세요">
        <option value="">선택</option>
      </Select>,
    );
    const select = document.getElementById('bank');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', 'bank-error');
    const err = screen.getByRole('alert');
    expect(err).toHaveAttribute('id', 'bank-error');
    expect(err).toHaveTextContent('은행을 선택해 주세요');
  });

  it('forwardRef 로 select DOM 참조를 전달한다', () => {
    const ref = createRef();
    render(
      <Select ref={ref} id="x">
        <option value="">선택</option>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('a11y 위반 없음 (Label + Select + 에러)', async () => {
    const { container } = render(
      <>
        <Label htmlFor="bank" required>
          은행
        </Label>
        <Select id="bank" invalid errorMessage="필수 선택">
          <option value="">선택</option>
          <option value="kb">국민은행</option>
        </Select>
      </>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
