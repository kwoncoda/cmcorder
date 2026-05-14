// Task 1.3 — Divider atom 단위 테스트.
// COMPONENT_GUIDE.md §2.8 — solid / dashed / stamp 3 variant.
// label 시 가운데 텍스트 + 양쪽 줄 패턴, role=separator.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Divider from '../Divider.jsx';

describe('Divider', () => {
  it('기본 solid variant — hr 요소 + border-t 클래스', () => {
    render(<Divider data-testid="d" />);
    const d = screen.getByTestId('d');
    expect(d.tagName).toBe('HR');
    expect(d.className).toMatch(/\bborder-t\b/);
    expect(d.className).not.toMatch(/\bborder-dashed\b/);
  });

  it('dashed variant — border-dashed 클래스', () => {
    render(<Divider variant="dashed" data-testid="d" />);
    expect(screen.getByTestId('d').className).toMatch(/\bborder-dashed\b/);
  });

  it('stamp variant — border-stamp-red 클래스 (DESIGN 도장 톤)', () => {
    render(<Divider variant="stamp" data-testid="d" />);
    expect(screen.getByTestId('d').className).toMatch(/border-stamp-red/);
  });

  it('label 있으면 텍스트 + role=separator + aria-orientation=horizontal', () => {
    render(<Divider label="또는" />);
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal');
    expect(sep).toHaveTextContent('또는');
  });

  it('forwardRef로 DOM 참조 전달', () => {
    const ref = createRef();
    render(<Divider ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <>
        <Divider />
        <Divider variant="dashed" />
        <Divider variant="stamp" />
        <Divider label="또는" />
      </>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
