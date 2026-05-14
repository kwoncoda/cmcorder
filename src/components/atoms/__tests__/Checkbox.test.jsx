// Task 1.2 — Checkbox atom 단위 테스트.
// COMPONENT_GUIDE.md §2.4 — 라벨 hitbox 확장(56px) · 라벨과 input 명시적 연결.
// "□ 학번 없음 (외부인)" 패턴 (UX-7).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Checkbox from '../Checkbox.jsx';

describe('Checkbox', () => {
  it('label 텍스트가 보이고 input 과 htmlFor 로 연결된다', () => {
    render(<Checkbox id="no-id" label="학번 없음 (외부인)" />);
    const input = screen.getByLabelText('학번 없음 (외부인)');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute('type', 'checkbox');
    expect(input).toHaveAttribute('id', 'no-id');
  });

  it('체크 토글 시 onChange 가 호출된다 (controlled)', () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        id="x"
        label="쿠폰 사용"
        checked={false}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('쿠폰 사용'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('defaultChecked 전달 시 초기 상태가 체크됨', () => {
    render(<Checkbox id="x" label="기본 체크" defaultChecked />);
    expect(screen.getByLabelText('기본 체크')).toBeChecked();
  });

  it('forwardRef 로 input DOM 참조를 전달한다', () => {
    const ref = createRef();
    render(<Checkbox ref={ref} id="x" label="검사" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current.type).toBe('checkbox');
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <Checkbox id="no-id" label="학번 없음 (외부인)" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
