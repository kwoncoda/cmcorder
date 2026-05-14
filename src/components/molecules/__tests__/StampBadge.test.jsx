// Task 2.1 — StampBadge molecule 단위 테스트.
// COMPONENT_GUIDE.md §3.1 / DESIGN.md §8.1 / ADR-026 §8.1 / 결정 C (CSS 도장 — SVG X).
// 5 variant: recommended · sold-out · paid · done · canceled.
// 회전: variant 별 고정 -3~+3 deg (랜덤 대신 — 테스트 회귀 친화 + 디자인 일관성).
// 색: recommended/paid/done = stamp-green, sold-out/canceled = stamp-red.
// reduced motion: globals.css 가 transition-duration 0.01ms 강제 — 클래스 존재 회귀로 확인.
// 폰트: font-stencil (Black Ops One — fallback Pretendard).
// 접근성: role=img + aria-label="X 도장".
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import StampBadge from '../StampBadge.jsx';

describe('StampBadge', () => {
  // ── variant 별 텍스트 ──
  it.each([
    ['recommended', 'RECOMMENDED'],
    ['sold-out', 'SOLD OUT'],
    ['paid', 'PAID'],
    ['done', 'DONE'],
    ['canceled', 'CANCELED'],
  ])('variant=%s 시 "%s" 텍스트 렌더', (variant, expected) => {
    render(<StampBadge variant={variant} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  // ── variant 별 회전 각도 (inline style) ──
  it.each([
    ['recommended', '-3deg'],
    ['sold-out', '2deg'],
    ['paid', '-2deg'],
    ['done', '3deg'],
    ['canceled', '1deg'],
  ])('variant=%s 시 rotate(%s) inline style 적용', (variant, deg) => {
    const { container } = render(<StampBadge variant={variant} />);
    const stamp = container.querySelector('span');
    // 양수는 "2deg" 또는 "+2deg" 둘 다 허용. CSS rotate() 는 양쪽 모두 유효.
    expect(stamp.style.transform).toContain(`rotate(${deg})`);
  });

  // ── variant 별 색 클래스 ──
  it.each([
    ['recommended', 'stamp-green'],
    ['sold-out', 'stamp-red'],
    ['paid', 'stamp-green'],
    ['done', 'stamp-green'],
    ['canceled', 'stamp-red'],
  ])('variant=%s 시 색 클래스 %s 매핑', (variant, colorToken) => {
    const { container } = render(<StampBadge variant={variant} />);
    const stamp = container.querySelector('span');
    expect(stamp.className).toContain(`text-${colorToken}`);
    expect(stamp.className).toContain(`border-${colorToken}`);
  });

  // ── 접근성 ──
  it('role=img + aria-label="X 도장" 패턴 적용', () => {
    render(<StampBadge variant="sold-out" />);
    const stamp = screen.getByRole('img');
    expect(stamp).toHaveAttribute('aria-label', 'SOLD OUT 도장');
  });

  it('customLabel prop 으로 텍스트와 aria-label 동시 override', () => {
    render(<StampBadge variant="recommended" label="베스트" />);
    expect(screen.getByText('베스트')).toBeInTheDocument();
    expect(screen.queryByText('RECOMMENDED')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '베스트 도장');
  });

  // ── 회전은 inline style — Tailwind purge 안전 ──
  it('rotate transform 은 inline style (Tailwind arbitrary 회피)', () => {
    const { container } = render(<StampBadge variant="recommended" />);
    const stamp = container.querySelector('span');
    expect(stamp.style.transform).toMatch(/rotate\([+-]?\d+deg\)/);
  });

  // ── 폰트: font-stencil (Black Ops One — fallback) ──
  it('font-stencil 클래스 적용 (Black Ops One — fallback Pretendard)', () => {
    const { container } = render(<StampBadge variant="paid" />);
    const stamp = container.querySelector('span');
    expect(stamp.className).toMatch(/\bfont-stencil\b/);
  });

  // ── reduced motion 회귀: transition 클래스 존재 → globals.css 가 0.01ms 차단 가능 ──
  it('transition-transform + duration-stamp 클래스 존재 (reduced motion 무력화 대상)', () => {
    const { container } = render(<StampBadge variant="recommended" />);
    const stamp = container.querySelector('span');
    expect(stamp.className).toMatch(/\btransition-transform\b/);
    expect(stamp.className).toMatch(/\bduration-stamp\b/);
  });

  // ── 기본 variant (variant prop 누락 시) ──
  it('variant prop 누락 시 recommended 기본값', () => {
    render(<StampBadge />);
    expect(screen.getByText('RECOMMENDED')).toBeInTheDocument();
  });

  // ── 알 수 없는 variant fallback ──
  it('알 수 없는 variant 시 recommended fallback', () => {
    render(<StampBadge variant="unknown-variant" />);
    expect(screen.getByText('RECOMMENDED')).toBeInTheDocument();
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM span 참조 전달', () => {
    const ref = createRef();
    render(<StampBadge ref={ref} variant="done" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  // ── passthrough className ──
  it('className prop 으로 추가 클래스 합성', () => {
    const { container } = render(
      <StampBadge variant="paid" className="extra-class" />,
    );
    const stamp = container.querySelector('span');
    expect(stamp.className).toContain('extra-class');
  });

  // ── select-none (도장 미학) ──
  it('select-none 클래스 적용 (사용자 텍스트 선택 회피 — 도장 미학)', () => {
    const { container } = render(<StampBadge variant="canceled" />);
    const stamp = container.querySelector('span');
    expect(stamp.className).toMatch(/\bselect-none\b/);
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<StampBadge variant="paid" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
