// Task 2.2 — IconLabel molecule 단위 테스트.
// COMPONENT_GUIDE §3.3.
// 아이콘 + 텍스트 조합 — icon ReactNode 또는 string(이모지) 모두 지원.
// 이모지 string 은 자동 aria-hidden 처리. text 는 SR이 읽음.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import IconLabel from '../IconLabel.jsx';

describe('IconLabel', () => {
  // ── icon ReactNode + text ──
  it('icon ReactNode + text 렌더', () => {
    render(<IconLabel icon={<svg data-testid="custom-icon" />} text="부스 약도" />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('부스 약도')).toBeInTheDocument();
  });

  // ── icon string 이모지 + aria-hidden ──
  it('icon string(이모지) 시 자동 aria-hidden 적용', () => {
    render(<IconLabel icon="🗺️" text="부스 약도" />);
    const emoji = screen.getByText('🗺️');
    expect(emoji).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('부스 약도')).toBeInTheDocument();
  });

  // ── gap 클래스 ──
  it.each([
    ['xs', 'gap-2xs'],
    ['sm', 'gap-xs'],
    ['md', 'gap-sm'],
  ])('gap="%s" → "%s" 클래스 적용', (gap, expectedCls) => {
    const { container } = render(<IconLabel icon="🗺️" text="약도" gap={gap} />);
    const wrap = container.querySelector('span, div');
    expect(wrap.className).toContain(expectedCls);
  });

  // ── inline prop ──
  it('inline=true 시 inline-flex 적용', () => {
    const { container } = render(<IconLabel icon="🗺️" text="약도" inline />);
    const wrap = container.firstChild;
    expect(wrap.className).toMatch(/\binline-flex\b/);
  });

  it('inline=false (기본) 시 flex 적용', () => {
    const { container } = render(<IconLabel icon="🗺️" text="약도" />);
    const wrap = container.firstChild;
    expect(wrap.className).toMatch(/\bflex\b/);
    expect(wrap.className).not.toMatch(/\binline-flex\b/);
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM 참조 전달', () => {
    const ref = createRef();
    render(<IconLabel ref={ref} icon="🗺️" text="약도" />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<IconLabel icon="🗺️" text="부스 약도" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
