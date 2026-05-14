// Task 1.2 — Radio atom 단위 테스트.
// Checkbox 와 동일 패턴, type="radio". name 공유로 그룹 형성.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Radio from '../Radio.jsx';

describe('Radio', () => {
  it('label 과 input 이 htmlFor 로 연결되고 type="radio"', () => {
    render(
      <Radio id="dine-in" name="dine-type" value="dineIn" label="매장 식사" />,
    );
    const input = screen.getByLabelText('매장 식사');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute('type', 'radio');
    expect(input).toHaveAttribute('name', 'dine-type');
    expect(input).toHaveAttribute('value', 'dineIn');
  });

  it('동일 name 그룹 안에서 한 개만 선택된다', () => {
    const onChange = vi.fn();
    render(
      <>
        <Radio
          id="r-dineIn"
          name="dine-type"
          value="dineIn"
          label="매장"
          onChange={onChange}
        />
        <Radio
          id="r-takeout"
          name="dine-type"
          value="takeout"
          label="포장"
          onChange={onChange}
        />
      </>,
    );
    fireEvent.click(screen.getByLabelText('포장'));
    expect(screen.getByLabelText('포장')).toBeChecked();
    expect(screen.getByLabelText('매장')).not.toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('forwardRef 로 input DOM 참조를 전달한다', () => {
    const ref = createRef();
    render(
      <Radio ref={ref} id="x" name="g" value="v" label="옵션" />,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current.type).toBe('radio');
  });

  it('defaultChecked 전달 시 초기 상태가 선택됨', () => {
    render(
      <Radio
        id="x"
        name="g"
        value="v"
        label="기본 선택"
        defaultChecked
      />,
    );
    expect(screen.getByLabelText('기본 선택')).toBeChecked();
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <fieldset>
        <legend>식사 유형</legend>
        <Radio id="r1" name="dine" value="in" label="매장 식사" />
        <Radio id="r2" name="dine" value="out" label="포장" />
      </fieldset>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
