// Task 1.3 — Spinner atom 단위 테스트.
// COMPONENT_GUIDE.md §2.7 / DESIGN §9.5 (reduced motion).
// role=status + aria-label, sm/md/lg 3 사이즈, motion-reduce 시 정적.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Spinner from '../Spinner.jsx';

describe('Spinner', () => {
  it('role=status + 기본 aria-label="로딩 중"', () => {
    render(<Spinner />);
    const sp = screen.getByRole('status');
    expect(sp).toHaveAttribute('aria-label', '로딩 중');
  });

  it('label prop 으로 aria-label 커스터마이즈', () => {
    render(<Spinner label="이체 확인 중" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '이체 확인 중');
  });

  it.each([
    ['sm', /w-3 h-3/],
    ['md', /w-4 h-4/],
    ['lg', /w-6 h-6/],
  ])('size %s 는 해당 크기 클래스를 갖는다', (size, pattern) => {
    render(<Spinner size={size} />);
    expect(screen.getByRole('status').className).toMatch(pattern);
  });

  it('animate-spin + motion-reduce:animate-none 클래스 모두 적용', () => {
    render(<Spinner />);
    const cls = screen.getByRole('status').className;
    expect(cls).toMatch(/\banimate-spin\b/);
    expect(cls).toMatch(/motion-reduce:animate-none/);
  });

  it('forwardRef로 DOM 참조 전달', () => {
    const ref = createRef();
    render(<Spinner ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<Spinner label="로딩 중" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
