// Task 1.2 — Label atom 단위 테스트.
// COMPONENT_GUIDE.md §2.5 / DESIGN.md §12.5 (placeholder 라벨 사용 X).
// htmlFor 연결 · required 별표 · aria-label="필수" · a11y axe 통과.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import Label from '../Label.jsx';

describe('Label', () => {
  it('htmlFor로 input 과 명시적 연결한다', () => {
    render(
      <>
        <Label htmlFor="student-id">학번</Label>
        <input id="student-id" />
      </>,
    );
    const lab = screen.getByText('학번');
    expect(lab).toHaveAttribute('for', 'student-id');
  });

  it('required=true 시 별표(*) 와 aria-label="필수" 가 표시된다', () => {
    render(
      <Label htmlFor="x" required>
        학번
      </Label>,
    );
    const star = screen.getByText('*');
    expect(star).toBeInTheDocument();
    expect(star).toHaveAttribute('aria-label', '필수');
  });

  it('required 기본값(false) 시 별표가 렌더되지 않는다', () => {
    render(<Label htmlFor="x">이름</Label>);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('자식 텍스트가 그대로 렌더된다', () => {
    render(<Label htmlFor="x">테이블 번호</Label>);
    expect(screen.getByText('테이블 번호')).toBeInTheDocument();
  });

  it('forwardRef 로 label DOM 참조를 전달한다', () => {
    const ref = createRef();
    render(
      <Label ref={ref} htmlFor="x">
        학번
      </Label>,
    );
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <>
        <Label htmlFor="student-id" required>
          학번
        </Label>
        <input id="student-id" />
      </>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
