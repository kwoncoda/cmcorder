// Task 1.3 — Icon atom 단위 테스트.
// COMPONENT_GUIDE.md §2.6 / §3.5 8조 (lucide-react named import).
// Icon은 *얇은 래퍼* — children에 lucide-react SVG 컴포넌트 주입.
// label 시 role=img + aria-label, decorative 시 aria-hidden.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import { Map } from 'lucide-react';
import Icon from '../Icon.jsx';

describe('Icon', () => {
  it('children에 주입한 SVG가 렌더된다', () => {
    render(
      <Icon label="지도">
        <Map size={20} data-testid="map-svg" />
      </Icon>,
    );
    expect(screen.getByTestId('map-svg')).toBeInTheDocument();
  });

  it('label prop 시 role=img + aria-label 적용', () => {
    render(
      <Icon label="부스 약도 열기">
        <Map size={20} />
      </Icon>,
    );
    const wrapper = screen.getByRole('img');
    expect(wrapper).toHaveAttribute('aria-label', '부스 약도 열기');
    expect(wrapper).not.toHaveAttribute('aria-hidden');
  });

  it('decorative=true 시 aria-hidden + role 미부여', () => {
    const { container } = render(
      <Icon decorative>
        <Map size={20} />
      </Icon>,
    );
    const wrapper = container.firstChild;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).not.toHaveAttribute('role');
    expect(wrapper).not.toHaveAttribute('aria-label');
  });

  it('forwardRef로 DOM 참조 전달', () => {
    const ref = createRef();
    render(
      <Icon ref={ref} label="지도">
        <Map size={20} />
      </Icon>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <Icon label="부스 약도 열기">
        <Map size={20} />
      </Icon>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
