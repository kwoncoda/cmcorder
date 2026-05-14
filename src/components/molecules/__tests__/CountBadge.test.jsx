// Task 2.2 — CountBadge molecule 단위 테스트.
// COMPONENT_GUIDE §3.6.
// 숫자 표시 배지 (장바구니 개수 등). count > max 시 "{max}+".
// count 0 + hideZero → null (렌더 X).
// label prop 으로 SR a11y 라벨 ("{label} {count}개").
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import CountBadge from '../CountBadge.jsx';

describe('CountBadge', () => {
  // ── 기본 — 숫자 렌더 ──
  it('count=3 → "3" 렌더', () => {
    render(<CountBadge count={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // ── max 초과 ──
  it('max=9, count=99 → "9+" 렌더', () => {
    render(<CountBadge count={99} max={9} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  // ── hideZero ──
  it('count=0 + hideZero → null (렌더 X)', () => {
    const { container } = render(<CountBadge count={0} hideZero />);
    expect(container.firstChild).toBeNull();
  });

  it('count=0 + hideZero 없으면 "0" 렌더', () => {
    render(<CountBadge count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // ── aria-label 패턴 ──
  it('label prop 시 aria-label="{label} {count}개"', () => {
    render(<CountBadge count={3} label="장바구니 항목" />);
    const badge = screen.getByLabelText('장바구니 항목 3개');
    expect(badge).toBeInTheDocument();
  });

  // ── size 클래스 ──
  it('size="sm" 클래스 적용', () => {
    const { container } = render(<CountBadge count={3} size="sm" />);
    const badge = container.querySelector('span');
    expect(badge.className).toMatch(/\btext-2xs\b/);
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM span 참조 전달', () => {
    const ref = createRef();
    render(<CountBadge ref={ref} count={5} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<CountBadge count={3} label="장바구니 항목" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
